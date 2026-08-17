#!/usr/bin/env node
// bench/ui judge — verifies the shop's interactions. Run: node bench/ui/judge.js
const net = require("net");
const http = require("http");

const SOCK = "/tmp/browser-bridge.sock";
const BASE = "http://localhost:8765/";
const TIMEOUT = 15000;
let _id = 1, passed = 0, failed = 0;

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
function check(name, cond, detail) {
  if (cond) { console.log(`  OK   ${name}`); passed++; }
  else { console.log(`  FAIL ${name}: ${detail}`); failed++; }
}
async function js(code) { const r = await cmd("js", { code }); return r.result; }
async function read() { const r = await cmd("read", {}); return r.text || ""; }

async function main() {
  console.log("=== bench/ui: shop interaction judge ===\n");
  try {
    await new Promise((res, rej) => {
      const req = http.get(BASE + "index.html", r => r.statusCode === 200 ? res() : rej(new Error("status " + r.statusCode)));
      req.on("error", () => rej(new Error("server not running on :8765")));
      req.setTimeout(3000, () => rej(new Error("timeout")));
    }).catch(e => { console.log("SKIP: " + e.message); process.exit(1); });
  } catch (e) { console.log("SKIP: " + e.message); process.exit(1); }

  // ---- index: mega menu, search, add to cart, late button ----
  let r = await cmd("navigate", { url: BASE + "index.html", newTab: false });
  check("navigate index", !r.error, r.error);
  await settle(700);

  r = await cmd("click", { selector: "#mega-toggle" });
  check("open mega menu", !r.error, r.error);
  await settle(200);
  r = await cmd("click", { selector: ".mega-panel a[data-nav='Laptops']" });
  check("click mega Laptops", !r.error, r.error);
  await settle(200);
  let t = await read();
  check("mega toast", t.includes("Menu: Laptops"), "no mega toast");

  r = await cmd("type", { selector: "#search-input", value: "keyboard" });
  check("type search", !r.error, r.error);
  r = await cmd("click", { selector: "#search-btn" });
  check("click search", !r.error, r.error);
  await settle(200);
  t = await read();
  check("search toast", t.includes("Search: keyboard"), "no search toast");

  r = await cmd("click", { selector: "button[data-add='keyboard']" });
  check("add keyboard to cart", !r.error, r.error);
  await settle(200);
  const count = await js("document.querySelector('[data-cart-count]').textContent");
  check("cart count 1", count === "1", "cart count " + count);

  await settle(1800);
  r = await cmd("click", { selector: "#late-btn" });
  check("click late button", !r.error, r.error);
  await settle(200);
  t = await read();
  check("late reward", t.includes("Reward claimed"), "no reward");

  // ---- catalog: filters, chips, pagination ----
  r = await cmd("navigate", { url: BASE + "catalog.html", newTab: false });
  check("navigate catalog", !r.error, r.error);
  await settle(700);
  r = await cmd("js", { code: "const s=document.querySelector('[data-filter=\"category\"]'); s.value='electronics'; s.dispatchEvent(new Event('change',{bubbles:true}));" });
  check("filter category", !r.error, r.error);
  await settle(200);
  t = await read();
  check("filter toast", t.includes("Filter: electronics"), "no filter toast");
  r = await cmd("click", { selector: ".chip[data-chip='sale']" });
  check("click chip", !r.error, r.error);
  await settle(200);
  t = await read();
  check("chip toast", t.includes("Chip: Sale"), "no chip toast");
  r = await cmd("click", { selector: "[data-page='2']" });
  check("click page 2", !r.error, r.error);
  await settle(200);
  t = await read();
  check("page toast", t.includes("Page 2"), "no page toast");

  // ---- product: variant + qty ----
  r = await cmd("navigate", { url: BASE + "product.html", newTab: false });
  check("navigate product", !r.error, r.error);
  await settle(700);
  r = await cmd("click", { selector: ".variant[data-variant='Blue']" });
  check("select variant", !r.error, r.error);
  await settle(200);
  t = await read();
  check("variant toast", t.includes("Variant: Blue"), "no variant toast");
  r = await cmd("click", { selector: "[data-qty-inc='keyboard']" });
  check("qty inc", !r.error, r.error);
  await settle(200);
  const qty = await js("document.querySelector('[data-qty-val=\"keyboard\"]').textContent");
  check("qty = 2", qty === "2", "qty " + qty);

  // ---- cart: total ----
  r = await cmd("navigate", { url: BASE + "cart.html", newTab: false });
  check("navigate cart", !r.error, r.error);
  await settle(700);
  const total = await js("document.getElementById('cart-total').textContent");
  check("cart total", total.includes("$"), "no total " + total);

  // ---- checkout: stepper ----
  r = await cmd("navigate", { url: BASE + "checkout.html", newTab: false });
  check("navigate checkout", !r.error, r.error);
  await settle(700);
  r = await cmd("click", { selector: "#step-next" });
  check("checkout step 1->2", !r.error, r.error);
  await settle(200);
  r = await cmd("click", { selector: "#step-next" });
  check("checkout step 2->3", !r.error, r.error);
  await settle(200);
  t = await read();
  check("checkout step 3", t.includes("Checkout: step 3"), "no step 3 toast");

  // ---- account: tabs, accordion, modal, toggle ----
  r = await cmd("navigate", { url: BASE + "account.html", newTab: false });
  check("navigate account", !r.error, r.error);
  await settle(700);
  r = await cmd("click", { selector: ".tab[data-tab='security']" });
  check("switch to security tab", !r.error, r.error);
  await settle(200);
  t = await read();
  check("security tab active", t.includes("Security settings"), "security panel not shown");
  r = await cmd("click", { selector: ".acc-head" });
  check("open accordion", !r.error, r.error);
  await settle(200);
  r = await cmd("click", { selector: "[data-modal-open='modal-2fa']" });
  check("open 2fa modal", !r.error, r.error);
  await settle(200);
  r = await cmd("type", { selector: "#twofa-code", value: "123456" });
  check("type 2fa code", !r.error, r.error);
  r = await cmd("click", { selector: "[data-modal-confirm='2FA enabled']" });
  check("confirm 2fa", !r.error, r.error);
  await settle(200);
  t = await read();
  check("2fa toast", t.includes("Confirmed: 2FA enabled"), "no 2fa toast");
  r = await cmd("click", { selector: "[data-toggle='u1']" });
  check("toggle alice", !r.error, r.error);
  await settle(200);
  t = await read();
  check("alice blocked", t.includes("Alice → blocked"), "alice not blocked");

  console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
