(function installHooks() {
  const s = document.createElement("script");
  s.textContent = "if(!window.__bridge_hooks_installed){window.__bridge_hooks_installed=true;window.__bridge_console_logs=[];window.__bridge_network_logs=[];window.__bridge_postmessage_logs=[];window.__bridge_ws_logs=[];['log','error','warn','info','debug'].forEach(function(m){var o=console[m];console[m]=function(){var a=[];for(var i=0;i<arguments.length;i++){try{a.push(typeof arguments[i]==='object'?JSON.stringify(arguments[i]):String(arguments[i]))}catch(e){a.push(String(arguments[i]))}}window.__bridge_console_logs.push({level:m,args:a,ts:Date.now()});if(window.__bridge_console_logs.length>500)window.__bridge_console_logs.shift();o.apply(console,arguments)}});var of=window.fetch;window.fetch=function(u,o){var s=Date.now();var e={type:'fetch',method:(o&&o.method)||'GET',url:String(u),start:s};if(o&&o.body){try{e.reqBody=String(o.body).slice(0,1000)}catch(_){}}if(o&&o.headers){try{var h={};if(o.headers instanceof Headers){o.headers.forEach(function(v,k){h[k]=v})}else{for(var k in o.headers)h[k]=o.headers[k]}e.reqHeaders=h}catch(_){}}return of.apply(this,arguments).then(function(r){e.status=r.status;e.duration=Date.now()-s;try{var c=r.clone();c.text().then(function(t){e.resBody=t.slice(0,2000)}).catch(function(){})}catch(_){}window.__bridge_network_logs.push(e);if(window.__bridge_network_logs.length>200)window.__bridge_network_logs.shift();return r}).catch(function(err){e.error=err.message;e.duration=Date.now()-s;window.__bridge_network_logs.push(e);throw err})};var OX=window.XMLHttpRequest;window.XMLHttpRequest=function(){var x=new OX();var e={type:'xhr',method:'GET',url:'',start:0};var oo=x.open;x.open=function(m,u){e.method=m;e.url=String(u);return oo.apply(this,arguments)};var osh=x.setRequestHeader;x.setRequestHeader=function(n,v){if(!e.reqHeaders)e.reqHeaders={};e.reqHeaders[n]=v;return osh.apply(this,arguments)};var os=x.send;x.send=function(b){if(b){try{e.reqBody=String(b).slice(0,1000)}catch(_){}}e.start=Date.now();x.addEventListener('load',function(){e.status=x.status;e.duration=Date.now()-e.start;try{e.resBody=String(x.responseText).slice(0,2000)}catch(_){}window.__bridge_network_logs.push(e);if(window.__bridge_network_logs.length>200)window.__bridge_network_logs.shift()});x.addEventListener('error',function(){e.error='Network error';e.duration=Date.now()-e.start;window.__bridge_network_logs.push(e)});return os.apply(this,arguments)};return x};var opm=window.postMessage;window.postMessage=function(d,to,tr){window.__bridge_postmessage_logs.push({origin:window.location.origin,data:typeof d==='object'?JSON.stringify(d):String(d),source:'self',ts:Date.now()});if(window.__bridge_postmessage_logs.length>200)window.__bridge_postmessage_logs.shift();return opm.apply(this,arguments)};window.addEventListener('message',function(e){window.__bridge_postmessage_logs.push({origin:e.origin,data:typeof e.data==='object'?JSON.stringify(e.data):String(e.data),source:e.source===window?'self':'iframe',ts:Date.now()});if(window.__bridge_postmessage_logs.length>200)window.__bridge_postmessage_logs.shift()});var OWS=window.WebSocket;window.WebSocket=function(url,protocols){window.__bridge_ws_logs.push({url:String(url),direction:'connect',data:'',ts:Date.now()});var ws=new OWS(url,protocols);var osend=ws.send;ws.send=function(d){window.__bridge_ws_logs.push({url:String(url),direction:'send',data:String(d).slice(0,2000),ts:Date.now()});return osend.apply(this,arguments)};ws.addEventListener('message',function(e){window.__bridge_ws_logs.push({url:String(url),direction:'recv',data:String(e.data).slice(0,2000),ts:Date.now()})});return ws}}";
  document.documentElement.appendChild(s);
  s.remove();
})();

