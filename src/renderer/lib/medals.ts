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

/**
 * A scalloped rim: `count` outward bulges evenly spaced around the circle.
 *
 * Drawn in a 0–100 viewBox so it scales with the medal. Each scallop is a
 * circular arc between two points on the rim, bulging outwards by enough to
 * read as a frill without eating into the name.
 */
export function frillsPath(count = 16, radius = 44, bulge = 6): string {
  const centre = 50;
  const point = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return [
      (centre + radius * Math.cos(rad)).toFixed(2),
      (centre + radius * Math.sin(rad)).toFixed(2)
    ];
  };
  const step = 360 / count;
  // Radius of each bulging arc: half the chord, plus the bulge, is close
  // enough and keeps the scallops touching.
  const chord = 2 * radius * Math.sin((step / 2) * (Math.PI / 180));
  const arcR = (chord / 2 + bulge).toFixed(2);

  let d = `M ${point(0).join(' ')}`;
  for (let i = 1; i <= count; i++) {
    // sweep-flag 1 bulges away from the centre.
    d += ` A ${arcR} ${arcR} 0 0 1 ${point(i * step).join(' ')}`;
  }
  return d + ' Z';
}

/**
 * A banner across the lower part of the medal, with notched ends — the shape a
 * ribbon makes when it is folded back on itself. The phrase sits on top of it.
 */
export function ribbonPath(top = 60, height = 16): string {
  const bottom = top + height;
  // Fit the chord the ribbon actually sits on, so it stays inside the circle.
  // Anything overhanging would be sliced off by the circular cut guide, which
  // leaves a blunt end rather than a ribbon.
  const halfWidthAt = (y: number) => Math.sqrt(Math.max(0, 50 * 50 - (y - 50) ** 2));
  const half = Math.min(halfWidthAt(top), halfWidthAt(bottom)) - 1;
  const left = +(50 - half).toFixed(2);
  const right = +(50 + half).toFixed(2);
  const notch = 7;
  const mid = top + height / 2;
  return [
    `M ${left} ${top}`,
    `L ${right} ${top}`,
    `L ${right - notch} ${mid}`,
    `L ${right} ${bottom}`,
    `L ${left + notch} ${bottom}`,
    `L ${left} ${bottom}`,
    `L ${left + notch} ${mid}`,
    `Z`
  ].join(' ');
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
