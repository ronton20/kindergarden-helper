#!/usr/bin/env node
// Extracts the readable app source out of the app/index.html bundle into
// tools/src/app.html, which is the file you actually edit. See rebundle.js.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BUNDLE = path.join(ROOT, 'app', 'index.html');
const OUT_DIR = path.join(__dirname, 'src');
const OUT = path.join(OUT_DIR, 'app.html');

const lines = fs.readFileSync(BUNDLE, 'utf8').split('\n');
const i = lines.findIndex(l => l.trim() === '<script type="__bundler/template">');
if (i < 0) throw new Error('template marker not found');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, JSON.parse(lines[i + 1]));
console.log('wrote %s (%d KB)', path.relative(ROOT, OUT), Math.round(fs.statSync(OUT).size / 1024));
