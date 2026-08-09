const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const splash = require('./splash');
const updater = require('./updater');

// Only present when running from the repo: `build/` is electron-builder's
// buildResources directory and is deliberately not packaged. In the installed
// app Windows takes the window and taskbar icon from the .exe itself, so this
// is a development-only nicety rather than a missing file.
const iconPath = path.join(__dirname, 'build', 'icon.png');

// Single-instance lock: if the app is already running, a second launch
// (e.g. a double double-click) just focuses the existing window instead
// of opening a duplicate.
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  let mainWindow = null;
  // The main window is created immediately but held back until the update check
  // has had its (short) say, so the app doesn't pop up behind the splash and
  // then vanish again to install an update.
  let mainReady = false;
  let mainWanted = false;

  function showMain() {
    mainWanted = true;
    if (mainReady && mainWindow && !mainWindow.isVisible()) mainWindow.show();
  }

  function markMainReady() {
    mainReady = true;
    if (mainWanted && mainWindow && !mainWindow.isVisible()) mainWindow.show();
  }

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 820,
      minWidth: 900,
      minHeight: 640,
      autoHideMenuBar: true,
      title: 'Kindergarten Helper',
      // Paint nothing until the renderer has something to show, so the window
      // never appears as a white rectangle while the bundle unpacks.
      show: false,
      ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
      webPreferences: { contextIsolation: true }
    });
    Menu.setApplicationMenu(null);
    mainWindow.once('ready-to-show', markMainReady);
    // Safety net: a window that is never shown is indistinguishable from an app
    // that failed to start. If `ready-to-show` hasn't fired by now, treat it as
    // ready anyway.
    setTimeout(markMainReady, 4000);
    mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'));
    mainWindow.on('closed', () => { mainWindow = null; });
  }

  app.on('second-instance', () => {
    // Mid-update there is deliberately nothing to focus but the splash — the
    // main window is hidden because the app is about to relaunch.
    if (!mainWanted) {
      const [splashWindow] = BrowserWindow.getAllWindows().filter(w => w !== mainWindow);
      if (splashWindow && !splashWindow.isDestroyed()) splashWindow.focus();
      return;
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    splash.create();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    const outcome = await updater.run({
      onAvailable: () => splash.showDownloading(),
      onProgress: (percent) => splash.setProgress(percent)
    });

    // 'installing' means quitAndInstall is under way: leave the splash up, and
    // never show the main window, or she'd see the app open just as it closes
    // again. Every other outcome — no update, no network, GitHub down, a check
    // too slow to wait for — is an ordinary launch.
    if (outcome === 'installing') return;

    splash.close();
    showMain();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
