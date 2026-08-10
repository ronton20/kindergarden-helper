// One medal. Shared by the preview and the print sheet, so the two cannot
// drift apart — the preview is the print sheet at a different size.

import { frillsPath, ribbonPath } from '../../lib/medals';
import type { Ornament, RenderedMedal } from '../../lib/types';

export function Medal({
  medal, ornament, borderWidth, diameterCm, showCutGuide = false
}: {
  medal: RenderedMedal;
  ornament: Ornament;
  borderWidth: number;
  diameterCm: number;
  /** The print sheet draws a line to cut along; the preview does not. */
  showCutGuide?: boolean;
}) {
  const svgOrnament = ornament === 'ribbon' || ornament === 'frills';

  return (
    <div
      style={{
        position: 'relative',
        width: `${diameterCm}cm`,
        height: `${diameterCm}cm`,
        containerType: 'size',
        breakInside: 'avoid',
        pageBreakInside: 'avoid'
      }}
    >
      {/* The medal itself: a filled circle, with the plain ring drawn as a
          border because that is exactly what a border is. */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: medal.bg,
        border: ornament === 'border' ? `${borderWidth}px solid ${medal.ornamentColour}` : 'none',
        boxSizing: 'border-box'
      }} />

      {/* Frills sit behind everything, bulging past the circle's edge; the
          ribbon sits above the fill but behind the phrase. Both are drawn in a
          0–100 viewBox so they scale with the medal rather than being re-tuned
          for each diameter. */}
      {svgOrnament && (
        <svg
          viewBox="0 0 100 100"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
          aria-hidden="true"
        >
          {ornament === 'frills' && (
            <path d={frillsPath()} fill={medal.ornamentColour} />
          )}
          {ornament === 'frills' && (
            // The fill again on top of the scallops, so they read as a rim
            // around the medal rather than a blob behind it.
            <circle cx="50" cy="50" r="44" fill={medal.bg} />
          )}
          {ornament === 'ribbon' && (
            <path d={ribbonPath()} fill={medal.ornamentColour} />
          )}
        </svg>
      )}

      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '2cqmin',
        textAlign: 'center', padding: '14cqmin', overflow: 'hidden',
        fontFamily: `${medal.font},sans-serif`, color: medal.text
      }}>
        <div style={{ fontSize: medal.nameSize, fontWeight: 900, lineHeight: 1.05 }}>
          {medal.name}
        </div>
        <div style={{
          fontSize: medal.phraseSize, fontWeight: 700, lineHeight: 1.1,
          // On the ribbon, the phrase has to read against the ribbon's colour.
          marginTop: ornament === 'ribbon' ? '6cqmin' : 0
        }}>
          {medal.phrase}
        </div>
      </div>

      {showCutGuide && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '1px dashed #9A9A9A', boxSizing: 'border-box', pointerEvents: 'none'
        }} />
      )}
    </div>
  );
}
