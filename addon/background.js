let port = null;
const networkLogs = {};
let stripHeadersActive = false;
const STRIP_HEADERS = ["content-security-policy", "content-security-policy-report-only",
  "x-xss-protection", "x-frame-options", "x-content-type-options"];

function reply(msg, data) {
  if (msg._id != null) data._id = msg._id;
  port.postMessage(data);
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
          tab => reply(msg, { url: tab.url, tabId: tab.id, title: tab.title }),
          err => reply(msg, { error: err.message })
        );
      } else {
        browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
          if (!tabs.length) {
            reply(msg, { error: "no active tab" });
            return;
          }
          browser.tabs.update(tabs[0].id, { url: msg.url }).then(
            tab => reply(msg, { url: tab.url, tabId: tab.id, title: tab.title }),
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
          if (msg.tabId == null || msg.tabId < 0 || msg.tabId >= tabs.length) {
            reply(msg, { error: "invalid tabId" });
            return;
          }
          browser.tabs.update(tabs[msg.tabId].id, { active: true }).then(
            tab => reply(msg, { switched: { index: msg.tabId, id: tab.id, title: tab.title, url: tab.url } }),
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
      browser.tabs.sendMessage(tabs[0].id, msg).then(
        resp => reply(msg, resp || { text: "" }),
        err => reply(msg, { error: err.message })
      );
    });
  });
  port.onDisconnect.addListener(() => {
    port = null;
    setTimeout(connect, 1000);
  });
}

connect();
