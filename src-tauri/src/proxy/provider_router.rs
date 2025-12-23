//! 供应商路由器模块
//!
//! 负责选择和管理代理目标供应商，实现智能故障转移

use crate::database::Database;
use crate::error::AppError;
use crate::provider::Provider;
use crate::proxy::circuit_breaker::CircuitBreaker;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// 供应商路由器
pub struct ProviderRouter {
    /// 数据库连接
    db: Arc<Database>,
    /// 熔断器管理器 - key 格式: "app_type:provider_id"
    circuit_breakers: Arc<RwLock<HashMap<String, Arc<CircuitBreaker>>>>,
}

impl ProviderRouter {
    /// 创建新的供应商路由器
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            db,
            circuit_breakers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 选择可用的供应商（支持故障转移）
    ///
    /// 逻辑：
    /// 1. 按队列顺序找到第一个未熔断的供应商
    /// 2. 直接使用该供应商，不检查其他供应商
    /// 3. 如果当前供应商熔断了，自动切换到下一个
    /// 4. 如果所有供应商都被熔断，返回错误
    /// 5. 后台任务会定期检查熔断供应商，恢复后自动切换回高优先级
    pub async fn select_providers(&self, app_type: &str) -> Result<Vec<Provider>, AppError> {
        // 0. 检查是否启用了自动故障转移
        let config = self.db.get_circuit_breaker_config().await.unwrap_or_default();
        if !config.enabled {
            log::info!(
                "[{}] 自动故障转移已禁用，使用当前供应商",
                app_type
            );
            return self.get_current_provider_only(app_type).await;
        }

        // 1. 自动同步模式：直接使用所有配置的供应商（按 sort_index 排序）
        let all_providers = self.db.get_all_providers(app_type)?;
        let failover_providers: Vec<_> = all_providers.into_values().collect();

        if failover_providers.is_empty() {
            log::warn!("[{}] 没有配置任何供应商", app_type);
            return self.get_current_provider_only(app_type).await;
        }

        log::debug!(
            "[{}] 自动同步模式，使用 {} 个供应商: [{}]",
            app_type,
            failover_providers.len(),
            failover_providers.iter().map(|p| p.name.as_str()).collect::<Vec<_>>().join(", ")
        );

        // 2. 找到第一个未熔断的供应商
        let mut first_available: Option<(usize, Provider)> = None;
        let mut circuit_open_providers = Vec::new();

        for (index, provider) in failover_providers.iter().enumerate() {
            let circuit_key = format!("{}:{}", app_type, provider.id);
            let breaker = self.get_or_create_circuit_breaker(&circuit_key).await;

            if breaker.allow_request().await {
                if first_available.is_none() {
                    first_available = Some((index, provider.clone()));
                    // 找到第一个可用的就停止，不继续检查其他供应商
                    break;
                }
            } else {
                circuit_open_providers.push(provider.name.clone());
            }
        }

        // 3. 如果找到可用供应商
        if let Some((index, provider)) = first_available {
            if index == 0 {
                log::info!(
                    "[{}] 使用最高优先级供应商: {}",
                    app_type,
                    provider.name
                );
            } else {
                log::info!(
                    "[{}] 故障转移到供应商: {} (优先级 {}，跳过熔断的: {})",
                    app_type,
                    provider.name,
                    index + 1,
                    circuit_open_providers.join(", ")
                );
            }
            return Ok(vec![provider]);
        }

        // 4. 所有供应商都被熔断，返回错误
        let provider_names: Vec<&str> = failover_providers
            .iter()
            .map(|p| p.name.as_str())
            .collect();

        log::error!(
            "[{}] 所有 {} 个供应商都被熔断: [{}]",
            app_type,
            failover_providers.len(),
            provider_names.join(", ")
        );

        Err(AppError::Config(format!(
            "所有接口都被熔断，连接失败。熔断的供应商: {}",
            provider_names.join(", ")
        )))
    }

