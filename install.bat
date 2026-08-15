@echo off
REM ==============================================================================
REM SLR Magic - Windows Installer Launcher
REM ==============================================================================
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Setup failed with error code %ERRORLEVEL%.
    pause
    exit /b %ERRORLEVEL%
)

endlocal
