@echo off
setlocal
set "SCRIPT=%~dp0launch-branch-companion.ps1"
if not exist "%SCRIPT%" (
  echo Branch companion launcher not found: "%SCRIPT%"
  pause
  exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" echo Branch companion exited with code %EXITCODE%.
pause
exit /b %EXITCODE%
