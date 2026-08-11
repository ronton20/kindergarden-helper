// Medals: the naming, the sizing, and the two SVG ornaments.

import { describe, it, expect } from 'vitest';
import {
  renderMedals, clampDiameter, ribbonShape, petalRing, darken, FRILLS,
  DEFAULT_MEDAL_CM, MIN_MEDAL_CM, MAX_MEDAL_CM
} from '../../src/renderer/lib/medals';
import { medalsPerPage } from '../../src/renderer/features/medals/MedalsTab';
import { fromSaved, DEFAULT_PHRASE } from '../../src/renderer/lib/storage';
import type { Child, MedalSettings } from '../../src/renderer/lib/types';

const CHILDREN: Child[] = [
  { id: 1, first: 'Noa', last: 'Levi', tz: '' },
  { id: 2, first: 'Noa', last: 'Cohen', tz: '' },
  { id: 3, first: '', last: 'Mizrahi', tz: '' }
];

const SETTINGS: MedalSettings = {
  diameter: 6, ornament: 'border', phrase: 'בהצלחה!',
  uniform: true, bg: '#F2C14E', text: '#2B2723', border: '#E07A4B',
  font: 'Rubik', size: 100, borderWidth: 6, overrides: {}, selectedId: null
};

describe('renderMedals', () => {
  it('uses the same naming rules as the cards', () => {
    expect(renderMedals(SETTINGS, CHILDREN).map((m) => m.name)).toEqual(['Noa L.', 'Noa C.', '—']);
  });

  it('puts the send-off on every medal', () => {
    for (const medal of renderMedals(SETTINGS, CHILDREN)) expect(medal.phrase).toBe('בהצלחה!');
  });

  it('sizes text against the shorter side, so a circle scales evenly', () => {
    const medal = renderMedals(SETTINGS, CHILDREN)[0];
    expect(medal.nameSize).toBe('20.0cqmin');
    expect(medal.phraseSize).toBe('9.0cqmin');
  });

  it('keeps text a fixed share of the medal whatever its diameter', () => {
    const small = renderMedals({ ...SETTINGS, diameter: 4 }, CHILDREN)[0];
    const large = renderMedals({ ...SETTINGS, diameter: 15 }, CHILDREN)[0];
    expect(small.nameSize).toBe(large.nameSize);
  });

  it('scales with the text size setting', () => {
    expect(renderMedals({ ...SETTINGS, size: 50 }, CHILDREN)[0].nameSize).toBe('10.0cqmin');
  });

  it('applies per-child colours only when not colouring uniformly', () => {
    const overridden: MedalSettings = {
      ...SETTINGS, uniform: false, overrides: { 2: { bg: '#6A994E', border: '#2B2723' } }
    };
    const medals = renderMedals(overridden, CHILDREN);
    expect(medals[1].bg).toBe('#6A994E');
    expect(medals[1].ornamentColour).toBe('#2B2723');
    expect(medals[0].bg).toBe('#F2C14E');

    // The same overrides are ignored while colouring everything at once.
    expect(renderMedals({ ...overridden, uniform: true }, CHILDREN)[1].bg).toBe('#F2C14E');
  });

  it('marks the selected medal only when colouring one at a time', () => {
    const picked = renderMedals({ ...SETTINGS, uniform: false, selectedId: 2 }, CHILDREN);
    expect(picked.map((m) => m.selected)).toEqual([false, true, false]);
    expect(renderMedals({ ...SETTINGS, selectedId: 2 }, CHILDREN).every((m) => !m.selected)).toBe(true);
  });
});

describe('clampDiameter', () => {
  it('defaults to 6 cm across', () => {
    expect(DEFAULT_MEDAL_CM).toBe(6);
  });

  it('keeps a sensible diameter', () => {
    expect(clampDiameter(8.5, DEFAULT_MEDAL_CM)).toBe(8.5);
  });

  it('refuses one too small to read or too big to print', () => {
    expect(clampDiameter(0.5, DEFAULT_MEDAL_CM)).toBe(MIN_MEDAL_CM);
    expect(clampDiameter(300, DEFAULT_MEDAL_CM)).toBe(MAX_MEDAL_CM);
  });

  it('falls back on nonsense rather than producing NaN', () => {
    expect(clampDiameter('abc', DEFAULT_MEDAL_CM)).toBe(DEFAULT_MEDAL_CM);
    expect(clampDiameter(undefined, DEFAULT_MEDAL_CM)).toBe(DEFAULT_MEDAL_CM);
  });
});

/**
 * The points a path actually visits. Needed because an arc command carries its
 * radii and flags before its endpoint, and a "number number" regex happily
 * reads "47 47" and "0 0" as places the path goes.
 */
function pointsOf(d: string): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  const tokens = d.match(/[A-Za-z]|-?[\d.]+/g) || [];
  let i = 0;
  while (i < tokens.length) {
    const command = tokens[i++];
    const take = (n: number) => tokens.slice(i, i + n).map(Number);
    if (command === 'M' || command === 'L') {
      const [x, y] = take(2); i += 2; points.push([x, y]);
    } else if (command === 'A') {
      const args = take(7); i += 7; points.push([args[5], args[6]]);
    }
    // Z carries nothing.
  }
  return points;
}

