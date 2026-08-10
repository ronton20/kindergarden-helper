# עוזר הגן · Kindergarten Helper

A very simple, bilingual (עברית / English) desktop helper for a kindergarten teacher.
Type the children's names once, and generate everything needed each year:

- **שמות למגירות · Drawer name cards** — 10 × 5 cm by default, colours / border / font / size / roundness, several per A4 page.
- **שמות לסלסלאות · Basket name cards** — 4.5 × 2.5 cm by default, same styling options.

Both card sizes are settings, in centimetres, saved per design. The preview is laid out at that size and the
studio says how many will fit on a page.
- **טבלת נוכחות · Attendance sheet** — a blank monthly sheet (31 days + ת״ז/ID) exported to Excel, landscape-A4 friendly.
- **מדליות · Medals** — a 6 cm circle for each child moving on to first grade, with their name and a send-off
  ("בהצלחה!" / "Good luck!"), four ornaments, and a PDF sheet with cut guides.
- **תמונת סיום · Graduation photo** — upload a photo (including iPhone `.HEIC` photos), add a title + subtitle, drag the text, save an 18 × 13 cm PNG.

Every tab produces a file, saved straight into **Documents** with no dialog, named after the tab it came from,
in the current language, with the year — `שמות למגירות 2026.pdf`, `Attendance 2026.xlsx`, and so on. Exporting
twice in a year doesn't overwrite: the second becomes `… 2026 (2)`.

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

Note that a page in a browser cannot choose where files are saved and has no way to write a PDF directly, so
there the name cards still open the print dialog and files go to the browser's own downloads folder — with
the correct names either way. The installed app does both properly.

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

### Tests

```bash
npm test          # unit tests (Vitest, no browser)
npm run typecheck # tsc --noEmit
```

`src/renderer/lib/` holds the app's logic — the spreadsheet writer, the ZIP writer, the card naming and
geometry rules, the export filenames — so it can be tested without a browser.

It is checked against the app that shipped *before* the refactor, not against itself.
`tests/unit/xlsx.test.ts` builds the attendance spreadsheet and asserts its sha256 equals the one
`tests/characterization/golden.json` recorded from the old bundle. Same hash, same file — faithful rather
than merely similar. The card tests do the same against the recorded names and proportions, and the i18n
tests against the recorded tab labels.

### Characterization tests

```bash
npm run test:characterization              # compare against the golden file
npx electron tests/characterization/run.js --update   # rewrite it
```

`tests/characterization/golden.json` records what the app does *today*: the `kh_v1` shape after a round trip,
the rendered geometry of both card studios, the exact bytes of a generated `.xlsx`, and the exported
graduation picture measured in pixels — where the text sits, how big it is, and which part of the photo
survived the cover-crop.

It exists for the source refactor. The plan is to port behaviour rather than code, and this is what "the same
behaviour" means, written down before anything moves. The assertions describe *rendered output*, never the
component or its methods, so they should hold on a rewritten stack without themselves being rewritten.

Two things to know before trusting a green run:

- It drives the real bundle in a real Electron, because half of what it pins down — container-query font
  sizes, canvas text metrics, PNG output — does not exist in jsdom.
- The window size is fixed at 1400 × 1000. Container-query units resolve against the layout, so the recorded
  font sizes only reproduce at a known width.

If a change to the app is *meant* to change behaviour, regenerate the golden file and review the diff. That
diff is the change, stated plainly.

### Saved files

`preload.js` is the only door between the app and the main process — three calls and one event, no paths and
no filesystem. It doubles as the signal for which build is running: `window.kh` exists in the installed app
and does not exist in a browser, and the renderer branches on that.

`downloads.js` owns everything that ends up on disk. Two routes arrive there, because the two kinds of export
are made in different places:

- The Excel sheet and the graduation picture are built in the renderer and handed over as ordinary downloads.
  A page can suggest a *name* but never a location, so a `will-download` handler calling `setSavePath()` is
  the only place the folder can be chosen.
- The name cards exist only as a print stylesheet, so there is nothing to download. The renderer sets
  `body[data-print]`, the main process renders the page with `printToPDF` — which renders in print mode, so
  that stylesheet applies — and writes the file itself.

