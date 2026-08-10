// The card naming and geometry rules, checked against the proportions the
// characterization suite recorded from the shipped app.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderCards, cardName, countFirstNames, CARD_SIZE_CM } from '../../src/renderer/lib/cards';
import type { Child, StudioSettings } from '../../src/renderer/lib/types';

const golden = JSON.parse(
  readFileSync(join(__dirname, '..', 'characterization', 'golden.json'), 'utf8')
);

const CHILDREN: Child[] = [
  { id: 1, first: 'Noa', last: 'Levi', tz: '111' },
  { id: 2, first: 'Noa', last: 'Cohen', tz: '222' },
  { id: 3, first: '', last: 'Mizrahi', tz: '333' },
  { id: 4, first: 'איתי', last: 'בר', tz: '444' }
];

const LARGE: StudioSettings = {
  uniform: false, bg: '#FEF3D8', text: '#2B2723', border: '#E07A4B',
  font: 'Rubik', size: 80, borderStyle: 'dashed', borderWidth: 6, cornerRadius: 9,
  overrides: { 2: { bg: '#E3F0FB', text: '#4C7FB8' } }, selectedId: null
};

const SMALL: StudioSettings = {
  uniform: true, bg: '#E3F0FB', text: '#2B2723', border: '#2FA39B',
  font: 'Heebo', size: 120, borderStyle: 'solid', borderWidth: 3, cornerRadius: 4,
  overrides: {}, selectedId: null
};

describe('cardName', () => {
  const counts = countFirstNames(CHILDREN);

  it('shows the first name alone when it is unique', () => {
    expect(cardName(CHILDREN[3], counts)).toBe('איתי');
  });

  it('adds a surname initial only to tell duplicates apart', () => {
    expect(cardName(CHILDREN[0], counts)).toBe('Noa L.');
    expect(cardName(CHILDREN[1], counts)).toBe('Noa C.');
  });

  it('falls back to a dash rather than an empty card', () => {
    expect(cardName(CHILDREN[2], counts)).toBe('—');
  });

  it('treats names as the same regardless of case or stray spaces', () => {
    const kids: Child[] = [
      { id: 1, first: 'noa', last: 'Levi', tz: '' },
      { id: 2, first: ' Noa ', last: 'Cohen', tz: '' }
    ];
    const c = countFirstNames(kids);
    expect(cardName(kids[0], c)).toBe('noa L.');
    expect(cardName(kids[1], c)).toBe('Noa C.');
  });

  it('leaves the name alone when the duplicate has no surname to take an initial from', () => {
    const kids: Child[] = [
      { id: 1, first: 'Noa', last: '', tz: '' },
      { id: 2, first: 'Noa', last: '', tz: '' }
    ];
    const c = countFirstNames(kids);
    expect(cardName(kids[0], c)).toBe('Noa');
  });
});

describe('renderCards', () => {
  it('matches the names the shipped app renders', () => {
    expect(renderCards('large', LARGE, CHILDREN).map(c => c.name))
      .toEqual(golden.largeCards.map((c: { name: string }) => c.name));
    expect(renderCards('small', SMALL, CHILDREN).map(c => c.name))
      .toEqual(golden.smallCards.map((c: { name: string }) => c.name));
  });

  it('matches the text size the shipped app renders, as a share of the card', () => {
    const large = renderCards('large', LARGE, CHILDREN)[0];
    expect(large.fontSize).toBe(golden.largeCards[0].fontSizePctOfHeight + 'cqh');

    const small = renderCards('small', SMALL, CHILDREN)[0];
    expect(small.fontSize).toBe(golden.smallCards[0].fontSizePctOfHeight + 'cqh');
  });

  it('matches the corner radius the shipped app renders', () => {
    expect(renderCards('large', LARGE, CHILDREN)[0].borderRadius)
      .toBe(golden.largeCards[0].radiusPctOfShorterSide + 'cqmin');
    expect(renderCards('small', SMALL, CHILDREN)[0].borderRadius)
      .toBe(golden.smallCards[0].radiusPctOfShorterSide + 'cqmin');
  });

  it('applies per-child overrides only when not colouring uniformly', () => {
    const overridden = renderCards('large', LARGE, CHILDREN)[1];
    expect(overridden.bg).toBe('#E3F0FB');
    expect(overridden.text).toBe('#4C7FB8');
    // Not overridden, so it keeps the studio's border.
    expect(overridden.border).toBe('#E07A4B');

    const uniform = renderCards('large', { ...LARGE, uniform: true }, CHILDREN)[1];
    expect(uniform.bg).toBe('#FEF3D8');
  });

  it('writes the border shorthand the way the studio is set', () => {
    expect(renderCards('large', LARGE, CHILDREN)[0].borderCss).toBe('6px dashed #E07A4B');
    expect(renderCards('small', SMALL, CHILDREN)[0].borderCss).toBe('3px solid #2FA39B');
  });

  it('drops the border entirely rather than drawing a zero-width one', () => {
    const none = renderCards('large', { ...LARGE, borderStyle: 'none' }, CHILDREN)[0];
    expect(none.borderCss).toBe('none');
  });

  it('marks the selected card only while colouring one at a time', () => {
    const picked = renderCards('large', { ...LARGE, selectedId: 3 }, CHILDREN);
    expect(picked.map(c => c.selected)).toEqual([false, false, true, false]);

    const uniform = renderCards('large', { ...LARGE, uniform: true, selectedId: 3 }, CHILDREN);
    expect(uniform.every(c => !c.selected)).toBe(true);
  });

  it('scales the text with the studio size setting', () => {
    const half = renderCards('large', { ...LARGE, size: 50 }, CHILDREN)[0];
    expect(half.fontSize).toBe('13.0cqh');
    const full = renderCards('large', { ...LARGE, size: 100 }, CHILDREN)[0];
    expect(full.fontSize).toBe('26.0cqh');
  });
});

describe('CARD_SIZE_CM', () => {
  it('is the physical size the print sheet promises', () => {
    expect(CARD_SIZE_CM.large).toEqual({ width: 6, height: 4 });
    expect(CARD_SIZE_CM.small).toEqual({ width: 4, height: 2 });
    expect(golden.largePrintArea.cardWidth).toBe(CARD_SIZE_CM.large.width + 'cm');
    expect(golden.largePrintArea.cardHeight).toBe(CARD_SIZE_CM.large.height + 'cm');
    expect(golden.smallPrintArea.cardWidth).toBe(CARD_SIZE_CM.small.width + 'cm');
    expect(golden.smallPrintArea.cardHeight).toBe(CARD_SIZE_CM.small.height + 'cm');
  });
});
