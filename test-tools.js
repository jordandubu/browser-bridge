#!/usr/bin/env node
const net = require("net");
const http = require("http");
const { execSync } = require("child_process");

const SOCK = "/tmp/browser-bridge.sock";
const TEST_URL = "http://localhost:8765/test-page.html";
const TIMEOUT = 10000;

let passed = 0;
let failed = 0;

function fail(name, reason) {
  console.log(`  FAIL ${name}: ${reason}`);
  failed++;
}

function ok(name) {
  console.log(`  OK ${name}`);
  passed++;
}

function send(msg) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(SOCK);
    let buf = "";
    const timer = setTimeout(() => { sock.destroy(); reject(new Error("timeout")); }, TIMEOUT);
    sock.on("data", c => {
      buf += c.toString();
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const m = JSON.parse(line);
          if (m._id === msg._id) {
            clearTimeout(timer);
            sock.destroy();
            resolve(m);
            return;
          }
        } catch (e) {}
      }
    });
    sock.on("error", e => { clearTimeout(timer); reject(e); });
    sock.write(JSON.stringify(msg) + "\n");
  });
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function test(name, fn) {
  process.stdout.write(`${name}... `);
  try {
    await fn();
    console.log("OK");
    passed++;
  } catch (e) {
    console.log(`FAIL: ${e.message}`);
    failed++;
  }
}

