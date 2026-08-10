// Loading saved state, and in particular what happens to a list saved by an
// older version. This is the only irreplaceable data in the app, so the
// forgiving-read behaviour is worth pinning down.

import { describe, it, expect } from 'vitest';
import { fromSaved, defaultState, defaultSubtitle, DEFAULT_TITLE } from '../../src/renderer/lib/storage';
import { DEFAULT_CARD_SIZE } from '../../src/renderer/lib/cards';

describe('fromSaved', () => {
  it('starts empty when there is nothing saved', () => {
    const { state, hadSaved, nextId } = fromSaved(null);
    expect(hadSaved).toBe(false);
    expect(state.children).toEqual([]);
    expect(nextId).toBe(1);
  });

  it('follows the machine language until a choice has been saved', () => {
    expect(fromSaved(null, 'he-IL').state.lang).toBe('he');
    expect(fromSaved(null, 'en-GB').state.lang).toBe('en');
    expect(fromSaved({ children: [], lang: 'en' }, 'he-IL').state.lang).toBe('en');
  });

  it('keeps the children exactly as saved', () => {
    const children = [{ id: 4, first: 'נועה', last: 'לוי', tz: '1' }];
    const { state, nextId } = fromSaved({ children });
    expect(state.children).toEqual(children);
    // New children must not collide with ids already in use.
    expect(nextId).toBe(5);
  });

  it('survives corrupt or foreign data rather than refusing to start', () => {
    expect(fromSaved('nonsense').state.children).toEqual([]);
    expect(fromSaved(42).state.children).toEqual([]);
    expect(fromSaved({ children: 'not an array' }).state.children).toEqual([]);
    expect(fromSaved({ large: 'not an object' }).state.large).toEqual(defaultState().large);
  });

  it('ignores a language it does not have a table for', () => {
    expect(fromSaved({ children: [], lang: 'fr' }, 'en').state.lang).toBe('en');
  });

  describe('settings saved before the card size existed', () => {
    // Phase 5 made the size a setting. Anything saved earlier has no cardSize,
    // and the plan's call was to move those to the new defaults rather than pin
    // them to the old hardcoded 6x4 — which nobody ever chose.
    const beforePhase5 = {
      children: [{ id: 1, first: 'A', last: 'B', tz: '' }],
      large: {
        uniform: true, bg: '#FEF3D8', text: '#2B2723', border: '#E07A4B',
        font: 'Rubik', size: 100, borderStyle: 'solid', borderWidth: 4,
        cornerRadius: 6, overrides: {}, selectedId: null
      },
      small: {
        uniform: true, bg: '#E3F0FB', text: '#2B2723', border: '#2FA39B',
        font: 'Rubik', size: 100, borderStyle: 'solid', borderWidth: 3,
        cornerRadius: 6, overrides: {}, selectedId: null
      }
    };

    it('gets the new default size', () => {
      const { state } = fromSaved(beforePhase5);
      expect(state.large.cardSize).toEqual(DEFAULT_CARD_SIZE.large);
      expect(state.small.cardSize).toEqual(DEFAULT_CARD_SIZE.small);
    });

    it('keeps every other setting the teacher did choose', () => {
      const { state } = fromSaved(beforePhase5);
      expect(state.large.bg).toBe('#FEF3D8');
      expect(state.large.borderWidth).toBe(4);
      expect(state.small.border).toBe('#2FA39B');
      expect(state.children).toHaveLength(1);
    });
  });

  it('keeps a size that was chosen, and clamps one that could not print', () => {
    const chosen = fromSaved({ children: [], large: { cardSize: { w: 7, h: 3 } } });
    expect(chosen.state.large.cardSize).toEqual({ w: 7, h: 3 });

    const absurd = fromSaved({ children: [], large: { cardSize: { w: 500, h: 0 } } });
    expect(absurd.state.large.cardSize.w).toBeLessThanOrEqual(19);
    expect(absurd.state.large.cardSize.h).toBeGreaterThanOrEqual(2);
  });

  it('fills in a title and subtitle when an older save has none', () => {
    const { state } = fromSaved({ children: [], grad: { img: null, title: '', subtitle: '' } });
    expect(state.grad.title).toBe(DEFAULT_TITLE);
    expect(state.grad.subtitle).toBe(defaultSubtitle());
  });

  it('does not overwrite a title the teacher typed', () => {
    const { state } = fromSaved({ children: [], grad: { title: 'גן שקד', subtitle: '2026' } });
    expect(state.grad.title).toBe('גן שקד');
    expect(state.grad.subtitle).toBe('2026');
  });
});

describe('defaultSubtitle', () => {
  it('rolls over to the new school year in August', () => {
    expect(defaultSubtitle(new Date(2026, 6, 15))).toContain('2025–2026');
    expect(defaultSubtitle(new Date(2026, 7, 1))).toContain('2026–2027');
  });
});
