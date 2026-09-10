#!/usr/bin/env node
const net = require("net");

const SOCK = process.env.BRIDGE_SOCK || "/tmp/browser-bridge.sock";
const sock = net.createConnection(SOCK);

let buf = "";
let printed = false;
sock.on("data", chunk => {
  buf += chunk;
  const lines = buf.split("\n");
  buf = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      // The host echoes probe replies too; the first real response is the
      // answer to our command. Print it and exit immediately — the old fixed
      // 5s setTimeout made every CLI call take 5s even for 5ms responses.
      if (printed) continue;
      console.log(JSON.stringify(msg));
      printed = true;
      sock.destroy();
      process.exit(0);
    } catch (e) {}
  }
});

const cmd = process.argv[2] || "read";
const arg1 = process.argv[3] || "";
const arg2 = process.argv[4] || "";

const msg = { cmd };

if (cmd === "js") {
  msg.code = arg1;
} else if (cmd === "navigate") {
  msg.url = arg1;
  msg.newTab = arg2 !== "false";
} else if (cmd === "tabs") {
  msg.action = arg1 || "list";
  msg.tabId = parseInt(arg2) || 0;
} else if (cmd === "strip_headers") {
  msg.active = arg1 === "true";
}

sock.write(JSON.stringify(msg) + "\n");

// Backstop only: a response normally arrives in milliseconds and the data
// handler exits. navigate waits for page load inside the addon, so allow it.
setTimeout(() => { sock.end(); process.exit(0); }, cmd === "navigate" ? 30000 : 10000);
