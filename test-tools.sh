#!/usr/bin/env bash
set -e

cleanup() {
  kill $SERVER_PID 2>/dev/null || true
  kill $WEBEXT_PID 2>/dev/null || true
  kill $HOST_PID 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT

# Start test HTTP server
echo "[1/4] Starting test server on :8765..."
python3 -m http.server 8765 --bind 127.0.0.1 &
SERVER_PID=$!
sleep 1

# Start extension
echo "[2/4] Starting extension..."
npx web-ext run --source-dir addon --firefox=firefox &
WEBEXT_PID=$!
sleep 5

# Start host bridge
echo "[3/4] Starting host bridge..."
node host/host.js &
HOST_PID=$!
sleep 1

# Run tests
echo "[4/4] Running tool tests..."
node test-tools.js
