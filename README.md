# firefox-bridge

Bridge opencode into your browser. Read pages, execute JavaScript, and audit for security flaws — all from your terminal. Purpose-built for bug bounty hunting.

## How it works

You browse a site in Firefox. opencode sees the page, runs JS, and spots vulnerabilities in real time. No proxies, no setup, just a browser extension and an MCP server.

## Install

```bash
git clone https://github.com/jordandubu/firefox-bridge
cd firefox-bridge
npm install
./install.sh
```

Then add this to `~/.config/opencode/opencode.jsonc`:

```jsonc
"mcp": {
  "firefox-bridge": {
    "type": "local",
    "command": "node",
    "args": ["/path/to/firefox-bridge/host/mcp-server.js"]
  }
}
```

Install the addon from the [Firefox Add-ons store](https://addons.mozilla.org).

## Tools

| Tool | What it does |
|------|-------------|
| `firefox_read` | Extract all visible text from the active tab |
| `firefox_html` | Get full page HTML |
| `firefox_js` | Run arbitrary JavaScript and return the result |
| `firefox_security` | Collect forms, scripts, cookies, storage, external domains, meta tags for vulnerability analysis |

## Files

| Path | Role |
|------|------|
| `addon/` | Firefox extension (manifest, background, content scripts) |
| `host/` | Native messaging host, MCP server, CLI client |