    /// 记录供应商请求结果
    pub async fn record_result(
        &self,
        provider_id: &str,
        app_type: &str,
        success: bool,
        error_msg: Option<String>,
    ) -> Result<(), AppError> {
        // 1. 更新熔断器状态
        let circuit_key = format!("{app_type}:{provider_id}");
        let breaker = self.get_or_create_circuit_breaker(&circuit_key).await;

        if success {
            breaker.record_success().await;
            log::debug!("Provider {provider_id} request succeeded");
        } else {
            breaker.record_failure().await;
            log::warn!(
                "Provider {} request failed: {}",
                provider_id,
                error_msg.as_deref().unwrap_or("Unknown error")
            );
        }

        // 2. 更新数据库健康状态
        self.db
            .update_provider_health(provider_id, app_type, success, error_msg.clone())
            .await?;

        // 3. 如果连续失败达到熔断阈值，自动禁用代理目标
        if !success {
            let health = self.db.get_provider_health(provider_id, app_type).await?;

            // 获取熔断器配置
            let config = self.db.get_circuit_breaker_config().await.ok();
            let failure_threshold = config.map(|c| c.failure_threshold).unwrap_or(5);

            // 如果连续失败达到阈值，自动关闭该供应商的代理开关
            if health.consecutive_failures >= failure_threshold {
                log::warn!(
                    "Provider {} has failed {} times (threshold: {}), auto-disabling proxy target",
                    provider_id,
                    health.consecutive_failures,
                    failure_threshold
                );
                self.db
                    .set_proxy_target(provider_id, app_type, false)
                    .await?;
            }
        }

        Ok(())
    }

    /// 获取当前供应商（不使用故障转移队列）
    async fn get_current_provider_only(&self, app_type: &str) -> Result<Vec<Provider>, AppError> {
        let current_id = self
            .db
            .get_current_provider(app_type)?
            .ok_or_else(|| AppError::Config(format!("No current provider for {}", app_type)))?;

        let providers = self.db.get_all_providers(app_type)?;
        let provider = providers
            .get(&current_id)
            .ok_or_else(|| AppError::Config(format!("Current provider {} not found", current_id)))?
            .clone();

        log::info!(
            "[{}] 使用当前供应商: {} ({})",
            app_type,
            provider.name,
            provider.id
        );

        Ok(vec![provider])
    }

    /// 重置熔断器（手动恢复）
    #[allow(dead_code)]
    pub async fn reset_circuit_breaker(&self, circuit_key: &str) {
        let breakers = self.circuit_breakers.read().await;
        if let Some(breaker) = breakers.get(circuit_key) {
            log::info!("Manually resetting circuit breaker for {circuit_key}");
            breaker.reset().await;
        }
    }

    /// 重置熔断器（公开方法，供恢复检查器使用）
    pub async fn reset_circuit_breaker_pub(&self, circuit_key: &str) {
        let breakers = self.circuit_breakers.read().await;
        if let Some(breaker) = breakers.get(circuit_key) {
            log::info!("Resetting circuit breaker for {circuit_key} (recovery check)");
            breaker.reset().await;
        }
    }

    /// 获取或创建熔断器（公开方法，供恢复检查器使用）
    pub async fn get_or_create_circuit_breaker_pub(&self, key: &str) -> Arc<CircuitBreaker> {
        self.get_or_create_circuit_breaker(key).await
    }

    /// 获取熔断器状态
    #[allow(dead_code)]
    pub async fn get_circuit_breaker_stats(
        &self,
        provider_id: &str,
        app_type: &str,
    ) -> Option<crate::proxy::circuit_breaker::CircuitBreakerStats> {
        let circuit_key = format!("{app_type}:{provider_id}");
        let breakers = self.circuit_breakers.read().await;

        if let Some(breaker) = breakers.get(&circuit_key) {
            Some(breaker.get_stats().await)
        } else {
            None
        }
    }

    /// 获取或创建熔断器
    async fn get_or_create_circuit_breaker(&self, key: &str) -> Arc<CircuitBreaker> {
        // 先尝试读锁获取
        {
            let breakers = self.circuit_breakers.read().await;
            if let Some(breaker) = breakers.get(key) {
                return breaker.clone();
            }
        }

        // 如果不存在，获取写锁创建
        let mut breakers = self.circuit_breakers.write().await;

        // 双重检查，防止竞争条件
        if let Some(breaker) = breakers.get(key) {
            return breaker.clone();
        }

        // 从数据库加载配置
        let config = self
            .db
            .get_circuit_breaker_config()
            .await
            .unwrap_or_default();

        log::debug!("Creating new circuit breaker for {key} with config: {config:?}");

        let breaker = Arc::new(CircuitBreaker::new(config));
        breakers.insert(key.to_string(), breaker.clone());

        breaker
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::Database;

    #[tokio::test]
    async fn test_provider_router_creation() {
        let db = Arc::new(Database::memory().unwrap());
        let router = ProviderRouter::new(db);

        // 测试创建熔断器
        let breaker = router.get_or_create_circuit_breaker("claude:test").await;
        assert!(breaker.allow_request().await);
    }
}
