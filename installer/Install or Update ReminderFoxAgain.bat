@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ReminderFoxAgain-Setup.ps1"
echo.
pause
