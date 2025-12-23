//! 代理服务相关的 Tauri 命令
//!
//! 提供前端调用的 API 接口

use crate::provider::Provider;
use crate::proxy::types::*;
use crate::proxy::{CircuitBreakerConfig, CircuitBreakerStats};
use crate::store::AppState;

/// 启动代理服务器（监控模式 - 不接管 Live 配置）
#[tauri::command]
pub async fn start_proxy_monitoring(
    state: tauri::State<'_, AppState>,
) -> Result<ProxyServerInfo, String> {
    // 设置代理目标（用于热切换）
    if let Err(e) = state.proxy_service.setup_monitoring_targets().await {
        log::warn!("设置监控模式代理目标失败: {}", e);
    }

    // 仅启动代理服务器，不接管 Live 配置
    state.proxy_service.start().await
}

/// 启动代理服务器（接管模式 - 自动接管 Live 配置）
#[tauri::command]
pub async fn start_proxy_with_takeover(
    state: tauri::State<'_, AppState>,
) -> Result<ProxyServerInfo, String> {
    state.proxy_service.start_with_takeover().await
}

/// 停止代理服务器（恢复 Live 配置）
#[tauri::command]
pub async fn stop_proxy_with_restore(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.proxy_service.stop_with_restore().await
}

/// 获取代理服务器状态
#[tauri::command]
pub async fn get_proxy_status(state: tauri::State<'_, AppState>) -> Result<ProxyStatus, String> {
    state.proxy_service.get_status().await
}

/// 获取代理配置
#[tauri::command]
pub async fn get_proxy_config(state: tauri::State<'_, AppState>) -> Result<ProxyConfig, String> {
    state.proxy_service.get_config().await
}

/// 更新代理配置
#[tauri::command]
pub async fn update_proxy_config(
    state: tauri::State<'_, AppState>,
    config: ProxyConfig,
) -> Result<(), String> {
    state.proxy_service.update_config(&config).await
}

/// 检查代理服务器是否正在运行
#[tauri::command]
pub async fn is_proxy_running(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    Ok(state.proxy_service.is_running().await)
}

/// 检查是否处于 Live 接管模式
#[tauri::command]
pub async fn is_live_takeover_active(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    state.proxy_service.is_takeover_active().await
}

/// 代理模式下切换供应商（热切换）
#[tauri::command]
pub async fn switch_proxy_provider(
    state: tauri::State<'_, AppState>,
    app_type: String,
    provider_id: String,
) -> Result<(), String> {
    state
        .proxy_service
        .switch_proxy_target(&app_type, &provider_id)
        .await
}

// ==================== 故障转移相关命令 ====================

/// 获取代理目标列表（自动同步模式：返回所有正常的供应商，过滤熔断的）
#[tauri::command]
pub async fn get_proxy_targets(
    state: tauri::State<'_, AppState>,
    app_type: String,
) -> Result<Vec<Provider>, String> {
    let db = &state.db;
    // 获取所有供应商
    let all_providers = db.get_all_providers(&app_type)
        .map_err(|e| e.to_string())?;

    // 过滤掉熔断的供应商（consecutive_failures >= failure_threshold）
    let config = db.get_circuit_breaker_config().await.unwrap_or_default();
    let failure_threshold = config.failure_threshold;

    let mut healthy_providers = Vec::new();
    for provider in all_providers.into_values() {
        // 检查健康状态
        match db.get_provider_health(&provider.id, &app_type).await {
            Ok(health) => {
                // 如果连续失败次数小于阈值，认为是正常的
                if health.consecutive_failures < failure_threshold {
                    healthy_providers.push(provider);
                }
            }
            Err(_) => {
                // 没有健康记录，认为是正常的（新供应商）
                healthy_providers.push(provider);
            }
        }
    }

    Ok(healthy_providers)
}

/// 设置代理目标
#[tauri::command]
pub async fn set_proxy_target(
    state: tauri::State<'_, AppState>,
    provider_id: String,
    app_type: String,
    enabled: bool,
) -> Result<(), String> {
    let db = &state.db;

    // 设置代理目标状态
    db.set_proxy_target(&provider_id, &app_type, enabled)
        .await
        .map_err(|e| e.to_string())?;

    // 如果是禁用代理目标，重置健康状态
    if !enabled {
        log::info!(
            "Resetting health status for provider {provider_id} (app: {app_type}) after disabling proxy target"
        );
        if let Err(e) = db.reset_provider_health(&provider_id, &app_type).await {
            log::warn!("Failed to reset provider health: {e}");
        }
    }

    Ok(())
}

