@echo off
setlocal

echo ============================================
echo Vestaboard WebUI - Build and Live Test
echo ============================================

cd /d "%~dp0"

echo.
echo [1/5] Ensuring npm dependencies are installed...
call npm install --no-fund --no-audit
if errorlevel 1 (
  echo.
  echo Dependency install failed. Stopping.
  exit /b 1
)

echo.
echo [2/5] Running production build...
call npm run build
if errorlevel 1 (
  echo.
  echo Build failed. Stopping.
  exit /b 1
)

echo.
echo [3/5] Running startup tests...
call npm run startup:test
if errorlevel 1 (
  echo.
  echo Startup tests failed. Stopping.
  exit /b 1
)

echo.
echo [4/5] Killing any process on port 3000...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$connections = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($connections) { $connections | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }; $deadline = (Get-Date).AddSeconds(10); do { $remaining = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue; if (-not $remaining) { if ($connections) { Write-Host 'Port 3000 cleared.' } else { Write-Host 'Port 3000 already free.' }; exit 0 }; Start-Sleep -Milliseconds 500 } while ((Get-Date) -lt $deadline); $remaining | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize; Write-Error 'Port 3000 is still in use.'; exit 1"
if errorlevel 1 (
  echo.
  echo Failed to clear port 3000. Stopping.
  exit /b 1
)

echo.
echo [5/5] Starting production server for live test (Node.js)...
echo Open http://localhost:3000 in your browser.
echo Press Ctrl+C to stop the server.
call node .\node_modules\next\dist\bin\next start

endlocal
