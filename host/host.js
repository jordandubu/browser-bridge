#!/usr/bin/env node
const net = require("net");
const fs = require("fs");

const SOCK = process.env.BRIDGE_SOCK || "/tmp/browser-bridge.sock";

// One host.js instance per Firefox native-messaging connection is normal, but
// only ONE may own the socket. Firefox respawns us on addon reconnect; if we
// blindly unlink + rebind, the new instance steals the path while MCP clients
// stay attached to the dying old one — requests flow into the void (30s hangs).
// Rules:
//  - The Firefox-spawned instance (no TTY stdin) ALWAYS takes ownership.
//  - A manual/dev instance (TTY stdin) yields if another instance owns it.
//  - A zombie owner is probed ({_probe:1} echo) and stolen from if silent.
//  - When Firefox closes stdin, we release the socket and exit — no zombies.
const IS_TTY = process.stdin.isTTY === true;
const PROBE_TIMEOUT_MS = 1500;
let server = null;
let clients = new Set();
let stdinBuf = Buffer.alloc(0);
let closed = false;

// Ask the current socket owner if it is alive and bridging. A healthy owner
// echoes {_probe:1} back on the same socket. No echo within the timeout means
// the file is held by a dead/zombie instance — safe to steal the path.
function probeOwner(onDead, onAlive) {
  const p = net.createConnection(SOCK);
  let sawEcho = false;
  let settled = false;
  const done = alive => {
    // A refused connection reports destroyed=true BEFORE the error handler
    // runs, so p.destroyed is not a valid "already handled" signal — use a
    // settled flag instead or the zombie-steal silently never fires.
    if (settled) return;
    settled = true;
    p.destroy();
    if (alive) onAlive();
    else {
      try { fs.unlinkSync(SOCK); } catch (e) {}
      onDead();
    }
  };
  p.on("data", chunk => {
    if (chunk.toString().includes('"_probe"')) { sawEcho = true; done(true); }
  });
  p.on("error", () => done(false));
  p.on("connect", () => {
    try { p.write(JSON.stringify({ _probe: 1, tty: IS_TTY }) + "\n"); } catch (e) { done(false); }
  });
  setTimeout(() => { if (!p.destroyed && !sawEcho) done(false); }, PROBE_TIMEOUT_MS);
}

function takeOwnership() {
  server = net.createServer(sock => {
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
          if (msg._probe) {
            if (IS_TTY && msg.tty === false) {
              // A Firefox-spawned instance is claiming the socket; yield.
              sock.write(JSON.stringify({ _probe: 1, _id: msg._id || null, yielding: true }) + "\n");
              setTimeout(releaseAndExit, 50);
              return;
            }
            sock.write(JSON.stringify({ _probe: 1, _id: msg._id || null }) + "\n");
            continue;
          }
          const resp = JSON.stringify(msg);
          const len = Buffer.alloc(4);
          len.writeUInt32LE(Buffer.byteLength(resp, "utf-8"), 0);
          process.stdout.write(Buffer.concat([len, Buffer.from(resp, "utf-8")]));
        } catch (e) {}
      }
    });
    sock.on("close", () => clients.delete(sock));
    sock.on("error", () => {});
  });
  server.on("error", err => {
    if (err.code === "EADDRINUSE") {
      // Socket path is held. Probe it: a healthy owner echoes {_probe:1}; a
      // zombie stays silent, gets its stale socket file unlinked, and we
      // re-listen. A manual TTY run always yields to the live owner instead.
      if (IS_TTY) {
        process.stderr.write("browser-bridge: socket owned by another instance, exiting\n");
        process.exit(0);
      }
      probeOwner(
        () => takeOwnership(),
        () => setTimeout(takeOwnership, 250)
      );
      return;
    }
    process.stderr.write("browser-bridge: " + err.message + "\n");
    process.exit(1);
  });
  server.listen(SOCK, () => {
    fs.chmodSync(SOCK, 0o666);
  });
}

function releaseAndExit() {
  if (closed) return;
  closed = true;
  for (const sock of clients) { try { sock.destroy(); } catch (e) {} }
  clients = new Set();
  try { server && server.close(() => { try { fs.unlinkSync(SOCK); } catch (e) {} }); } catch (e) {}
  // Native messaging: Firefox closed our stdin — nothing more will arrive.
  process.exit(0);
}

process.stdin.on("end", releaseAndExit);
process.stdin.on("error", releaseAndExit);
process.on("SIGHUP", releaseAndExit);
process.on("SIGTERM", releaseAndExit);

takeOwnership();

process.stdin.on("data", chunk => {
  stdinBuf = Buffer.concat([stdinBuf, chunk]);
  while (stdinBuf.length >= 4) {
    const len = stdinBuf.readUInt32LE(0);
    if (stdinBuf.length < 4 + len) break;
    let msg;
    try {
      msg = JSON.parse(stdinBuf.slice(4, 4 + len).toString("utf-8"));
    } catch (e) {
      process.stderr.write("browser-bridge: bad native message, skipping\n");
      stdinBuf = stdinBuf.slice(4 + len);
      continue;
    }
    stdinBuf = stdinBuf.slice(4 + len);
    for (const sock of clients) {
      try { sock.write(JSON.stringify(msg) + "\n"); } catch (e) {}
    }
  }
});