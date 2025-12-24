@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================
echo    CC Switch 自动构建发布脚本
echo ============================================
echo.

:: 配置区域 - 请根据实际情况修改
set "KEY_PATH=%USERPROFILE%\.tauri\cc-switch.key"
set "REPO_OWNER=bjrwx888"
set "REPO_NAME=cc-switch"

:: 检查密钥文件是否存在
if not exist "%KEY_PATH%" (
    echo [错误] 未找到签名密钥文件: %KEY_PATH%
    echo.
    echo 请先生成密钥对，运行以下命令:
    echo   pnpm tauri signer generate -w "%KEY_PATH%"
    echo.
    echo 生成后请妥善保管私钥，公钥需要填入 tauri.conf.json 的 plugins.updater.pubkey
    pause
    exit /b 1
)

:: 从 tauri.conf.json 读取版本号
for /f "tokens=2 delims=:," %%a in ('findstr /c:"\"version\"" src-tauri\tauri.conf.json') do (
    set "VERSION=%%~a"
    set "VERSION=!VERSION: =!"
    set "VERSION=!VERSION:"=!"
    goto :found_version
)
:found_version
echo [信息] 当前版本: v%VERSION%
echo.

:: 询问是否继续
set /p "CONFIRM=是否开始构建 v%VERSION%? (y/n): "
if /i not "%CONFIRM%"=="y" (
    echo 已取消构建
    exit /b 0
)

:: 输入密钥密码
echo.
set /p "KEY_PASSWORD=请输入签名密钥密码: "
if "%KEY_PASSWORD%"=="" (
    echo [错误] 密码不能为空
    pause
    exit /b 1
)

:: 设置签名环境变量
echo.
echo [步骤 1/4] 设置签名环境变量...
for /f "delims=" %%i in ('type "%KEY_PATH%"') do (
    set "TAURI_SIGNING_PRIVATE_KEY=%%i"
)
set "TAURI_SIGNING_PRIVATE_KEY_PASSWORD=%KEY_PASSWORD%"

:: 读取完整的私钥内容（多行）
set "TAURI_SIGNING_PRIVATE_KEY="
for /f "usebackq delims=" %%i in ("%KEY_PATH%") do (
    if defined TAURI_SIGNING_PRIVATE_KEY (
        set "TAURI_SIGNING_PRIVATE_KEY=!TAURI_SIGNING_PRIVATE_KEY!%%i"
    ) else (
        set "TAURI_SIGNING_PRIVATE_KEY=%%i"
    )
)

:: 清理旧构建
echo [步骤 2/4] 清理旧构建文件...
if exist "src-tauri\target\release\bundle" (
    rmdir /s /q "src-tauri\target\release\bundle" 2>nul
)

:: 安装依赖
echo [步骤 3/4] 检查并安装依赖...
call pnpm install

:: 开始构建
echo [步骤 4/4] 开始构建...
echo.
call pnpm tauri build

if %ERRORLEVEL% neq 0 (
    echo.
    echo [错误] 构建失败！
    pause
    exit /b 1
)

:: 查找构建产物
echo.
echo ============================================
echo    构建完成！
echo ============================================
echo.
echo 构建产物位置:
echo.

set "BUNDLE_PATH=src-tauri\target\release\bundle"

:: NSIS 安装包
if exist "%BUNDLE_PATH%\nsis\*.exe" (
    echo [NSIS 安装包]
    for %%f in ("%BUNDLE_PATH%\nsis\*.exe") do (
        echo   %%f
    )
    for %%f in ("%BUNDLE_PATH%\nsis\*.sig") do (
        echo   %%f (签名)
    )
    echo.
)

:: MSI 安装包
if exist "%BUNDLE_PATH%\msi\*.msi" (
    echo [MSI 安装包]
    for %%f in ("%BUNDLE_PATH%\msi\*.msi") do (
        echo   %%f
    )
    for %%f in ("%BUNDLE_PATH%\msi\*.sig") do (
        echo   %%f (签名)
    )
    echo.
)

:: 生成 latest.json
echo [步骤 5] 生成 latest.json...
call :generate_latest_json

echo.
echo [latest.json]
echo   %BUNDLE_PATH%\latest.json
echo.

echo ============================================
echo 下一步操作:
echo 1. 在 GitHub 创建新的 Release，标签为 v%VERSION%
echo 2. 上传以下文件到 Release:
echo    - NSIS 安装包 (.exe)
echo    - latest.json
echo 3. 发布 Release
echo ============================================
echo.

:: 询问是否打开输出目录
set /p "OPEN_DIR=是否打开构建输出目录? (y/n): "
if /i "%OPEN_DIR%"=="y" (
    explorer "%CD%\%BUNDLE_PATH%"
)

pause
exit /b 0

:: 生成 latest.json 的函数
:generate_latest_json
setlocal enabledelayedexpansion

set "OUTPUT_FILE=%BUNDLE_PATH%\latest.json"
set "BASE_URL=https://github.com/%REPO_OWNER%/%REPO_NAME%/releases/download/v%VERSION%"

:: 获取当前时间 (ISO 8601 格式)
for /f "tokens=1-3 delims=/ " %%a in ('date /t') do set "DATESTAMP=%%c-%%a-%%b"
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set "TIMESTAMP=%%a:%%b:00Z"
set "PUB_DATE=%DATESTAMP%T%TIMESTAMP%"

:: 查找 NSIS exe 文件名和签名
set "NSIS_FILE="
set "NSIS_SIG="
for %%f in ("%BUNDLE_PATH%\nsis\*_x64-setup.exe") do (
    set "NSIS_FILE=%%~nxf"
)
for %%f in ("%BUNDLE_PATH%\nsis\*_x64-setup.exe.sig") do (
    for /f "delims=" %%s in ('type "%%f"') do set "NSIS_SIG=%%s"
)

:: 生成 JSON 文件
(
echo {
echo   "version": "%VERSION%",
echo   "notes": "v%VERSION% Release",
echo   "pub_date": "%PUB_DATE%",
echo   "platforms": {
echo     "windows-x86_64": {
echo       "signature": "%NSIS_SIG%",
echo       "url": "%BASE_URL%/%NSIS_FILE%"
echo     }
echo   }
echo }
) > "%OUTPUT_FILE%"

endlocal
goto :eof
