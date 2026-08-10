// Medals: the naming, the sizing, and the two SVG ornaments.

import { describe, it, expect } from 'vitest';
import {
  renderMedals, clampDiameter, frillsPath, ribbonPath,
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

describe('the ornaments', () => {
  it('draws a closed scalloped path with one arc per scallop', () => {
    const d = frillsPath(16);
    expect(d.startsWith('M ')).toBe(true);
    expect(d.trim().endsWith('Z')).toBe(true);
    expect((d.match(/ A /g) || [])).toHaveLength(16);
    expect(d).not.toContain('NaN');
  });

  it('scales the scallops with the count rather than fixing their size', () => {
    const few = frillsPath(6);
    const many = frillsPath(24);
    const radiusOf = (d: string) => parseFloat(/A ([\d.]+)/.exec(d)![1]);
    expect(radiusOf(few)).toBeGreaterThan(radiusOf(many));
  });

  it('keeps the ribbon inside the circle, so the cut guide does not clip it', () => {
    const d = ribbonPath();
    const xs = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => parseFloat(m[1]));
    const ys = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => parseFloat(m[2]));
    for (let i = 0; i < xs.length; i++) {
      const distance = Math.hypot(xs[i] - 50, ys[i] - 50);
      expect(distance, `point ${xs[i]},${ys[i]}`).toBeLessThanOrEqual(50);
    }
  });

  it('notches the ribbon ends rather than leaving them square', () => {
    // Eight points: two corners at each end plus the notch that folds inward.
    expect((ribbonPath().match(/L /g) || []).length).toBeGreaterThanOrEqual(6);
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
