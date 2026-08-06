browser.runtime.onMessage.addListener(msg => {
  if (msg.cmd === "read") {
    const clone = document.body.cloneNode(true);
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    const parts = [];
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent.trim();
      if (t) parts.push(t);
    }
    const text = parts.join("\n");
    return Promise.resolve({ text, title: document.title, url: location.href });
  }
  if (msg.cmd === "html") {
    return Promise.resolve({ html: document.documentElement.outerHTML, title: document.title, url: location.href });
  }
  if (msg.cmd === "js") {
    try {
      const result = eval(msg.code);
      if (result instanceof Promise) {
        return result.then(r => ({ result: r })).catch(e => ({ error: e.message }));
      }
      return Promise.resolve({ result });
    } catch (e) {
      return Promise.resolve({ error: e.message });
    }
  }
  if (msg.cmd === "security") {
    const info = { url: location.href, protocol: location.protocol };

    info.forms = Array.from(document.querySelectorAll("form")).map(f => {
      const action = f.action || location.href;
      const inputs = Array.from(f.querySelectorAll("input, textarea, select")).map(el => ({
        type: el.type || "text",
        name: el.name || "",
        autocomplete: el.autocomplete || "on"
      }));
      const hasPassword = inputs.some(i => i.type === "password");
      return {
        action,
        method: (f.method || "get").toLowerCase(),
        hasPassword,
        inputCount: inputs.length,
        inputs: inputs.slice(0, 20) // ponytail: cap to 20 inputs per form
      };
    });

    info.scripts = Array.from(document.querySelectorAll("script")).map(s => {
      const src = s.src || null;
      let content = null;
      if (!src) {
        content = s.textContent.slice(0, 500);
      }
      return { src, content };
    });

    info.cookies = document.cookie.split(";").filter(c => c.trim())
      .map(c => c.trim().split("=")[0]);

    info.localStorageKeys = Object.keys(localStorage).length;
    info.sessionStorageKeys = Object.keys(sessionStorage).length;

    const links = Array.from(document.querySelectorAll("a")).map(a => a.href);
    const scripts = Array.from(document.querySelectorAll("script[src]")).map(s => s.src);
    const iframes = Array.from(document.querySelectorAll("iframe[src]")).map(i => i.src);
    const imgs = Array.from(document.querySelectorAll("img[src]")).map(i => i.src);
    info.externalDomains = [...new Set(
      [...links, ...scripts, ...iframes, ...imgs]
        .map(u => { try { return new URL(u, location.href).origin } catch(e) { return null; } })
        .filter(o => o && o !== location.origin)
        .slice(0, 50) // ponytail: cap external domains
    )];

    info.meta = Array.from(document.querySelectorAll("meta")).map(m => ({
      name: m.name || m.httpEquiv || "",
      content: m.content || "",
      property: m.getAttribute("property") || ""
    }));

    return Promise.resolve(info);
  }
});
