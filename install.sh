#!/usr/bin/env bash
# browser-bridge installer — registers the Firefox native messaging host and
# wires the MCP server into omp (and opencode if present). Does NOT install the
# browser extension: get it from the Firefox Add-ons store or web-ext.
#
# One-shot from the web:
#   curl -fsSL https://raw.githubusercontent.com/jordandubu/browser-bridge/main/install.sh | bash
#
# Or clone and run:
#   git clone https://github.com/jordandubu/browser-bridge && cd browser-bridge && ./install.sh
#
# Works on Linux and macOS (WSL included — register inside WSL; Firefox can
# stay on Windows). Requires node >= 18.
set -euo pipefail

REPO_URL="https://github.com/jordandubu/browser-bridge"
RAW_BASE="https://raw.githubusercontent.com/jordandubu/browser-bridge/main"
BRIDGE_DIR="${BRIDGE_DIR:-$HOME/.local/share/browser-bridge}"

log() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

# --- detect platform ---------------------------------------------------------
OS="$(uname -s)"
case "$OS" in
  Linux*) PLATFORM=linux ;;
  Darwin*) PLATFORM=macos ;;
  CYGWIN*|MSYS*|MINGW*) die "Windows detected — run this inside WSL (https://learn.microsoft.com/windows/wsl/install)" ;;
  *) die "unsupported OS: $OS" ;;
esac

# --- find node ---------------------------------------------------------------
NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
  log "node not found — installing"
  case "$PLATFORM" in
    linux)
      if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update -y && sudo apt-get install -y nodejs
      elif command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y nodejs
      elif command -v pacman >/dev/null 2>&1; then
        sudo pacman -Sy --noconfirm nodejs
      elif command -v zypper >/dev/null 2>&1; then
        sudo zypper install -y nodejs
      elif command -v apk >/dev/null 2>&1; then
        sudo apk add nodejs
      else
        die "no node and no known package manager — install node >= 18 first"
      fi
      ;;
    macos)
      if command -v brew >/dev/null 2>&1; then
        brew install node
      else
        die "no node and no Homebrew — install node >= 18 first (https://nodejs.org)"
      fi
      ;;
  esac
  NODE_BIN="$(command -v node || true)"
  [ -n "$NODE_BIN" ] || die "node install failed — install node >= 18 manually"
fi

NODE_MAJOR="$("$NODE_BIN" -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || die "node >= 18 required, found $("$NODE_BIN" -v)"

# --- fetch the repo ----------------------------------------------------------
install_from_web() {
  log "installing browser-bridge to $BRIDGE_DIR"
  mkdir -p "$BRIDGE_DIR/host"
  local fetcher
  if command -v curl >/dev/null 2>&1; then
    fetcher() { curl -fsSL "$RAW_BASE/$1" -o "$2"; }
  else
    fetcher() { wget -qO "$2" "$RAW_BASE/$1"; }
  fi
  for f in host/host.js host/mcp-server.js host/bridge.js package.json; do
    fetcher "$f" "$BRIDGE_DIR/$f" || die "failed to download $f from $RAW_BASE"
  done
  chmod +x "$BRIDGE_DIR/host/"*.js
  DIR="$BRIDGE_DIR"
}
install_from_local() {
  DIR="$(cd "$(dirname "$0")" && pwd)"
}

# Running from a checkout (host/ sits next to the script) or from curl|bash?
if [ -f "$(dirname "${BASH_SOURCE[0]:-$0}")/host/host.js" ]; then
  install_from_local
else
  command -v curl >/dev/null 2>&1 || command -v wget >/dev/null 2>&1 \
    || die "need curl or wget to download browser-bridge"
  install_from_web
fi
HOST="$DIR/host/host.js"
MCP="$DIR/host/mcp-server.js"

# --- register native messaging host ------------------------------------------
case "$PLATFORM" in
  linux)  NM_DIRS="$HOME/.mozilla/native-messaging-hosts" ;;
  macos)  NM_DIRS="$HOME/Library/Mozilla/NativeMessagingHosts" ;;
esac
mkdir -p "$NM_DIRS"
cat > "$NM_DIRS/browser_bridge.json" <<EOF
{
  "name": "browser_bridge",
  "description": "browser-bridge native messaging host",
  "path": "$HOST",
  "type": "stdio",
  "allowed_extensions": ["browser-bridge@localhost"]
}
EOF
log "registered native messaging host: $NM_DIRS/browser_bridge.json"

if [ -f "$NM_DIRS/browser_bridge.json" ] && ! grep -q "\"path\": \"$HOST\"" "$NM_DIRS/browser_bridge.json"; then
  log "note: native host path changed to $HOST — restart Firefox so the addon re-spawns it"
fi

# --- wire MCP config: omp first, then opencode if present ----------------------
# omp native user config: ~/.omp/agent/mcp.json (profiles: ~/.omp/profiles/<name>/agent/mcp.json)
write_json_entry() { # file, key, json-object-string, create-if-missing
  "$NODE_BIN" - "$1" "$2" "$3" <<'EOF'
const fs = require("fs");
const [file, key, entryJson, createIfMissing] = process.argv.slice(2);
const entry = JSON.parse(entryJson);
let cfg;
if (fs.existsSync(file)) {
  try { cfg = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { console.error(`warning: ${file} is not valid JSON — add the "${key}" MCP entry manually`); process.exit(0); }
} else if (!createIfMissing) {
  process.exit(0);
} else {
  cfg = {};
}
cfg.mcpServers = cfg.mcpServers || {};
const existing = JSON.stringify(cfg.mcpServers[key] || null);
const wanted = JSON.stringify(entry);
if (existing === wanted) { console.log(`${key} already wired in ${file}`); process.exit(0); }
cfg.mcpServers[key] = entry;
fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
console.log(`${existing === "null" ? "added" : "updated"} ${key} in ${file}`);
EOF
}

OMP_SCHEMA="https://raw.githubusercontent.com/can1357/oh-my-pi/main/packages/coding-agent/src/config/mcp-schema.json"
OMP_MCP_JSON="\"type\": \"stdio\", \"command\": \"node\", \"args\": [\"$MCP\"], \"timeout\": 30000"

if [ -d "$HOME/.omp" ]; then
  mkdir -p "$HOME/.omp/agent"
  if [ ! -f "$HOME/.omp/agent/mcp.json" ]; then
    printf '{\n  "$schema": "%s",\n  "mcpServers": {}\n}\n' "$OMP_SCHEMA" > "$HOME/.omp/agent/mcp.json"
  fi
  write_json_entry "$HOME/.omp/agent/mcp.json" "browser-bridge" "{$OMP_MCP_JSON}" false
  log "omp MCP config ready: $HOME/.omp/agent/mcp.json"
fi

# opencode: only wire it if opencode is actually installed/used
OPENCODE_CONFIG=""
for cand in "$HOME/.config/opencode/opencode.json" "$HOME/.config/opencode/opencode.jsonc"; do
  [ -f "$cand" ] && { OPENCODE_CONFIG="$cand"; break; }
done
if [ -n "$OPENCODE_CONFIG" ]; then
  write_json_entry "$OPENCODE_CONFIG" "browser-bridge" \
    "{\"type\": \"local\", \"command\": [\"node\", \"$MCP\"]}" false
  log "opencode MCP config ready: $OPENCODE_CONFIG"
fi

echo
log "done. next:"
echo "  1. Install the Firefox addon from the Add-ons store (see ${REPO_URL}#install)"
echo "  2. Restart omp — the browser-bridge MCP server is already configured"
echo "     (in omp: /mcp list, /mcp test browser-bridge)"