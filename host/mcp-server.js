#!/usr/bin/env node
const net = require("net");

const SOCK = "/tmp/browser-bridge.sock";

function send(msg) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(SOCK);
    let buf = "";
    sock.on("data", c => { buf += c; });
    sock.on("end", () => {
      try {
        const lines = buf.split("\n").filter(l => l.trim());
        const last = JSON.parse(lines[lines.length - 1]);
        resolve(last);
      } catch (e) { reject(e); }
    });
    sock.on("error", reject);
    sock.write(JSON.stringify(msg) + "\n");
    setTimeout(() => { sock.end(); }, 5000);
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
    description: "Extract security-relevant data from the active tab: forms, scripts, cookies, storage, external domains, meta tags. Use to audit a page for web vulnerabilities.",
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
      respond(id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "browser-bridge", version: "1.0" } });
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
