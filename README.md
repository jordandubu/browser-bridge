# browser-bridge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Firefox Add-on](https://img.shields.io/badge/Firefox-Add--on-orange)](https://addons.mozilla.org)

Bridge opencode into your browser. Read pages, execute JavaScript, and audit for security flaws — all from your terminal. Purpose-built for bug bounty hunting.

## Why

Bug bounty hunters spend half their time switching between browser and tools. browser-bridge puts opencode directly inside the page. Browse normally, then ask opencode to read the DOM, run JS, or scan for vulnerabilities — no proxies, no manual export, no context switching.

## Architecture

```
opencode ──▶ MCP server (stdio) ──▶ Unix socket ──▶ host.js (native messaging) ──▶ browser addon ──▶ page
```

The MCP server talks to opencode over stdio. It forwards commands through a Unix socket to the native messaging host, which relays them into the browser's active tab. Responses flow back the same way.

## Requirements

- [opencode](https://opencode.ai)
- [Firefox](https://www.mozilla.org/firefox/)
- [Node.js](https://nodejs.org) ≥ 18

## Install

```bash
git clone https://github.com/jordandubu/browser-bridge
cd browser-bridge
npm install
./install.sh
```

`install.sh` registers the native messaging host with Firefox. Then add this to `~/.config/opencode/opencode.jsonc`:

```jsonc
"mcp": {
  "browser-bridge": {
    "type": "local",
    "command": "node",
    "args": ["/path/to/browser-bridge/host/mcp-server.js"]
  }
}
```

Install the addon from the [Firefox Add-ons store](https://addons.mozilla.org). Restart opencode.

## Tools

| Tool | Description |
|------|-------------|
| `browser_read` | Extract all visible text from the active tab |
| `browser_html` | Get full page HTML |
| `browser_js` | Run arbitrary JavaScript and return the result |
| `browser_security` | Collect forms, scripts, cookies, storage, external domains, meta tags for vulnerability analysis |
| `browser_navigate` | Navigate to a URL (new tab by default, or reuse current tab) |
| `browser_console` | Capture console.log/error/warn/info/debug output (up to 500 entries) |
| `browser_network` | Capture ALL network requests (page load + fetch/XHR) with URL, method, type |

### Example: security audit

```
User: audit this page for vulnerabilities
opencode → browser_security → returns forms, scripts, cookies, external domains
opencode: "Found 3 issues:
  1. Login form submits over HTTP (no TLS)
  2. No CSP meta tag detected
  3. Inline script uses innerHTML with user-controlled input"
```

## CLI

For testing without opencode:

```bash
node host/bridge.js              # read page text
node host/bridge.js html         # get page HTML
node host/bridge.js js "document.title"  # run JS
node host/bridge.js security     # extract security data
```

## Files

| Path | Role |
|------|------|
| `addon/` | Browser extension (manifest, background, content scripts) |
| `host/` | Native messaging host, MCP server, CLI client |

## Contributing

PRs welcome. Only opencode is supported — if you want Cursor, Claude Code, or another MCP client, add it yourself. The bridge is client-agnostic (stdio MCP), so it should just work. Test with `node host/bridge.js` and `npm run lint`.

## License

MIT
