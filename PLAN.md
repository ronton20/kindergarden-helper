# Kindergarten Helper — development plan

Living document. Phases are ordered by dependency and by how quickly they reach
the person actually using the app. Each phase is independently shippable.

---

## Where we are

**Phase 0 — done, merged, tagged `v1.2.0`.** Graduation photo fixes: photo
preview never rendered (data-URL semicolon broke the style-attribute parser),
exported text was 2.24× the preview, and HEIC/iPhone photos are now supported
via a vendored decoder.

**Phase 1 — code complete, awaiting a check on a real Windows machine.** See
the phase below for what still has to be confirmed there.

**Also introduced:** `tools/src/app.html` + `tools/rebundle.js`. This was the
minimum needed to edit a generated single-line file safely. Phase 4 replaces it
with a real source tree.

---

## Order of work, and why

Your list was: updates → medals → sizes, plus the refactor and the startup
question. I'm proposing a different order. The reasoning:

1. **The startup problem and auto-update are the same fix.** Startup is slow
   because of the `portable` packaging target (evidence in the appendix), and
   `portable` is also the reason auto-update can't work. One packaging change
   solves both.
2. **Auto-update should land before the features it will deliver.** Whichever
   version introduces auto-update has to be installed by hand. Everything
   released after it arrives on its own. Shipping medals first costs an extra
   manual install.
3. **Sizes before medals.** A medal needs a configurable size anyway. Building
   the size model first means medals is built on it rather than retrofitted.
4. **The refactor sits between the two clusters.** Packaging and updates are
   main-process work that barely touches app source; the features are all
   renderer work. Refactoring in between means the update work isn't blocked
   and the feature work is done on the good foundation.

| # | Phase | Ships as | Depends on |
|---|-------|----------|-----------|
| 0 | Merge the graduation fixes | v1.2.0 | — |
| 1 | Installer instead of portable (fixes startup) | v2.0.0 | 0 |
| 2 | Auto-update | v2.0.0 | 1 |
| 3 | Saved files: Documents folder, named per tab + year | v2.0.0 | 1 |
| 4 | Source refactor | internal | — |
| 5 | Per-design sizes | v2.1.0 | 4 |
| 6 | Medals tab | v2.2.0 | 4, 5 |

Phases 1–3 ship together as one manual install — they're all main-process work
riding the same release. Phase 4 has no user-visible change by design; that is
how we'll know it worked.

---

## Phase 0 — Merge the graduation fixes

Review and merge the current branch. It's unrelated to the attendance branch
it currently sits on, so it wants its own branch off `main`.

**Done when:** merged, tagged `v1.2.0`, and you've confirmed a real iPhone photo
works in the built app on Windows.

---

## Phase 1 — Replace the portable build with an installer

**The problem.** The `portable` target is a self-extracting archive. Its NSIS
script deletes its temp directory, extracts the *entire* ~200 MB Electron
runtime into `%TEMP%`, runs the app, and deletes it all again on exit — on
every single launch, with `SetSilent silent` so nothing is shown while it
happens. That is the 10–15 seconds. It is not the app.

**The fix.** Switch `win.target` from `portable` to `nsis`, per-user, one-click
(no admin prompt, installs to `%LOCALAPPDATA%`). The runtime is extracted once
at install time; launches become ordinary Electron startup.

Also in this phase, since they're small and related:

- `main.js`: `show: false` + `ready-to-show` so the window never paints blank.
- `main.js:22`: the window icon points at `build/icon.png`, which isn't in the
  `files` allowlist, so it doesn't exist in the packaged app. Fix or drop it.
- Add a Start Menu / desktop shortcut named in Hebrew and English.

**Expected result:** launch in roughly 1–2 s instead of 10–15 s.

**Risk — this is the one to be careful about.** The teacher's children list and
settings live in `localStorage` under `%APPDATA%\Kindergarten Helper`, keyed by
`productName` and the `file://` origin. Changing the install method must not
change either. **Do not rename `productName` or `appId`.** Verify on a real
machine that an existing list survives the upgrade before releasing, and add
an export/import-settings button as a safety valve.

