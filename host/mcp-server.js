#!/usr/bin/env node
const net = require("net");

const SOCK = "/tmp/browser-bridge.sock";

let sock = null;
let buf = "";
let pending = {};
let nextId = 1;

function connect() {
  sock = net.createConnection(SOCK);
  sock.on("data", c => {
    buf += c;
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg._id && pending[msg._id]) {
          pending[msg._id](msg);
          delete pending[msg._id];
        }
      } catch (e) {}
    }
  });
  sock.on("error", () => { sock = null; });
  sock.on("close", () => { sock = null; });
}

function send(msg) {
  return new Promise((resolve, reject) => {
    if (!sock) connect();
    const id = nextId++;
    msg._id = id;
    pending[id] = resolve;
    const timer = setTimeout(() => { delete pending[id]; reject(new Error("timeout")); }, 10000);
    const orig = pending[id];
    pending[id] = (resp) => { clearTimeout(timer); orig(resp); };
    try { sock.write(JSON.stringify(msg) + "\n"); } catch (e) { clearTimeout(timer); delete pending[id]; reject(e); }
  });
}

const TOOLS = [
  {
    name: "browser_read",
    description: "Read text content of the active browser tab. Returns all visible and hidden text nodes.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "browser_html",
    description: "Get full HTML of the active browser tab.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "browser_js",
    description: "Execute arbitrary JavaScript on the active browser tab and return the result.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "JavaScript code to execute. Use (() => { ... })() for async." }
      },
      required: ["code"]
    }
  },
  {
    name: "browser_security",
    description: "Extract security-relevant data from the active tab: forms, scripts, cookies, storage, external domains, meta tags, CSP meta, inline scripts, iframes. Use to audit a page for web vulnerabilities.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "browser_navigate",
    description: "Navigate to a URL. Opens in a new tab by default, or reuse the current tab if newTab is false.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to navigate to" },
        newTab: { type: "boolean", description: "Open in new tab (default true). Set false to reuse current tab." }
      },
      required: ["url"]
    }
  },
  {
    name: "browser_console",
    description: "Capture console.log/error/warn/info/debug output from the page. Returns logs collected since page load (up to 500).",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "browser_network",
    description: "Capture ALL network requests from the active tab (page load + fetch/XHR). Returns up to 500 requests with URL, method, type, timestamp.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "browser_tabs",
    description: "List all open tabs or switch to a specific tab by index.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "'list' to list all tabs, 'switch' to activate a tab" },
        tabId: { type: "number", description: "Tab index (0-based) to switch to. Required when action is 'switch'." }
      },
      required: ["action"]
    }
  },
  {
    name: "browser_postmessage",
    description: "Capture all window.postMessage events between frames. Returns origin, data, source (self/iframe), timestamp. Useful for finding postMessage-based XSS or origin validation bugs.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "browser_dom_sinks",
    description: "Find DOM XSS sinks in inline scripts: innerHTML, document.write, eval, setTimeout(string), jQuery.html(), dangerouslySetInnerHTML, location.href, and more. Returns sink type, count, and code snippet.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "browser_storage",
    description: "Dump cookies (full values), localStorage, and sessionStorage from the active tab. Use to find sensitive data stored client-side.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "browser_csp",
    description: "Extract Content-Security-Policy from meta tags and flag weaknesses: unsafe-inline, unsafe-eval, wildcards, missing directives (frame-ancestors, object-src, base-uri, form-action).",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "browser_cors",
    description: "Find cross-origin resources (scripts, styles, images with crossorigin attribute) and list external origins. Use to identify potential CORS misconfiguration targets.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "browser_websocket",
    description: "Capture WebSocket connections and messages (connect, send, recv) from the active tab. Returns URL, direction, data, timestamp.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "browser_strip_headers",
    description: "Toggle stripping of security headers (CSP, X-XSS-Protection, X-Frame-Options, X-Content-Type-Options) for testing. Pass active:true to enable, active:false to disable.",
    inputSchema: {
      type: "object",
      properties: {
        active: { type: "boolean", description: "true to strip headers, false to restore" }
      },
      required: ["active"]
    }
  },
  {
    name: "browser_event_listeners",
    description: "Enumerate inline event handlers (onclick, onsubmit, onchange, etc.) and interactive elements (forms, buttons, links, inputs) on the page. Use to find client-side attack surface.",
    inputSchema: { type: "object", properties: {} }
  }
];

let stdinBuf = "";
process.stdin.on("data", chunk => {
  stdinBuf += chunk.toString();
  let newline;
  while ((newline = stdinBuf.indexOf("\n")) !== -1) {
    const line = stdinBuf.slice(0, newline);
    stdinBuf = stdinBuf.slice(newline + 1);
    handle(line);
  }
});

async function handle(line) {
  try {
    const req = JSON.parse(line);
    const { id, method, params } = req;

    if (method === "initialize") {
      respond(id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "browser-bridge", version: "1.2" } });
    } else if (method === "tools/list") {
      respond(id, { tools: TOOLS });
    } else if (method === "tools/call") {
      const { name, arguments: args } = params;
      try {
        let result;
        if (name === "browser_read") {
          result = await send({ cmd: "read" });
        } else if (name === "browser_html") {
          result = await send({ cmd: "html" });
        } else if (name === "browser_js") {
          result = await send({ cmd: "js", code: args.code });
        } else if (name === "browser_security") {
          result = await send({ cmd: "security" });
        } else if (name === "browser_navigate") {
          result = await send({ cmd: "navigate", url: args.url, newTab: args.newTab !== false });
        } else if (name === "browser_console") {
          result = await send({ cmd: "console" });
        } else if (name === "browser_network") {
          result = await send({ cmd: "network" });
        } else if (name === "browser_tabs") {
          result = await send({ cmd: "tabs", action: args.action, tabId: args.tabId });
        } else if (name === "browser_postmessage") {
          result = await send({ cmd: "postmessage" });
        } else if (name === "browser_dom_sinks") {
          result = await send({ cmd: "dom_sinks" });
        } else if (name === "browser_storage") {
          result = await send({ cmd: "storage" });
        } else if (name === "browser_csp") {
          result = await send({ cmd: "csp" });
        } else if (name === "browser_cors") {
          result = await send({ cmd: "cors" });
        } else if (name === "browser_websocket") {
          result = await send({ cmd: "websocket" });
        } else if (name === "browser_strip_headers") {
          result = await send({ cmd: "strip_headers", active: args.active });
        } else if (name === "browser_event_listeners") {
          result = await send({ cmd: "event_listeners" });
        }
        respond(id, { content: [{ type: "text", text: JSON.stringify(result) }] });
      } catch (e) {
        respond(id, { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }], isError: true });
      }
    } else if (method === "notifications/initialized") {
    } else {
      respond(id, { error: { code: -32601, message: `Unknown method: ${method}` } });
    }
  } catch (e) {
    process.stderr.write("mcp-server error: " + e.message + "\n");
  }
}

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}
