// Everything to do with turning something in the app into a file on disk.
//
// Two routes end up here, because the two kinds of export are made in
// different places:
//
//   * The Excel sheet and the graduation picture are built in the renderer and
//     handed over as an ordinary download. A page can suggest a *name* but
//     never a location, so `will-download` is the only place the folder can be
//     chosen — hence the interception below.
//   * The name cards exist only as a print stylesheet, so there is nothing to
//     download. The main process renders them with `printToPDF` and writes the
//     result itself.
//
// Both routes converge: the same sanitising, the same Documents folder, the
// same collision handling, and the same `kh:saved` message back to the app so
// it can say where the file went.

const { app, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');

// Illegal in Windows filenames. Hebrew is fine; these are not.
const FORBIDDEN = /[\\/:*?"<>|]/g;
const CONTROL = /[\u0000-\u001F\u007F]/g;

const FALLBACK_NAME = 'Kindergarten Helper';

// A4 with a 1 cm margin. printToPDF takes margins in INCHES — the shared
// Margins type in electron.d.ts documents pixels, which is what the *other*
// print API means, and measuring settles it: 1/2.54 comes out as a 1 cm margin
// on the page, while a pixel-scale number is rejected as larger than the paper.
// Note also that marginType 'none' does not mean zero here; only an explicit
// 'custom' does.
const CM = 1 / 2.54;
const PDF_OPTIONS = {
  pageSize: 'A4',
  // Without this every background colour silently disappears and the cards
  // print as outlines.
  printBackground: true,
  margins: { marginType: 'custom', top: CM, bottom: CM, left: CM, right: CM }
};

/**
 * Reduce anything to a single, safe filename. Applied here as well as in the
 * renderer, because this side receives it over IPC and a name is otherwise a
 * way to write outside the Documents folder.
 */
function sanitise(name) {
  // Split on both separators explicitly rather than using path.basename, which
  // treats "\" as a separator on Windows and as an ordinary character
  // everywhere else — the same name would otherwise sanitise differently
  // depending on where the build ran. Taking the last segment is what defeats
  // "../../somewhere else".
  const base = String(name || '')
    .split(/[\\/]/)
    .pop()
    .replace(FORBIDDEN, ' ')
    .replace(CONTROL, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .slice(0, 150)
    .trim();
  return base || FALLBACK_NAME;
}

/**
 * Exporting twice in one year would otherwise hit the same name, and silently
 * overwriting destroys work without asking. Number instead: "… 2026 (2).pdf".
 */
function uniquePath(dir, filename) {
  const ext = path.extname(filename);
  const stem = path.basename(filename, ext);
  let candidate = path.join(dir, filename);
  for (let n = 2; fs.existsSync(candidate); n++) {
    candidate = path.join(dir, `${stem} (${n})${ext}`);
    if (n > 999) break;
  }
  return candidate;
}

function documentsDir() {
  try {
    const dir = app.getPath('documents');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch (err) {
    // A machine with no Documents folder is not a reason to lose the export.
    return app.getPath('home');
  }
}

// Saved files are handed back to the renderer as opaque ids rather than paths,
// so "show me the file" can never be asked to reveal something we did not just
// write.
const savedById = new Map();
let nextId = 1;

function remember(filePath) {
  const id = String(nextId++);
  savedById.set(id, filePath);
  if (savedById.size > 50) savedById.delete(savedById.keys().next().value);
  return id;
}

function announce(webContents, filePath) {
  if (!webContents || webContents.isDestroyed()) return;
  webContents.send('kh:saved', { id: remember(filePath), name: path.basename(filePath) });
}

let handlersInstalled = false;

function installHandlers() {
  if (handlersInstalled) return;
  handlersInstalled = true;

  // The cards. The renderer has already set body[data-print] so the print
  // stylesheet reveals the right area; printToPDF renders in print mode, so
  // that CSS applies here exactly as it would to a printer.
  ipcMain.handle('kh:save-pdf', async (event, request) => {
    try {
      const name = sanitise((request && request.name) || '');
      const filePath = uniquePath(documentsDir(), name.endsWith('.pdf') ? name : name + '.pdf');
      const data = await event.sender.printToPDF(PDF_OPTIONS);
      await fs.promises.writeFile(filePath, data);
      announce(event.sender, filePath);
      return { ok: true };
    } catch (err) {
      return { ok: false };
    }
  });

  ipcMain.handle('kh:reveal', (event, id) => {
    const filePath = savedById.get(String(id));
    if (!filePath || !fs.existsSync(filePath)) return { ok: false };
    shell.showItemInFolder(filePath);
    return { ok: true };
  });
}

/**
 * Point this window's downloads at Documents. Everything else is per-process
 * and installed once.
 */
function install(win) {
  installHandlers();

  win.webContents.session.on('will-download', (event, item) => {
    // Must be set synchronously, before the download starts, or Electron shows
    // its own save dialog.
    const target = uniquePath(documentsDir(), sanitise(item.getFilename()));
    item.setSavePath(target);
    item.once('done', (doneEvent, state) => {
      if (state === 'completed') announce(win.webContents, target);
    });
  });
}

module.exports = { install, sanitise, uniquePath, PDF_OPTIONS };
