@echo off
setlocal

set "ROOT=%~dp0.."

if not exist "%ROOT%\frontend\dist\index.html" (
  echo Building frontend first...
  pushd "%ROOT%\frontend"
  call npm.cmd run build
  if errorlevel 1 (
    echo Frontend build failed.
    popd
    exit /b 1
  )
  popd
)

echo Starting FEMATA backend in a new window...
start "FEMATA Backend" powershell.exe -NoExit -ExecutionPolicy Bypass -Command "Set-Location '%ROOT%\backend'; & '.\.venv\Scripts\python.exe' -m uvicorn main:app --host 127.0.0.1 --port 8000"

echo.
echo Backend window launched.
echo Open this URL in your browser after a few seconds:
echo http://127.0.0.1:8000/chat
