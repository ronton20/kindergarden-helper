// Characterization tests: what the app does today, recorded so the refactor
// can be checked against it.
//
// These deliberately describe *behaviour*, not implementation — rendered
// styles, saved bytes, exported pixels — because the whole point is that the
// implementation is about to be replaced. Nothing here reaches into the
// component or its methods, so the same assertions should hold on a React and
// TypeScript rewrite without being rewritten themselves.
//
// It drives the real bundle in Electron rather than a jsdom stand-in, because
// half of what is being pinned down (container-query font sizes, canvas text
// metrics, PNG output) only exists in a real engine.
//
//   npm run test:characterization           compare against the golden file
//   npm run test:characterization -- --update   rewrite the golden file
//
// The renderer is loaded on its own, with no preload: these tests pin the app,
// not the packaging, so they survive the main-process side being restructured
// too. Without the bridge the app takes its browser path, which is why the
// cards are read from the DOM rather than from a produced PDF.

const { app, BrowserWindow, session } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.join(__dirname, '..', '..');
const GOLDEN = path.join(__dirname, 'golden.json');
const UPDATE = process.argv.includes('--update');

// Which build to check. Defaults to the one that ships; during the refactor
// KH_APP points it at the new output, so the same recording can be replayed
// against the port before anything is switched over.
const APP_HTML = path.join(REPO, process.env.KH_APP || 'app/index.html');

// Fixed window size: container-query units resolve against the layout, so the
// font sizes below are only reproducible at a known width.
const WIDTH = 1400;
const HEIGHT = 1000;

const downloads = new Map();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 32);

let win;
const js = (code) => win.webContents.executeJavaScript(code, true);

// ── the fixture ───────────────────────────────────────────────────────────
// Chosen to exercise the awkward cases, not the happy path: two children share
// a first name (so the "Noa L." disambiguation fires), one has no first name
// at all (so the em-dash fallback fires), and the large studio carries a
// per-child colour override plus non-default geometry.
const CHILDREN = [
  { id: 1, first: 'Noa', last: 'Levi', tz: '111' },
  { id: 2, first: 'Noa', last: 'Cohen', tz: '222' },
  { id: 3, first: '', last: 'Mizrahi', tz: '333' },
  { id: 4, first: 'איתי', last: 'בר', tz: '444' }
];

const LARGE = {
  uniform: false, bg: '#FEF3D8', text: '#2B2723', border: '#E07A4B',
  font: 'Rubik', size: 80, borderStyle: 'dashed', borderWidth: 6, cornerRadius: 9,
  overrides: { 2: { bg: '#E3F0FB', text: '#4C7FB8' } }, selectedId: null
};

const SMALL = {
  uniform: true, bg: '#E3F0FB', text: '#2B2723', border: '#2FA39B',
  font: 'Heebo', size: 120, borderStyle: 'solid', borderWidth: 3, cornerRadius: 4,
  overrides: {}, selectedId: null
};

const GRAD = {
  img: null, title: 'פעוטון תמר', subtitle: 'תשפ״ו 2026',
  color: '#FFFFFF', font: 'Suez One', size: 44, x: 50, y: 78
};

// A photo whose halves are flatly different colours, so the cover-crop can be
// read off the exported picture: 2:1 into an 18:13 frame must crop the sides,
// leaving the seam down the middle.
const PHOTO_JS = `(() => {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 600;
  const x = c.getContext('2d');
  x.fillStyle = '#FF0000'; x.fillRect(0, 0, 600, 600);
  x.fillStyle = '#0000FF'; x.fillRect(600, 0, 600, 600);
  return c.toDataURL('image/png');
})()`;

async function seed(lang, photo) {
  await js(`localStorage.setItem('kh_v1', JSON.stringify({
    lang: ${JSON.stringify(lang)},
    children: ${JSON.stringify(CHILDREN)},
    large: ${JSON.stringify(LARGE)},
    small: ${JSON.stringify(SMALL)},
    history: ['#E07A4B', '#2FA39B'],
    grad: Object.assign(${JSON.stringify(GRAD)}, { img: ${JSON.stringify(photo)} }),
    att: { cls: 'טרום חובה', emptyRows: 2 }
  })); true;`);
  await win.webContents.reload();
  await sleep(2200);
}

const openTab = (label) => js(
  `(() => { const b = [...document.querySelectorAll('button')]
     .find(b => b.innerText.trim() === ${JSON.stringify(label)});
     if (!b) return 'no tab: ' + ${JSON.stringify(label)}; b.click(); return 'ok'; })()`);

const clickContaining = (text) => js(
  `(() => { const b = [...document.querySelectorAll('button')]
     .find(b => b.innerText.includes(${JSON.stringify(text)}));
     if (!b) return 'no button: ' + ${JSON.stringify(text)}; b.click(); return 'ok'; })()`);

