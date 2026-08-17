let port = null;
const networkLogs = {};
let stripHeadersActive = false;
const STRIP_HEADERS = ["content-security-policy", "content-security-policy-report-only",
  "x-xss-protection", "x-frame-options", "x-content-type-options"];

function reply(msg, data) {
  if (msg._id != null) data._id = msg._id;
  port.postMessage(data);
}

function waitTabLoaded(tabId, url, timeout = 10000) {
  const start = Date.now();
  return new Promise(resolve => {
    const check = () => {
      browser.tabs.get(tabId).then(tab => {
        // race guard: the tab may still report the PREVIOUS page's "complete"
        // status right after tabs.update — also require the URL to match.
        const urlOk = !url || (tab.url || "").split("#")[0] === url.split("#")[0];
        if ((tab.status === "complete" && urlOk) || Date.now() - start > timeout) {
          resolve(tab);
        } else {
          setTimeout(check, 100);
        }
      }, () => resolve(null));
    };
    check();
  });
}

// Wait until the content script is ready to receive messages on a tab.
// Polls sendMessage until it stops erroring with "Receiving end does not exist".
function waitContentReady(tabId, timeout = 5000) {
  const start = Date.now();
  return new Promise(resolve => {
    const ping = () => {
      browser.tabs.sendMessage(tabId, { cmd: "ping" }).then(
        () => resolve(true),
        () => {
          if (Date.now() - start > timeout) resolve(false);
          else setTimeout(ping, 100);
        }
      );
    };
    ping();
  });
}

browser.webNavigation.onBeforeNavigate.addListener(details => {
  if (details.frameId === 0) delete networkLogs[details.tabId];
});

browser.webRequest.onBeforeRequest.addListener(
  details => {
    const key = details.tabId;
    if (!networkLogs[key]) networkLogs[key] = [];
    networkLogs[key].push({
      type: details.type,
      method: details.method,
      url: details.url,
      tabId: details.tabId,
      ts: details.timeStamp,
      fromCache: details.fromCache
    });
    if (networkLogs[key].length > 500) networkLogs[key].shift();
  },
  { urls: ["<all_urls>"] }
);

browser.webRequest.onBeforeSendHeaders.addListener(
  details => {
    const key = details.tabId;
    if (!networkLogs[key]) networkLogs[key] = [];
    const entry = networkLogs[key].find(e => e.url === details.url && e.method === details.method && !e.reqHeaders);
    if (entry) {
      entry.reqHeaders = {};
      details.requestHeaders.forEach(h => { entry.reqHeaders[h.name] = h.value; });
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"]
);

browser.webRequest.onHeadersReceived.addListener(
  details => {
    if (!stripHeadersActive) return {};
    const responseHeaders = details.responseHeaders.filter(h =>
      !STRIP_HEADERS.includes(h.name.toLowerCase())
    );
    return { responseHeaders };
  },
  { urls: ["<all_urls>"] },
  ["blocking", "responseHeaders"]
);

function connect() {
  port = browser.runtime.connectNative("browser_bridge");
  port.onMessage.addListener(msg => {
    if (msg.cmd === "navigate") {
      if (msg.newTab !== false) {
        browser.tabs.create({ url: msg.url }).then(
          async tab => {
            await waitTabLoaded(tab.id, msg.url);
            await waitContentReady(tab.id);
            const t = await browser.tabs.get(tab.id);
            reply(msg, { url: t.url, tabId: tab.id, title: t.title });
          },
          err => reply(msg, { error: err.message })
        );
      } else {
        browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
          if (!tabs.length) {
            reply(msg, { error: "no active tab" });
            return;
          }
          browser.tabs.update(tabs[0].id, { url: msg.url }).then(
            async tab => {
              await waitTabLoaded(tab.id, msg.url);
              await waitContentReady(tab.id);
              const t = await browser.tabs.get(tab.id);
              reply(msg, { url: t.url, tabId: t.id, title: t.title });
            },
            err => reply(msg, { error: err.message })
          );
        });
      }
      return;
    }
    if (msg.cmd === "network") {
      browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        if (!tabs.length) {
          reply(msg, { error: "no active tab" });
          return;
        }
        const logs = networkLogs[tabs[0].id] || [];
        reply(msg, { logs });
      });
      return;
    }
    if (msg.cmd === "tabs") {
      if (msg.action === "list") {
        browser.tabs.query({ currentWindow: true }).then(tabs => {
          reply(msg, { tabs: tabs.map((t, i) => ({ index: i, id: t.id, title: t.title, url: t.url, active: t.active })) });
        });
      } else if (msg.action === "switch") {
        browser.tabs.query({ currentWindow: true }).then(tabs => {
          let target = null;
          let via = null;
          if (msg.tabId != null) {
            target = tabs.find(t => t.id === msg.tabId);
            if (target) via = "id";
          }
          if (!target && Number.isInteger(msg.tabId) && msg.tabId >= 0 && msg.tabId < tabs.length) {
            target = tabs[msg.tabId];
            via = "index";
          }
          if (!target) {
            reply(msg, { error: "invalid tabId: " + msg.tabId, tabs: tabs.map((t, i) => ({ index: i, id: t.id, title: t.title, url: t.url })) });
            return;
          }
          browser.tabs.update(target.id, { active: true }).then(
            tab => reply(msg, { switched: { index: tabs.findIndex(t => t.id === tab.id), id: tab.id, title: tab.title, url: tab.url }, matchedBy: via }),
            err => reply(msg, { error: err.message })
          );
        });
      } else if (msg.action === "close") {
        browser.tabs.query({ currentWindow: true }).then(tabs => {
          let target = null;
          let via = null;
          if (msg.tabId != null) {
            target = tabs.find(t => t.id === msg.tabId);
            if (target) via = "id";
          }
          if (!target && Number.isInteger(msg.tabId) && msg.tabId >= 0 && msg.tabId < tabs.length) {
            target = tabs[msg.tabId];
            via = "index";
          }
          if (!target) {
            reply(msg, { error: "invalid tabId: " + msg.tabId, tabs: tabs.map((t, i) => ({ index: i, id: t.id, title: t.title, url: t.url })) });
            return;
          }
          browser.tabs.remove(target.id).then(
            () => reply(msg, { closed: { id: target.id, title: target.title, url: target.url }, matchedBy: via }),
            err => reply(msg, { error: err.message })
          );
        });
      } else {
        reply(msg, { error: "unknown action: " + msg.action });
      }
      return;
    }
    if (msg.cmd === "strip_headers") {
      stripHeadersActive = msg.active === true;
      reply(msg, { stripHeadersActive, stripped: STRIP_HEADERS });
      return;
    }
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (!tabs.length) {
        reply(msg, { error: "no active tab" });
        return;
      }
      sendWithRetry(msg, tabs[0].id, 10);
    });
  });
  port.onDisconnect.addListener(() => {
    port = null;
    setTimeout(connect, 1000);
  });
}

function sendWithRetry(msg, tabId, attempts) {
  browser.tabs.sendMessage(tabId, msg).then(
    resp => reply(msg, resp || { text: "" }),
    err => {
      if (attempts > 0 && /Receiving end does not exist|Could not establish connection/.test(err.message)) {
        setTimeout(() => sendWithRetry(msg, tabId, attempts - 1), 150);
      } else {
        reply(msg, { error: err.message });
      }
    }
  );
}

connect();
