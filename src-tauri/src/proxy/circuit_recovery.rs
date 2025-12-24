//! 熔断器恢复检查模块
//!
//! 后台定时检查熔断的供应商，尝试恢复

use crate::database::Database;
use crate::proxy::provider_router::ProviderRouter;
use reqwest::Client;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

/// 熔断恢复检查器
pub struct CircuitRecoveryChecker {
    db: Arc<Database>,
    router: Arc<ProviderRouter>,
    client: Client,
    /// 是否正在运行
    running: Arc<RwLock<bool>>,
    /// 检查间隔（秒）
    check_interval_secs: u64,
}

impl CircuitRecoveryChecker {
    pub fn new(db: Arc<Database>, router: Arc<ProviderRouter>) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            db,
            router,
            client,
            running: Arc::new(RwLock::new(false)),
            check_interval_secs: 60, // 默认 1 分钟
        }
    }

    /// 启动后台恢复检查任务
    pub async fn start(&self) {
        // 检查是否已在运行
        {
            let mut running = self.running.write().await;
            if *running {
                log::warn!("熔断恢复检查器已在运行");
                return;
            }
            *running = true;
        }

        let db = self.db.clone();
        let router = self.router.clone();
        let client = self.client.clone();
        let running = self.running.clone();
        let interval = self.check_interval_secs;

        tokio::spawn(async move {
            log::info!("熔断恢复检查器启动，检查间隔: {}秒", interval);

            loop {
                // 检查是否应该停止
                if !*running.read().await {
                    log::info!("熔断恢复检查器停止");
                    break;
                }

                // 等待指定间隔
                tokio::time::sleep(Duration::from_secs(interval)).await;

                // 再次检查是否应该停止
                if !*running.read().await {
                    break;
                }

                // 执行恢复检查
                if let Err(e) = Self::check_and_recover(&db, &router, &client).await {
                    log::error!("熔断恢复检查失败: {}", e);
                }
            }
        });
    }

    /// 停止后台恢复检查任务
    pub async fn stop(&self) {
        *self.running.write().await = false;
        log::info!("熔断恢复检查器已请求停止");
    }

    /// 检查并尝试恢复熔断的供应商
    async fn check_and_recover(
        db: &Arc<Database>,
        router: &Arc<ProviderRouter>,
        client: &Client,
    ) -> Result<(), String> {
        // 获取熔断器配置
        let config = db.get_circuit_breaker_config().await.unwrap_or_default();
        if !config.enabled {
            log::debug!("自动故障转移已禁用，跳过恢复检查");
            return Ok(());
        }

        // 获取所有应用类型
        let app_types = vec!["claude"]; // TODO: 动态获取所有应用类型

        for app_type in app_types {
            // 自动同步模式：直接使用所有配置的供应商
            let failover_providers: Vec<crate::provider::Provider> = match db.get_all_providers(app_type) {
                Ok(all_providers) => all_providers.into_values().collect(),
                Err(e) => {
                    log::warn!("[{}] 获取所有供应商失败: {}", app_type, e);
                    continue;
                }
            };

            if failover_providers.is_empty() {
                continue;
            }

            // 检查每个供应商的熔断器状态
            let mut circuit_open_providers = Vec::new();

            for provider in &failover_providers {
                let circuit_key = format!("{}:{}", app_type, provider.id);
                let breaker = router.get_or_create_circuit_breaker_pub(&circuit_key).await;

                // 如果熔断器是 Open 状态，加入待检查列表
                if !breaker.allow_request().await {
                    circuit_open_providers.push(provider.clone());
                }
            }

            if circuit_open_providers.is_empty() {
                log::debug!("[{}] 没有熔断的供应商需要检查", app_type);
                continue;
            }

            log::info!(
                "[{}] 发现 {} 个熔断的供应商，开始恢复检查: {}",
                app_type,
                circuit_open_providers.len(),
                circuit_open_providers
                    .iter()
                    .map(|p| p.name.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            );

            // 对每个熔断的供应商发送测试请求
            for provider in circuit_open_providers {
                let result = Self::test_provider(client, &provider, app_type).await;

                match result {
                    Ok(()) => {
                        log::info!(
                            "[{}] 供应商 {} 测试成功，重置熔断器",
                            app_type,
                            provider.name
                        );

                        // 重置熔断器
                        let circuit_key = format!("{}:{}", app_type, provider.id);
                        router.reset_circuit_breaker_pub(&circuit_key).await;

                        // 更新健康状态
                        if let Err(e) = db
                            .update_provider_health(&provider.id, app_type, true, None)
                            .await
                        {
                            log::warn!("更新健康状态失败: {}", e);
                        }

                        // 检查是否是高优先级供应商恢复
                        if let Ok(queue) = db.get_failover_providers(app_type) {
                            if let Some(first) = queue.first() {
                                if first.id == provider.id {
                                    log::info!(
                                        "[{}] 最高优先级供应商 {} 已恢复，下次请求将自动切换",
                                        app_type,
                                        provider.name
                                    );
                                }
                            }
                        }
                    }
                    Err(e) => {
                        log::debug!(
                            "[{}] 供应商 {} 测试失败，保持熔断状态: {}",
                            app_type,
                            provider.name,
                            e
                        );
                    }
                }
            }
        }

        Ok(())
    }

    /// 测试供应商是否可用
    async fn test_provider(
        client: &Client,
        provider: &crate::provider::Provider,
        _app_type: &str,
    ) -> Result<(), String> {
        // 从 provider 配置中提取 base_url 和 api_key
        let settings = provider
            .settings_config
            .as_object()
            .ok_or("Invalid provider config")?;

        let base_url = settings
            .get("baseUrl")
            .and_then(|v| v.as_str())
            .ok_or("No baseUrl found")?;

        let api_key = settings
            .get("apiKey")
            .and_then(|v| v.as_str())
            .ok_or("No apiKey found")?;

        // 发送简单的测试请求
        // 使用一个轻量级的请求来测试连接（如 models 列表或简单的 messages 请求）
        let test_url = format!("{}/v1/messages", base_url.trim_end_matches('/'));

        let test_body = serde_json::json!({
            "model": "claude-3-haiku-20240307",
            "max_tokens": 1,
            "messages": [{"role": "user", "content": "test"}]
        });

        let response = client
            .post(&test_url)
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&test_body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = response.status();

        // 200-299 表示成功
        // 401/403 表示认证问题，但连接是通的
        // 429 表示限流，但连接是通的
        if status.is_success() || status.as_u16() == 401 || status.as_u16() == 403 || status.as_u16() == 429 {
            Ok(())
        } else if status.as_u16() >= 500 {
            Err(format!("Server error: {}", status))
        } else {
            // 其他 4xx 错误（如 400）可能是请求格式问题，但连接是通的
            Ok(())
        }
    }
}