// ── what gets recorded ────────────────────────────────────────────────────

/** The saved shape, which is the only irreplaceable thing in the app. */
async function capturePersistence() {
  const raw = await js(`localStorage.getItem('kh_v1')`);
  const parsed = JSON.parse(raw);
  const img = parsed.grad && parsed.grad.img;
  if (parsed.grad) parsed.grad = { ...parsed.grad, img: img ? 'data-url:' + img.length : null };
  return {
    topLevelKeys: Object.keys(parsed).sort(),
    value: parsed
  };
}

/**
 * How a card actually renders, rather than which CSS produced it.
 *
 * Sizes are recorded as proportions of the card, not as pixels. The card's
 * text and radius are declared in container-query units — `cqh` and `cqmin` —
 * so in pixels they scale with however wide the grid happens to lay out, which
 * depends on the window, the platform's window chrome and the display the test
 * runs on. A CI machine with a small screen clamps the window and every number
 * moves. The proportion is what the CSS actually says (20.8% of the card's
 * height, 9% of its shorter side) and is the same everywhere.
 *
 * Border width stays in pixels because it is declared in pixels.
 */
async function captureCards(studio) {
  return js(`(() => {
    const cards = [...document.querySelectorAll('div[data-studio="' + ${JSON.stringify(studio)} + '"][data-id]')];
    return cards.map(outer => {
      const inner = outer.firstElementChild;
      const cs = getComputedStyle(inner);
      // The card's text size lives on the span, not on the card box — the box
      // only carries colours, border and radius. Measuring the box gives a flat
      // 16px for every card, which says nothing.
      const label = inner.querySelector('span') || inner;
      const ls = getComputedStyle(label);
      const box = outer.getBoundingClientRect();
      const shorter = Math.min(box.width, box.height);
      const px = (v) => parseFloat(v);
      const pct = (v, of) => Math.round(px(v) / of * 1000) / 10;
      const ratio = (a, b) => Math.round(a / b * 1000) / 1000;
      return {
        id: outer.getAttribute('data-id'),
        name: inner.textContent,
        fontSizePctOfHeight: pct(ls.fontSize, box.height),
        radiusPctOfShorterSide: pct(cs.borderTopLeftRadius, shorter),
        lineHeightRatio: ratio(px(ls.lineHeight), px(ls.fontSize)),
        aspectRatio: ratio(box.width, box.height),
        borderWidthPx: px(cs.borderTopWidth),
        borderStyle: cs.borderTopStyle,
        borderColor: cs.borderTopColor,
        background: cs.backgroundColor,
        color: cs.color,
        fontFamily: cs.fontFamily.split(',')[0].replace(/["']/g, '')
      };
    });
  })()`);
}

/** The print sheet is a separate DOM from the preview and can drift from it. */
async function capturePrintArea(studio) {
  return js(`(() => {
    const area = document.querySelector('[data-print-area="' + ${JSON.stringify(studio)} + '"]');
    if (!area) return null;
    const boxes = [...area.children];
    const first = boxes[0];
    // Read the style properties rather than parsing the attribute: the print
    // area is display:none, so computed width/height are useless here, and the
    // attribute's exact serialisation is not something worth pinning.
    return {
      cardCount: boxes.length,
      // The physical size promise: the cm the cards are cut to.
      cardWidth: first ? first.style.width : null,
      cardHeight: first ? first.style.height : null,
      breakInside: first ? first.style.breakInside : null,
      gap: area.style.gap,
      flexWrap: area.style.flexWrap
    };
  })()`);
}

/** Every byte of the spreadsheet, plus its structure. */
function captureXlsx(buf) {
  // Entry names come out of the central directory; a structural check that
  // still means something if the bytes legitimately change.
  const names = [];
  const s = buf.toString('latin1');
  const re = /PK\x03\x04[\s\S]{22}/g;
  let m;
  while ((m = re.exec(s))) {
    const at = m.index;
    const nameLen = buf.readUInt16LE(at + 26);
    names.push(buf.slice(at + 30, at + 30 + nameLen).toString('utf8'));
  }
  return { bytes: buf.length, sha256: sha256(buf), entries: names };
}

/**
 * The exported picture, measured rather than hashed: where the text sits, how
 * big it is, and which part of the photo survived the cover-crop. A hash alone
 * would break on any encoder change while telling us nothing about position.
 */
