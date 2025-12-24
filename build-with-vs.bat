@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ===================================
echo  CC Switch Tauri Build Script
echo ===================================
echo.
echo 日志将保存到: build-log.txt
echo.

cd /d "K:\cc-switch"

REM 创建日志文件
set "LOGFILE=build-log.txt"
echo Build started at %date% %time% > "%LOGFILE%"

REM 保存 Cargo 路径
set "CARGO_HOME=%USERPROFILE%\.cargo"
set "CARGO_BIN=%CARGO_HOME%\bin"

echo [1/5] 检查 Cargo 是否存在...
echo [1/5] 检查 Cargo 是否存在... >> "%LOGFILE%"

if exist "%CARGO_BIN%\cargo.exe" (
    echo    ✓ Cargo 找到: %CARGO_BIN%\cargo.exe
    echo    ✓ Cargo 找到: %CARGO_BIN%\cargo.exe >> "%LOGFILE%"
) else (
    echo    ✗ 错误: Cargo 未找到!
    echo    ✗ 错误: Cargo 未找到! >> "%LOGFILE%"
    echo.
    echo 请确认 Rust 已正确安装。
    echo 安装路径应该是: %CARGO_BIN%
    pause
    exit /b 1
)

echo.
echo [2/5] 设置 Visual Studio 2025 环境...
echo [2/5] 设置 Visual Studio 2025 环境... >> "%LOGFILE%"

set "VS_DEV_CMD=C:\Program Files\Microsoft Visual Studio\18\Enterprise\Common7\Tools\VsDevCmd.bat"

if exist "%VS_DEV_CMD%" (
    echo    ✓ VS Dev环境脚本找到
    echo    ✓ VS Dev环境脚本找到 >> "%LOGFILE%"

    echo    正在初始化 Visual Studio 环境...
    call "%VS_DEV_CMD%" -arch=x64 -host_arch=x64 >> "%LOGFILE%" 2>&1

    if !ERRORLEVEL! EQU 0 (
        echo    ✓ Visual Studio 环境设置成功
        echo    ✓ Visual Studio 环境设置成功 >> "%LOGFILE%"
    ) else (
        echo    ✗ Visual Studio 环境设置失败
        echo    ✗ Visual Studio 环境设置失败 >> "%LOGFILE%"
        pause
        exit /b 1
    )
) else (
    echo    ✗ 错误: VS Dev环境脚本未找到!
    echo    ✗ 错误: VS Dev环境脚本未找到! >> "%LOGFILE%"
    echo    期望路径: %VS_DEV_CMD%
    pause
    exit /b 1
)

REM 将 Cargo 重新添加到 PATH 前面
set "PATH=%CARGO_BIN%;%PATH%"

echo.
echo [3/5] 验证构建工具...
echo [3/5] 验证构建工具... >> "%LOGFILE%"

echo    检查 Cargo...
"%CARGO_BIN%\cargo.exe" --version >> "%LOGFILE%" 2>&1
if !ERRORLEVEL! EQU 0 (
    for /f "delims=" %%i in ('"%CARGO_BIN%\cargo.exe" --version') do echo    ✓ %%i
    for /f "delims=" %%i in ('"%CARGO_BIN%\cargo.exe" --version') do echo    ✓ %%i >> "%LOGFILE%"
) else (
    echo    ✗ Cargo 命令执行失败
    echo    ✗ Cargo 命令执行失败 >> "%LOGFILE%"
    pause
    exit /b 1
)

echo    检查 Rustc...
"%CARGO_BIN%\rustc.exe" --version >> "%LOGFILE%" 2>&1
if !ERRORLEVEL! EQU 0 (
    for /f "delims=" %%i in ('"%CARGO_BIN%\rustc.exe" --version') do echo    ✓ %%i
    for /f "delims=" %%i in ('"%CARGO_BIN%\rustc.exe" --version') do echo    ✓ %%i >> "%LOGFILE%"
) else (
    echo    ✗ Rustc 命令执行失败
    pause
    exit /b 1
)

