// The graduation photo: a picture, a title, a subtitle, dragged into place.
//
// The preview and the export have to agree exactly, so both size their text
// from the same number — `grad.size`, calibrated against a 600px-wide preview.
// See lib/graduation.ts for the arithmetic that keeps them in step.

import { useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { AppApi } from '../../state';
import { readPhoto } from '../../lib/photo';
import { canvasToPngBlob, renderGraduationCanvas, PREVIEW_WIDTH, SUBTITLE_RATIO } from '../../lib/graduation';
import { exportName } from '../../lib/filename';
import { downloadBlob, bridge } from '../../lib/desktop';
import {
  COLOURS, FONT_CHOICES, Row, SavedNote, SectionTitle, Segmented, Slider, Swatches, card, primaryButton
} from '../../ui/controls';

const TEXT_COLOURS = ['#FFFFFF', '#2B2723', '#F2C14E', '#E07A4B'];

export function GraduationTab({ api }: { api: AppApi }) {
  const { saved, transient, strings: s, patch, updateGrad } = api;
  const g = saved.grad;
  const boxRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';                       // let the same file be picked again
    if (!file) return;
    try {
      const dataUrl = await readPhoto(file, (stage) =>
        patch({ gradBusy: stage === 'heic' ? s.photoHeic : s.photoWorking, gradErr: '' }));
      updateGrad({ img: dataUrl });
      patch({ gradBusy: '' });
    } catch {
      patch({ gradBusy: '', gradErr: s.photoError });
    }
  };

  // Dragging the text moves it in percentages of the picture, so the position
  // means the same thing at any rendered size.
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!g.img) return;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || !boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
    updateGrad({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    setDragging(false);
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* already gone */ }
  };

  const savePicture = async () => {
    if (!g.img) return;
    patch({ savedFile: null, saveError: false });
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('bad image'));
        image.src = g.img as string;
      });
      const canvas = await renderGraduationCanvas(g, image);
      const blob = await canvasToPngBlob(canvas);
      downloadBlob(blob, exportName(s.tabGrad, 'png'));
    } catch {
      patch({ saveError: true });
    }
  };

  const note = transient.gradErr || transient.gradBusy || '';
  const savedMessage = transient.saveError ? s.saveFailed : (transient.savedFile ? s.savedToDocuments : '');

  // The preview is `PREVIEW_WIDTH` wide by definition; cqw keeps the text the
  // same share of the picture however the box is actually laid out.
  const titleSize = `${(g.size / (PREVIEW_WIDTH / 100)).toFixed(3)}cqw`;
  const subSize = `${(g.size * SUBTITLE_RATIO / (PREVIEW_WIDTH / 100)).toFixed(3)}cqw`;

  return (
    <div>
      <SectionTitle title={s.gradTitle} help={s.gradHelp} />

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 26, alignItems: 'start' }}>
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{
            height: 56, borderRadius: 14, background: COLOURS.accent, color: '#fff',
            font: '700 19px Rubik,sans-serif', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: 10
          }}>
            📷 {g.img ? s.changePhoto : s.uploadPhoto}
            <input
              type="file"
              accept="image/*,.heic,.heif,.hif,.HEIC,.HEIF,.HIF"
              onChange={upload}
              style={{ display: 'none' }}
            />
          </label>

          {note && (
            <div style={{
              font: '600 15px Rubik,sans-serif', lineHeight: 1.35,
              color: transient.gradErr ? COLOURS.red : COLOURS.muted
            }}>{note}</div>
          )}

          <div>
            <div style={{ font: '700 16px Rubik,sans-serif', marginBottom: 6 }}>{s.gTitle}</div>
            <input
              value={g.title}
              onChange={(e) => updateGrad({ title: e.target.value })}
              style={{
                height: 52, border: `2px solid ${COLOURS.line}`, borderRadius: 12, padding: '0 14px',
                font: '500 19px Rubik,sans-serif', width: '100%', background: COLOURS.white, color: COLOURS.ink
              }}
            />
          </div>
          <div>
            <div style={{ font: '700 16px Rubik,sans-serif', marginBottom: 6 }}>{s.gSubtitle}</div>
            <input
              value={g.subtitle}
              onChange={(e) => updateGrad({ subtitle: e.target.value })}
              style={{
                height: 52, border: `2px solid ${COLOURS.line}`, borderRadius: 12, padding: '0 14px',
                font: '500 19px Rubik,sans-serif', width: '100%', background: COLOURS.white, color: COLOURS.ink
              }}
            />
          </div>

          <Row label={s.font}>
            <Segmented
              options={FONT_CHOICES.map((f) => ({ value: f.family, label: s[f.labelKey] }))}
              current={g.font}
              onPick={(font) => updateGrad({ font })}
              fontFamily={(family) => family}
            />
          </Row>

          <Row label={s.textColor}>
            <input
              type="color"
              value={g.color}
              onChange={(e) => updateGrad({ color: e.target.value })}
              style={{ width: 40, height: 40 }}
            />
            <Swatches colours={TEXT_COLOURS} current={g.color} onPick={(color) => updateGrad({ color })} size={34} />
          </Row>

          <Row label={s.size}>
            <Slider value={g.size} min={16} max={90} onChange={(size) => updateGrad({ size })} />
          </Row>
        </div>

        <div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, flexWrap: 'wrap', marginBottom: 14
          }}>
            <div style={{ font: '600 16px Rubik,sans-serif', color: COLOURS.muted }}>
              {s.dragHint} · 18 × 13 cm
            </div>
            <button type="button" onClick={savePicture} style={primaryButton}>⤓ {s.savePng}</button>
          </div>

          <SavedNote
            message={savedMessage}
            isError={transient.saveError}
            canReveal={!!transient.savedFile && !transient.saveError}
            revealLabel={s.showFile}
            onReveal={() => transient.savedFile && bridge()?.reveal(transient.savedFile.id)}
          />

          <div
            ref={boxRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{
              position: 'relative', width: '100%', maxWidth: PREVIEW_WIDTH,
              aspectRatio: '18/13', containerType: 'inline-size', borderRadius: 14,
              overflow: 'hidden', background: g.img ? '#000' : '#F4EFE7',
              border: `2px solid ${COLOURS.line}`, cursor: g.img ? 'move' : 'default',
              touchAction: 'none'
            }}
          >
            {g.img ? (
              <img
                src={g.img}
                alt=""
                draggable={false}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: COLOURS.muted, font: '600 18px Rubik,sans-serif'
              }}>{s.noPhoto}</div>
            )}
            <div style={{
              position: 'absolute', left: `${g.x}%`, top: `${g.y}%`,
              transform: 'translate(-50%,-50%)', textAlign: 'center', color: g.color,
              fontFamily: `${g.font},serif`, whiteSpace: 'nowrap', pointerEvents: 'none',
              textShadow: '0 0.333cqw 1.333cqw rgba(0,0,0,0.35)',
              display: (g.title || g.subtitle) ? 'block' : 'none'
            }}>
              <div style={{ fontSize: titleSize, fontWeight: 700, lineHeight: 1.15 }}>{g.title}</div>
              <div style={{ fontSize: subSize, fontWeight: 700, lineHeight: 1.15 }}>{g.subtitle}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
