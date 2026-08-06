#!/usr/bin/env node
const net = require("net");
const fs = require("fs");

const SOCK = "/tmp/firefox-bridge.sock";

fs.unlink(SOCK, () => {});

const clients = new Set();

const server = net.createServer(sock => {
  clients.add(sock);
  let buf = "";
  sock.on("data", chunk => {
    buf += chunk;
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        const resp = JSON.stringify(msg);
        const len = Buffer.alloc(4);
        len.writeUInt32LE(resp.length, 0);
        process.stdout.write(Buffer.concat([len, Buffer.from(resp, "utf-8")]));
      } catch (e) {}
    }
  });
  sock.on("close", () => clients.delete(sock));
});

server.listen(SOCK, () => fs.chmodSync(SOCK, 0o666));

let stdinBuf = Buffer.alloc(0);
process.stdin.on("data", chunk => {
  stdinBuf = Buffer.concat([stdinBuf, chunk]);
  while (stdinBuf.length >= 4) {
    const len = stdinBuf.readUInt32LE(0);
    if (stdinBuf.length < 4 + len) break;
    const msg = JSON.parse(stdinBuf.slice(4, 4 + len).toString("utf-8"));
    stdinBuf = stdinBuf.slice(4 + len);
    for (const sock of clients) {
      try { sock.write(JSON.stringify(msg) + "\n"); } catch (e) {}
    }
  }
});
