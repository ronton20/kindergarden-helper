# עוזר הגן · Kindergarten Helper

A very simple, bilingual (עברית / English) desktop helper for a kindergarten teacher.
Type the children's names once, and generate everything needed each year:

- **שמות למגירות · Drawer name cards** — 6 × 4 cm, colours / border / font / size / roundness, several per A4 page.
- **שמות לסלסלאות · Basket name cards** — 4 × 2 cm, same styling options.
- **טבלת נוכחות · Attendance sheet** — a blank monthly sheet (31 days + ת״ז/ID) exported to Excel, landscape-A4 friendly.
- **תמונת סיום · Graduation photo** — upload a photo (including iPhone `.HEIC` photos), add a title + subtitle, drag the text, save an 18 × 13 cm PNG.

The interface follows the computer's language automatically (Hebrew → right-to-left) and has a visible language switch. The children list and all settings are saved automatically on the machine, so next year you just change the names. The **Children** tab can also save a backup file of the list and every setting, and restore it later or on another computer.

---

## ⬇️ Get it

There are two ways to run it. They are the same app; pick whichever suits you.

### 1. Install on Windows — recommended

**[➡️ Download the latest version](../../releases/latest)**

> On the Releases page, download **`KindergardenHelper_Setup_v<version>.exe`** and double-click it.
> It installs into your own user account, so Windows does **not** ask for an administrator password, and it adds a
> **עוזר הגן · Kindergarten Helper** shortcut to the Start Menu and the desktop. After that the app opens in a second or two.
>
> It also keeps itself up to date. When a new version is released, the app notices on startup, shows a small
> progress bar while it downloads, and restarts into the new version by itself. There is nothing to click, and
> nothing to download again. With no internet connection it simply opens as usual.
>
> (Replace the link above with your own repository once pushed: `https://github.com/YOUR-USERNAME/kindergarten-helper/releases/latest`)

Windows may show a blue “Windows protected your PC” screen the first time, because the file is not
code-signed. Choose **More info → Run anyway**.

### 2. No installation at all — open in a browser

Open **[`app/index.html`](app/index.html)** — it is a single self-contained file. Save it anywhere (e.g. the Desktop)
and double-click to open it in any browser. Works fully offline; your lists are saved in that browser.

Note that a page in a browser cannot choose where files are saved, so downloads go to the browser's own
downloads folder.

---

## For the developer

### Run locally
```bash
npm install
npm start
```

### Build the Windows installer yourself
```bash
npm install
npm run dist
# → dist/KindergardenHelper_Setup_v<version>.exe
```
(Builds on Windows, macOS or Linux — electron-builder fetches the Windows runtime and NSIS itself.)

The target is a **one-click, per-user NSIS installer**: it extracts the Electron runtime once, at install
time, into `%LOCALAPPDATA%`, which is why the app starts in a second or two. The old `portable` target
extracted that same runtime into `%TEMP%` on *every* launch and deleted it again on exit, which cost 10–15
seconds each time; it has been retired.

`appId` and `productName` are deliberately unchanged from v1.x. The children list lives in `localStorage`
under `%APPDATA%\Kindergarten Helper`, keyed by those two values and by the `file://` origin — renaming
either one would orphan every saved list.

### Auto-update

`updater.js` asks GitHub for the latest release on startup, and `splash.js` /
`splash.html` are the small frameless window that carries the progress bar. The splash lives in the main
process rather than in the app UI so that it can appear before the renderer has loaded anything, and so the
planned renderer refactor cannot break it.

The rule the code is built around is that **the update must never make the app slower to open, or stop it
opening**:

- The check is time-boxed to 3 seconds. If GitHub hasn't answered by then the app opens anyway. The download
  is *not* cancelled — electron-updater keeps going in the background and `autoInstallOnAppQuit` installs it
  when the app is closed, so a slow connection still gets the update, just one launch later.
- A download that stalls for 45 seconds is abandoned and the app opens.
- No network, GitHub down, a corrupt file, missing update metadata, or running from a checkout all resolve
  quietly into a normal launch. None of it is ever shown to the user.

**There is deliberately no code signing.** A certificate is ~$200–400/yr and buys only the removal of the
SmartScreen warning on the *first* manual download. Auto-update itself works unsigned, because
electron-updater verifies the sha512 recorded in `latest.yml`.

That has one non-obvious consequence, and it is why `win.verifyUpdateCodeSignature` is `false`: when
`publisherName` reaches `app-update.yml`, electron-updater runs `Get-AuthenticodeSignature` on the downloaded
installer before running it. An unsigned installer comes back `NotSigned`, which it treats as a failed
verification, and the update is refused. Turning the option off keeps `publisherName` out of
`app-update.yml`, so that check is skipped while the sha512 check remains. **If a certificate is ever bought,
remove that option** — signature verification is worth having once there is a signature to verify.

### Publish a release (auto-builds the installer)
The workflow in `.github/workflows/release.yml` builds the installer and attaches it to a GitHub Release automatically. To cut a release:

```bash
git tag v2.0.0
git push origin v2.0.0
```

GitHub Actions then builds on `windows-latest` and publishes to a Release named after the tag. You can also
trigger it manually from the **Actions** tab (**Run workflow**), which builds without publishing.

electron-builder does the publishing itself (`--publish always`), because it is the only thing that knows the
full set of files auto-update needs: the installer, `latest.yml` — the manifest the app reads, carrying the
sha512 it checks the download against — and the `.blockmap` that lets it download only the parts that
changed. A workflow that uploaded just the `.exe` would leave installed copies unable to see the release at
all. The release must also be a real release rather than a draft (`releaseType: release`), since drafts are
invisible to the updater.

### Editing the app
`app/index.html` is a **generated** file: a small unpacker, a manifest of
gzipped assets, and the whole app squeezed onto one JSON-encoded line. Don't
edit it by hand — edit `tools/src/app.html` and repack:

```bash
node tools/rebundle.js     # tools/src/app.html -> app/index.html
```

`node tools/unbundle.js` goes the other way, and regenerates `tools/src/app.html`
from the bundle if the two ever drift apart.

`tools/src/libheif.js` is vendored [libheif-js](https://github.com/catdad-experiments/libheif-js)
(the pure-JavaScript build, LGPL — see `tools/src/libheif.LICENSE`). It decodes
the HEIC photos iPhones produce, which Chromium cannot open on its own. It is
packed into the bundle as an asset and only fetched out of it the first time
someone actually picks a HEIC file, so it costs nothing at startup.

## Project layout
```
kindergarten-helper/
├─ app/index.html        the app (GENERATED — see tools/, self-contained, offline)
├─ tools/
│  ├─ src/app.html       the app source you edit
│  ├─ src/libheif.js     vendored HEIC decoder (packed into the bundle)
│  ├─ rebundle.js        src -> app/index.html
│  └─ unbundle.js        app/index.html -> src
├─ main.js               Electron window, and the launch / update sequence
├─ updater.js            checks GitHub, downloads, relaunches — fails silently
├─ splash.js             the frameless window that carries the progress bar
├─ splash.html           its contents (self-contained, bilingual)
├─ build/icon.png        icon for the .exe and the installer (source: build/icon.svg)
│                        — electron-builder's buildResources dir, not shipped inside the app
├─ package.json          Electron + electron-builder config
├─ package-lock.json     locked dependency versions (used by `npm ci`)
├─ .github/workflows/
│  └─ release.yml        builds the .exe and publishes a Release
└─ README.md
```

## License
MIT