**Done when:** installer runs without an admin prompt; app starts in under 2 s;
an existing `kh_v1` list is intact after upgrading from v1.2.0.

**Status — built and verified as far as a Mac can verify it.** The installer
builds (`KindergardenHelper_Setup_v2.0.0.exe`, one-click, per-user, x64-pinned so
the runner's architecture can't change what ships); `appId` and `productName` are
unchanged, so the storage location is untouched; the Hebrew shortcut name
survives into the NSIS defines; the `build/icon.png` reference is gone from the
packaged app (confirmed: the asar holds only `main.js`, `package.json`,
`app/index.html`); and the backup export/restore round-trips against the real
bundle in both languages, rejecting a non-backup file without touching the list.

Three things need a real Windows machine and cannot be checked here:
no admin prompt, the sub-2-second launch, and an existing `kh_v1` list surviving
the upgrade from v1.2.0. Do the upgrade check with a backup file saved first.

**Decided — the portable `.exe` is retired.** Adding it back to the build is a
one-word change, but the upkeep isn't free: it is *by construction* the slow
build (the extraction above is inherent to the target), it can never
auto-update, and it needs a README section explaining why one download behaves
worse than the other. That's a permanent support cost for a second-class
artifact.

The "no installation" story survives without it: the README's other promise —
open `app/index.html` in any browser, offline, by double-clicking — is genuinely
free, because Phase 4 keeps producing that single-file build anyway. So the
downloads become **installer** (the real app, auto-updating) and **single HTML
file** (zero-install, browser). Both README links get updated in this phase.

---

## Phase 2 — Auto-update

**Behaviour you asked for:** on startup, check the latest GitHub release
against the running version; if newer, announce it, show a progress bar,
download, and relaunch. No clicks.

**Approach.** `electron-updater` with the GitHub provider, `autoDownload = true`,
and `quitAndInstall()` when finished.

**Where the progress bar lives.** In a small frameless splash window owned by
the main process — *not* in the app UI. Three reasons: it appears instantly
while the main window is still loading, it's the only thing on screen at that
moment anyway, and it stays completely decoupled from the renderer, so the
Phase 4 refactor can't break it and doesn't have to carry it.

**Work:**
- `src/main/updater.ts` — check, download, progress events, install-on-quit.
- `src/main/splash.ts` — frameless always-on-top window; bilingual
  "מוריד עדכון… / Downloading update…" plus a progress bar; closes when the
  main window is ready if there's no update.
- Release workflow: switch to `electron-builder --win nsis --publish always`
  with `GH_TOKEN`. The current workflow uploads only `dist/*.exe`;
  electron-updater also needs the `latest.yml` and `.blockmap` that
  electron-builder generates. This is why the publish step has to change.
- Offline and failure handling: no network, GitHub down, or a corrupt download
  must all fall through silently to a normal launch. Never block startup on
  the update check — time-box it.

**Not doing:** code signing. Unsigned auto-update works fine (electron-updater
verifies the sha512 from `latest.yml`); the only cost is a SmartScreen warning
on the *first* manual download. A certificate is ~$200–400/yr and can be added
later without changing any of this.

**Done when:** installing v2.0.0, then tagging v2.0.1, results in the app
updating itself and relaunching on next start with no interaction — and with
the network unplugged, it still starts normally.

---

## Phase 3 — Saved files land somewhere findable, with a real name

Two problems, fixed together.

**Names and location.** Today's exports are hardcoded English with no year —
`attendance.xlsx`, `graduation.png` — and land wherever the browser's download
folder points. A teacher exporting each year ends up with `attendance (3).xlsx`
in Downloads and no idea which is which.

**The card tabs don't download at all.** Drawer and basket names go through
`window.print()` (`doPrint()`), which opens the system print dialog. These
become downloads like everything else, with no dialog.

