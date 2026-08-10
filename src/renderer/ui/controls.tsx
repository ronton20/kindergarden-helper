// The small shared pieces every studio uses.
//
// Styling is inline, as it was before the refactor. This app is one screen of
// controls with no reuse pressure worth a styling system, and inline styles
// keep each control's appearance next to its behaviour — which matters more
// here than avoiding repetition.

import type { CSSProperties, ReactNode } from 'react';

export const COLOURS = {
  ink: '#2B2723',
  muted: '#7A736B',
  line: '#E7E0D6',
  paper: '#FAF7F2',
  white: '#fff',
  accent: '#E07A4B',
  accentSoft: '#FDEEE6',
  teal: '#2FA39B',
  green: '#6A994E',
  red: '#C0392B'
} as const;

export const PALETTE = [
  '#2B2723', '#FFFFFF', '#E4572E', '#F4A259', '#F2C14E', '#6A994E',
  '#2FA39B', '#4C7FB8', '#7B6CB0', '#D65A8E', '#FDECEC', '#E3F0FB'
];

export const FONT_CHOICES = [
  { family: 'Rubik', labelKey: 'fontRounded' },
  { family: 'Suez One', labelKey: 'fontBold' },
  { family: 'Frank Ruhl Libre', labelKey: 'fontSerif' },
  { family: 'Heebo', labelKey: 'fontClean' }
] as const;

export const card: CSSProperties = {
  background: COLOURS.white,
  border: `2px solid ${COLOURS.line}`,
  borderRadius: 20,
  padding: 20
};

export const primaryButton: CSSProperties = {
  height: 60, padding: '0 28px', borderRadius: 16, border: 'none',
  background: COLOURS.teal, color: '#fff', font: '700 21px Rubik,sans-serif',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10
};

export const quietButton: CSSProperties = {
  height: 56, padding: '0 22px', borderRadius: 14,
  border: `2px solid ${COLOURS.line}`, background: COLOURS.white, color: COLOURS.ink,
  font: '700 18px Rubik,sans-serif', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 10
};

export function SectionTitle({ title, help }: { title: string; help?: string }) {
  return (
    <>
      <div style={{ font: '900 26px Rubik,sans-serif', marginBottom: 6 }}>{title}</div>
      {help && (
        <div style={{ font: '500 19px Rubik,sans-serif', color: COLOURS.muted, marginBottom: 22, maxWidth: 660 }}>
          {help}
        </div>
      )}
    </>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      padding: '12px 0', borderTop: `1px solid ${COLOURS.line}`
    }}>
      <div style={{ font: '700 17px Rubik,sans-serif', minWidth: 130 }}>{label}</div>
      {children}
    </div>
  );
}

export function Swatches({
  colours, current, onPick, size = 38, title
}: {
  colours: readonly string[];
  current?: string;
  onPick: (colour: string) => void;
  size?: number;
  title?: (colour: string) => string;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {colours.map((colour) => (
        <button
          key={colour}
          type="button"
          onClick={() => onPick(colour)}
          title={title ? title(colour) : colour}
          aria-label={colour}
          style={{
            width: size, height: size, borderRadius: Math.round(size / 3.6),
            border: `2px solid ${current && current.toLowerCase() === colour.toLowerCase() ? COLOURS.ink : COLOURS.line}`,
            cursor: 'pointer', background: colour
          }}
        />
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  options, current, onPick, fontFamily
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  current: T;
  onPick: (value: T) => void;
  /** Used by the font picker, so each choice is shown in its own typeface. */
  fontFamily?: (value: T) => string;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(({ value, label }) => {
        const on = value === current;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onPick(value)}
            style={{
              cursor: 'pointer', height: 48, padding: '0 18px', borderRadius: 12,
              border: `2px solid ${on ? COLOURS.accent : COLOURS.line}`,
              background: on ? COLOURS.accentSoft : COLOURS.white,
              color: COLOURS.ink,
              fontSize: 19, fontWeight: 700,
              fontFamily: fontFamily ? `${fontFamily(value)},sans-serif` : 'Rubik,sans-serif'
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function Slider({
  value, min, max, step = 1, onChange
}: {
  value: number; min: number; max: number; step?: number; onChange: (value: number) => void;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ flex: 1, minWidth: 180, accentColor: COLOURS.accent }}
    />
  );
}

/** The quiet "saved to Documents" line under an export button. */
export function SavedNote({
  message, isError, canReveal, revealLabel, onReveal
}: {
  message: string;
  isError: boolean;
  canReveal: boolean;
  revealLabel: string;
  onReveal: () => void;
}) {
  if (!message) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      margin: '-6px 0 14px',
      font: '600 16px Rubik,sans-serif',
      color: isError ? COLOURS.red : COLOURS.green
    }}>
      <span>{isError ? '' : '✓ '}{message}</span>
      {canReveal && (
        <button
          type="button"
          onClick={onReveal}
          style={{
            height: 36, padding: '0 14px', borderRadius: 10,
            border: `2px solid ${COLOURS.line}`, background: COLOURS.white,
            color: COLOURS.ink, font: '700 15px Rubik,sans-serif', cursor: 'pointer'
          }}
        >
          {revealLabel}
        </button>
      )}
    </div>
  );
}