async function captureGradPixels(buf) {
  const b64 = buf.toString('base64');
  return js(`(async () => {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res; img.onerror = rej;
      img.src = 'data:image/png;base64,' + ${JSON.stringify(b64)};
    });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const at = (px, py) => {
      const i = (py * c.width + px) * 4;
      return [d[i], d[i + 1], d[i + 2]].join(',');
    };
    // White text on a red/blue photo: find every near-white pixel.
    let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1, count = 0;
    for (let py = 0; py < c.height; py += 2) {
      for (let px = 0; px < c.width; px += 2) {
        const i = (py * c.width + px) * 4;
        if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) {
          count++;
          if (px < minX) minX = px; if (px > maxX) maxX = px;
          if (py < minY) minY = py; if (py > maxY) maxY = py;
        }
      }
    }
    return {
      width: c.width,
      height: c.height,
      // Cover-crop: a 2:1 photo in an 18:13 frame keeps the middle, so the
      // seam stays centred and both halves remain visible at the edges.
      leftEdge: at(4, Math.round(c.height / 2)),
      rightEdge: at(c.width - 5, Math.round(c.height / 2)),
      justLeftOfCentre: at(Math.round(c.width / 2) - 12, 30),
      justRightOfCentre: at(Math.round(c.width / 2) + 12, 30),
      text: count ? {
        left: minX, right: maxX, top: minY, bottom: maxY,
        widthPx: maxX - minX, heightPx: maxY - minY,
        centreXpct: Math.round((minX + maxX) / 2 / c.width * 1000) / 10
      } : null
    };
  })()`);
}

/**
 * Type a new card size, reload, and see whether it stuck. The size is a
 * setting, so "it persists across a restart" is the whole point of it — and a
 * controlled React input needs the native setter to be driven from outside.
 */
async function captureSizePersists(widthLabel) {
  return js(`(async () => {
    const label = [...document.querySelectorAll('label')]
      .find(l => l.textContent.trim().startsWith(${JSON.stringify(widthLabel)}));
    if (!label) return { error: 'width input not found' };
    const input = label.querySelector('input');

    const setValue = (el, value) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    // React listens for delegated focusin/focusout, and calling focus()/blur()
    // on a window that is not on screen does not reliably produce them — so
    // dispatch the events the component actually hears.
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    setValue(input, '7.5');
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));

    const saved = JSON.parse(localStorage.getItem('kh_v1') || '{}');
    return {
      shownAfterTyping: input.value,
      savedWidth: saved.large && saved.large.cardSize && saved.large.cardSize.w,
      savedHeight: saved.large && saved.large.cardSize && saved.large.cardSize.h
    };
  })()`);
}

// ── the run ───────────────────────────────────────────────────────────────
// Announce each step, so a failure inside the page says which capture broke
// rather than only that something threw.
async function step(name, fn) {
  process.stdout.write('  ' + name + ' … ');
  try {
    const value = await fn();
    console.log('ok');
    return value;
  } catch (err) {
    console.log('FAILED');
    throw new Error(name + ': ' + (err && err.message ? err.message : String(err)));
  }
}

async function collect() {
  const snapshot = { note: 'Behaviour of the pre-refactor app. See run.js.' };

  const photo = await step('fixture photo', () => js(PHOTO_JS));
  snapshot.fixturePhoto = { dataUrlLength: photo.length, prefix: photo.slice(0, 22) };

  // Hebrew first, since that is the language it is actually used in.
  await seed('he', photo);
  snapshot.persistence = await step('persistence', capturePersistence);

  await openTab('שמות למגירות');
  await sleep(600);
  snapshot.largeCards = await step('large cards', () => captureCards('large'));
  snapshot.largePrintArea = await step('large print area', () => capturePrintArea('large'));

  snapshot.sizePersists = await step('card size persists', async () => {
    const typed = await captureSizePersists('רוחב');
    await win.webContents.reload();
    await sleep(2200);
    await openTab('שמות למגירות');
    await sleep(500);
    const after = await js(`(() => {
      const label = [...document.querySelectorAll('label')]
        .find(l => l.textContent.trim().startsWith('רוחב'));
      return label ? label.querySelector('input').value : 'not found';
    })()`);
    return { ...typed, afterReload: after };
  });

  // Put the fixture back before anything else is measured.
  await seed('he', photo);
  await openTab('שמות לסלסלאות');
  await sleep(600);
  snapshot.smallCards = await step('small cards', () => captureCards('small'));
  snapshot.smallPrintArea = await step('small print area', () => capturePrintArea('small'));

  await openTab('טבלת נוכחות');
  await sleep(500);
  downloads.clear();
  await clickContaining('הורדת קובץ Excel');
  await sleep(2000);
  const xlsx = downloads.get('xlsx');
  snapshot.attendanceXlsx = xlsx ? captureXlsx(xlsx) : { error: 'no download captured' };

  await openTab('תמונת סיום');
  await sleep(600);
  downloads.clear();
  await clickContaining('שמירת תמונה');
  await sleep(3000);
  const png = downloads.get('png');
  snapshot.graduationPng = png ? await step('graduation pixels', () => captureGradPixels(png)) : { error: 'no download captured' };

  // The English side of the string tables, so a missing translation is caught.
  await seed('en', photo);
  snapshot.englishTabLabels = await step('english labels', () => js(`[...document.querySelectorAll('button')]
    .slice(2, 7).map(b => b.innerText.trim())`));
  await seed('he', photo);
  snapshot.hebrewTabLabels = await step('hebrew labels', () => js(`[...document.querySelectorAll('button')]
    .slice(2, 7).map(b => b.innerText.trim())`));

  return snapshot;
}

