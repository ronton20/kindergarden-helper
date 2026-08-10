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

/** Physical size of a printed card, in centimetres. */
export interface CardSize {
  w: number;
  h: number;
}

export interface StudioSettings {
  /** What the printed card measures. Saved per design. */
  cardSize: CardSize;
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

/**
 * Four, and no more. The point of a medal is a child's name on a circle; the
 * decoration is there to make it feel like an award, not to be a design tool.
 */
export type Ornament = 'clear' | 'border' | 'ribbon' | 'frills';

export interface MedalSettings {
  /** Across, in centimetres. A circle needs one number, not two. */
  diameter: number;
  ornament: Ornament;
  /** The send-off, editable so it can change year to year. */
  phrase: string;
  uniform: boolean;
  bg: string;
  text: string;
  /**
   * The ornament's colour. It reuses the "border" name the other studios use
   * so the three colour slots — background, text, border — stay the same
   * everywhere, and the shared swatches and history work unchanged.
   */
  border: string;
  font: string;
  size: number;
  borderWidth: number;
  overrides: Record<number, Partial<Record<ColorTarget, string>>>;
  selectedId: number | null;
}

export interface RenderedMedal {
  id: number;
  name: string;
  phrase: string;
  bg: string;
  text: string;
  ornamentColour: string;
  font: string;
  nameSize: string;
  phraseSize: string;
  selected: boolean;
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
  medals: MedalSettings;
  att: AttSettings;
}
