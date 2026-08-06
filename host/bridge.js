#!/usr/bin/env node
const net = require("net");

const SOCK = "/tmp/opencode-bridge.sock";
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
const code = process.argv[3] || "";
sock.write(JSON.stringify({ cmd, code }) + "\n");

setTimeout(() => { sock.end(); process.exit(0); }, 5000);
