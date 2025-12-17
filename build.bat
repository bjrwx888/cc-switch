@echo off
echo Starting Tauri build process...
echo.

cd /d "K:\cc-switch"

REM Add Cargo to PATH
set PATH=%USERPROFILE%\.cargo\bin;%PATH%

REM Verify cargo is available
echo Checking for cargo...
cargo --version
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: cargo not found!
    pause
    exit /b 1
)

echo.
echo Starting build...
pnpm tauri build

echo.
echo Build process completed!
pause