// ── comparison ────────────────────────────────────────────────────────────
//
// Almost everything is compared exactly — the saved shape, the colours, the
// spreadsheet's bytes. A few measurements genuinely differ between machines by
// a hair and are given a tolerance, chosen to be far smaller than any change
// worth catching:
//
//   * proportions come from sub-pixel layout, which rounds differently across
//     platforms — 0.2% of a card is invisible, a changed ratio is not;
//   * the text block in the exported picture is found by scanning pixels, and
//     glyph rasterisation differs between Windows and macOS by a pixel or two.
//     8 px on a 2126 px canvas is under half a percent; a moved or resized
//     title shifts it by far more.
const TOLERANCES = [
  { pattern: /^(large|small)Cards\.\d+\.(fontSizePctOfHeight|radiusPctOfShorterSide)$/, allow: 0.2 },
  { pattern: /^(large|small)Cards\.\d+\.(lineHeightRatio|aspectRatio)$/, allow: 0.01 },
  { pattern: /^graduationPng\.text\.(left|right|top|bottom|widthPx|heightPx)$/, allow: 8 },
  { pattern: /^graduationPng\.text\.centreXpct$/, allow: 0.5 }
];

function withinTolerance(trail, actual, expected) {
  if (typeof actual !== 'number' || typeof expected !== 'number') return false;
  const rule = TOLERANCES.find(t => t.pattern.test(trail));
  return !!rule && Math.abs(actual - expected) <= rule.allow;
}

function diff(actual, expected, trail = '', out = []) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) return out;
  if (withinTolerance(trail, actual, expected)) return out;
  const bothObjects = actual && expected &&
    typeof actual === 'object' && typeof expected === 'object' &&
    Array.isArray(actual) === Array.isArray(expected);
  if (!bothObjects) {
    out.push({ at: trail || '(root)', expected, actual });
    return out;
  }
  const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  for (const k of keys) diff(actual[k], expected[k], trail ? trail + '.' + k : k, out);
  return out;
}

app.whenReady().then(async () => {
  session.defaultSession.on('will-download', (event, item) => {
    const name = item.getFilename();
    const chunks = [];
    item.on('updated', () => {});
    item.setSavePath(path.join(app.getPath('temp'), 'kh-char-' + Date.now() + '-' + name));
    item.once('done', (e, state) => {
      if (state !== 'completed') return;
      const buf = fs.readFileSync(item.getSavePath());
      fs.unlinkSync(item.getSavePath());
      downloads.set(name.endsWith('.xlsx') ? 'xlsx' : 'png', buf);
    });
  });

  win = new BrowserWindow({
    width: WIDTH, height: HEIGHT, show: false,
    webPreferences: { contextIsolation: true }
  });
  await win.loadFile(APP_HTML);
  await sleep(2000);

  let snapshot;
  try {
    snapshot = await collect();
  } catch (err) {
    console.error('characterization run failed:', err);
    app.exit(1);
    return;
  }

  if (UPDATE || !fs.existsSync(GOLDEN)) {
    fs.writeFileSync(GOLDEN, JSON.stringify(snapshot, null, 2) + '\n');
    console.log((fs.existsSync(GOLDEN) ? 'wrote' : 'created') + ' ' + path.relative(REPO, GOLDEN));
    console.log('Review it before committing — it is the definition of "unchanged".');
    app.exit(0);
    return;
  }

  const expected = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const differences = diff(snapshot, expected);

  if (!differences.length) {
    console.log('characterization: behaviour matches the golden file');
    app.exit(0);
    return;
  }

  console.log('characterization: ' + differences.length + ' difference(s) from the golden file\n');
  for (const d of differences.slice(0, 40)) {
    console.log('  ' + d.at);
    console.log('    expected: ' + JSON.stringify(d.expected));
    console.log('    actual:   ' + JSON.stringify(d.actual));
  }
  if (differences.length > 40) console.log('  … and ' + (differences.length - 40) + ' more');
  app.exit(1);
}).catch(err => { console.error(err); app.exit(1); });