function readPageLogs(key) {
  try {
    const w = window.wrappedJSObject;
    const src = w[key];
    if (!src) return Promise.resolve({ logs: [] });
    const logs = [];
    for (let i = 0; i < src.length; i++) {
      try { logs.push(JSON.parse(JSON.stringify(src[i]))); } catch (e) { logs.push({ _error: e.message }); }
    }
    return Promise.resolve({ logs });
  } catch (e) {
    return Promise.resolve({ error: e.message });
  }
}

let lastMatches = [];

// Toast history: the page typically reuses ONE toast div and swaps its text
// (bench/ui/app.js does exactly that), so a snapshot-based toast tool returns
// stale text as the "latest". Keep a ring of recent messages; browser_toast
// reports the newest text seen since the last read plus how long ago it fired.
let toastHistory = [];
let toastSeenAt = 0;
function trackToast() {
  const el = document.querySelector("#toast, [class*=toast]");
  if (!el) return;
  const text = (el.textContent || "").trim();
  const hidden = (el.classList && el.classList.contains("show") === false && el.classList.length > 0) ||
    getComputedStyle(el).display === "none" || getComputedStyle(el).visibility === "hidden";
  const last = toastHistory[toastHistory.length - 1];
  const sameText = last && last.text === text;
  if (sameText) {
    last.ts = Date.now();
  } else if (text) {
    toastHistory.push({ text, ts: Date.now(), visible: !hidden });
    if (toastHistory.length > 10) toastHistory.shift();
  }
  if (toastHistory.length) toastHistory[toastHistory.length - 1].visible = !hidden;
}
new MutationObserver(() => trackToast()).observe(document.documentElement, {
  childList: true, subtree: true, characterData: true, attributes: true
});
trackToast();

function describe(el) {
  let parent = null;
  for (let p = el.parentElement, depth = 0; p && depth < 3; p = p.parentElement, depth++) {
    if (p.id || (typeof p.className === "string" && p.className.trim())) {
      parent = (p.id ? "#" + p.id : "") + (typeof p.className === "string" && p.className.trim() ? "." + p.className.trim().split(/\s+/).join(".") : "");
      break;
    }
  }
  return {
    tag: el.tagName,
    id: el.id || null,
    class: typeof el.className === "string" ? el.className : null,
    name: el.getAttribute && el.getAttribute("name") || null,
    text: (el.textContent || "").trim().slice(0, 80),
    parent
  };
}

