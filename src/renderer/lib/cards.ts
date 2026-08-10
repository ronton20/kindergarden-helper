// Turning the children list plus a studio's settings into the cards that get
// drawn — the naming rules and the geometry.
//
// The sizes are proportions rather than pixels, expressed in container-query
// units, so a card renders at the same relative size whether it is in the
// on-screen preview or on the print sheet at its true physical size. That is
// what lets the preview claim to be "actual size".

import type { CardSize, Child, StudioName, StudioSettings } from './types';

/**
 * Base text size, as a percentage of the card's height, before the studio's
 * own size setting is applied. The two studios differ because a basket card is
 * half the height of a drawer card but holds the same names.
 */
const BASE_TEXT_PCT: Record<StudioName, number> = { large: 26, small: 34 };

export interface RenderedCard {
  id: number;
  /** What actually goes on the card — see `cardName`. */
  name: string;
  bg: string;
  text: string;
  border: string;
  font: string;
  /** e.g. "20.8cqh" — a share of the card's height. */
  fontSize: string;
  /** e.g. "9cqmin" — a share of the card's shorter side. */
  borderRadius: string;
  /** e.g. "6px dashed #E07A4B", or "none". */
  borderCss: string;
  /** Whether this card is the one being edited, when colouring one at a time. */
  selected: boolean;
}

/**
 * Counts first names so duplicates can be told apart. Compared lower-cased and
 * trimmed, because "noa" and "Noa " are the same child's name to a teacher.
 */
export function countFirstNames(children: Child[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const child of children) {
    const key = (child.first || '').trim().toLowerCase();
    if (key) counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

/**
 * A card shows the first name alone — that is the point of it, and it is what
 * a four-year-old can recognise. Only when two children share a first name is
 * a surname initial added, and only to tell those two apart. A child with no
 * first name yet gets an em dash rather than an empty card.
 */
export function cardName(child: Child, counts: Record<string, number>): string {
  const first = (child.first || '').trim();
  if (!first) return '—';
  if ((counts[first.toLowerCase()] || 0) <= 1) return first;
  const initial = (child.last || '').trim().charAt(0);
  return initial ? first + ' ' + initial + '.' : first;
}

export function renderCards(
  studio: StudioName,
  settings: StudioSettings,
  children: Child[]
): RenderedCard[] {
  const basePct = BASE_TEXT_PCT[studio];
  const counts = countFirstNames(children);
  const { borderStyle, borderWidth } = settings;

  return children.map((child) => {
    // Overrides only apply when colouring cards one at a time.
    const override = (!settings.uniform && settings.overrides[child.id]) || {};
    const border = override.border || settings.border;
    return {
      id: child.id,
      name: cardName(child, counts),
      bg: override.bg || settings.bg,
      text: override.text || settings.text,
      border,
      font: settings.font,
      fontSize: (basePct * settings.size / 100).toFixed(1) + 'cqh',
      borderRadius: settings.cornerRadius + 'cqmin',
      borderCss: borderStyle === 'none' ? 'none' : `${borderWidth}px ${borderStyle} ${border}`,
      selected: !settings.uniform && settings.selectedId === child.id
    };
  });
}

/**
 * What each studio's cards measure unless the teacher says otherwise.
 *
 * These are larger than the sizes the app shipped with (6 × 4 and 4 × 2). The
 * old values were never a deliberate choice, so saved settings from before the
 * size was configurable move to these rather than being pinned to a number
 * nobody picked.
 */
export const DEFAULT_CARD_SIZE: Record<StudioName, CardSize> = {
  large: { w: 10, h: 5 },
  small: { w: 4.5, h: 2.5 }
};

/**
 * Bounds for the number inputs. The lower one is about the smallest a name
 * stays readable at; the upper one is the short side of A4 minus its margins,
 * beyond which a card cannot fit on the page at all.
 */
export const MIN_CARD_CM = 2;
export const MAX_CARD_CM = 19;

export function clampCardSize(size: Partial<CardSize>, fallback: CardSize): CardSize {
  const clamp = (value: unknown, whenMissing: number) => {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    if (!isFinite(n)) return whenMissing;
    // A tenth of a centimetre is as fine as a ruler and a pair of scissors get.
    return Math.round(Math.min(MAX_CARD_CM, Math.max(MIN_CARD_CM, n)) * 10) / 10;
  };
  return { w: clamp(size?.w, fallback.w), h: clamp(size?.h, fallback.h) };
}
