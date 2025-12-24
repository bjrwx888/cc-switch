@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================
echo    CC Switch 签名密钥生成工具
echo ============================================
echo.

set "KEY_DIR=%USERPROFILE%\.tauri"
set "KEY_PATH=%KEY_DIR%\cc-switch.key"

echo [信息] 密钥将保存到: %KEY_PATH%
echo.

:: 检查密钥是否已存在
if exist "%KEY_PATH%" (
    echo [警告] 密钥文件已存在!
    echo.
    set /p "OVERWRITE=是否覆盖现有密钥? (y/n): "
    if /i not "!OVERWRITE!"=="y" (
        echo 已取消操作
        pause
        exit /b 0
    )
    echo.
)

:: 创建目录
if not exist "%KEY_DIR%" (
    echo [信息] 创建目录: %KEY_DIR%
    mkdir "%KEY_DIR%"
    if !ERRORLEVEL! neq 0 (
        echo [错误] 无法创建目录!
        pause
        exit /b 1
    )
)

:: 检查 pnpm 是否可用
where pnpm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 pnpm，请先安装 pnpm
    pause
    exit /b 1
)

:: 生成密钥
echo.
echo [信息] 正在生成签名密钥...
echo [提示] 系统会要求你输入密码，请记住这个密码，构建时需要使用
echo.
echo 执行命令: pnpm tauri signer generate -w "%KEY_PATH%"
echo.

call pnpm tauri signer generate -w "%KEY_PATH%"
set "GEN_RESULT=%ERRORLEVEL%"

echo.
echo [调试] 命令返回值: %GEN_RESULT%

if %GEN_RESULT% neq 0 (
    echo.
    echo [错误] 密钥生成失败！返回码: %GEN_RESULT%
    echo.
    echo 可能的原因:
    echo - Tauri CLI 未安装，请运行: pnpm install
    echo - 密码输入为空或不匹配
    echo.
    pause
    exit /b 1
)

:: 检查文件是否生成
if not exist "%KEY_PATH%" (
    echo.
    echo [错误] 密钥文件未生成: %KEY_PATH%
    pause
    exit /b 1
)

if not exist "%KEY_PATH%.pub" (
    echo.
    echo [错误] 公钥文件未生成: %KEY_PATH%.pub
    pause
    exit /b 1
)

echo.
echo ============================================
echo    密钥生成成功!
echo ============================================
echo.
echo 私钥位置: %KEY_PATH%
echo 公钥位置: %KEY_PATH%.pub
echo.
echo ============================================
echo [重要] 请将以下公钥内容复制到 tauri.conf.json
echo        路径: plugins.updater.pubkey
echo ============================================
echo.
type "%KEY_PATH%.pub"
echo.
echo ============================================
echo.
echo [安全提醒]
echo - 私钥请妥善保管，不要提交到代码仓库
echo - 如果使用 GitHub Actions，请将私钥存入 Repository Secrets
echo   变量名: TAURI_SIGNING_PRIVATE_KEY
echo   密码变量: TAURI_SIGNING_PRIVATE_KEY_PASSWORD
echo.

pause
