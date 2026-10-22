@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch-bookmark-companion.ps1"
if errorlevel 1 pause
