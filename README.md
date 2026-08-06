# firefox-bridge

Firefox addon + MCP server that lets opencode read and interact with web pages.

## What it does

- **`firefox_read`** — extract all text from active tab (visible + hidden)
- **`firefox_html`** — get full page HTML
- **`firefox_js`** — run arbitrary JavaScript on the page
- **`firefox_security`** — extract security surface: forms, scripts, cookies, storage, external domains, meta tags

## Architecture

```
opencode → MCP server (stdio) → Unix socket → host.js (native messaging) → Firefox addon → page
```

## Install

```bash
npm install
./install.sh
```

`install.sh` sets up the native messaging host so Firefox can talk to the bridge.

Install the addon from the [Firefox Add-ons store](https://addons.mozilla.org) (or for dev: `npm run build` then sideload the `.xpi`).

## MCP config

Add to `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "mcp": {
    "firefox-bridge": {
      "type": "local",
      "command": "node",
      "args": ["/path/to/firefox-bridge/host/mcp-server.js"]
    }
  }
}
```

## CLI usage

```bash
node host/bridge.js              # read page text
node host/bridge.js html         # get page HTML
node host/bridge.js js "document.title"  # run JS
node host/bridge.js security     # extract security data
```

## Files

| Path | Role |
|------|------|
| `addon/manifest.json` | Firefox addon manifest |
| `addon/background.js` | Native messaging relay |
| `addon/content.js` | Content script: read, html, js, security extraction |
| `host/host.js` | Native messaging host + Unix socket server |
| `host/mcp-server.js` | MCP stdio server for opencode |
| `host/bridge.js` | CLI client for testing |
| `install.sh` | Install native messaging host manifest |
