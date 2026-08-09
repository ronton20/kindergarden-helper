// Checks GitHub for a newer release and, if there is one, downloads it and
// relaunches into it. No clicks anywhere.
//
// The governing rule is that this must never make the app slower to open or
// stop it opening at all. So:
//
//   * the *check* is time-boxed. If GitHub hasn't answered within
//     CHECK_TIMEOUT_MS we stop waiting and let the app start. The download is
//     not cancelled — electron-updater keeps going in the background and
//     `autoInstallOnAppQuit` installs it when she closes the app, so a slow
//     connection costs nothing and still gets the update, just one launch later.
//   * once a download is under way we watch it for stalls rather than trusting
//     it to finish, so a connection that dies mid-download can't leave the
//     splash on screen for ever.
//   * every failure path — no network, GitHub down, corrupt file, missing
//     update metadata, running unpackaged — resolves quietly and the app opens
//     as normal. Nothing is ever shown to the user about any of it.

const { app } = require('electron');

// How long to hold the launch waiting for GitHub to answer. The check is a
// single small HTTPS GET and normally answers well inside a second; this is the
// point at which we stop caring.
const CHECK_TIMEOUT_MS = 3000;

// How long a download may go without progress before we give up on it.
const STALL_TIMEOUT_MS = 45000;

/**
 * @param {object} handlers
 * @param {() => void} [handlers.onAvailable] an update exists and is downloading
 * @param {(percent: number) => void} [handlers.onProgress] 0-100
 * @returns {Promise<'skipped'|'no-update'|'timeout'|'stalled'|'error'|'installing'>}
 *   Anything but 'installing' means "carry on and open the app".
 */
function run({ onAvailable, onProgress } = {}) {
  // Unpackaged runs have no app-update.yml, and updating a checkout would be
  // wrong anyway.
  if (!app.isPackaged) return Promise.resolve('skipped');

  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (err) {
    return Promise.resolve('skipped');
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;

  return new Promise((resolve) => {
    let settled = false;
    let checkTimer = null;
    let stallTimer = null;

    // Named so they can be removed individually — `removeAllListeners()` would
    // also tear off electron-updater's own internal listeners and break the
    // background download we deliberately leave running after a timeout.
    const handlers = {};

    const finish = (outcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(checkTimer);
      clearTimeout(stallTimer);
      for (const [event, fn] of Object.entries(handlers)) autoUpdater.off(event, fn);
      resolve(outcome);
    };

    const armStallWatchdog = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => finish('stalled'), STALL_TIMEOUT_MS);
    };

    const safely = (fn, arg) => { try { if (fn) fn(arg); } catch (err) { /* never fatal */ } };

    handlers['update-not-available'] = () => finish('no-update');
    handlers['error'] = () => finish('error');

    handlers['update-available'] = () => {
      // The check has answered, so its clock no longer applies; the download
      // gets its own, longer one.
      clearTimeout(checkTimer);
      armStallWatchdog();
      safely(onAvailable);
    };

    handlers['download-progress'] = (p) => {
      armStallWatchdog();
      safely(onProgress, Math.max(0, Math.min(100, p && p.percent ? p.percent : 0)));
    };

    handlers['update-downloaded'] = () => {
      if (settled) return;
      settled = true;
      clearTimeout(checkTimer);
      clearTimeout(stallTimer);
      // isSilent: run the NSIS installer with no UI. isForceRunAfter: come back
      // up by ourselves once it's done. Deferred a tick so this handler returns
      // before the app starts quitting.
      setImmediate(() => {
        try { autoUpdater.quitAndInstall(true, true); } catch (err) { /* fall through */ }
      });
      resolve('installing');
    };

    for (const [event, fn] of Object.entries(handlers)) autoUpdater.on(event, fn);

    checkTimer = setTimeout(() => finish('timeout'), CHECK_TIMEOUT_MS);

    try {
      const checking = autoUpdater.checkForUpdates();
      // checkForUpdates() rejects as well as emitting 'error'; both land on
      // finish(), which only acts once.
      if (checking && typeof checking.catch === 'function') checking.catch(() => finish('error'));
    } catch (err) {
      finish('error');
    }
  });
}

module.exports = { run, CHECK_TIMEOUT_MS, STALL_TIMEOUT_MS };
