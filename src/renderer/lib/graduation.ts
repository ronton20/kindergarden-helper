// Drawing the graduation picture at print resolution.
//
// The hard part is making the exported picture match the preview exactly. The
// preview is a CSS box with text positioned by percentages and sized in
// container units; the export is a canvas. Every number below exists to make
// those two agree — an earlier version got the scale wrong and exported text
// 2.24x larger than what was on screen.

import type { GradSettings } from './types';

/** 18 x 13 cm at roughly 300dpi. */
export const EXPORT_WIDTH = 2126;
export const EXPORT_HEIGHT = 1535;

/**
 * The preview sizes its text against a box this wide, so `grad.size` is in
 * "pixels at a 600px preview". Every length is that length times the scale.
 * Getting this wrong is what made exported titles bigger than the preview's.
 */
export const PREVIEW_WIDTH = 600;

/** The line height the preview uses, matched here so the text block is the same height. */
const LINE_HEIGHT = 1.15;

/** The subtitle is a little over half the title. */
export const SUBTITLE_RATIO = 0.52;

/**
 * Where a CSS line box puts its glyphs: lineTop + halfLeading + ascent. Matched
 * rather than guessed, so the text lands where the preview shows it.
 */
function baselineOffset(ctx: CanvasRenderingContext2D, fontPx: number): number {
  const m = ctx.measureText('M');
  const rawAscent = m.fontBoundingBoxAscent;
  const rawDescent = m.fontBoundingBoxDescent;
  const ascent = (rawAscent == null || isNaN(rawAscent)) ? fontPx * 0.8 : rawAscent;
  const descent = (rawDescent == null || isNaN(rawDescent)) ? fontPx * 0.2 : rawDescent;
  return (LINE_HEIGHT * fontPx - (ascent + descent)) / 2 + ascent;
}

/**
 * Cover-crop, the same as CSS `object-fit: cover`: fill the frame, keep the
 * aspect ratio, centre what does not fit.
 */
export function coverRect(
  imageWidth: number, imageHeight: number, frameWidth: number, frameHeight: number
): { dx: number; dy: number; dw: number; dh: number } {
  const imageRatio = imageWidth / imageHeight;
  const frameRatio = frameWidth / frameHeight;
  if (imageRatio > frameRatio) {
    const dh = frameHeight;
    const dw = frameHeight * imageRatio;
    return { dx: (frameWidth - dw) / 2, dy: 0, dw, dh };
  }
  const dw = frameWidth;
  const dh = frameWidth / imageRatio;
  return { dx: 0, dy: (frameHeight - dh) / 2, dw, dh };
}

/** Font sizes on the export canvas, for a given settings object. */
export function exportFontSizes(size: number): { title: number; subtitle: number } {
  const scale = EXPORT_WIDTH / PREVIEW_WIDTH;
  const title = size * scale;
  return { title, subtitle: title * SUBTITLE_RATIO };
}

export async function renderGraduationCanvas(
  grad: GradSettings,
  image: HTMLImageElement
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');

  const scale = EXPORT_WIDTH / PREVIEW_WIDTH;
  const { dx, dy, dw, dh } = coverRect(image.width, image.height, EXPORT_WIDTH, EXPORT_HEIGHT);

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  ctx.drawImage(image, dx, dy, dw, dh);

  const { title: titlePx, subtitle: subPx } = exportFontSizes(grad.size);
  const family = '"' + grad.font + '"';
  const titleFont = '700 ' + titlePx + 'px ' + family + ',sans-serif';
  const subFont = '700 ' + subPx + 'px ' + family + ',sans-serif';

  // Load the exact faces this picture needs. `document.fonts.ready` alone can
  // resolve before a Hebrew subset the canvas is about to use has arrived, and
  // the canvas would silently fall back to a different typeface.
  try {
    await Promise.all([
      grad.title ? document.fonts.load(titleFont, grad.title) : null,
      grad.subtitle ? document.fonts.load(subFont, grad.subtitle) : null
    ].filter(Boolean) as Promise<unknown>[]);
    await document.fonts.ready;
  } catch {
    // Worst case the export uses a fallback face; better than no export.
  }

  const titleHeight = grad.title ? titlePx * LINE_HEIGHT : 0;
  const subHeight = grad.subtitle ? subPx * LINE_HEIGHT : 0;
  const totalHeight = titleHeight + subHeight;

  const cx = EXPORT_WIDTH * grad.x / 100;
  const cy = EXPORT_HEIGHT * grad.y / 100;
  // The preview centres the block on the drag point: translate(-50%, -50%).
  let top = cy - totalHeight / 2;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = grad.color;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 8 * scale;
  ctx.shadowOffsetY = 2 * scale;

  if (grad.title) {
    ctx.font = titleFont;
    ctx.fillText(grad.title, cx, top + baselineOffset(ctx, titlePx));
    top += titleHeight;
  }
  if (grad.subtitle) {
    ctx.font = subFont;
    ctx.fillText(grad.subtitle, cx, top + baselineOffset(ctx, subPx));
  }

  return canvas;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned nothing'))),
      'image/png'
    );
  });
}