echo    检查 MSVC 链接器...
where link.exe >> "%LOGFILE%" 2>&1
where link.exe | findstr /i "Microsoft Visual Studio" >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    for /f "delims=" %%i in ('where link.exe ^| findstr /i "Microsoft Visual Studio"') do echo    ✓ MSVC link.exe: %%i
    for /f "delims=" %%i in ('where link.exe ^| findstr /i "Microsoft Visual Studio"') do echo    ✓ MSVC link.exe: %%i >> "%LOGFILE%"
) else (
    echo    ✗ 警告: MSVC 链接器未在 PATH 中找到
    echo    ✗ 警告: MSVC 链接器未在 PATH 中找到 >> "%LOGFILE%"
    echo.
    echo 这可能导致构建失败。请检查 Visual Studio 安装。
    pause
)

echo.
echo [4/5] 检查 pnpm 和 Node.js...
echo [4/5] 检查 pnpm 和 Node.js... >> "%LOGFILE%"

pnpm --version >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    for /f "delims=" %%i in ('pnpm --version') do echo    ✓ pnpm: %%i
    for /f "delims=" %%i in ('pnpm --version') do echo    ✓ pnpm: %%i >> "%LOGFILE%"
) else (
    echo    ✗ pnpm 未找到
    echo    ✗ pnpm 未找到 >> "%LOGFILE%"
    pause
    exit /b 1
)

node --version >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    for /f "delims=" %%i in ('node --version') do echo    ✓ Node.js: %%i
    for /f "delims=" %%i in ('node --version') do echo    ✓ Node.js: %%i >> "%LOGFILE%"
) else (
    echo    ✗ Node.js 未找到
    echo    ✗ Node.js 未找到 >> "%LOGFILE%"
    pause
    exit /b 1
)

echo.
echo [5/5] 开始 Tauri 构建...
echo [5/5] 开始 Tauri 构建... >> "%LOGFILE%"
echo.
echo 这将需要 5-15 分钟（首次构建更久）...
echo 请勿关闭此窗口！
echo.
echo 详细输出正在写入日志文件: %LOGFILE%
echo.

pnpm tauri build >> "%LOGFILE%" 2>&1

if !ERRORLEVEL! EQU 0 (
    echo.
    echo ===================================
    echo  ✓✓✓ 构建成功！✓✓✓
    echo ===================================
    echo.
    echo 生成的文件:
    echo.

    if exist "src-tauri\target\release\CC Switch.exe" (
        echo [EXE] src-tauri\target\release\CC Switch.exe
        for %%A in ("src-tauri\target\release\CC Switch.exe") do echo       大小: %%~zA 字节
    )

    if exist "src-tauri\target\release\bundle\msi" (
        echo.
        echo [MSI] src-tauri\target\release\bundle\msi\
        dir /b "src-tauri\target\release\bundle\msi\*.msi" 2>nul
    )

    if exist "src-tauri\target\release\bundle\nsis" (
        echo.
        echo [NSIS] src-tauri\target\release\bundle\nsis\
        dir /b "src-tauri\target\release\bundle\nsis\*-setup.exe" 2>nul
    )

    echo.
    echo 构建成功！>> "%LOGFILE%"
) else (
    echo.
    echo ===================================
    echo  ✗✗✗ 构建失败！✗✗✗
    echo ===================================
    echo.
    echo 请查看日志文件获取详细错误信息:
    echo    %CD%\%LOGFILE%
    echo.
    echo 最后 30 行日志:
    echo --------------------------------
    powershell -Command "Get-Content '%LOGFILE%' -Tail 30"
    echo --------------------------------
    echo.
    echo 构建失败！>> "%LOGFILE%"
)

echo.
echo 完整日志已保存到: %LOGFILE%
echo.
pause
endlocal
