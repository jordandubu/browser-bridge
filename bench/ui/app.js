/* bench/ui shop — shared interaction logic */
(function () {
  function toast(msg) {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2000);
  }
  window.__toast = toast;

  // persistent evidence log — every interaction records here so a grader can
  // verify the AI actually performed each action after it finishes.
  let evidence = [];
  try { evidence = JSON.parse(localStorage.getItem("bench_ui_evidence") || "[]"); } catch (e) {}
  function log(ev) {
    evidence.push(Object.assign({ ts: Date.now() }, ev));
    localStorage.setItem("bench_ui_evidence", JSON.stringify(evidence));
  }
  window.__evidence = { get: () => evidence, clear: () => { evidence = []; localStorage.removeItem("bench_ui_evidence"); } };

  // cart state (shared via localStorage)
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem("bench_ui_cart") || "[]"); } catch (e) {}
  function saveCart() { localStorage.setItem("bench_ui_cart", JSON.stringify(cart)); }
  function cartCount() { return cart.reduce((a, i) => a + i.qty, 0); }
  function renderCartBadge() {
    document.querySelectorAll("[data-cart-count]").forEach(el => el.textContent = cartCount());
  }
  window.__cart = { get: () => cart, add: (id, name, price, qty) => {
    const ex = cart.find(i => i.id === id);
    if (ex) ex.qty += qty; else cart.push({ id, name, price, qty });
    saveCart(); renderCartBadge(); toast("Added " + name);
  }, setQty: (id, qty) => { const ex = cart.find(i => i.id === id); if (ex) { ex.qty = qty; if (qty <= 0) cart = cart.filter(i => i.id !== id); saveCart(); renderCartBadge(); } }, clear: () => { cart = []; saveCart(); renderCartBadge(); } };

  // mega menu
  document.querySelectorAll(".mega > .mega-btn").forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      const m = b.parentElement;
      const wasOpen = m.classList.contains("open");
      document.querySelectorAll(".mega.open, .dd.open").forEach(x => x.classList.remove("open"));
      if (!wasOpen) m.classList.add("open");
    });
  });
  // dropdowns
  document.querySelectorAll(".dd > .dd-btn").forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      const d = b.parentElement;
      const wasOpen = d.classList.contains("open");
      document.querySelectorAll(".mega.open, .dd.open").forEach(x => x.classList.remove("open"));
      if (!wasOpen) d.classList.add("open");
    });
  });
  document.addEventListener("click", () => {
    document.querySelectorAll(".mega.open, .dd.open").forEach(x => x.classList.remove("open"));
  });

  // mega menu links
  document.querySelectorAll(".mega-panel a[data-nav]").forEach(a => {
    a.addEventListener("click", () => { const v = a.getAttribute("data-nav"); toast("Menu: " + v); log({ ev: "menu", value: v }); });
  });
  // account dropdown links
  document.querySelectorAll(".dd-panel a[data-acc]").forEach(a => {
    a.addEventListener("click", () => { const v = a.getAttribute("data-acc"); toast("Account: " + v); log({ ev: "account", value: v }); });
  });

  // search
  const searchBtn = document.getElementById("search-btn");
  if (searchBtn) searchBtn.addEventListener("click", () => {
    const q = document.getElementById("search-input").value;
    toast("Search: " + (q || "all"));
    log({ ev: "search", value: q || "all" });
  });

  // add-to-cart buttons
  document.querySelectorAll("[data-add]").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-add");
      const name = b.getAttribute("data-name") || id;
      const price = parseFloat(b.getAttribute("data-price") || "0");
      window.__cart.add(id, name, price, 1);
      log({ ev: "cart_add", id, name });
    });
  });

  // product variants
  document.querySelectorAll(".variant").forEach(v => {
    v.addEventListener("click", () => {
      v.parentElement.querySelectorAll(".variant").forEach(x => x.classList.remove("active"));
      v.classList.add("active");
      toast("Variant: " + v.textContent);
      log({ ev: "variant", value: v.textContent });
    });
  });

  // qty steppers
  document.querySelectorAll("[data-qty-inc]").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-qty-inc");
      const span = document.querySelector('[data-qty-val="' + id + '"]');
      const n = parseInt(span.textContent) + 1;
      span.textContent = n;
      window.__cart.setQty(id, n);
      log({ ev: "qty", id, value: n });
    });
  });
  document.querySelectorAll("[data-qty-dec]").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-qty-dec");
      const span = document.querySelector('[data-qty-val="' + id + '"]');
      const n = Math.max(0, parseInt(span.textContent) - 1);
      span.textContent = n;
      window.__cart.setQty(id, n);
      log({ ev: "qty", id, value: n });
    });
  });

  // filters
  document.querySelectorAll("[data-filter]").forEach(sel => {
    sel.addEventListener("change", () => { toast("Filter: " + sel.value); log({ ev: "filter", value: sel.value }); });
  });
  document.querySelectorAll(".chip").forEach(c => {
    c.addEventListener("click", () => {
      c.classList.toggle("active");
      toast("Chip: " + c.textContent);
      log({ ev: "chip", value: c.textContent });
    });
  });

  // pagination
  document.querySelectorAll("[data-page]").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll("[data-page]").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      toast("Page " + b.getAttribute("data-page"));
      log({ ev: "page", value: b.getAttribute("data-page") });
    });
  });

  // tabs
  document.querySelectorAll(".tab[data-tab]").forEach(t => {
    t.addEventListener("click", () => {
      const group = t.closest(".tabs");
      group.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      const panel = t.getAttribute("data-tab");
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      const target = document.getElementById("panel-" + panel);
      if (target) target.classList.add("active");
      toast("Tab: " + t.textContent);
      log({ ev: "tab", value: t.textContent });
    });
  });

  // accordions
  document.querySelectorAll(".acc-head").forEach(h => {
    h.addEventListener("click", () => { h.parentElement.classList.toggle("open"); log({ ev: "accordion", value: h.textContent }); });
  });

  // modals
  document.querySelectorAll("[data-modal-open]").forEach(b => {
    b.addEventListener("click", () => { document.getElementById(b.getAttribute("data-modal-open")).classList.add("open"); log({ ev: "modal_open", value: b.getAttribute("data-modal-open") }); });
  });
  document.querySelectorAll("[data-modal-close]").forEach(b => {
    b.addEventListener("click", () => b.closest(".modal-overlay").classList.remove("open"));
  });
  document.querySelectorAll("[data-modal-confirm]").forEach(b => {
    b.addEventListener("click", () => {
      b.closest(".modal-overlay").classList.remove("open");
      toast("Confirmed: " + b.getAttribute("data-modal-confirm"));
      log({ ev: "modal_confirm", value: b.getAttribute("data-modal-confirm") });
    });
  });

  // stepper (checkout)
  const stepNext = document.getElementById("step-next");
  if (stepNext) {
    let step = 1;
    stepNext.addEventListener("click", () => {
      step = Math.min(3, step + 1);
      document.querySelectorAll(".step").forEach((s, i) => s.classList.toggle("active", i < step));
      document.querySelectorAll(".step-form").forEach(f => f.classList.remove("active"));
      const cur = document.getElementById("step-form-" + step);
      if (cur) cur.classList.add("active");
      if (step === 3) toast("Checkout: step 3");
      log({ ev: "checkout_step", value: step });
    });
  }

  // user toggles
  document.querySelectorAll("[data-toggle]").forEach(b => {
    b.addEventListener("click", () => {
      const tr = b.closest("tr");
      const st = tr.querySelector(".status");
      const on = st.classList.contains("on");
      st.classList.toggle("on", !on);
      st.classList.toggle("off", on);
      st.textContent = on ? "blocked" : "active";
      toast(tr.querySelector(".u-name").textContent + " → " + st.textContent);
      log({ ev: "toggle", id: b.getAttribute("data-toggle"), value: st.textContent });
    });
  });

  // late-injected button
  setTimeout(() => {
    const sec = document.getElementById("late-section");
    if (sec) {
      const b = document.createElement("button");
      b.className = "btn primary";
      b.id = "late-btn";
      b.textContent = "Claim Reward";
      b.addEventListener("click", () => {
        document.getElementById("late-status").textContent = "Reward claimed";
        toast("Reward claimed");
        log({ ev: "late", value: "claimed" });
      });
      sec.appendChild(b);
    }
  }, 1500);

  renderCartBadge();
})();
