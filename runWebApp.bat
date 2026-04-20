@echo off
setlocal

echo ============================================
echo Vestaboard WebUI - Build and Live Test
echo ============================================

cd /d "%~dp0"

echo.
echo [1/4] Running production build...
call npm run build
if errorlevel 1 (
  echo.
  echo Build failed. Stopping.
  exit /b 1
)

echo.
echo [2/4] Running startup tests...
call npm run startup:test
if errorlevel 1 (
  echo.
  echo Startup tests failed. Stopping.
  exit /b 1
)

echo.
echo [3/4] Killing any process on port 3000...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$connections = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($connections) { $connections | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }; Write-Host 'Port 3000 cleared.' } else { Write-Host 'Port 3000 already free.' }"

echo.
echo [4/4] Starting production server for live test (Node.js)...
echo Open http://localhost:3000 in your browser.
echo Press Ctrl+C to stop the server.
call node .\node_modules\next\dist\bin\next start

endlocal
