// One medal. Shared by the preview and the print sheet, so the two cannot
// drift apart — the preview is the print sheet at a different size.

import { FRILLS, ribbonShape, darken, readableOn } from '../../lib/medals';
import type { Ornament, RenderedMedal } from '../../lib/types';

const RIBBON = ribbonShape();

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
  const shaded = darken(medal.ornamentColour);

  // Frills draw their own face, at the radius the petals leave room for.
  const faceIsDrawn = ornament === 'frills';
  const hasSvg = ornament === 'frills' || ornament === 'ribbon';

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
      {!faceIsDrawn && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: medal.bg,
          border: ornament === 'border' ? `${borderWidth}px solid ${medal.ornamentColour}` : 'none',
          boxSizing: 'border-box'
        }} />
      )}

      {/* Drawn in a 0–100 viewBox, so both ornaments scale with the medal
          rather than being re-tuned for every diameter. overflow is visible
          because the ribbon's folded ends sit just outside the rim. */}
      {hasSvg && (
        <svg
          viewBox="0 0 100 100"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
          aria-hidden="true"
        >
          {ornament === 'frills' && (
            <>
              {/* Two rings, the back one larger, darker and half a step round,
                  so the petals overlap instead of reading as a flat edge. */}
              {FRILLS.back.map((p, i) => (
                <ellipse
                  key={'b' + i}
                  cx={50} cy={p.cy} rx={p.rx} ry={p.ry}
                  fill={shaded}
                  transform={`rotate(${p.angle} 50 50)`}
                />
              ))}
              {FRILLS.front.map((p, i) => (
                <ellipse
                  key={'f' + i}
                  cx={50} cy={p.cy} rx={p.rx} ry={p.ry}
                  fill={medal.ornamentColour}
                  transform={`rotate(${p.angle} 50 50)`}
                />
              ))}
              <circle cx={50} cy={50} r={FRILLS.discRadius} fill={medal.bg} />
              {/* A hairline of the ornament colour, so the face reads as
                  sitting on the flower rather than punched out of it. */}
              <circle
                cx={50} cy={50} r={FRILLS.discRadius}
                fill="none" stroke={shaded} strokeWidth={0.8} opacity={0.5}
              />
            </>
          )}

          {ornament === 'ribbon' && (
            <>
              {RIBBON.folds.map((d, i) => <path key={i} d={d} fill={shaded} />)}
              <path d={RIBBON.band} fill={medal.ornamentColour} />
            </>
          )}
        </svg>
      )}

      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '2cqmin',
        textAlign: 'center', padding: '16cqmin', overflow: 'hidden',
        fontFamily: `${medal.font},sans-serif`, color: medal.text,
        // The ribbon takes the lower third, so the name sits above it.
        paddingBottom: ornament === 'ribbon' ? '40cqmin' : '16cqmin'
      }}>
        <div style={{ fontSize: medal.nameSize, fontWeight: 900, lineHeight: 1.05 }}>
          {medal.name}
        </div>
        {ornament !== 'ribbon' && (
          <div style={{ fontSize: medal.phraseSize, fontWeight: 700, lineHeight: 1.1 }}>
            {medal.phrase}
          </div>
        )}
      </div>

      {/* On the ribbon the phrase belongs on the banner, which is lower than
          the flow above would put it. */}
      {ornament === 'ribbon' && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: `${RIBBON.centreY}%`,
          transform: 'translateY(-50%)', textAlign: 'center',
          fontFamily: `${medal.font},sans-serif`, color: readableOn(medal.ornamentColour),
          fontSize: medal.phraseSize, fontWeight: 800, lineHeight: 1.1,
          padding: '0 6cqmin', pointerEvents: 'none', whiteSpace: 'nowrap'
        }}>
          {medal.phrase}
        </div>
      )}

      {showCutGuide && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '1px dashed #9A9A9A', boxSizing: 'border-box', pointerEvents: 'none'
        }} />
      )}
    </div>
  );
}
