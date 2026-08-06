let port = null;

function connect() {
  port = browser.runtime.connectNative("opencode_bridge");
  port.onMessage.addListener(msg => {
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
