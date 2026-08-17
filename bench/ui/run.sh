#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

# Judge: serve the shop, start the extension (spawns its own native host),
# then verify the shop's interactions over the socket. Tears down on exit.

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

echo "[1/3] Serving shop on :8765..."
python3 -m http.server 8765 --bind 127.0.0.1 &
SERVER_PID=$!
sleep 1

echo "[2/3] Starting extension..."
npx web-ext run --source-dir ../../addon --firefox=firefox &
WEBEXT_PID=$!
sleep 5

echo "[3/3] Running judge..."
node judge.js
