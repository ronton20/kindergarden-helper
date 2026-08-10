// The only door between the app and the main process.
//
// The same bundle in app/index.html also runs as a plain page in a browser,
// where none of this exists. So `window.kh` is both the door and the signal:
// if it is there the app is on the desktop and can save into Documents; if it
// is not, the app falls back to ordinary browser downloads and the print
// dialog. Nothing else about the two builds differs.
//
// Deliberately narrow — three calls and one event, no paths and no filesystem.
// Saved files come back as opaque ids, so "show me the file" can only ever
// reveal something the main process just wrote.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kh', {
  desktop: true,

  /** Render the current print area to a PDF in Documents. */
  savePdf: (name) => ipcRenderer.invoke('kh:save-pdf', { name }),

  /** Show a previously saved file in Explorer. `id` comes from onSaved. */
  reveal: (id) => ipcRenderer.invoke('kh:reveal', id),

  /** Called with { id, name } once a file has actually landed on disk. */
  onSaved: (handler) => {
    ipcRenderer.on('kh:saved', (_event, payload) => {
      try { handler(payload); } catch (err) { /* never break the page */ }
    });
  }
});