async function main() {
  console.log("=== browser-bridge tool tests ===\n");

  // Ensure test server is running
  await new Promise((resolve, reject) => {
    const req = http.get(TEST_URL, res => {
      if (res.statusCode === 200) resolve();
      else reject(new Error(`server returned ${res.statusCode}`));
    });
    req.on("error", () => reject(new Error("test server not running on :8765. Start with: python3 -m http.server 8765")));
    req.setTimeout(3000, () => { req.destroy(); reject(new Error("test server timeout")); });
  }).catch(e => { console.log(`SKIP: ${e.message}`); process.exit(1); });

  // Navigate to test page first
  console.log("navigating to test page...");
  await send({ cmd: "navigate", url: TEST_URL, newTab: false, _id: 1 });
  await new Promise(r => setTimeout(r, 1000));

  // --- browser_read ---
  await test("browser_read", async () => {
    const r = await send({ cmd: "read", _id: 2 });
    assert(!r.error, r.error);
    assert(r.text && r.text.includes("Browser Bridge"), "missing page title text");
  });

  // --- browser_html ---
  await test("browser_html", async () => {
    const r = await send({ cmd: "html", _id: 3 });
    assert(!r.error, r.error);
    assert(r.html && r.html.includes("<title>Browser Bridge Test Page</title>"), "missing title tag");
  });

  // --- browser_console ---
  await test("browser_console", async () => {
    // trigger console calls first
    await send({ cmd: "js", code: "window.wrappedJSObject.triggerConsole()", _id: 4 });
    await new Promise(r => setTimeout(r, 500));
    const r = await send({ cmd: "console", _id: 5 });
    assert(!r.error, r.error);
    assert(Array.isArray(r.logs), "logs not array");
    const hasLog = r.logs.some(l => l.args && l.args.some(a => a === "test-log"));
    assert(hasLog, "missing test-log");
  });

  // --- browser_network ---
  await test("browser_network", async () => {
    await send({ cmd: "js", code: "window.wrappedJSObject.triggerFetch()", _id: 5.5 });
    await new Promise(r => setTimeout(r, 1000));
    const r = await send({ cmd: "network", _id: 6 });
    assert(!r.error, r.error);
    assert(Array.isArray(r.logs), "logs not array");
    const hasFetch = r.logs.some(l => l.type === "xmlhttprequest" && l.url.includes("httpbin.org"));
    assert(hasFetch, "missing fetch request");
  });

  // --- browser_security ---
  await test("browser_security", async () => {
    const r = await send({ cmd: "security", _id: 7 });
    assert(!r.error, r.error);
    assert(r.forms && r.forms.length > 0, "no forms found");
    assert(r.scripts && r.scripts.length > 0, "no scripts found");
  });

  // --- browser_storage ---
  await test("browser_storage", async () => {
    await send({ cmd: "js", code: "window.wrappedJSObject.setStorage()", _id: 8 });
    await new Promise(r => setTimeout(r, 300));
    const r = await send({ cmd: "storage", _id: 9 });
    assert(!r.error, r.error);
    assert(r.cookies && r.cookies.some(c => c.name === "test-cookie"), "missing test cookie");
    assert(r.localStorage && r.localStorage["test-key"] === "local-storage-value", "missing localStorage");
    assert(r.sessionStorage && r.sessionStorage["test-session"] === "session-storage-value", "missing sessionStorage");
  });

  // --- browser_csp ---
  await test("browser_csp", async () => {
    const r = await send({ cmd: "csp", _id: 10 });
    assert(!r.error, r.error);
    assert(r.meta && r.meta.length > 0, "missing meta");
    assert(r.weaknesses && r.weaknesses.length > 0, "no weaknesses found");
  });

  // --- browser_cors ---
  await test("browser_cors", async () => {
    const r = await send({ cmd: "cors", _id: 11 });
    assert(!r.error, r.error);
    assert(Array.isArray(r.externalOrigins), "externalOrigins not array");
    const hasCDN = r.externalOrigins.some(o => o.includes("jsdelivr.net"));
    assert(hasCDN, "missing CDN origin");
  });

  // --- browser_dom_sinks ---
  await test("browser_dom_sinks", async () => {
    const r = await send({ cmd: "dom_sinks", _id: 12 });
    assert(!r.error, r.error);
    assert(Array.isArray(r.sinks), "sinks not array");
    const sinkTypes = r.sinks.map(s => s.sink);
    assert(sinkTypes.includes("innerHTML"), "missing innerHTML sink");
    assert(sinkTypes.includes("eval"), "missing eval sink");
    assert(sinkTypes.includes("setTimeout(string)"), "missing setTimeout sink");
  });

  // --- browser_event_listeners ---
  await test("browser_event_listeners", async () => {
    const r = await send({ cmd: "event_listeners", _id: 13 });
    assert(!r.error, r.error);
    assert(r.onAttributes && r.onAttributes.length > 0, "no onAttributes found");
    assert(r.interactiveElements && r.interactiveElements.length > 0, "no elements found");
  });

  // --- browser_postmessage ---
  await test("browser_postmessage", async () => {
    await send({ cmd: "js", code: "window.wrappedJSObject.triggerPostMessage()", _id: 14 });
    await new Promise(r => setTimeout(r, 500));
    const r = await send({ cmd: "postmessage", _id: 15 });
    assert(!r.error, r.error);
    assert(Array.isArray(r.logs), "logs not array");
    const hasPM = r.logs.some(l => l.data && l.data.includes("test"));
    assert(hasPM, "missing postMessage event");
  });

  // --- browser_websocket ---
  await test("browser_websocket", async () => {
    const r = await send({ cmd: "websocket", _id: 16 });
    assert(!r.error, r.error);
    assert(Array.isArray(r.logs), "logs not array");
    // echo server may be down, just check structure
  });

  // --- browser_strip_headers ---
  await test("browser_strip_headers", async () => {
    const r = await send({ cmd: "strip_headers", active: true, _id: 17 });
    assert(!r.error, r.error);
    assert(r.stripHeadersActive === true, "not active");
    assert(Array.isArray(r.stripped), "stripped not array");
  });

  // --- browser_tabs ---
  await test("browser_tabs", async () => {
    const r = await send({ cmd: "tabs", action: "list", _id: 18 });
    assert(!r.error, r.error);
    assert(Array.isArray(r.tabs) && r.tabs.length > 0, "no tabs");
  });

  // --- browser_js ---
  await test("browser_js", async () => {
    const r = await send({ cmd: "js", code: "document.title", _id: 19 });
    assert(!r.error, r.error);
    assert(r.result && r.result.includes("Browser Bridge"), "wrong title: " + r.result);
  });

  // --- browser_navigate (new tab) ---
  await test("browser_navigate (new tab)", async () => {
    const r = await send({ cmd: "navigate", url: "about:blank", newTab: true, _id: 20 });
    assert(!r.error, r.error);
    assert(r.tabId != null, "no tabId");
    // switch back
    await send({ cmd: "tabs", action: "switch", tabId: 0, _id: 21 });
  });

  // --- browser_toast repeat guard (via MCP server, which owns the guard) ---
  await test("browser_toast repeat guard", async () => {
    const { spawn } = require("child_process");
    const server = spawn("node", ["host/mcp-server.js"], { stdio: ["pipe", "pipe", "inherit"] });
    const rpc = (id, method, params) => new Promise((resolve, reject) => {
      const onData = c => {
        const line = c.toString().trim();
        if (!line) return;
        try {
          const m = JSON.parse(line);
          if (m.id === id) { server.stdout.off("data", onData); resolve(m); }
        } catch (e) {}
      };
      server.stdout.on("data", onData);
      server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
    try {
      await rpc(1, "initialize", {});
      const r1 = await rpc(2, "tools/call", { name: "browser_toast", arguments: {} });
      assert(!r1.result.isError, "first toast read failed: " + JSON.stringify(r1));
      const r2 = await rpc(3, "tools/call", { name: "browser_toast", arguments: {} });
      const text = r2.result.content[0].text;
      assert(r2.result.isError && text.includes("repeated"), "expected repeat-guard error, got: " + text);
    } finally {
      server.kill();
    }
  });

  console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
