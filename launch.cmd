@echo off
setlocal
set "SCRIPT=%~dp0launch-gpt-assistant.ps1"
if not exist "%SCRIPT%" (
  echo GPT Assistant launcher not found: "%SCRIPT%"
  pause
  exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" echo GPT Assistant exited with code %EXITCODE%.
pause
exit /b %EXITCODE%
