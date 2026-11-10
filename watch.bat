@echo off
cd /d "%~dp0"

echo [1/3] Updating DOC\manifest.json now...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update_manifest.ps1"

echo.
echo [2/3] Starting background folder watcher (hidden window)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*watch_manifest.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Process powershell.exe -WindowStyle Hidden -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0watch_manifest.ps1\"'"

echo.
echo [3/3] Registering auto-start on Windows boot/logon...
schtasks /Create /TN "FollowerWeb_DocWatcher" /TR "powershell.exe -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File \"%~dp0watch_manifest.ps1\"" /SC ONLOGON /RL HIGHEST /F >nul 2>&1
if errorlevel 1 (
  schtasks /Create /TN "FollowerWeb_DocWatcher" /TR "powershell.exe -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File \"%~dp0watch_manifest.ps1\"" /SC ONLOGON /F >nul 2>&1
)

echo.
echo ====================================================
echo  Background watcher is now RUNNING in the background!
echo  You can close this window safely.
echo ====================================================
pause
