const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

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
    mainWindow.once('ready-to-show', () => { mainWindow.show(); });
    // Safety net: a window that is never shown is indistinguishable from an app
    // that failed to start. If `ready-to-show` hasn't fired by now, show anyway.
    setTimeout(() => { if (mainWindow && !mainWindow.isVisible()) mainWindow.show(); }, 4000);
    mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'));
    mainWindow.on('closed', () => { mainWindow = null; });
  }

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