Both routes share the sanitising, the collision numbering and the `kh:saved` message back to the app. Saved
files are handed back as opaque ids rather than paths, so "show the file" can only ever reveal something just
written.

Two things worth knowing before touching the PDF options:

- **`printBackground: true` is mandatory.** Without it every background colour silently disappears and the
  cards print as outlines.
- **`margins` are in inches**, and only `marginType: 'custom'` means what it says. The shared `Margins` type
  in `electron.d.ts` documents pixels — that is what the *other* print API means — and `marginType: 'none'`
  quietly leaves the default ~1 cm margin in place. Measured, not assumed: a card comes out of the PDF at
  6.006 × 3.995 cm.

Page geometry is passed to `printToPDF` rather than injected as an `@page` rule, so there is one source of
truth for it. The browser build still injects the rule, because `window.print()` is all it has.

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

The app is React and TypeScript under `src/renderer/`, built by Vite.

```bash
npm run dev      # dev server with hot reload, in an Electron window
npm run build    # -> app/index.html
```

`npm run dev` serves the renderer over `http://localhost` and points Electron at it, so the dev app has its
own children list and cannot see or damage the real one — localStorage is keyed by origin. Everything else
loads from a file, which is what keeps that origin `file://`. **Never serve the real app over http**: every
saved list would vanish.

A new feature is a new folder under `src/renderer/features/`. Shared logic lives in `lib/`, shared controls in
`ui/`, and strings in `i18n/` — where `Strings` is derived from the English table, so a missing Hebrew string
is a compile error.

**`app/index.html` is a build artefact, and it is committed anyway.** The README promises you can save that
one file anywhere and open it in a browser, so a clone has to carry a working copy without anyone running a
build first. Run `npm run build` and commit the result whenever you change `src/`; CI fails if the committed
file has drifted from the sources.

The build inlines everything — 17 self-hosted woff2 subsets and the HEIC decoder — into that single file. The
decoder is [libheif-js](https://github.com/catdad-experiments/libheif-js) (the pure-JavaScript build, LGPL —
see `src/renderer/assets/libheif.LICENSE`), which decodes the photos iPhones produce and Chromium cannot open
on its own. It is 2.1 MB, so it is gzipped at build time and only inflated the first time someone actually
picks a HEIC file: see the `?gzip-base64` plugin in `vite.config.ts`. The fonts are not gzipped, because woff2
already is.

## Project layout
```
kindergarten-helper/
├─ app/index.html        BUILT from src/ by Vite — one file, offline, committed
├─ main.js               Electron window, and the launch / update sequence
├─ preload.js            the only main↔renderer door (contextBridge)
├─ downloads.js          saves every export into Documents, named and numbered
├─ updater.js            checks GitHub, downloads, relaunches — fails silently
├─ splash.js             the frameless window that carries the progress bar
├─ splash.html           its contents (self-contained, bilingual)
├─ build/icon.png        icon for the .exe and the installer (source: build/icon.svg)
│                        — electron-builder's buildResources dir, not shipped inside the app
├─ package.json          Electron + electron-builder config
├─ package-lock.json     locked dependency versions (used by `npm ci`)
├─ vite.config.ts        renderer build: single file, inlined assets
├─ src/renderer/
│  ├─ App.tsx            shell: language switch, tabs, print sheets
│  ├─ state.ts           the one place state changes and is persisted
│  ├─ features/          children/ cards/ attendance/ graduation/
│  ├─ lib/               logic: xlsx, zip, cards, filename, photo, print…
│  ├─ ui/                shared controls
│  ├─ i18n/              en.ts / he.ts — a missing string is a type error
│  └─ assets/            self-hosted fonts, vendored HEIC decoder
├─ scripts/dev.js        vite + electron together, for `npm run dev`
├─ tests/
│  ├─ unit/              Vitest, checked against the golden recording
│  └─ characterization/
│     ├─ run.js          drives the real bundle and records what it does
│     └─ golden.json     the recording — the definition of "unchanged"
├─ .github/workflows/
│  └─ release.yml        builds the .exe and publishes a Release
└─ README.md
```

## License
MIT