**Target:** every tab produces a file, every file defaults to **Documents**,
named after the tab it came from, in the current language, with the calendar
year.

| Tab | Hebrew | English |
|---|---|---|
| Drawer names | `שמות למגירות 2026.pdf` | `Drawer names 2026.pdf` |
| Basket names | `שמות לסלסלאות 2026.pdf` | `Basket names 2026.pdf` |
| Attendance | `טבלת נוכחות 2026.xlsx` | `Attendance 2026.xlsx` |
| Graduation photo | `תמונת סיום 2026.png` | `Graduation photo 2026.png` |
| Medals (Phase 6) | `מדליות 2026.pdf` | `Medals 2026.pdf` |

Names come from the tab labels (`tabLarge`, `tabAtt`, …), so a new tab gets
correct naming for free.

**Work:**
- `src/main/downloads.ts` — a `will-download` handler calling `setSavePath()`
  into `app.getPath('documents')`. This is the only way to control the folder;
  a renderer `<a download>` can suggest a *name* but never a location.
- **Cards → PDF, no dialog.** Replace `doPrint()` / `window.print()` with
  `webContents.printToPDF`, writing straight to Documents. Details that will
  bite if missed:
  - `printBackground: true` is mandatory. Without it the cards print as
    outlines — every background colour silently disappears.
  - `printToPDF` takes its own `pageSize` and `margins`, which overlap with the
    `@page` rule the current code injects into `#kh-print-page`. Pass A4 and
    the 1 cm margin as options and delete the injected rule, rather than
    leaving two sources of truth for page geometry.
  - The print areas are revealed by `body[data-print="…"]` under
    `@media print`. `printToPDF` renders in print mode, so that CSS still
    applies — but the attribute has to be set before the call and cleared
    after, which is now an IPC round-trip instead of a `setTimeout`.
  - `@media print` also hides `.kh-screen`; verify nothing else depends on the
    old timing once the `setTimeout(…, 60)` dance is gone.
- Button strings change with the behaviour: `exportPdf`
  ("Print / Save as PDF" · "הדפסה / שמירה כ־PDF") becomes a download label
  matching the attendance tab's "Download Excel file" · "הורדת קובץ Excel".
- `lib/filename.ts` in the renderer — builds `<tab label> <year>.<ext>`, and
  sanitises it. Windows forbids `\ / : * ? " < > |` in filenames; Hebrew is
  fine, but the helper should be defensive since these strings are
  user-facing text that may change.
- Collision handling: exporting twice in one year hits the same name. Silent
  overwrite is the Electron default and it destroys work without asking, so
  auto-number instead (`… 2026 (2).xlsx`).
- A quiet in-app confirmation — "נשמר במסמכים / Saved to Documents" with a
  link that reveals the file (`shell.showItemInFolder`). No dialog, no clicks,
  consistent with how the rest of the app behaves.

**A side benefit worth knowing about.** The app's whole promise is cards at an
exact physical size — 6 × 4 cm, soon 10 × 5. A browser print dialog defaults to
scaling ("Fit to page"), which silently shrinks that and makes the printed card
the wrong size. A PDF with A4 geometry baked in can't be mangled that way, so
this change makes the physical sizing more reliable, not just tidier.

**The consequence:** printing is now two steps — download, then print the PDF.
That's the trade for losing the dialog, and it's the right trade given the
scaling problem above, but it is a change to how she works.

**Note — the browser build can't do all of this.** A page in a browser cannot
choose a download folder, and has no `printToPDF`. There the card tabs keep the
print dialog and files go to the browser's own download location, with correct
names. Worth a line in the README so the two builds aren't confusing.

**Done when:** every tab in both languages produces a correctly named file in
Documents with no dialog, exporting twice doesn't overwrite, a printed card
measures correctly with a ruler, and card background colours survive into the
PDF.

---

