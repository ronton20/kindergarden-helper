// The little frameless window that is on screen while the app loads, and that
// carries the update progress bar when there is an update.
//
// It lives in the main process rather than in the app UI for three reasons: it
// has to appear before the renderer has loaded anything, it is the only thing
// on screen at that moment anyway, and keeping it here means the Phase 4
// refactor of the renderer cannot break it and does not have to carry it.

const { BrowserWindow } = require('electron');
const path = require('path');

let win = null;

function create() {
  win = new BrowserWindow({
    width: 440,
    height: 210,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    center: true,
    backgroundColor: '#FAF7F2',
    webPreferences: { contextIsolation: true }
  });

  win.loadFile(path.join(__dirname, 'splash.html'));
  win.once('ready-to-show', () => { if (win) win.show(); });
  win.on('closed', () => { win = null; });
  return win;
}

// The splash is a fixed page we ship ourselves, so driving it with
// executeJavaScript is simpler than a preload and a contextBridge for two
// calls. Every failure is swallowed: a splash that misbehaves must never take
// the launch down with it.
function call(expression) {
  if (!win || win.isDestroyed()) return;
  win.webContents.executeJavaScript(expression, true).catch(() => {});
}

function showDownloading() {
  call('window.khSplash && window.khSplash.downloading()');
}

function setProgress(percent) {
  call('window.khSplash && window.khSplash.progress(' + Number(percent).toFixed(2) + ')');
}

function close() {
  if (win && !win.isDestroyed()) win.destroy();
  win = null;
}

module.exports = { create, showDownloading, setProgress, close };
