// Turning whatever the teacher picked into a picture the app can use.
//
// The awkward case is iPhone photos. Chromium cannot decode HEIC, so a
// vendored pure-JavaScript decoder is used — but it is 2 MB, so it is gzipped
// into the bundle and only inflated the first time someone actually picks one.
// Everything else goes through the browser, which also applies the EXIF
// rotation iPhone photos carry.

import libheifGzipBase64 from '../assets/libheif.js.gz?base64';

/** Capping the longest side keeps full print detail while fitting in localStorage. */
const MAX_PHOTO_PX = 2600;

/** ISO-BMFF brands that mean "this is a HEIC/HEIF". */
const HEIF_BRANDS = [
  'heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs', 'mif1', 'msf1'
];

/**
 * Apple's brand lives at bytes 8..12, right after the `ftyp` marker. The file
 * extension is only a hint — the brand decides.
 */
export function isHeic(name: string, head: Uint8Array): boolean {
  if (head.length >= 12 && String.fromCharCode(head[4], head[5], head[6], head[7]) === 'ftyp') {
    const brand = String.fromCharCode(head[8], head[9], head[10], head[11]).toLowerCase();
    return HEIF_BRANDS.includes(brand);
  }
  return /\.(heic|heif|hif)$/i.test(name || '');
}

interface HeifImage {
  get_width(): number;
  get_height(): number;
  display(data: ImageData, cb: (result: ImageData | null) => void): void;
  free?(): void;
}
interface HeifLib {
  HeifDecoder: new () => { decode(bytes: Uint8Array): HeifImage[] };
}

let heifLib: HeifLib | null = null;

/** Inflate and evaluate the decoder, once, on first use. */
async function loadHeifLib(): Promise<HeifLib> {
  if (heifLib) return heifLib;

  const packed = Uint8Array.from(atob(libheifGzipBase64), (c) => c.charCodeAt(0));
  const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const source = await new Response(stream).text();

  // Evaluated rather than imported: it is a vendored UMD build, and keeping it
  // out of the module graph is what lets it stay compressed until now.
  const factory = new Function(source + '\n;return typeof libheif !== "undefined" ? libheif : null;');
  const exported = factory();
  if (!exported) throw new Error('no-heic-decoder');

  heifLib = (typeof exported === 'function' ? exported() : exported) as HeifLib;
  return heifLib;
}

async function decodeHeic(bytes: Uint8Array): Promise<HTMLCanvasElement> {
  const lib = await loadHeifLib();
  const images = new lib.HeifDecoder().decode(bytes);
  if (!images || !images.length) throw new Error('empty-heic');

  const image = images[0];
  const width = image.get_width();
  const height = image.get_height();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');

  const data = ctx.createImageData(width, height);
  await new Promise<void>((resolve, reject) => {
    image.display(data, (result) => (result ? resolve() : reject(new Error('heic-display'))));
  });
  ctx.putImageData(data, 0, 0);
  try { image.free?.(); } catch { /* the decoder's own bookkeeping */ }
  return canvas;
}

async function decodeNative(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Older engines reject the options argument rather than the image.
    return await createImageBitmap(file);
  }
}

export type PhotoStage = 'working' | 'heic';

/** A normalised, downscaled JPEG data URL, whatever came in. */
export async function readPhoto(
  file: File,
  onStage?: (stage: PhotoStage) => void
): Promise<string> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const heic = isHeic(file.name, head);
  onStage?.(heic ? 'heic' : 'working');

  let source: HTMLCanvasElement | ImageBitmap;
  if (heic) {
    source = await decodeHeic(new Uint8Array(await file.arrayBuffer()));
  } else {
    try {
      source = await decodeNative(file);
    } catch {
      // Some builds of Chromium refuse HEIC without a recognisable brand;
      // fall back to the decoder before giving up.
      source = await decodeHeic(new Uint8Array(await file.arrayBuffer()));
    }
  }

  const sw = source.width;
  const sh = source.height;
  if (!sw || !sh) throw new Error('empty-image');

  const scale = Math.min(1, MAX_PHOTO_PX / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // PNGs may be transparent, and the export draws onto black otherwise.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);

  if ('close' in source && typeof source.close === 'function') {
    try { source.close(); } catch { /* already released */ }
  }

  return canvas.toDataURL('image/jpeg', 0.92);
}
