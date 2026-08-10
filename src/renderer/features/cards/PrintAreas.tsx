// The sheets that actually get printed.
//
// These are a separate DOM from the previews, hidden on screen and revealed
// only by the print stylesheet. They exist because the preview is laid out to
// fit the window, while these are laid out in centimetres — the physical size
// the cards are cut to, which is the app's whole promise.

import { renderCards, CARD_SIZE_CM } from '../../lib/cards';
import { coverRect } from '../../lib/graduation';
import type { SavedState, StudioName } from '../../lib/types';

const hidden = { display: 'none' } as const;

function CardSheet({ studio, saved }: { studio: StudioName; saved: SavedState }) {
  const cards = renderCards(studio, saved[studio], saved.children);
  const size = CARD_SIZE_CM[studio];
  return (
    <div
      className="kh-print"
      data-print-area={studio}
      style={{
        ...hidden,
        flexWrap: 'wrap',
        gap: '0.5cm',
        alignContent: 'flex-start',
        padding: 0
      }}
    >
      {cards.map((c) => (
        <div
          key={c.id}
          style={{
            width: `${size.width}cm`,
            height: `${size.height}cm`,
            containerType: 'size',
            breakInside: 'avoid',
            pageBreakInside: 'avoid'
          }}
        >
          <div style={{
            width: '100%', height: '100%', boxSizing: 'border-box',
            borderRadius: c.borderRadius, display: 'flex', alignItems: 'center',
            justifyContent: 'center', textAlign: 'center', padding: '6cqw',
            overflow: 'hidden', fontWeight: 900, fontFamily: `${c.font},sans-serif`,
            background: c.bg, color: c.text, border: c.borderCss
          }}>
            <span style={{ fontSize: c.fontSize, lineHeight: 1.05, whiteSpace: 'normal' }}>
              {c.name}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function GraduationSheet({ saved }: { saved: SavedState }) {
  const g = saved.grad;
  return (
    <div
      className="kh-print"
      data-print-area="grad"
      style={{ ...hidden, alignItems: 'flex-start', justifyContent: 'flex-start' }}
    >
      <div style={{
        position: 'relative', width: '18cm', height: '13cm',
        containerType: 'inline-size', overflow: 'hidden',
        background: g.img ? '#000' : '#F4EFE7'
      }}>
        {g.img && (
          <img
            src={g.img}
            alt=""
            style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <div style={{
          position: 'absolute', left: `${g.x}%`, top: `${g.y}%`,
          transform: 'translate(-50%,-50%)', textAlign: 'center', color: g.color,
          fontFamily: `${g.font},serif`, whiteSpace: 'nowrap',
          textShadow: '0 0.333cqw 1.333cqw rgba(0,0,0,0.35)'
        }}>
          <div style={{ fontSize: `${(g.size / 6).toFixed(3)}cqw`, fontWeight: 700, lineHeight: 1.15 }}>
            {g.title}
          </div>
          <div style={{ fontSize: `${(g.size * 0.52 / 6).toFixed(3)}cqw`, fontWeight: 700, lineHeight: 1.15 }}>
            {g.subtitle}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PrintAreas({ saved }: { saved: SavedState }) {
  return (
    <>
      <CardSheet studio="large" saved={saved} />
      <CardSheet studio="small" saved={saved} />
      <GraduationSheet saved={saved} />
    </>
  );
}

// Re-exported so the cover-crop maths has one home, shared by the preview and
// the export rather than written twice.
export { coverRect };
