@echo off
setlocal

echo ============================================
echo  Vestaboard WebUI - Build and Start
echo ============================================

cd /d "%~dp0"

echo.
echo [1/4] Installing npm dependencies...
call npm install --no-fund --no-audit
if errorlevel 1 (
  echo.
  echo ERROR: Dependency install failed. Cannot continue.
  exit /b 1
)

echo.
echo [2/4] Running production build...
call npm run build
if errorlevel 1 (
  echo.
  echo ERROR: Build failed. Cannot continue.
  exit /b 1
)

echo.
echo [3/4] Running startup tests (advisory)...
call npm run startup:test
if errorlevel 1 (
  echo.
  echo WARNING: Some startup tests failed. Continuing anyway.
  echo          Check the output above and verify your .env.local is correct.
)

echo.
echo [4/4] Clearing port 3000 and starting server...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$connections = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($connections) { $connections | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }; $deadline = (Get-Date).AddSeconds(10); do { $remaining = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if (-not $remaining) { if ($connections) { Write-Host 'Port 3000 cleared.' } else { Write-Host 'Port 3000 already free.' }; exit 0 }; Start-Sleep -Milliseconds 500 } while ((Get-Date) -lt $deadline); $remaining | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize; Write-Error 'Port 3000 is still listening.'; exit 1"
if errorlevel 1 (
  echo.
  echo WARNING: Could not clear port 3000 - it may already be in use.
)

echo.
echo Open http://localhost:3000 in your browser.
echo Press Ctrl+C to stop.
set SECURE_COOKIES=false
call node .\node_modules\next\dist\bin\next start

endlocal
