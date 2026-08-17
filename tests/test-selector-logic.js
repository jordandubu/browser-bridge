// Smoke test for content.js selector logic (numbered ambiguity, resolved-index
// semantics, text suggestions). Runs the real source with a stubbed document.
// Usage: node test-selector-logic.js
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../addon/content.js", "utf8");

const els = [];
function mk(tag, text, opts = {}) {
  const el = {
    tagName: tag, children: [], offsetWidth: 10, offsetHeight: 10,
    className: opts.class || "", id: opts.id || null, textContent: text,
    getAttribute: () => null, parentElement: opts.parent || null
  };
  els.push(el);
  return el;
}
const megaPanel = mk("DIV", "", { class: "mega-panel" });
const filters = mk("DIV", "", { class: "filters" });
const btn1 = mk("BUTTON", "Add to cart", { class: "btn", parent: megaPanel });
const btn2 = mk("BUTTON", "Add to cart", { class: "btn", parent: filters });
const shop = mk("BUTTON", "Shop \u25be", { id: "mega-toggle" });
mk("A", "Laptops");
const pg2 = mk("BUTTON", "2", { class: "active" });
const optRed = mk("OPTION", "Red");
const optBlue = mk("OPTION", "Blue");
optRed.value = "red"; optBlue.value = "blue";
const select = mk("SELECT", "", {});
optRed.parentElement = select; optBlue.parentElement = select;
select.value = "red";

document = {
  documentElement: { appendChild() {}, remove() {} },
  querySelectorAll(sel) {
    if (sel === "body *") return els;
    if (sel === "#toast, [class*=toast]") return [];
    if (sel === "#mega-toggle") return [shop];
    if (sel === "[data-page=\"2\"]") return [pg2];
    if (sel === "[data-page=2]") throw new Error("'[data-page=2]' is not a valid selector");
    return [];
  },
  createElement: () => ({ remove() {} }),
  body: { appendChild() {} },
  querySelector: () => null
};
window = { wrappedJSObject: undefined };
browser = { runtime: { onMessage: { addListener() {} } } };
MutationObserver = class { observe() {} disconnect() {} };
getComputedStyle = () => ({ display: "block", visibility: "visible" });
globalThis.btn1 = btn1; globalThis.btn2 = btn2; globalThis.shop = shop; globalThis.pg2 = pg2;

const test = new Function(src + `
  return {
    p1: parseSelector('text=Add to cart').type === 'text',
    p2: parseSelector('text=Add to cart|index=1').index === 1 && parseSelector('text=Add to cart|index=1').explicitIndex === true,
    r1: (r => r.error && /did you mean/.test(r.error))(resolveElement('text=Add to cartX', false)),
    r2: (r => !r.error && r.el === btn2 && r.ambiguous === false && r.matched[1].hint === '|index=1')(resolveElement('text=Add to cart|index=1', true)),
    r3: (r => r.error && r.matched[0].hint === '|index=0')(resolveElement('text=Add to cart', true)),
    r4: (r => !r.error && r.el === shop && r.ambiguous === false)(resolveElement('#mega-toggle', true)),
    r5: (r => r.error && r.error.includes('Shop') && r.suggestions.length > 0)(resolveElement('text=Shop', false)),
    r6: (r => !r.error && r.el === pg2)(resolveElement('[data-page=2]', false)),
    r7: (r => r.error && r.error.includes('index=0: BUTTON (in .mega-panel)') && r.error.includes('index=1: BUTTON (in .filters)'))(resolveElement('text=Add to cart', true)),
    r8: (r => !r.error && r.el === btn2 && r.matched[1].parent === '.filters')(resolveElement('text=Add to cart|index=1', true))
  };
`)();

const keys = ["p1", "p2", "r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8"];
let ok = true;
for (const k of keys) {
  const pass = test[k] === true;
  if (!pass) ok = false;
  console.log(k, pass ? "PASS" : "FAIL", JSON.stringify(test[k]).slice(0, 100));
}
process.exit(ok ? 0 : 1);
