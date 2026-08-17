#!/usr/bin/env node
const net = require("net");

const SOCK = process.env.BRIDGE_SOCK || "/tmp/browser-bridge.sock";

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

const SEND_TIMEOUT = 30000;
const SEND_RETRIES = 2;
// Mutating actions whose response may be lost when the page handles the click
// but the socket/connection dies before the reply arrives. For these, a
// timeout is reported as a non-fatal warning: the action may have landed.
const MUTATING_CMDS = new Set(["click", "type", "act", "clear_storage"]);

function send(msg) {
  return new Promise((resolve, reject) => {
    // send with reconnect + retry: a stalled/dead socket is the usual cause of
    // a "timeout" that the page actually handled fine. Drop the socket so the
    // next attempt reconnects instead of silently dropping the response.
    const attempt = (tryNo) => {
      if (!sock) connect();
      const id = nextId++;
      const timer = setTimeout(() => {
        delete pending[id];
        try { sock && sock.destroy(); } catch (e) {}
        sock = null;
        if (tryNo < SEND_RETRIES) return attempt(tryNo + 1);
        if (MUTATING_CMDS.has(msg.cmd)) {
          resolve({ error: "timeout waiting for page response (retried " + SEND_RETRIES + "x). The action may still have executed — verify page state (toast, cart, DOM) before retrying.", mayHaveExecuted: true });
          return;
        }
        reject(new Error("timeout"));
      }, SEND_TIMEOUT);
      const m = { ...msg, _id: id };
      pending[id] = (resp) => { clearTimeout(timer); resolve(resp); };
      try { sock.write(JSON.stringify(m) + "\n"); } catch (e) { clearTimeout(timer); delete pending[id]; sock = null; if (tryNo < SEND_RETRIES) return attempt(tryNo + 1); if (MUTATING_CMDS.has(msg.cmd)) { resolve({ error: "connection error (retried " + SEND_RETRIES + "x). The action may still have executed — verify page state before retrying.", mayHaveExecuted: true }); return; } reject(e); }
    };
    attempt(0);
  });
}

const TOOLS = [
  {
    name: "browser_read",
    description: "Read text content of the active browser tab. Returns all visible and hidden text nodes. Optional selector: only read that element's subtree. Optional visibleOnly: skip text inside display:none/visibility:hidden subtrees. Optional maxChars: truncate output (response includes truncated:true and totalChars so you can re-read with a larger cap).",
    inputSchema: { type: "object", properties: { selector: { type: "string", description: "Optional CSS/#id/[attr], text=..., or :has-text('...') selector to scope the read" }, visibleOnly: { type: "boolean", description: "Skip text inside hidden (display:none / visibility:hidden) subtrees" }, maxChars: { type: "number", description: "Truncate output to N chars; response reports truncated + totalChars" } } }
  },
  {
    name: "browser_html",
    description: "Get full HTML of the active browser tab. Optional maxChars: truncate output (response includes truncated:true and totalChars so you can re-read with a larger cap).",
    inputSchema: { type: "object", properties: { maxChars: { type: "number", description: "Truncate output to N chars; response reports truncated + totalChars" } } }
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
    name: "browser_click",
    description: "Click an element on the active tab. selector can be a CSS selector, #id, [name=value], text=Label, role=button, label=Field, or :has-text('X')/:contains('X') (translated to substring text match). Unquoted attribute values like [data-page=2] are auto-quoted. Clicking an <option> selects it on the parent <select> (fires change) since plain clicks don't. If multiple elements match, the call ERRORS with a numbered matched list — append |index=N to pick one (index is 0-based, e.g. '.variant|index=1' = 2nd match). A resolved index is NOT reported as ambiguous. Timeouts are non-fatal: the click may have landed — verify page state first.",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector, #id, [name=value], text=..., role=..., label=..., or :has-text('...') for the element to click. Append |index=N (0-based) when the selector matches multiple elements." }
      },
      required: ["selector"]
    }
  },
  {
    name: "browser_type",
    description: "Type text into an input or textarea on the active tab. selector can be a CSS selector, #id, [name=value], text=Label, role=button, label=Field, or :has-text('X'). Set pressEnter:true to dispatch Enter and submit the enclosing form; when there is no form (e.g. a search box with a sibling button), the sibling submit/search button is clicked instead. Returns 'landed' to confirm the value actually registered (false if the framework ignored the direct assignment). Ambiguous selectors error with a numbered list — append |index=N (0-based) to pick one.",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector, #id, [name=value], text=..., role=..., label=..., or :has-text('...') for the target element. Append |index=N when the selector matches multiple elements." },
        value: { type: "string", description: "Text to type into the element" },
        pressEnter: { type: "boolean", description: "Dispatch Enter key and submit the enclosing form" }
      },
      required: ["selector", "value"]
    }
  },
  {
    name: "browser_act",
    description: "Compound action: click or type, optionally wait for a selector, then return post-state (toast text, cart count, matched elements) in ONE call. Use this instead of separate click+toast round trips. Actions: 'click' (selector), 'type' (selector+value, optional pressEnter), 'wait' (selector+timeout). Clicking an <option> selects it on the parent <select> (fires change). Optional verify: a selector whose text is returned after the action. Ambiguous selectors error with a numbered list — append |index=N (0-based) to pick one. Timeouts are non-fatal: the action may have landed — check post-state.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "'click', 'type', or 'wait'" },
        selector: { type: "string", description: "Target selector (text=..., role=..., label=..., CSS, #id). Append |index=N when the selector matches multiple elements." },
        value: { type: "string", description: "For action=type: text to type" },
        pressEnter: { type: "boolean", description: "For action=type: dispatch Enter + submit form" },
        timeout: { type: "number", description: "For action=wait: max ms to wait (default 5000)" },
        verify: { type: "string", description: "Optional selector whose text is returned after the action (e.g. '#toast')" }
      },
      required: ["action", "selector"]
    }
  },
  {
    name: "browser_wait",
    description: "Wait until a selector exists and is visible, up to timeout ms. Use for late-injected elements (e.g. a button that appears ~1.5s after load).",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "Selector to wait for (text=..., role=..., label=..., CSS, #id)" },
        timeout: { type: "number", description: "Max ms to wait (default 5000)" }
      },
      required: ["selector"]
    }
  },
  {
    name: "browser_toast",
    description: "Read toast/notification text from the page. If the toast element still shows text, returns it (with '(N s ago)' age); if it already faded, returns the newest toast seen since your last read marked '(faded)', so a toast that appeared and expired between calls is still reported instead of null. Returns null only when no toast has ever appeared (or page was reloaded). Use browser_act with verify to capture a toast in the same call as the action.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "browser_clear_storage",
    description: "Clear localStorage and sessionStorage of the active tab. Use to reset page state (cart, session, evidence) before a fresh task run.",
    inputSchema: { type: "object", properties: {} }
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
    description: "List all open tabs, switch to a specific tab by index, or close a tab. Actions: 'list', 'switch' (tabId), 'close' (tabId).",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "'list', 'switch', or 'close'" },
        tabId: { type: "number", description: "Tab index (0-based) to switch/close. Required when action is 'switch' or 'close'." }
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