## Phase 4 — Source refactor

The goal is that a new feature is a new folder, not an archaeology expedition.

**Current state.** `app/index.html` is a 1.3 MB generated file. The real source
is one 96 KB line of JSON containing an 830-line HTML template written in a
bespoke `{{ }}` / `sc-if` / `sc-for` dialect, plus a 570-line logic class, run
by a generated artifact runtime (`dc-runtime`) that wraps React. There are no
tests, no types, no module boundaries, and no HMR.

**Recommended target:** `electron-vite` + React + TypeScript + electron-builder,
with Vitest for logic and ESLint/Prettier. This is the standard Electron
scaffold today, and it gives us type safety, real components, hot reload, and a
test runner.

```
src/
  main/       index.ts, updater.ts, splash.ts, window.ts
  preload/    index.ts            # contextBridge surface, the only main↔renderer door
  renderer/
    app/                          # shell, tabs, language switch
    features/  children/ cards/ attendance/ graduation/ medals/
    lib/       storage.ts xlsx.ts photo.ts print.ts geometry.ts
    i18n/      en.ts he.ts        # replaces the two inline string blobs
    ui/                           # shared inputs, colour picker, sliders
tests/
```

**Migration method — this is the part that makes it safe.** Port behaviour, not
code, under a characterization test suite written *first* against the current
app. I already have a working jsdom harness that drives the real bundle; it
becomes the baseline. Lock down, before changing anything:

- the `kh_v1` persistence shape (round-trip of a populated state),
- the generated `.xlsx` bytes for a known children list,
- card geometry values (font sizes, radii, borders) for both studios,
- the graduation export: canvas size, text scale, position, cover-crop maths.

Then port feature by feature until the same assertions pass on the new stack.

**Two things that must not be lost:**
- **The single-file browser build.** The README promises `app/index.html` works
  offline in any browser by double-clicking. Keep it as a second build target
  (`vite-plugin-singlefile`), with fonts self-hosted rather than fetched.
- **The `file://` origin.** localStorage is keyed by origin. If the renderer
  ever moves to a custom protocol (`app://`), every saved list is silently
  lost. Stay on `loadFile`, and land the export/import escape hatch from
  Phase 1 before this phase.

**Also worth doing while we're in here:** the hand-rolled OOXML/zip writer for
the attendance sheet is good work and should stay dependency-free — it just
wants to be `lib/xlsx.ts` with unit tests instead of a method on a 570-line
class.

**Done when:** every characterization test passes on the new stack, the app is
byte-for-byte equivalent in behaviour, and `npm run dev` gives hot reload.

**Decided:** TypeScript throughout. The state shape here — per-child colour
overrides, studio settings, sizes — is exactly what types are good at, and the
i18n string tables become checkable, so a new feature can't ship with a missing
Hebrew string.

---

## Phase 5 — Per-design sizes

Physical size becomes a saved setting per design, with these defaults:

| Design | Default | Currently |
|---|---|---|
| Drawer names | 10 × 5 cm | 6 × 4 cm |
| Basket names | 4.5 × 2.5 cm | 4 × 2 cm |
| Medals | 6 cm diameter | — |

**Work:**
- A shared `size` model (`{w, h}` in cm, or `{d}` for circles) in each studio's
  persisted settings, with the defaults above and sensible min/max.
- Width/height number inputs next to the existing sliders, bilingual, in cm.
- Print layout has to follow: at 10 × 5 cm only one card fits across an A4
  column, where 6 × 4 fitted three. The flex-wrap print area should handle it,
  but cards-per-page and the cut gaps need checking at the new defaults.
- The existing text scaling already uses container units (`cqh`/`cqmin`), so
  font size should track the new dimensions for free — worth verifying rather
  than assuming.
- Migration: existing saved settings have no `size`; fall back to the new
  defaults, and decide whether people already using the app should keep 6 × 4
  or move to 10 × 5. My suggestion: move everyone to the new defaults, since
  the old value was never a deliberate choice.