describe('the ornaments', () => {
  it('lays petals evenly around the medal', () => {
    const ring = petalRing(11, 31, 8.5, 15);
    expect(ring).toHaveLength(11);
    const angles = ring.map((p) => p.angle);
    // Evenly spaced, and starting where it says it does.
    expect(angles[0]).toBe(0);
    const step = 360 / 11;
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i] - angles[i - 1]).toBeCloseTo(step, 1);
    }
  });

  it('offsets the back ring by half a step, so petals overlap', () => {
    const step = 360 / FRILLS.front.length;
    expect(FRILLS.back[0].angle).toBeCloseTo(step / 2, 1);
    // And the back petals are the larger ones.
    expect(FRILLS.back[0].rx).toBeGreaterThan(FRILLS.front[0].rx);
    expect(FRILLS.back[0].ry).toBeGreaterThan(FRILLS.front[0].ry);
  });

  it('leaves the face big enough for a name', () => {
    // Over half the medal's width, or the name has nowhere to go.
    expect(FRILLS.discRadius * 2).toBeGreaterThan(50);
  });

  it('keeps the petals within the medal box', () => {
    for (const p of [...FRILLS.back, ...FRILLS.front]) {
      expect(50 - p.cy + p.ry).toBeLessThanOrEqual(50);
    }
  });

  it('draws the ribbon as a straight band with a fold at each end', () => {
    const { band, folds } = ribbonShape();
    expect(band).toMatch(/^M /);
    // Straight, not arced: a band following the rim tapers at its ends and
    // reads as a crescent rather than a ribbon.
    expect(band).not.toContain(' A ');
    expect(band.trim()).toMatch(/Z$/);
    expect(folds).toHaveLength(2);
    for (const d of folds) {
      expect(d).toMatch(/^M /);
      expect(d).not.toContain('NaN');
    }
  });

  it('keeps the whole ribbon inside the rim', () => {
    // The cut guide is a circle: anything outside it is scissored off, and
    // tails on neighbouring medals meet in the gap and read as one long ribbon
    // running through all of them.
    const { band, folds } = ribbonShape();
    for (const d of [band, ...folds]) {
      for (const [x, y] of pointsOf(d)) {
        expect(Math.hypot(x - 50, y - 50), `${x},${y}`).toBeLessThanOrEqual(50.01);
      }
    }
  });

  it('folds outwards at both ends, not inwards', () => {
    const [left, right] = ribbonShape().folds.map(pointsOf);
    // Each wedge reaches from its band end towards the rim on its own side.
    // The first version took the direction from the argument order, and with
    // 90 degrees at the bottom that folded both ends inwards.
    expect(Math.min(...left.map(([x]) => x))).toBeLessThan(50);
    expect(Math.max(...right.map(([x]) => x))).toBeGreaterThan(50);
    expect(Math.max(...left.map(([x]) => x))).toBeLessThan(Math.min(...right.map(([x]) => x)));
  });

  it('spans the bottom of the medal symmetrically', () => {
    const { band } = ribbonShape();
    const xs = pointsOf(band).map(([x]) => x);
    const ys = pointsOf(band).map(([, y]) => y);
    expect(Math.min(...xs)).toBeLessThan(50);
    expect(Math.max(...xs)).toBeGreaterThan(50);
    // Entirely in the lower half.
    expect(Math.min(...ys)).toBeGreaterThan(50);
  });
});

describe('darken', () => {
  it('shades a colour towards black without changing its hue much', () => {
    expect(darken('#E07A4B', 0.5)).toBe('#703d26');
    expect(darken('#FFFFFF', 0.2)).toBe('#cccccc');
  });

  it('leaves anything it does not understand alone', () => {
    expect(darken('rebeccapurple')).toBe('rebeccapurple');
    expect(darken('')).toBe('');
  });
});

describe('medalsPerPage', () => {
  it('counts what fits on A4 inside its margins', () => {
    // 19 x 27.7 cm printable, 0.5 cm gaps: three across, four down at 6 cm.
    expect(medalsPerPage(6)).toBe(12);
    expect(medalsPerPage(10)).toBe(2);
  });
});

describe('medal settings in storage', () => {
  it('starts with the send-off in the machine language', () => {
    expect(fromSaved(null, 'he-IL').state.medals.phrase).toBe(DEFAULT_PHRASE.he);
    expect(fromSaved(null, 'en-GB').state.medals.phrase).toBe(DEFAULT_PHRASE.en);
  });

  it('gives a save from before medals existed the full defaults', () => {
    const { state } = fromSaved({ children: [], lang: 'he' });
    expect(state.medals.diameter).toBe(DEFAULT_MEDAL_CM);
    expect(state.medals.ornament).toBe('border');
    expect(state.medals.phrase).toBe(DEFAULT_PHRASE.he);
  });

  it('keeps a send-off the teacher typed', () => {
    const { state } = fromSaved({ children: [], medals: { phrase: 'כל הכבוד!' } });
    expect(state.medals.phrase).toBe('כל הכבוד!');
  });

  it('clamps a diameter that could not print', () => {
    expect(fromSaved({ children: [], medals: { diameter: 999 } }).state.medals.diameter)
      .toBe(MAX_MEDAL_CM);
  });
});
