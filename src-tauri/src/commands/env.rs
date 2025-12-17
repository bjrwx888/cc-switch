use crate::services::env_checker::{check_env_conflicts as check_conflicts, EnvConflict};
use crate::services::env_manager::{
    delete_env_vars as delete_vars, restore_from_backup, BackupInfo,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;

/// Check environment variable conflicts for a specific app
#[tauri::command]
pub fn check_env_conflicts(app: String) -> Result<Vec<EnvConflict>, String> {
    check_conflicts(&app)
}

/// Delete environment variables with backup
#[tauri::command]
pub fn delete_env_vars(conflicts: Vec<EnvConflict>) -> Result<BackupInfo, String> {
    delete_vars(conflicts)
}

/// Restore environment variables from backup file
#[tauri::command]
pub fn restore_env_backup(backup_path: String) -> Result<(), String> {
    restore_from_backup(backup_path)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GlobalApiConfig {
    pub api_key: String,
    pub external_ip: Option<String>,
}

/// Save global API key and external IP to all three config files
#[tauri::command]
pub fn save_global_api_config(api_key: String, external_ip: Option<String>) -> Result<(), String> {
    // 构建环境变量值
    let env_value = if let Some(ref ip) = external_ip {
        format!("{}|{}", api_key, ip)
    } else {
        api_key.clone()
    };

    // 1. 保存到 Claude Code 配置 (~/.claude/settings.json)
    save_to_claude_config(&env_value)?;

    // 2. 保存到 Codex 配置 (~/.codex/auth.json)
    save_to_codex_config(&env_value)?;

    // 3. 保存到 Gemini 配置 (~/.gemini/.env)
    save_to_gemini_config(&env_value)?;

    // 设置系统环境变量
    std::env::set_var("ANTHROPIC_AUTH_TOKEN", &env_value);
    log::info!("Global API config saved to all configuration files");
    log::info!("Environment variable ANTHROPIC_AUTH_TOKEN set");

    Ok(())
}

/// Load global API config from Claude settings
#[tauri::command]
pub fn load_global_api_config() -> Result<GlobalApiConfig, String> {
    // 从 Claude 配置读取
    let claude_path = crate::config::get_claude_settings_path();

    if !claude_path.exists() {
        return Ok(GlobalApiConfig {
            api_key: String::new(),
            external_ip: None,
        });
    }

    let content = fs::read_to_string(&claude_path)
        .map_err(|e| format!("读取 Claude 配置文件失败: {}", e))?;

    let settings: Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析 Claude 配置文件失败: {}", e))?;

    // 从 env.ANTHROPIC_AUTH_TOKEN 读取
    if let Some(env_obj) = settings.get("env").and_then(|v| v.as_object()) {
        if let Some(auth_token) = env_obj.get("ANTHROPIC_AUTH_TOKEN").and_then(|v| v.as_str()) {
            // 解析格式：api_key 或 api_key|external_ip
            if let Some((api_key, external_ip)) = auth_token.split_once('|') {
                return Ok(GlobalApiConfig {
                    api_key: api_key.to_string(),
                    external_ip: Some(external_ip.to_string()),
                });
            } else {
                return Ok(GlobalApiConfig {
                    api_key: auth_token.to_string(),
                    external_ip: None,
                });
            }
        }
    }

    Ok(GlobalApiConfig {
        api_key: String::new(),
        external_ip: None,
    })
}

/// 保存到 Claude Code 配置文件
fn save_to_claude_config(env_value: &str) -> Result<(), String> {
    let settings_path = crate::config::get_claude_settings_path();

    // 读取现有配置或创建新配置
    let mut settings: Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("读取 Claude 配置失败: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("解析 Claude 配置失败: {}", e))?
    } else {
        serde_json::json!({})
    };

    // 确保 env 对象存在
    if !settings.is_object() {
        settings = serde_json::json!({});
    }
    let obj = settings.as_object_mut().unwrap();
    if !obj.contains_key("env") {
        obj.insert("env".to_string(), serde_json::json!({}));
    }

    // 设置 ANTHROPIC_AUTH_TOKEN
    if let Some(env_obj) = obj.get_mut("env").and_then(|v| v.as_object_mut()) {
        env_obj.insert(
            "ANTHROPIC_AUTH_TOKEN".to_string(),
            Value::String(env_value.to_string()),
        );
    }

    // 确保目录存在
    if let Some(parent) = settings_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建 Claude 配置目录失败: {}", e))?;
    }

    // 保存文件
    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化 Claude 配置失败: {}", e))?;
    fs::write(&settings_path, json)
        .map_err(|e| format!("写入 Claude 配置文件失败: {}", e))?;

    log::info!("Saved to Claude config: {}", settings_path.display());
    Ok(())
}

/// 保存到 Codex 配置文件
fn save_to_codex_config(env_value: &str) -> Result<(), String> {
    let auth_path = crate::codex_config::get_codex_auth_path();

    // 读取现有配置或创建新配置
    let mut auth: Value = if auth_path.exists() {
        let content = fs::read_to_string(&auth_path)
            .map_err(|e| format!("读取 Codex 配置失败: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("解析 Codex 配置失败: {}", e))?
    } else {
        serde_json::json!({})
    };

    // 设置 ANTHROPIC_AUTH_TOKEN
    if !auth.is_object() {
        auth = serde_json::json!({});
    }
    auth["ANTHROPIC_AUTH_TOKEN"] = Value::String(env_value.to_string());

    // 确保目录存在
    if let Some(parent) = auth_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建 Codex 配置目录失败: {}", e))?;
    }

    // 保存文件
    let json = serde_json::to_string_pretty(&auth)
        .map_err(|e| format!("序列化 Codex 配置失败: {}", e))?;
    fs::write(&auth_path, json)
        .map_err(|e| format!("写入 Codex 配置文件失败: {}", e))?;

    log::info!("Saved to Codex config: {}", auth_path.display());
    Ok(())
}

/// 保存到 Gemini 配置文件
fn save_to_gemini_config(env_value: &str) -> Result<(), String> {
    let env_path = crate::gemini_config::get_gemini_env_path();

    // 读取现有 .env 文件
    let mut env_map: HashMap<String, String> = if env_path.exists() {
        let content = fs::read_to_string(&env_path)
            .map_err(|e| format!("读取 Gemini 配置失败: {}", e))?;
        crate::gemini_config::parse_env_file(&content)
    } else {
        HashMap::new()
    };

    // 设置 ANTHROPIC_AUTH_TOKEN
    env_map.insert("ANTHROPIC_AUTH_TOKEN".to_string(), env_value.to_string());

    // 构建 .env 文件内容
    let mut lines: Vec<String> = env_map
        .iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect();
    lines.sort(); // 保持一致的顺序

    let content = lines.join("\n") + "\n";

    // 确保目录存在
    if let Some(parent) = env_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建 Gemini 配置目录失败: {}", e))?;
    }

    // 保存文件
    fs::write(&env_path, content)
        .map_err(|e| format!("写入 Gemini 配置文件失败: {}", e))?;

    log::info!("Saved to Gemini config: {}", env_path.display());
    Ok(())
}