/// 获取供应商健康状态
#[tauri::command]
pub async fn get_provider_health(
    state: tauri::State<'_, AppState>,
    provider_id: String,
    app_type: String,
) -> Result<ProviderHealth, String> {
    let db = &state.db;
    db.get_provider_health(&provider_id, &app_type)
        .await
        .map_err(|e| e.to_string())
}

/// 重置熔断器
#[tauri::command]
pub async fn reset_circuit_breaker(
    state: tauri::State<'_, AppState>,
    provider_id: String,
    app_type: String,
) -> Result<(), String> {
    // 重置数据库健康状态
    let db = &state.db;
    db.update_provider_health(&provider_id, &app_type, true, None)
        .await
        .map_err(|e| e.to_string())?;

    // 注意：熔断器状态在内存中，重启代理服务器后会重置
    // 如果代理服务器正在运行，需要通知它重置熔断器
    // 目前先通过数据库重置健康状态，熔断器会在下次超时后自动尝试半开

    Ok(())
}

/// 获取熔断器配置
#[tauri::command]
pub async fn get_circuit_breaker_config(
    state: tauri::State<'_, AppState>,
) -> Result<CircuitBreakerConfig, String> {
    let db = &state.db;
    db.get_circuit_breaker_config()
        .await
        .map_err(|e| e.to_string())
}

/// 更新熔断器配置
#[tauri::command]
pub async fn update_circuit_breaker_config(
    state: tauri::State<'_, AppState>,
    config: CircuitBreakerConfig,
) -> Result<(), String> {
    let db = &state.db;
    db.update_circuit_breaker_config(&config)
        .await
        .map_err(|e| e.to_string())
}

/// 获取熔断器统计信息（仅当代理服务器运行时）
#[tauri::command]
pub async fn get_circuit_breaker_stats(
    state: tauri::State<'_, AppState>,
    provider_id: String,
    app_type: String,
) -> Result<Option<CircuitBreakerStats>, String> {
    // 这个功能需要访问运行中的代理服务器的内存状态
    // 目前先返回 None，后续可以通过 ProxyService 暴露接口来实现
    let _ = (state, provider_id, app_type);
    Ok(None)
}

/// 测试供应商连接是否正常
#[tauri::command]
pub async fn test_provider_connection(
    state: tauri::State<'_, AppState>,
    provider_id: String,
    app_type: String,
) -> Result<bool, String> {
    let db = &state.db;

    // 获取供应商信息
    let provider = db
        .get_provider_by_id(&provider_id, &app_type)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Provider {} not found", provider_id))?;

    // 从 provider 配置中提取 base_url 和 api_key
    let settings = provider
        .settings_config
        .as_object()
        .ok_or("Invalid provider config")?;

    let base_url = settings
        .get("baseUrl")
        .and_then(|v| v.as_str())
        .ok_or("No baseUrl found in provider config")?;

    let api_key = settings
        .get("apiKey")
        .and_then(|v| v.as_str())
        .ok_or("No apiKey found in provider config")?;

    // 创建 HTTP 客户端
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // 发送测试请求
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

    // 判断是否成功
    // 200-299 表示成功
    // 401/403 表示认证问题，但连接是通的
    // 429 表示限流，但连接是通的
    // 其他 4xx 错误可能是请求格式问题，但连接是通的
    let success = status.is_success()
        || status.as_u16() == 401
        || status.as_u16() == 403
        || status.as_u16() == 429
        || (status.as_u16() >= 400 && status.as_u16() < 500);

    // 更新健康状态
    if success {
        let _ = db
            .update_provider_health(&provider_id, &app_type, true, None)
            .await;
        log::info!(
            "Provider {} ({}) test passed, status: {}",
            provider.name,
            provider_id,
            status
        );
    } else {
        let error_msg = format!("Server error: {}", status);
        let _ = db
            .update_provider_health(&provider_id, &app_type, false, Some(error_msg.clone()))
            .await;
        log::warn!(
            "Provider {} ({}) test failed: {}",
            provider.name,
            provider_id,
            error_msg
        );
    }

    Ok(success)
}