// Queue tools: repeated identical reads return the same (or empty) state, so
// a model stuck re-calling one gets no new information. Track the last call
// per tool; an identical repeat within the window is rejected with guidance
// instead of silently returning null forever (loop guard).
const QUEUE_TOOLS = new Set(["browser_toast", "browser_console", "browser_network", "browser_postmessage", "browser_websocket"]);
const REPEAT_WINDOW_MS = 5000;
let lastCall = null;

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
        if (QUEUE_TOOLS.has(name)) {
          const now = Date.now();
          const same = lastCall && lastCall.name === name && JSON.stringify(lastCall.args) === JSON.stringify(args);
          if (same && now - lastCall.ts < REPEAT_WINDOW_MS) {
            respond(id, { content: [{ type: "text", text: JSON.stringify({ error: "identical " + name + " call repeated within " + REPEAT_WINDOW_MS + "ms — a queue read returns no new state. Do something else first (click, navigate, js) or read the DOM instead." }) }], isError: true });
            return;
          }
          lastCall = { name, args, ts: now };
        }
        if (name === "browser_read") {
          result = await send({ cmd: "read", selector: args.selector, visibleOnly: args.visibleOnly, maxChars: args.maxChars });
        } else if (name === "browser_click") {
          result = await send({ cmd: "click", selector: args.selector });
        } else if (name === "browser_type") {
          result = await send({ cmd: "type", selector: args.selector, value: args.value, pressEnter: args.pressEnter });
        } else if (name === "browser_act") {
          result = await send({ cmd: "act", action: args.action, selector: args.selector, value: args.value, pressEnter: args.pressEnter, timeout: args.timeout, verify: args.verify });
        } else if (name === "browser_wait") {
          result = await send({ cmd: "wait", selector: args.selector, timeout: args.timeout });
        } else if (name === "browser_toast") {
          result = await send({ cmd: "toast" });
        } else if (name === "browser_clear_storage") {
          result = await send({ cmd: "clear_storage" });
        } else if (name === "browser_html") {
          result = await send({ cmd: "html", maxChars: args.maxChars });
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
