// The saved state, typed.
//
// This shape is the only irreplaceable thing in the app: it is what lives in
// localStorage under `kh_v1`, and it has to survive every version. Changing a
// field here changes what a teacher's saved list means, so additions should be
// optional and reads should tolerate anything missing.

export type Lang = 'en' | 'he';
export type StudioName = 'large' | 'small';
export type ColorTarget = 'bg' | 'text' | 'border';
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'double' | 'none';

export interface Child {
  id: number;
  first: string;
  last: string;
  /** Israeli ID number. Free text: it may be blank, and it is never validated. */
  tz: string;
}

export interface StudioSettings {
  /** One colour scheme for every card, rather than per child. */
  uniform: boolean;
  bg: string;
  text: string;
  border: string;
  font: string;
  /** Percentage of the studio's base text size, not a point size. */
  size: number;
  borderStyle: BorderStyle;
  borderWidth: number;
  cornerRadius: number;
  /** Per-child colour overrides, used only when `uniform` is false. */
  overrides: Record<number, Partial<Record<ColorTarget, string>>>;
  selectedId: number | null;
}

export interface GradSettings {
  /** A data URL. Big enough to blow the localStorage quota on its own. */
  img: string | null;
  title: string;
  subtitle: string;
  color: string;
  font: string;
  /** Calibrated against a 600px-wide preview; see lib/graduation.ts. */
  size: number;
  /** Percentages of the picture, so the preview and the export agree. */
  x: number;
  y: number;
}

export interface AttSettings {
  cls: string;
  /** Comes from a number input, so it can arrive as a string. */
  emptyRows: number | string;
}

export interface SavedState {
  lang: Lang;
  children: Child[];
  large: StudioSettings;
  small: StudioSettings;
  history: string[];
  grad: GradSettings;
  att: AttSettings;
}