// Parse a selector into { type, value, index }.
// Supported forms:
//   "text=Shop"        exact text match (leaf-most element)
//   "text*=keyboard"   substring text match
//   "role=button"      ARIA role
//   "label=Search"     <label for> text
//   "#id", ".class", "tag", "[attr]", any CSS selector
//   optional trailing "|index=N" to disambiguate multi-matches
//   pseudo ":has-text(X)" / ":contains(X)" / ":text(X)" are translated to
//   text/text* so agents can use them like in Playwright.
function parseSelector(sel) {
  let s = (sel || "").trim();
  if (!s) return null;
  let index = 0;
  let explicitIndex = false;
  const idxMatch = s.match(/\|index=(\d+)\s*$/);
  if (idxMatch) {
    index = parseInt(idxMatch[1], 10);
    explicitIndex = true;
    s = s.slice(0, idxMatch.index).trim();
  }
  let type = "css", value = s;
  const m = s.match(/^(text\*?|role|label)=(.+)$/i);
  if (m) {
    type = m[1].toLowerCase();
    value = m[2].trim();
  } else {
    // elementPrefix:has-text("...") — strip "span.chip:" etc. and keep the text.
    const p = s.match(/^(?:[^\s:]+:)?(?:has-text|contains|text)\(\s*([\s\S]*?)\s*\)\s*$/i);
    if (p) {
      type = "text*";
      value = p[1].replace(/^['"]|['"]$/g, "");
    }
  }
  return { type, value, index, explicitIndex };
}

function matchByType(type, value) {
  if (type === "text") {
    // leaf-most elements whose trimmed text equals value
    return Array.from(document.querySelectorAll("body *")).filter(el =>
      el.children.length === 0 && el.textContent.trim() === value
    );
  }
  if (type === "text*") {
    return Array.from(document.querySelectorAll("body *")).filter(el =>
      el.children.length === 0 && el.textContent.includes(value)
    );
  }
  if (type === "role") {
    return Array.from(document.querySelectorAll("[role='" + value + "']"));
  }
  if (type === "label") {
    const labels = Array.from(document.querySelectorAll("label")).filter(l =>
      l.textContent.trim() === value
    );
    const els = [];
    labels.forEach(l => {
      const forId = l.getAttribute("for");
      if (forId) {
        const t = document.getElementById(forId);
        if (t) els.push(t);
      } else {
        const c = l.querySelector("input, select, textarea");
        if (c) els.push(c);
      }
    });
    return els;
  }
  if (type === "css") {
    // [data-page=2] is valid HTML but querySelectorAll rejects unquoted attr
    // values — auto-quote and retry before failing.
    let sel = value;
    if (!/['"]/.test(sel)) {
      sel = sel.replace(/\[([\w-]+)=([^'"\]\s][^'"\]]*)\]/g, '[$1="$2"]');
    }
    try {
      return Array.from(document.querySelectorAll(sel));
    } catch (e) {
      if (sel !== value) return Array.from(document.querySelectorAll(value));
      throw e;
    }
  }
  return Array.from(document.querySelectorAll(value));
}

// Text fallback: exact text match fails, so suggest the closest real options.
// Returns up to 5 candidate descriptions so the error message is actionable.
function textSuggestions(value, type) {
  const exact = type === "text";
  const els = Array.from(document.querySelectorAll("body *")).filter(el => {
    if (el.children.length > 0) return false;
    const t = el.textContent.trim();
    if (!t) return false;
    return exact ? (t.includes(value) || value.includes(t)) : t.includes(value);
  });
  const uniq = [];
  const seen = new Set();
  for (const el of els) {
    const d = describe(el);
    const key = el.tagName + ":" + d.text;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(d);
    if (uniq.length >= 5) break;
  }
  return uniq;
}

// Returns { el, matched, ambiguous } or { error }.
// requireUnique: mutating actions (click/type/act) pass true so an ambiguous
// selector errors instead of silently acting on the first match.
function resolveElement(selector, requireUnique) {
  const parsed = parseSelector(selector);
  if (!parsed) return { error: "empty selector" };
  let candidates;
  try {
    candidates = matchByType(parsed.type, parsed.value);
  } catch (e) {
    return { error: "invalid selector: " + e.message };
  }
  if (!candidates.length) {
    lastMatches = [];
    const suggest = parsed.type === "text" || parsed.type === "text*"
      ? textSuggestions(parsed.value, parsed.type)
      : [];
    if (suggest.length) {
      return { error: "no exact match for: " + selector + " — did you mean: " + suggest.map(d => d.tag + ' "' + d.text + '"').join(", "), suggestions: suggest };
    }
    return { error: "no element matched selector: " + selector };
  }
  const visible = candidates.filter(el => el.offsetWidth || el.offsetHeight);
  const pool = visible.length ? visible : candidates;
  lastMatches = pool.map(describe);
  if (parsed.index >= pool.length) {
    return { error: "index " + parsed.index + " out of range (matched " + pool.length + ")", matched: numbered(lastMatches) };
  }
  // Ambiguity resolution: exact `|index=N` or an unambiguous single match both
  // count as resolved. Anything else (substring text matching many leaves,
  // CSS matching many nodes) errors instead of silently acting on the first.
  const resolved = parsed.explicitIndex || pool.length === 1;
  if (requireUnique && pool.length > 1 && !resolved) {
    const list = numbered(lastMatches).map(d => "index=" + d.index + ": " + d.tag + (d.parent ? " (in " + d.parent + ")" : "") + ' "' + d.text + '"').join("\n");
    return { error: "ambiguous selector: " + selector + " matched " + pool.length + " elements, append |index=N to pick one\n" + list, matched: numbered(lastMatches) };
  }
  const el = pool[parsed.index];
  return { el, matched: numbered(lastMatches), ambiguous: !resolved };
}

function numbered(els) {
  return els.map((d, i) => Object.assign({ index: i, hint: "|index=" + i }, d));
}

// Wait until a selector exists/visible, up to timeout ms. MutationObserver
// based — no busy-wait.
function waitForSelector(selector, timeout) {
  return new Promise(resolve => {
    const start = Date.now();
    let done = false;
    const finish = r => { if (!done) { done = true; resolve(r); } };
    const check = () => {
      const r = resolveElement(selector);
      if (!r.error) { finish(r); return true; }
      if (Date.now() - start >= timeout) { finish({ error: "timeout waiting for: " + selector, matched: lastMatches }); return true; }
      return false;
    };
    if (check()) return;
    const mo = new MutationObserver(() => { if (check()) mo.disconnect(); });
    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
    setTimeout(() => { mo.disconnect(); check(); }, timeout);
  });
}

browser.runtime.onMessage.addListener(async msg => {
  switch (msg.cmd) {
    case "ping":
      return Promise.resolve({ pong: true });
    case "read": {
      let root = document.body;
      if (msg.selector) {
        const r = resolveElement(msg.selector);
        if (r.error) return Promise.resolve({ error: r.error, matched: r.matched || lastMatches });
        root = r.el;
      }
      // walk the LIVE DOM (computed styles only work on attached nodes);
      // clone only for text extraction.
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const parts = [];
      let node;
      while ((node = walker.nextNode())) {
        const t = node.textContent.trim();
        if (!t) continue;
        if (msg.visibleOnly) {
          let el = node.parentElement;
          let hidden = false;
          while (el && el !== document.body) {
            const cs = getComputedStyle(el);
            if (cs.display === "none" || cs.visibility === "hidden") { hidden = true; break; }
            el = el.parentElement;
          }
          if (hidden) continue;
        }
        parts.push(t);
      }
      const text = parts.join("\n");
      const truncated = msg.maxChars && text.length > msg.maxChars;
      return Promise.resolve({
        text: truncated ? text.slice(0, msg.maxChars) : text,
        truncated,
        totalChars: text.length,
        title: document.title,
        url: location.href
      });
    }
    case "html": {
      const html = document.documentElement.outerHTML;
      const truncated = msg.maxChars && html.length > msg.maxChars;
      return Promise.resolve({
        html: truncated ? html.slice(0, msg.maxChars) : html,
        truncated,
        totalChars: html.length,
        title: document.title,
        url: location.href
      });
    }    case "click": {
      try {
        const r = resolveElement(msg.selector, true);
        if (r.error) return Promise.resolve({ error: r.error, matched: r.matched || lastMatches });
        if (r.el.tagName === "OPTION") {
          // Clicking an <option> fires no change on the parent <select> in
          // headless/automation contexts — set value + dispatch like a real
          // user pick would.
          const sel = r.el.closest("select");
          if (sel) {
            sel.value = r.el.value;
            sel.dispatchEvent(new Event("change", { bubbles: true }));
            return Promise.resolve({ clicked: describe(r.el), changedSelect: true, matched: r.matched, ambiguous: r.ambiguous });
          }
        }
        r.el.scrollIntoView({ block: "center" });
        r.el.click();
        return Promise.resolve({ clicked: describe(r.el), matched: r.matched, ambiguous: r.ambiguous });
      } catch (e) { return Promise.resolve({ error: e.message }); }
    }
    case "type": {
      try {
        const r = resolveElement(msg.selector, true);
        if (r.error) return Promise.resolve({ error: r.error, matched: r.matched || lastMatches });
        r.el.focus();
        r.el.value = msg.value;
        r.el.dispatchEvent(new Event("input", { bubbles: true }));
        r.el.dispatchEvent(new Event("change", { bubbles: true }));
        // verify the value actually landed on the real field (React etc. may
        // need a native setter to register the change).
        let landed = r.el.value === msg.value || r.el.defaultValue === msg.value;
        if (!landed) {
          // native setter fallback for framework-controlled inputs
          const proto = r.el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
          setter.call(r.el, msg.value);
          r.el.dispatchEvent(new Event("input", { bubbles: true }));
          r.el.dispatchEvent(new Event("change", { bubbles: true }));
          landed = r.el.value === msg.value;
        }
        if (msg.pressEnter) {
          ["keydown", "keypress", "keyup"].forEach(k =>
            r.el.dispatchEvent(new KeyboardEvent(k, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }))
          );
          const form = r.el.closest("form");
          if (form) {
            form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
          } else {
            // no form: hit the obvious submit/search sibling (bench/ui search
            // box is a bare div + 🔍 button), so pressEnter still lands
            const scope = r.el.parentElement || document;
            const btn = scope.querySelector('button[type="submit"], button[type="search"], button:not([type])');
            if (btn) btn.click();
          }
        }
        return Promise.resolve({ typed: true, value: r.el.value || "", landed, matched: r.matched, ambiguous: r.ambiguous });
      } catch (e) { return Promise.resolve({ error: e.message }); }
    }
    case "act": {
      // Compound action: perform action, optionally wait for a selector, then
      // return post-state (toast, cart count, matched) in one round trip.
      const out = { action: msg.action, selector: msg.selector };
      try {
        if (msg.action === "click" || msg.action === "type") {
          const r = resolveElement(msg.selector, true);
          if (r.error) return Promise.resolve({ error: r.error, matched: r.matched || lastMatches });
          out.matched = r.matched;
          out.ambiguous = r.ambiguous;
          if (msg.action === "click") {
            const optSel = r.el.tagName === "OPTION" && r.el.closest("select");
            if (optSel) {
              optSel.value = r.el.value;
              optSel.dispatchEvent(new Event("change", { bubbles: true }));
              out.clicked = describe(r.el);
              out.changedSelect = true;
            } else {
              r.el.scrollIntoView({ block: "center" });
              r.el.click();
              out.clicked = describe(r.el);
            }
          } else {
            r.el.focus();
            r.el.value = msg.value || "";
            r.el.dispatchEvent(new Event("input", { bubbles: true }));
            r.el.dispatchEvent(new Event("change", { bubbles: true }));
            out.landed = r.el.value === (msg.value || "") || r.el.defaultValue === (msg.value || "");
            if (!out.landed) {
              const proto = r.el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
              const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
              setter.call(r.el, msg.value || "");
              r.el.dispatchEvent(new Event("input", { bubbles: true }));
              r.el.dispatchEvent(new Event("change", { bubbles: true }));
              out.landed = r.el.value === (msg.value || "");
            }
            if (msg.pressEnter) {
              ["keydown", "keypress", "keyup"].forEach(k =>
                r.el.dispatchEvent(new KeyboardEvent(k, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }))
              );
              const form = r.el.closest("form");
              if (form) {
                form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
              } else {
                const scope = r.el.parentElement || document;
                const btn = scope.querySelector('button[type="submit"], button[type="search"], button:not([type])');
                if (btn) btn.click();
              }
            }
            out.typed = true;
          }
        } else if (msg.action === "wait") {
          const found = await waitForSelector(msg.selector, msg.timeout || 5000);
          if (found.error) return Promise.resolve({ error: found.error, matched: lastMatches });
          out.matched = found.matched;
          out.ambiguous = found.ambiguous;
          out.waited = true;
        } else {
          return Promise.resolve({ error: "unknown action: " + msg.action });
        }
        // verify: read a selector's text (e.g. toast) after the action
        if (msg.verify) {
          const v = resolveElement(msg.verify);
          out.verify = v.error ? null : (v.el.textContent || "").trim();
        }
        // generic post-state: toast + cart count if present
        const toast = document.querySelector("#toast, [class*=toast]");
        if (toast) out.toast = (toast.textContent || "").trim();
        const cart = document.querySelector("[data-cart-count], .cart-count, [class*=cart-count]");
        if (cart) out.cartCount = (cart.textContent || "").trim();
        return Promise.resolve(out);
      } catch (e) { return Promise.resolve({ error: e.message }); }
    }
    case "wait": {
      const found = await waitForSelector(msg.selector, msg.timeout || 5000);
      if (found.error) return Promise.resolve({ error: found.error, matched: lastMatches });
      return Promise.resolve({ waited: true, matched: found.matched, ambiguous: found.ambiguous, text: (found.el.textContent || "").trim().slice(0, 200) });
    }
    case "toast":
      return Promise.resolve({ toast: (() => {
        const t = document.querySelector("#toast, [class*=toast]");
        // A toast div is present. If it currently shows text (visible or not),
        // report it directly with a faded marker when hidden.
        if (t) {
          const text = (t.textContent || "").trim();
          const cs = getComputedStyle(t);
          const visible = cs.display !== "none" && cs.visibility !== "hidden" &&
            !(t.classList && t.classList.contains("show") === false && t.classList.length > 0);
          if (text) {
            // record before reading so the same text can't re-announce forever
            trackToast();
            const hist = toastHistory[toastHistory.length - 1];
            const age = hist && hist.text === text ? Date.now() - hist.ts : 0;
            return (visible ? text : text + " (faded)") + (age > 0 ? " (" + Math.round(age / 1000) + "s ago)" : "");
          }
        }
        // No toast div or it's empty: report toasts seen since the last read,
        // newest first, marked faded (they're off-screen now). If none unseen,
        // fall back to the newest ever seen so history stays readable.
        const now = Date.now();
        const unseen = toastHistory.filter(h => h.ts > toastSeenAt).reverse();
        const pick = unseen.length ? unseen[0] : toastHistory[toastHistory.length - 1];
        toastSeenAt = now;
        return pick ? pick.text + " (faded)" : null;
      })() });
    case "js":
      try {
        // expose page globals as `page` so the model can call page functions,
        // not just poke DOM (page = window.wrappedJSObject).
        // Strategy: inner eval returns the last expression value (so `1+1` and
        // statement sequences work); if the code uses explicit `return`, inner
        // eval throws and we fall back to a function wrapper.
        let result;
        try {
          result = eval("(function() { var page = window.wrappedJSObject; return eval(" + JSON.stringify(msg.code) + "); })()");
        } catch (e) {
          result = eval("(function() { var page = window.wrappedJSObject;\n" + msg.code + "\n})()");
        }
        if (result instanceof Promise) {
          return result.then(r => ({ result: r })).catch(e => ({ error: e.message }));
        }
        return Promise.resolve({ result });
      } catch (e) {
        return Promise.resolve({ error: e.message });
      }
    case "console":
      return readPageLogs("__bridge_console_logs");
    case "postmessage":
      return readPageLogs("__bridge_postmessage_logs");
    case "websocket":
      return readPageLogs("__bridge_ws_logs");
    case "dom_sinks": {
      const sinks = [];
      const scripts = document.querySelectorAll("script:not([src])");
      scripts.forEach(s => {
        const code = s.textContent || "";
        const patterns = [
          { name: "innerHTML", re: /\.innerHTML\s*=/g },
          { name: "outerHTML", re: /\.outerHTML\s*=/g },
          { name: "document.write", re: /document\.write\s*\(/g },
          { name: "eval", re: /eval\s*\(/g },
          { name: "setTimeout(string)", re: /setTimeout\s*\(\s*['"`]/g },
          { name: "setInterval(string)", re: /setInterval\s*\(\s*['"`]/g },
          { name: "insertAdjacentHTML", re: /\.insertAdjacentHTML\s*\(/g },
          { name: "location.href", re: /location\.href\s*=/g },
          { name: "location=", re: /location\s*=\s*(?![\s=])/g },
          { name: "jQuery.html", re: /\$\([^)]*\)\.html\s*\(/g },
          { name: "jQuery.append", re: /\$\([^)]*\)\.append\s*\(/g },
          { name: "jQuery.prepend", re: /\$\([^)]*\)\.prepend\s*\(/g },
          { name: "jQuery.after", re: /\$\([^)]*\)\.after\s*\(/g },
          { name: "jQuery.before", re: /\$\([^)]*\)\.before\s*\(/g },
          { name: "dangerouslySetInnerHTML", re: /dangerouslySetInnerHTML/g },
          { name: "createContextualFragment", re: /createContextualFragment\s*\(/g },
          { name: "document.URL", re: /document\.URL\b/g },
          { name: "documentURI", re: /document\.documentURI\b/g },
          { name: "baseURI", re: /\.baseURI\b/g },
          { name: "window.name", re: /window\.name\b/g }
        ];
        patterns.forEach(p => {
          const matches = code.match(p.re);
          if (matches) sinks.push({ sink: p.name, count: matches.length, snippet: code.slice(0, 200) });
        });
      });
      return Promise.resolve({ sinks, url: location.href });
    }
    case "clear_storage": {
      const result = { url: location.href };
      // Reset page-level in-memory state first (page JS may cache a copy of
      // localStorage in a module-scoped var, e.g. `cart`, so clearing storage
      // alone leaves stale state that gets written back on the next action).
      try {
        const page = window.wrappedJSObject;
        if (page && page.__cart && typeof page.__cart.clear === "function") page.__cart.clear();
        if (page && page.__evidence && typeof page.__evidence.clear === "function") page.__evidence.clear();
        result.appReset = true;
      } catch (e) { result.appResetError = e.message; }
      try { localStorage.clear(); result.localStorageCleared = true; } catch (e) { result.localStorageError = e.message; }
      try { sessionStorage.clear(); result.sessionStorageCleared = true; } catch (e) { result.sessionStorageError = e.message; }
      return Promise.resolve(result);
    }
    case "storage": {
      const result = { url: location.href };
      result.cookies = document.cookie.split(";").filter(c => c.trim()).map(c => {
        const [name, ...rest] = c.trim().split("=");
        return { name, value: rest.join("=") };
      });
      result.localStorage = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          result.localStorage[key] = localStorage.getItem(key);
        }
      } catch (e) { result.localStorageError = e.message; }
      result.sessionStorage = {};
      try {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          result.sessionStorage[key] = sessionStorage.getItem(key);
        }
      } catch (e) { result.sessionStorageError = e.message; }
      return Promise.resolve(result);
    }
    case "csp": {
      const csp = { url: location.href, meta: [], weaknesses: [] };
      const metaCsp = document.querySelector("meta[http-equiv='Content-Security-Policy'], meta[http-equiv='Content-Security-Policy-Report-Only']");
      if (metaCsp) csp.meta.push({ httpEquiv: metaCsp.httpEquiv, content: metaCsp.content });
      if (csp.meta.length > 0) {
        const policy = csp.meta.map(m => m.content).join("; ");
        if (policy.includes("unsafe-inline")) csp.weaknesses.push("unsafe-inline in script-src/style-src");
        if (policy.includes("unsafe-eval")) csp.weaknesses.push("unsafe-eval allowed");
        if (policy.includes("*")) csp.weaknesses.push("wildcard in policy");
        if (policy.includes("data:")) csp.weaknesses.push("data: URI allowed");
        if (policy.includes("https:") && !policy.includes("'self'")) csp.weaknesses.push("https: without 'self' restriction");
        if (!policy.includes("default-src") && !policy.includes("script-src")) csp.weaknesses.push("no script-src directive");
        if (!policy.includes("object-src") || policy.includes("object-src *")) csp.weaknesses.push("object-src missing or wildcard");
        if (!policy.includes("base-uri")) csp.weaknesses.push("base-uri not set");
        if (!policy.includes("frame-ancestors")) csp.weaknesses.push("frame-ancestors not set (clickjacking risk)");
        if (!policy.includes("form-action")) csp.weaknesses.push("form-action not set");
      } else {
        csp.weaknesses.push("no CSP meta tag found");
      }
      return Promise.resolve(csp);
    }
    case "cors": {
      const info = { url: location.href, crossOriginResources: [] };
      const selectors = [
        { sel: "script[src][crossorigin]", label: "script" },
        { sel: "link[rel='stylesheet'][crossorigin]", label: "stylesheet" },
        { sel: "img[crossorigin]", label: "img" },
        { sel: "video[crossorigin]", label: "video" },
        { sel: "audio[crossorigin]", label: "audio" },
        { sel: "link[rel='preload'][crossorigin]", label: "preload" },
        { sel: "link[rel='modulepreload'][crossorigin]", label: "modulepreload" },
        { sel: "script[type='module'][src]", label: "module-script" }
      ];
      selectors.forEach(({ sel, label }) => {
        document.querySelectorAll(sel).forEach(el => {
          info.crossOriginResources.push({
            type: label,
            src: el.src || el.href || "",
            crossorigin: el.getAttribute("crossorigin") || "anonymous"
          });
        });
      });
      const allScripts = document.querySelectorAll("script[src]");
      const allLinks = document.querySelectorAll("link[href]");
      const origins = new Set();
      [...allScripts, ...allLinks].forEach(el => {
        const u = el.src || el.href;
        try {
          const o = new URL(u, location.href).origin;
          if (o !== location.origin) origins.add(o);
        } catch (e) {}
      });
      info.externalOrigins = [...origins].slice(0, 30);
      return Promise.resolve(info);
    }
    case "event_listeners": {
      const result = { url: location.href, onAttributes: [], interactiveElements: [] };
      const onAttrs = ["onclick", "ondblclick", "onmousedown", "onmouseup", "onmouseover", "onmouseout",
        "onkeydown", "onkeyup", "onkeypress", "onsubmit", "onreset", "onchange", "oninput",
        "onfocus", "onblur", "onload", "onerror", "onscroll", "onresize", "onhashchange",
        "onpopstate", "onbeforeunload", "onunload", "oncontextmenu", "ondrag", "ondrop",
        "ontouchstart", "ontouchend", "onpointerdown", "onpointerup"];
      onAttrs.forEach(attr => {
        document.querySelectorAll("[" + attr + "]").forEach(el => {
          result.onAttributes.push({
            tag: el.tagName, id: el.id || null, class: el.className || null,
            name: el.getAttribute("name") || null, attr,
            value: (el.getAttribute(attr) || "").slice(0, 200)
          });
        });
      });
      const interactive = "form, button, a, input, select, textarea, [role='button'], [role='link'], [role='menuitem'], [tabindex]";
      document.querySelectorAll(interactive).forEach(el => {
        const hasOnAttr = onAttrs.some(a => el.hasAttribute(a));
        result.interactiveElements.push({
          tag: el.tagName, id: el.id || null, class: el.className || null,
          name: el.getAttribute("name") || null, type: el.getAttribute("type") || null,
          href: el.getAttribute("href") || null,
          text: (el.textContent || "").trim().slice(0, 100),
          hasOnAttribute: hasOnAttr
        });
      });
      return Promise.resolve(result);
    }
    case "security": {
      const info = { url: location.href, protocol: location.protocol };
      info.forms = Array.from(document.querySelectorAll("form")).map(f => {
        const action = f.action || location.href;
        const inputs = Array.from(f.querySelectorAll("input, textarea, select")).map(el => ({
          type: el.type || "text", name: el.name || "", autocomplete: el.autocomplete || "on"
        }));
        return { action, method: (f.method || "get").toLowerCase(), hasPassword: inputs.some(i => i.type === "password"), inputCount: inputs.length, inputs: inputs.slice(0, 20) };
      });
      info.scripts = Array.from(document.querySelectorAll("script")).map(s => {
        const src = s.src || null;
        return { src, content: src ? null : s.textContent.slice(0, 500) };
      });
      info.cookies = document.cookie.split(";").filter(c => c.trim()).map(c => c.trim().split("=")[0]);
      info.localStorageKeys = Object.keys(localStorage).length;
      info.sessionStorageKeys = Object.keys(sessionStorage).length;
      const links = Array.from(document.querySelectorAll("a")).map(a => a.href);
      const extScripts = Array.from(document.querySelectorAll("script[src]")).map(s => s.src);
      const iframes = Array.from(document.querySelectorAll("iframe[src]")).map(i => i.src);
      const imgs = Array.from(document.querySelectorAll("img[src]")).map(i => i.src);
      info.externalDomains = [...new Set(
        [...links, ...extScripts, ...iframes, ...imgs]
          .map(u => { try { return new URL(u, location.href).origin } catch(e) { return null; } })
          .filter(o => o && o !== location.origin).slice(0, 50)
      )];
      info.meta = Array.from(document.querySelectorAll("meta")).map(m => ({
        name: m.name || m.httpEquiv || "", content: m.content || "", property: m.getAttribute("property") || ""
      }));
      const metaCsp = document.querySelector("meta[http-equiv='Content-Security-Policy']");
      info.hasCspMeta = !!metaCsp;
      if (metaCsp) info.cspMeta = metaCsp.content;
      const inlineScripts = document.querySelectorAll("script:not([src])");
      info.inlineScriptCount = inlineScripts.length;
      info.inlineScriptsWithInnerHTML = 0;
      inlineScripts.forEach(s => { if (/\.innerHTML\s*=/.test(s.textContent || "")) info.inlineScriptsWithInnerHTML++; });
      info.iframes = Array.from(document.querySelectorAll("iframe")).map(f => ({
        src: f.src || null, id: f.id || null, name: f.name || null, sandbox: f.getAttribute("sandbox") || null
      }));
      return Promise.resolve(info);
    }
  }
});
