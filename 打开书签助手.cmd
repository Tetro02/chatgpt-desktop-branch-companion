@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch-gpt-assistant.ps1"
if errorlevel 1 pause
