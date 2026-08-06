let pageQueue = Promise.resolve();

(function installHooks() {
  const s = document.createElement("script");
  s.textContent = "if(!window.__bridge_hooks_installed){window.__bridge_hooks_installed=true;window.__bridge_console_logs=[];window.__bridge_network_logs=[];['log','error','warn','info','debug'].forEach(function(m){var o=console[m];console[m]=function(){var a=[];for(var i=0;i<arguments.length;i++){try{a.push(typeof arguments[i]==='object'?JSON.stringify(arguments[i]):String(arguments[i]))}catch(e){a.push(String(arguments[i]))}}window.__bridge_console_logs.push({level:m,args:a,ts:Date.now()});if(window.__bridge_console_logs.length>500)window.__bridge_console_logs.shift();o.apply(console,arguments)}});var of=window.fetch;window.fetch=function(u,o){var s=Date.now();var e={type:'fetch',method:(o&&o.method)||'GET',url:String(u),start:s};if(o&&o.body){try{e.reqBody=String(o.body).slice(0,1000)}catch(_){}}return of.apply(this,arguments).then(function(r){e.status=r.status;e.duration=Date.now()-s;try{var c=r.clone();c.text().then(function(t){e.resBody=t.slice(0,2000)}).catch(function(){})}catch(_){}window.__bridge_network_logs.push(e);if(window.__bridge_network_logs.length>200)window.__bridge_network_logs.shift();return r}).catch(function(err){e.error=err.message;e.duration=Date.now()-s;window.__bridge_network_logs.push(e);throw err})};var OX=window.XMLHttpRequest;window.XMLHttpRequest=function(){var x=new OX();var e={type:'xhr',method:'GET',url:'',start:0};var oo=x.open;x.open=function(m,u){e.method=m;e.url=String(u);return oo.apply(this,arguments)};var os=x.send;x.send=function(b){if(b){try{e.reqBody=String(b).slice(0,1000)}catch(_){}}e.start=Date.now();x.addEventListener('load',function(){e.status=x.status;e.duration=Date.now()-e.start;try{e.resBody=String(x.responseText).slice(0,2000)}catch(_){}window.__bridge_network_logs.push(e);if(window.__bridge_network_logs.length>200)window.__bridge_network_logs.shift()});x.addEventListener('error',function(){e.error='Network error';e.duration=Date.now()-e.start;window.__bridge_network_logs.push(e)});return os.apply(this,arguments)};return x}}";
  document.documentElement.appendChild(s);
  s.remove();
})();

function injectPage(code) {
  const p = pageQueue.then(() => new Promise(resolve => {
    const id = "bridge-" + Math.random().toString(36).slice(2);
    const handler = e => {
      if (e.data && e.data.type === id) {
        window.removeEventListener("message", handler);
        resolve(e.data.result);
      }
    };
    window.addEventListener("message", handler);
    const s = document.createElement("script");
    s.textContent = "(async function(){try{var __r=await eval(" + JSON.stringify(code) + ");window.postMessage({type:" + JSON.stringify(id) + ",result:__r}," + JSON.stringify(location.origin) + ")}catch(e){window.postMessage({type:" + JSON.stringify(id) + ",result:{error:e.message}}," + JSON.stringify(location.origin) + ")}})()";
    document.documentElement.appendChild(s);
    s.remove();
    setTimeout(() => { window.removeEventListener("message", handler); resolve({ error: "timeout" }); }, 5000);
  }));
  pageQueue = p.catch(() => {});
  return p;
}

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
  if (msg.cmd === "console") {
    return injectPage("JSON.stringify(window.__bridge_console_logs||[])").then(s => {
      if (typeof s === 'string') return { logs: JSON.parse(s) };
      return { logs: [] };
    }).catch(e => ({ error: e.message }));
  }
  if (msg.cmd === "network") {
    return injectPage("JSON.stringify(window.__bridge_network_logs||[])").then(s => {
      if (typeof s === 'string') return { logs: JSON.parse(s) };
      return { logs: [] };
    }).catch(e => ({ error: e.message }));
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
        inputs: inputs.slice(0, 20)
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
        .slice(0, 50)
    )];

    info.meta = Array.from(document.querySelectorAll("meta")).map(m => ({
      name: m.name || m.httpEquiv || "",
      content: m.content || "",
      property: m.getAttribute("property") || ""
    }));

    return Promise.resolve(info);
  }
});
