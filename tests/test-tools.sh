#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

# The extension spawns its own native host (host.js) via the manifest, which
# binds the default socket. Do NOT start a second host here — it would conflict.
# Kill any stale test processes from a previous run first.
pkill -f "host/host.js" 2>/dev/null || true
pkill -f "firefox-profile" 2>/dev/null || true
pkill -f "http.server 8765" 2>/dev/null || true
sleep 1
rm -f /tmp/browser-bridge.sock

cleanup() {
  kill $SERVER_PID 2>/dev/null || true
  kill $WEBEXT_PID 2>/dev/null || true
  pkill -f "firefox-profile" 2>/dev/null || true
  pkill -f "host/host.js" 2>/dev/null || true
  wait 2>/dev/null || true
  rm -f /tmp/browser-bridge.sock
}
trap cleanup EXIT

# Start test HTTP server (test-page.html lives in this dir)
echo "[1/4] Starting test server on :8765..."
python3 -m http.server 8765 --bind 127.0.0.1 &
SERVER_PID=$!
sleep 1

# Start extension (spawns its own native host on the default socket)
echo "[2/4] Starting extension..."
npx web-ext run --source-dir ../addon --firefox=firefox &
WEBEXT_PID=$!
sleep 5

# Run tests
echo "[3/4] Running tool tests..."
node test-tools.js
node test-selector-logic.js
