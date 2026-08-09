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

browser.runtime.onMessage.addListener(msg => {
  switch (msg.cmd) {
    case "read": {
      const clone = document.body.cloneNode(true);
      const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
      const parts = [];
      let node;
      while ((node = walker.nextNode())) {
        const t = node.textContent.trim();
        if (t) parts.push(t);
      }
      return Promise.resolve({ text: parts.join("\n"), title: document.title, url: location.href });
    }
    case "html":
      return Promise.resolve({ html: document.documentElement.outerHTML, title: document.title, url: location.href });
    case "js":
      try {
        const result = eval(msg.code);
        if (result instanceof Promise) {
          return result.then(r => ({ result: r })).catch(e => ({ error: e.message }));
        }
        return Promise.resolve({ result });
      } catch (e) {
        return Promise.resolve({ error: e.message });
      }
    case "console":
      return readPageLogs("__bridge_console_logs");
    case "network":
      return readPageLogs("__bridge_network_logs");
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
