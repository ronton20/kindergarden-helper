# עוזר הגן · Kindergarten Helper

A very simple, bilingual (עברית / English) desktop helper for a kindergarten teacher.
Type the children's names once, and generate everything needed each year:

- **שמות למגירות · Drawer name cards** — 6 × 4 cm, colours / border / font / size / roundness, several per A4 page.
- **שמות לסלסלאות · Basket name cards** — 4 × 2 cm, same styling options.
- **טבלת נוכחות · Attendance sheet** — a blank monthly sheet (31 days + ת״ז/ID) exported to Excel, landscape-A4 friendly.
- **תמונת סיום · Graduation photo** — upload a photo, add a title + subtitle, drag the text, save an 18 × 13 cm PNG.

The interface follows the computer's language automatically (Hebrew → right-to-left) and has a visible language switch. The children list and all settings are saved automatically on the machine, so next year you just change the names.

---

## ⬇️ Download for Windows (no installation)

**[➡️ Download the latest version](../../releases/latest)**

> On the Releases page, download the **`.exe`** file (named `KindergardenHelper_v<version>.exe`), then just **double-click it** — there is nothing to install.
> (Replace the link above with your own repository once pushed: `https://github.com/YOUR-USERNAME/kindergarten-helper/releases/latest`)

### No download needed — open in a browser
Prefer zero download? Open **[`app/index.html`](app/index.html)** — it is a single self-contained file. Save it anywhere (e.g. the Desktop) and double-click to open it in any browser. Works fully offline; your lists are saved in that browser.

---

## For the developer

### Run locally
```bash
npm install
npm start
```

### Build the Windows .exe yourself
```bash
npm install
npm run dist
# → dist/KindergardenHelper_v<version>.exe
```
(Build on Windows, or use the GitHub Action below.)

### Publish a release (auto-builds the .exe)
The workflow in `.github/workflows/release.yml` builds the portable `.exe` and attaches it to a GitHub Release automatically. To cut a release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions then builds on `windows-latest` and publishes the `.exe` to a Release named after the tag. You can also trigger it manually from the **Actions** tab (**Run workflow**).

### Editing the app
The app UI lives in **`app/index.html`** — a compiled, self-contained bundle. To change the app, edit the source design and re-export the bundle, then replace `app/index.html`.

## Project layout
```
kindergarten-helper/
├─ app/index.html        the app (self-contained, offline)
├─ main.js               Electron window
├─ build/icon.png        app / .exe icon (source: build/icon.svg)
├─ package.json          Electron + electron-builder config
├─ package-lock.json     locked dependency versions (used by `npm ci`)
├─ .github/workflows/
│  └─ release.yml        builds the .exe and publishes a Release
└─ README.md
```

## License
MIT
