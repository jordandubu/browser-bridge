#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_DIR="$HOME/.mozilla/native-messaging-hosts"
MANIFEST="$HOST_DIR/opencode_bridge.json"

mkdir -p "$HOST_DIR"

cat > "$MANIFEST" <<EOF
{
  "name": "opencode_bridge",
  "description": "opencode page reader bridge",
  "path": "$DIR/host/host.js",
  "type": "stdio",
  "allowed_extensions": ["opencode-bridge@localhost"]
}
EOF

chmod +x "$DIR/host/host.js" "$DIR/host/mcp-server.js" "$DIR/host/bridge.js"

echo "Installed native messaging host to $MANIFEST"
echo ""
echo "Next:"
echo "  1. Install the Firefox addon from the Add-ons store"
echo "     (or: web-ext run --firefox=/usr/bin/firefox for development)"
echo "  2. Add to ~/.config/opencode/opencode.jsonc:"
echo ""
echo "  \"mcp\": {"
echo "    \"firefox-bridge\": {"
echo "      \"type\": \"local\","
echo "      \"command\": \"node\","
echo "      \"args\": [\"$DIR/host/mcp-server.js\"]"
echo "    }"
echo "  }"
