@echo off
echo.
echo ========================================
echo   准备构建 CC Switch
echo ========================================
echo.
echo 正在打开 Visual Studio Developer 命令提示符...
echo 请在打开的窗口中运行以下命令:
echo.
echo   K:
echo   cd \cc-switch
echo   set PATH=%%USERPROFILE%%\.cargo\bin;%%PATH%%
echo   pnpm tauri build
echo.
pause

cmd.exe /k "C:\Program Files\Microsoft Visual Studio\18\Enterprise\Common7\Tools\VsDevCmd.bat" -arch=x64
