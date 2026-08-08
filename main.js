const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

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
      icon: path.join(__dirname, 'build', 'icon.png'),
      webPreferences: { contextIsolation: true }
    });
    Menu.setApplicationMenu(null);
    mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'));
    mainWindow.on('closed', () => { mainWindow = null; });
  }

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
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
