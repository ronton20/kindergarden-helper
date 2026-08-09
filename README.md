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

### Publish a release (auto-builds the installer)
The workflow in `.github/workflows/release.yml` builds the installer and attaches it to a GitHub Release automatically. To cut a release:

```bash
git tag v2.0.0
git push origin v2.0.0
```

GitHub Actions then builds on `windows-latest` and publishes the installer to a Release named after the tag. You can also trigger it manually from the **Actions** tab (**Run workflow**).

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
├─ main.js               Electron window
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
