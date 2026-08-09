#!/usr/bin/env node
// Repacks app/index.html from the readable sources in tools/src/.
//
// app/index.html is a self-contained bundle: a small unpacker, a manifest of
// gzip+base64 assets, and the whole app as one JSON-encoded template string.
// Editing that by hand is unpleasant, so the workflow is:
//
//   node tools/unbundle.js    # bundle  -> tools/src/app.html (+ assets)
//   ...edit tools/src/app.html...
//   node tools/rebundle.js    # tools/src/app.html -> bundle
//
// Assets listed in ASSETS are (re)inserted into the manifest under a fixed
// uuid; the unpacker rewrites every manifest uuid it finds in the template
// into a blob: URL at runtime, so the template refers to them by uuid.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const BUNDLE = path.join(ROOT, 'app', 'index.html');
const SRC = path.join(__dirname, 'src', 'app.html');

// uuid -> { file, mime }. Kept stable so repacking is idempotent.
const ASSETS = {
  'eb34bd46-caa6-4519-8d8b-6cc0ef5c7db2': {
    file: path.join(__dirname, 'src', 'libheif.js'),
    mime: 'text/javascript'
  }
};

function findLine(lines, text) {
  const i = lines.findIndex(l => l.trim() === text);
  if (i < 0) throw new Error('bundle marker not found: ' + text);
  return i;
}

function main() {
  const lines = fs.readFileSync(BUNDLE, 'utf8').split('\n');

  // ── manifest ──────────────────────────────────────────────────────────
  const manOpen = findLine(lines, '<script type="__bundler/manifest">');
  let manEnd = manOpen + 1;
  while (lines[manEnd].trim() !== '</script>') manEnd++;
  const manifest = JSON.parse(lines.slice(manOpen + 1, manEnd).join('\n'));

  for (const [uuid, asset] of Object.entries(ASSETS)) {
    const raw = fs.readFileSync(asset.file);
    manifest[uuid] = {
      mime: asset.mime,
      compressed: true,
      data: zlib.gzipSync(raw, { level: 9 }).toString('base64')
    };
    console.log('asset %s  %s  %d KB raw -> %d KB packed',
      uuid.slice(0, 8), path.basename(asset.file),
      Math.round(raw.length / 1024), Math.round(manifest[uuid].data.length / 1024));
  }

  // ── template ──────────────────────────────────────────────────────────
  const tplOpen = findLine(lines, '<script type="__bundler/template">');
  if (lines[tplOpen + 2].trim() !== '</script>') {
    throw new Error('expected the template to be exactly one line');
  }
  const source = fs.readFileSync(SRC, 'utf8');
  // "</" anywhere inside the JSON would close the enclosing <script> element
  // early; / is the same character to a JSON parser but inert to the HTML
  // tokeniser.
  const encoded = JSON.stringify(source).replace(/<\//g, '<\\u002F');

  const out = [
    ...lines.slice(0, manOpen + 1),
    JSON.stringify(manifest),
    ...lines.slice(manEnd, tplOpen + 1),
    encoded,
    ...lines.slice(tplOpen + 2)
  ].join('\n');

  fs.writeFileSync(BUNDLE, out);
  console.log('wrote %s  (%d KB)', path.relative(ROOT, BUNDLE), Math.round(out.length / 1024));
}

main();