**Done when:** sizes persist across restart, "actual size" preview measures
correctly against a ruler, and a printed A4 sheet has correctly sized cards.

---

## Phase 6 — Medals tab

Circular medal, **6 cm across**, with a child's name and a send-off line —
"בהצלחה!" / "Good luck!" — for children moving on to first grade.

**Work:**
- New tab reusing the existing studio pattern (uniform vs per-child colours,
  font, text size, colour history) so it feels identical to the other tabs.
- Circular layout: name centred, phrase below or arced along the rim.
- The phrase is an **editable text field**, like the graduation title, so it can
  be changed per year or per child batch. Defaults: `בהצלחה!` in Hebrew,
  `Good luck!` in English. Note this is deliberately a send-off, not
  "Congratulations" — the two languages should read as the same sentiment.
- **Four ornaments, no more:**

  | Option | What it is |
  |---|---|
  | Clear | No ornament — just the circle, its colour, and the text |
  | Solid border | A plain ring, reusing the existing border-width control |
  | Ribbon | A banner band across the lower part of the medal, behind the phrase |
  | Frills | A scalloped/wavy outer edge |

  Ribbon and frills are SVG rather than CSS borders, so they stay crisp at
  print resolution and scale with the medal size instead of being re-tuned per
  size.

- **Ornament colour reuses the existing "border" slot.** The other studios
  already expose exactly three colour targets — background, text, border — with
  shared swatches and recent-colour history. Mapping the ornament onto the
  border target means medals get colour control with no new machinery and feel
  identical to the tabs beside them. If the ribbon ends up needing a colour
  distinct from the ring, that's a fourth target and a small change — worth
  deciding from the mock-up rather than up front.

- PDF sheet with circular cut guides, using the Phase 5 size setting and the
  Phase 3 download path — no print dialog, same as the card tabs.

**Done when:** medals print at the configured size, cut guides line up, and
both languages read naturally.

**Still to sketch before building:** the ribbon and frills shapes. Two SVG
ornaments are quick to mock up and quicker to agree on visually than in prose.

---

## Constraints that apply to every phase

- **Never lose the teacher's data.** The children list is the only irreplaceable
  thing in the app. Any change touching storage, packaging, or origins needs an
  explicit upgrade check on a real machine.
- **Fully offline.** No runtime network dependency except the update check,
  which must fail silently.
- **Bilingual, RTL-correct.** Every new string lands in both `en` and `he`, and
  Hebrew is checked in RTL layout, not just translated.
- **The user is not technical.** No dialogs asking about versions, no error
  codes, no jargon. If something fails, the app should still open and work.

---

## Appendix — startup timing evidence

Measured, not assumed.

Unpacking the 1.3 MB bundle is **not** the problem. Decoding and decompressing
all 21 embedded assets, parsing both JSON blobs, and doing the 21 URL
substitutions totals about **6 ms**. Even allowing for the browser's
`DecompressionStream` being far slower than Node's zlib, that is nowhere near
seconds.

The cause is the `portable` packaging target. From the NSIS template that ships
with the pinned `electron-builder` (`app-builder-lib/templates/nsis/portable.nsi`):

```nsis
StrCpy $INSTDIR "$TEMP\${UNPACK_DIR_NAME}"
RMDir /r $INSTDIR                    # delete any previous extraction
SetOutPath $INSTDIR
File /r "${APP_DIR_64}\*.*"          # extract the whole runtime, every launch
ExecWait "$INSTDIR\${APP_EXECUTABLE_FILENAME} $R0" $0
SetOutPath $EXEDIR
RMDir /r $INSTDIR                    # and delete it again on exit
```

There is no caching: it extracts before running and deletes after exiting, so
every launch pays the full cost. `.onInit` also sets `SetSilent silent` when no
splash image is configured, which is why those seconds pass with nothing on
screen. Phase 1 removes this entirely.
