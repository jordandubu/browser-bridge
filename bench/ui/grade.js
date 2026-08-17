#!/usr/bin/env node
// bench/ui grader — reads the persistent evidence log the AI left behind and
// scores each task. Run AFTER the AI finishes: node bench/ui/grade.js
// NOTE: start the server DETACHED so it survives shell timeouts:
//   setsid python3 -m http.server 8765 >/tmp/http.log 2>&1 < /dev/null &
const net = require("net");
const http = require("http");

const SOCK = "/tmp/browser-bridge.sock";
const BASE = "http://localhost:8765/";
const TIMEOUT = 15000;
let _id = 1;

function send(msg) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(SOCK);
    let buf = "";
    const timer = setTimeout(() => { sock.destroy(); reject(new Error("timeout")); }, TIMEOUT);
    msg._id = _id++;
    sock.on("data", c => {
      buf += c.toString();
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const m = JSON.parse(line);
          if (m._id === msg._id) { clearTimeout(timer); sock.destroy(); resolve(m); return; }
        } catch (e) {}
      }
    });
    sock.on("error", e => { clearTimeout(timer); reject(e); });
    sock.write(JSON.stringify(msg) + "\n");
  });
}
async function cmd(kind, payload) { return send(Object.assign({ cmd: kind }, payload || {})); }
async function settle(ms) { await new Promise(r => setTimeout(r, ms)); }
// Wait until a selector exists/visible, up to timeout ms.
async function waitFor(selector, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const r = await cmd("wait", { selector, timeout: 500 });
    if (!r.error) return r;
    await settle(100);
  }
  return { error: "timeout waiting for " + selector };
}

// Each task: { name, check(ev) -> bool }
const TASKS = [
  { name: "mega-menu Laptops", check: ev => ev.some(e => e.ev === "menu" && e.value === "Laptops") },
  { name: "search keyboard", check: ev => ev.some(e => e.ev === "search" && e.value === "keyboard") },
  { name: "add keyboard to cart", check: ev => ev.some(e => e.ev === "cart_add" && e.id === "keyboard") },
  { name: "late reward claimed", check: ev => ev.some(e => e.ev === "late" && e.value === "claimed") },
  { name: "filter electronics", check: ev => ev.some(e => e.ev === "filter" && e.value === "electronics") },
  { name: "chip Sale", check: ev => ev.some(e => e.ev === "chip" && e.value === "Sale") },
  { name: "page 2", check: ev => ev.some(e => e.ev === "page" && e.value === "2") },
  { name: "variant Blue", check: ev => ev.some(e => e.ev === "variant" && e.value === "Blue") },
  { name: "qty keyboard 2", check: ev => ev.some(e => e.ev === "qty" && e.id === "keyboard" && e.value === 2) },
  { name: "checkout step 3", check: ev => ev.some(e => e.ev === "checkout_step" && e.value === 3) },
  { name: "tab Security", check: ev => ev.some(e => e.ev === "tab" && e.value === "Security") },
  { name: "accordion open", check: ev => ev.some(e => e.ev === "accordion") },
  { name: "modal 2FA confirm", check: ev => ev.some(e => e.ev === "modal_confirm" && e.value === "2FA enabled") },
  { name: "toggle Alice blocked", check: ev => ev.some(e => e.ev === "toggle" && e.id === "u1" && e.value === "blocked") },
];

async function main() {
  console.log("=== bench/ui: AI task grader ===\n");
  try {
    await new Promise((res, rej) => {
      const req = http.get(BASE + "index.html", r => r.statusCode === 200 ? res() : rej(new Error("status " + r.statusCode)));
      req.on("error", () => rej(new Error("server not running on :8765")));
      req.setTimeout(3000, () => rej(new Error("timeout")));
    }).catch(e => { console.log("SKIP: " + e.message); process.exit(1); });
  } catch (e) { console.log("SKIP: " + e.message); process.exit(1); }

  let r = await cmd("navigate", { url: BASE + "index.html", newTab: false });
  if (r.error) { console.log("FAIL navigate: " + r.error); process.exit(1); }
  await settle(700);

  r = await cmd("js", { code: "JSON.parse(localStorage.getItem('bench_ui_evidence') || '[]')" });
  const ev = r.result || [];
  console.log("evidence entries: " + ev.length + "\n");

  let passed = 0, failed = 0;
  for (const t of TASKS) {
    if (t.check(ev)) { console.log("  OK   " + t.name); passed++; }
    else { console.log("  FAIL " + t.name); failed++; }
  }
  console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
