// Loading and saving the one thing in this app that cannot be recreated.
//
// The children's list lives in localStorage under `kh_v1`, keyed by the page's
// origin. That origin must stay `file://` — moving the renderer to a custom
// protocol would silently orphan every saved list — and the key must stay
// `kh_v1`, because a teacher's existing data is already under it.
//
// Reads are deliberately forgiving: anything missing falls back to a default,
// anything unrecognised is ignored. A saved file from an older version must
// still open.

import type { AttSettings, Child, GradSettings, Lang, SavedState, StudioSettings } from './types';
import { detectLang } from '../i18n';
import { DEFAULT_CARD_SIZE, clampCardSize } from './cards';

export const STORAGE_KEY = 'kh_v1';

export const DEFAULT_LARGE: StudioSettings = {
  cardSize: { ...DEFAULT_CARD_SIZE.large },
  uniform: true, bg: '#FEF3D8', text: '#2B2723', border: '#E07A4B',
  font: 'Rubik', size: 100, borderStyle: 'solid', borderWidth: 4, cornerRadius: 6,
  overrides: {}, selectedId: null
};

export const DEFAULT_SMALL: StudioSettings = {
  cardSize: { ...DEFAULT_CARD_SIZE.small },
  uniform: true, bg: '#E3F0FB', text: '#2B2723', border: '#2FA39B',
  font: 'Rubik', size: 100, borderStyle: 'solid', borderWidth: 3, cornerRadius: 6,
  overrides: {}, selectedId: null
};

export const DEFAULT_GRAD: GradSettings = {
  img: null, title: '', subtitle: '', color: '#FFFFFF',
  font: 'Suez One', size: 44, x: 50, y: 78
};

export const DEFAULT_ATT: AttSettings = { cls: '', emptyRows: 0 };

export const DEFAULT_HISTORY = ['#E07A4B', '#2FA39B', '#F2C14E', '#6A994E'];

/** The nursery's name, as a starting point rather than a rule. */
export const DEFAULT_TITLE = 'פעוטון תמר';

/**
 * "2025–2026", with the Hebrew year in front where the calendar is available.
 * The school year turns over in August, so anything from August counts as the
 * start of the new one.
 */
export function defaultSubtitle(now: Date = new Date()): string {
  const year = now.getFullYear();
  const start = now.getMonth() >= 7 ? year : year - 1;
  const gregorian = start + '–' + (start + 1);
  let hebrew = '';
  try {
    hebrew = new Intl.DateTimeFormat('he-u-ca-hebrew-nu-hebr', { year: 'numeric' })
      .format(new Date(start, 9, 1));
  } catch {
    // A runtime without the Hebrew calendar still gets the Gregorian years.
  }
  return (hebrew ? hebrew + ' ' : '') + gregorian;
}

export function defaultState(navigatorLanguage?: string): SavedState {
  return {
    lang: detectLang(navigatorLanguage),
    children: [],
    large: { ...DEFAULT_LARGE },
    small: { ...DEFAULT_SMALL },
    history: [...DEFAULT_HISTORY],
    grad: { ...DEFAULT_GRAD, title: DEFAULT_TITLE, subtitle: defaultSubtitle() },
    att: { ...DEFAULT_ATT }
  };
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** Merge a saved studio over the defaults, keeping anything unrecognised out. */
function mergeStudio(base: StudioSettings, saved: unknown): StudioSettings {
  if (!isObject(saved)) return base;
  const merged = { ...base, ...(saved as Partial<StudioSettings>) };
  // Settings saved before the size was configurable have no cardSize, and get
  // the new default rather than being pinned to the old hardcoded value — that
  // value was never a deliberate choice. A saved size is clamped, so a hand-
  // edited or corrupt backup cannot produce a card that will not print.
  merged.cardSize = clampCardSize(merged.cardSize ?? {}, base.cardSize);
  return merged;
}

export interface LoadResult {
  state: SavedState;
  /** Highest id seen, so new children never collide with existing ones. */
  nextId: number;
  /** False when there was nothing saved — a first run. */
  hadSaved: boolean;
}

export function fromSaved(raw: unknown, navigatorLanguage?: string): LoadResult {
  const base = defaultState(navigatorLanguage);
  if (!isObject(raw)) return { state: base, nextId: 1, hadSaved: false };

  const state: SavedState = { ...base };

  if (raw.lang === 'he' || raw.lang === 'en') state.lang = raw.lang as Lang;
  if (Array.isArray(raw.children)) state.children = raw.children as Child[];
  state.large = mergeStudio(base.large, raw.large);
  state.small = mergeStudio(base.small, raw.small);
  if (Array.isArray(raw.history)) state.history = raw.history as string[];
  if (isObject(raw.grad)) state.grad = { ...base.grad, ...(raw.grad as Partial<GradSettings>) };
  if (isObject(raw.att)) state.att = { ...base.att, ...(raw.att as Partial<AttSettings>) };

  // A saved state from before these had defaults still gets them.
  if (!state.grad.title) state.grad.title = DEFAULT_TITLE;
  if (!state.grad.subtitle) state.grad.subtitle = defaultSubtitle();

  const nextId = state.children.reduce((max, c) => Math.max(max, c.id || 0), 0) + 1;
  return { state, nextId, hadSaved: true };
}

export function load(navigatorLanguage?: string): LoadResult {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    // Corrupt storage is not a reason to refuse to start.
  }
  return fromSaved(parsed, navigatorLanguage);
}

export type SaveOutcome = 'saved' | 'saved-without-photo' | 'failed';

/**
 * A photo can be several megabytes, which blows the ~5 MB localStorage quota
 * on its own. Losing the names because of a picture would be absurd, so on a
 * quota failure the photo is dropped and everything else is kept.
 */
export function save(state: SavedState): SaveOutcome {
  const write = (grad: GradSettings) => {
    const { lang, children, large, small, history, att } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lang, children, large, small, history, grad, att }));
  };

  try {
    write(state.grad);
    return 'saved';
  } catch {
    try {
      write({ ...state.grad, img: null });
      return 'saved-without-photo';
    } catch {
      return 'failed';
    }
  }
}
