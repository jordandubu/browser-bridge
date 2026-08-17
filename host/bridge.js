#!/usr/bin/env node
const net = require("net");

const SOCK = process.env.BRIDGE_SOCK || "/tmp/browser-bridge.sock";
const sock = net.createConnection(SOCK);

let buf = "";
sock.on("data", chunk => {
  buf += chunk;
  const lines = buf.split("\n");
  buf = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      console.log(JSON.stringify(msg));
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

setTimeout(() => { sock.end(); process.exit(0); }, 5000);
