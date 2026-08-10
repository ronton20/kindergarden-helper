#!/usr/bin/env node
// `npm run dev`: the Vite dev server with hot reload, and Electron pointed at
// it instead of at the built file.
//
// Two things worth knowing while developing this way. The renderer is served
// over http://localhost, so localStorage is keyed to that origin rather than
// to `file://` — the dev app has its own children list, and cannot see or
// damage the real one. And the update check is skipped, because the app is not
// packaged.

const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const PORT = Number(process.env.KH_DEV_PORT || 5173);
const HOST = '127.0.0.1';
const ROOT = path.join(__dirname, '..');

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const vite = spawn(npx, ['vite', '--port', String(PORT), '--strictPort'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

function waitForServer(attemptsLeft = 100) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(PORT, HOST);
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', () => {
        socket.destroy();
        if (--attemptsLeft <= 0) return reject(new Error('dev server never came up'));
        setTimeout(attempt, 150);
      });
    };
    attempt();
  });
}

let electron;

waitForServer().then(() => {
  electron = spawn(npx, ['electron', '.'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, KH_DEV_SERVER: `http://${HOST}:${PORT}` }
  });
  electron.on('exit', (code) => { vite.kill(); process.exit(code ?? 0); });
}).catch((err) => {
  console.error(err.message);
  vite.kill();
  process.exit(1);
});

const shutdown = () => {
  if (electron) electron.kill();
  vite.kill();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
