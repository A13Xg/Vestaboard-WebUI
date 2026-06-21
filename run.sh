#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================"
echo " Vestaboard WebUI - Build and Start"
echo "============================================"

# ── 1. Install dependencies ──────────────────────────────────────────────────
echo ""
echo "[1/4] Installing npm dependencies..."
if ! npm install --no-fund --no-audit; then
  echo ""
  echo "ERROR: Dependency install failed. Cannot continue."
  exit 1
fi

# ── 2. Build ─────────────────────────────────────────────────────────────────
echo ""
echo "[2/4] Running production build..."
if ! npm run build; then
  echo ""
  echo "ERROR: Build failed. Cannot continue."
  exit 1
fi

# ── 3. Startup tests (advisory — failures do not block startup) ───────────────
echo ""
echo "[3/4] Running startup tests (advisory)..."
if ! npm run startup:test; then
  echo ""
  echo "WARNING: Some startup tests failed. Continuing anyway."
  echo "         Check the output above and verify your .env.local is correct."
fi

# ── 4. Clear port 3000, then start ───────────────────────────────────────────
echo ""
echo "[4/4] Clearing port 3000 and starting server..."

if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti tcp:3000 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "Killing existing process(es) on port 3000: $PIDS"
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    sleep 1
  else
    echo "Port 3000 is free."
  fi
elif command -v fuser >/dev/null 2>&1; then
  fuser -k 3000/tcp 2>/dev/null || true
  sleep 1
else
  echo "WARNING: Neither lsof nor fuser found — skipping port check."
fi

echo ""
echo "Open http://localhost:3000 in your browser."
echo "Press Ctrl+C to stop."
node ./node_modules/next/dist/bin/next start
