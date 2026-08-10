// Medals: a circle with a child's name and a send-off line, for the children
// moving on to first grade.
//
// The two decorated ornaments are SVG rather than CSS borders, deliberately.
// A CSS border can only be a ring, and anything shaped — a scalloped rim, a
// banner — would have to be redrawn for every medal size. An SVG path drawn in
// a 0–100 viewBox scales to any diameter and stays crisp at print resolution.

import type { Child, MedalSettings, RenderedMedal } from './types';
import { cardName, countFirstNames } from './cards';

/** What a medal measures unless the teacher says otherwise. */
export const DEFAULT_MEDAL_CM = 6;
export const MIN_MEDAL_CM = 3;
export const MAX_MEDAL_CM = 19;

/** Text sizes as a share of the medal's diameter, before the size setting. */
const NAME_PCT = 20;
const PHRASE_PCT = 9;

export function clampDiameter(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!isFinite(n)) return fallback;
  return Math.round(Math.min(MAX_MEDAL_CM, Math.max(MIN_MEDAL_CM, n)) * 10) / 10;
}

/** Mix a colour towards black, for the shaded side of a fold or a petal. */
export function darken(hex: string, amount = 0.22): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (channel: number) => Math.max(0, Math.round(channel * (1 - amount)));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export interface Petal {
  /** Centre of the petal, as a distance from the medal's centre. */
  cy: number;
  rx: number;
  ry: number;
  /** Degrees, for a rotate() about the medal's centre. */
  angle: number;
}

/**
 * A ring of petals, as ellipses to be rotated about the centre.
 *
 * Ellipses rather than hand-drawn paths because a petal *is* an ellipse, and
 * one that is described by four numbers can be re-proportioned by changing a
 * number rather than by re-drawing a bezier.
 */
export function petalRing(count: number, distance: number, rx: number, ry: number, offset = 0): Petal[] {
  const step = 360 / count;
  return Array.from({ length: count }, (_, i) => ({
    cy: 50 - distance,
    rx,
    ry,
    angle: +(i * step + offset).toFixed(2)
  }));
}

/**
 * The petals, in two rings. The back ring is larger, darker and offset by half
 * a step, so the front petals read as sitting on top of it rather than as a
 * flat scalloped edge — which is what a single ring looks like.
 */
export const FRILLS = {
  back: petalRing(11, 33, 9.5, 17, 360 / 22),
  front: petalRing(11, 31, 8.5, 15),
  /** The face of the medal, over the petals' inner ends. */
  discRadius: 33
} as const;

export interface RibbonShape {
  /** The banner: a straight band with a swallowtail cut into each end. */
  band: string;
  /** Two shaded wedges where the band meets the rim, so it reads as folded. */
  folds: [string, string];
  /** Where the band's middle sits, as a percentage of the medal's height. */
  centreY: number;
}

/**
 * A banner across the lower third of the medal, notched into a swallowtail at
 * each end, with a darker wedge bridging the band and the rim so it reads as
 * folding back behind the medal.
 *
 * Straight rather than curved on purpose. A band following the rim reads as a
 * crescent — the inner and outer arcs are different lengths, so it tapers at
 * the ends and looks like a smile rather than a ribbon.
 */
export function ribbonShape(top = 62, height = 17): RibbonShape {
  const bottom = top + height;
  const middle = top + height / 2;

  /** Where the medal's rim crosses a given height. */
  const halfWidthAt = (y: number) => Math.sqrt(Math.max(0, 50 * 50 - (y - 50) ** 2));

  // The band stops at the rim rather than overhanging it. Two reasons, and the
  // second is the one that matters: tails on neighbouring medals meet in the
  // half-centimetre gap on the sheet and read as one long ribbon through all of
  // them; and the cut guide is a circle, so anything outside it is scissored
  // off anyway. It is measured at the band's lower edge, where the circle is
  // narrowest, so the whole band fits.
  const half = halfWidthAt(bottom);
  const left = +(50 - half).toFixed(2);
  const right = +(50 + half).toFixed(2);
  const notch = 7;

  const band = [
    `M ${left} ${top}`,
    `L ${right} ${top}`,
    `L ${right - notch} ${middle}`,
    `L ${right} ${bottom}`,
    `L ${left} ${bottom}`,
    `L ${left + notch} ${middle}`,
    'Z'
  ].join(' ');

  const fold = (direction: 1 | -1): string => {
    const bandEnd = direction === 1 ? right : left;
    const rim = 50 + direction * halfWidthAt(top);
    return [
      `M ${bandEnd.toFixed(2)} ${top}`,
      `L ${rim.toFixed(2)} ${top}`,
      `L ${bandEnd.toFixed(2)} ${(top - height * 0.5).toFixed(2)}`,
      'Z'
    ].join(' ');
  };

  return { band, folds: [fold(-1), fold(1)], centreY: middle };
}

/**
 * Black or white, whichever can actually be read on the given colour. The
 * ornament is any colour the teacher likes, and the send-off sits on top of it.
 */
export function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#2B2723';
  const n = parseInt(m[1], 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255);
  return luminance > 0.42 ? '#2B2723' : '#FFFFFF';
}

export function renderMedals(settings: MedalSettings, children: Child[]): RenderedMedal[] {
  const counts = countFirstNames(children);
  const scale = settings.size / 100;

  return children.map((child) => {
    const override = (!settings.uniform && settings.overrides[child.id]) || {};
    return {
      id: child.id,
      name: cardName(child, counts),
      phrase: settings.phrase,
      bg: override.bg || settings.bg,
      text: override.text || settings.text,
      ornamentColour: override.border || settings.border,
      font: settings.font,
      // cqmin, not cqh: a circle's two dimensions are the same, and cqmin keeps
      // the text a fixed share of it whatever the diameter.
      nameSize: (NAME_PCT * scale).toFixed(1) + 'cqmin',
      phraseSize: (PHRASE_PCT * scale).toFixed(1) + 'cqmin',
      selected: !settings.uniform && settings.selectedId === child.id
    };
  });
}
