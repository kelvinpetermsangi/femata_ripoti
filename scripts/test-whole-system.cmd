@echo off
setlocal

set "ROOT=%~dp0.."
set "FRONTEND=%ROOT%\frontend"
set "BACKEND=%ROOT%\backend"
set "URL=http://127.0.0.1:8000"

echo Building the latest frontend bundle...
pushd "%FRONTEND%"
call npm.cmd run build
if errorlevel 1 (
  echo Frontend build failed.
  popd
  exit /b 1
)
popd

echo Starting FEMATA backend in a new window...
start "FEMATA Backend" powershell.exe -NoExit -ExecutionPolicy Bypass -Command "Set-Location '%BACKEND%'; & '.\.venv\Scripts\python.exe' -m uvicorn main:app --host 127.0.0.1 --port 8000"

echo Waiting for the backend to respond...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$deadline = (Get-Date).AddSeconds(30);" ^
  "while ((Get-Date) -lt $deadline) {" ^
  "  try { Invoke-WebRequest -UseBasicParsing '%URL%/health' | Out-Null; exit 0 } catch { Start-Sleep -Seconds 1 }" ^
  "}" ^
  "exit 1"

if errorlevel 1 (
  echo Backend did not become ready in time.
  exit /b 1
)

echo.
echo Whole system is ready for local testing.
echo Open any of these URLs:
echo   %URL%/
echo   %URL%/report
echo   %URL%/track
echo   %URL%/chat
echo   %URL%/admin/login
echo.
echo AI guidance is configured to use DeepSeek from backend\.env.
echo Keep the "FEMATA Backend" window open while testing.

start "" "%URL%/"
