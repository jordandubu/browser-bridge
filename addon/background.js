let port = null;
const networkLogs = {};

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

function connect() {
  port = browser.runtime.connectNative("browser_bridge");
  port.onMessage.addListener(msg => {
    if (msg.cmd === "navigate") {
      if (msg.newTab !== false) {
        browser.tabs.create({ url: msg.url }).then(
          tab => port.postMessage({ url: tab.url, tabId: tab.id, title: tab.title }),
          err => port.postMessage({ error: err.message })
        );
      } else {
        browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
          if (!tabs.length) {
            port.postMessage({ error: "no active tab" });
            return;
          }
          browser.tabs.update(tabs[0].id, { url: msg.url }).then(
            tab => port.postMessage({ url: tab.url, tabId: tab.id, title: tab.title }),
            err => port.postMessage({ error: err.message })
          );
        });
      }
      return;
    }
    if (msg.cmd === "network") {
      browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        if (!tabs.length) {
          port.postMessage({ error: "no active tab" });
          return;
        }
        const logs = networkLogs[tabs[0].id] || [];
        port.postMessage({ logs });
      });
      return;
    }
    if (msg.cmd === "tabs") {
      if (msg.action === "list") {
        browser.tabs.query({ currentWindow: true }).then(tabs => {
          port.postMessage({ tabs: tabs.map((t, i) => ({ index: i, id: t.id, title: t.title, url: t.url, active: t.active })) });
        });
      } else if (msg.action === "switch") {
        browser.tabs.query({ currentWindow: true }).then(tabs => {
          if (msg.tabId == null || msg.tabId < 0 || msg.tabId >= tabs.length) {
            port.postMessage({ error: "invalid tabId" });
            return;
          }
          browser.tabs.update(tabs[msg.tabId].id, { active: true }).then(
            tab => port.postMessage({ switched: { index: msg.tabId, id: tab.id, title: tab.title, url: tab.url } }),
            err => port.postMessage({ error: err.message })
          );
        });
      } else {
        port.postMessage({ error: "unknown action: " + msg.action });
      }
      return;
    }
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (!tabs.length) {
        port.postMessage({ error: "no active tab" });
        return;
      }
      browser.tabs.sendMessage(tabs[0].id, msg).then(
        resp => port.postMessage(resp || { text: "" }),
        err => port.postMessage({ error: err.message })
      );
    });
  });
  port.onDisconnect.addListener(() => {
    port = null;
    setTimeout(connect, 1000);
  });
}

connect();
