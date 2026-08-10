// One studio — drawer names or basket names. The two differ only in their
// settings and their physical size, so they share this component entirely.

import { useState } from 'react';
import type { AppApi } from '../../state';
import { renderCards, CARD_SIZE_CM } from '../../lib/cards';
import { exportName } from '../../lib/filename';
import { printCards } from '../../lib/print';
import { isDesktop, bridge } from '../../lib/desktop';
import type { BorderStyle, ColorTarget, StudioName } from '../../lib/types';
import {
  COLOURS, FONT_CHOICES, PALETTE, Row, SavedNote, SectionTitle,
  Segmented, Slider, Swatches, card, primaryButton
} from '../../ui/controls';

export function CardStudio({ api, studio }: { api: AppApi; studio: StudioName }) {
  const { saved, transient, strings: s, patch, updateStudio, setStudioColor, toggleUniform, selectCard } = api;
  const settings = saved[studio];
  const cards = renderCards(studio, settings, saved.children);
  const size = CARD_SIZE_CM[studio];

  // Which of the three colour slots the palette is currently pointing at.
  const [target, setTarget] = useState<ColorTarget>('bg');

  const active = (() => {
    if (settings.uniform || !settings.selectedId) return settings;
    const o = settings.overrides[settings.selectedId] || {};
    return { bg: o.bg || settings.bg, text: o.text || settings.text, border: o.border || settings.border };
  })();

  const editingLabel = settings.uniform || !settings.selectedId
    ? s.editingAll
    : s.editingOne + (saved.children.find((c) => c.id === settings.selectedId)?.first || '—');

  const borderOptions: ReadonlyArray<{ value: BorderStyle; label: string }> = [
    { value: 'solid', label: s.bSolid },
    { value: 'dashed', label: s.bDashed },
    { value: 'dotted', label: s.bDotted },
    { value: 'double', label: s.bDouble },
    { value: 'none', label: s.bNone }
  ];

  const doExport = async () => {
    if (!saved.children.length) return;
    patch({ savedFile: null, saveError: false });
    const label = studio === 'large' ? s.tabLarge : s.tabSmall;
    const outcome = await printCards(studio, exportName(label, 'pdf'));
    if (outcome === 'failed') patch({ saveError: true });
  };

  const savedMessage = transient.saveError ? s.saveFailed : (transient.savedFile ? s.savedToDocuments : '');

  return (
    <div>
      <SectionTitle
        title={studio === 'large' ? s.largeTitle : s.smallTitle}
        help={studio === 'large' ? s.largeHelp : s.smallHelp}
      />

      {/* Controls above, cards below — the same shape as before the refactor.
          The controls need the full width for a row of twelve swatches to sit
          on one line. */}
      <div>
        <div style={card}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, font: '700 18px Rubik,sans-serif', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.uniform}
              onChange={() => toggleUniform(studio)}
              style={{ width: 22, height: 22, accentColor: COLOURS.accent }}
            />
            {s.colorAll}
          </label>
          <div style={{
            marginTop: 10, display: 'inline-block', padding: '6px 12px', borderRadius: 999,
            background: COLOURS.accentSoft, color: COLOURS.accent, font: '600 15px Rubik,sans-serif'
          }}>{editingLabel}</div>

          {(['bg', 'text', 'border'] as ColorTarget[]).map((slot) => (
            <Row
              key={slot}
              label={slot === 'bg' ? s.bgLabel : slot === 'text' ? s.textLabel : s.borderLabel}
            >
              <input
                type="color"
                value={active[slot]}
                onFocus={() => setTarget(slot)}
                onChange={(e) => setStudioColor(studio, slot, e.target.value)}
                title={s.moreColours}
                style={{ width: 40, height: 40 }}
              />
              <Swatches
                colours={PALETTE}
                current={active[slot]}
                onPick={(colour) => { setTarget(slot); setStudioColor(studio, slot, colour); }}
              />
            </Row>
          ))}

          <Row label={s.font}>
            <Segmented
              options={FONT_CHOICES.map((f) => ({ value: f.family, label: s[f.labelKey] }))}
              current={settings.font}
              onPick={(font) => updateStudio(studio, { font })}
              fontFamily={(family) => family}
            />
          </Row>

          <Row label={s.borderStyle}>
            <Segmented
              options={borderOptions}
              current={settings.borderStyle}
              onPick={(borderStyle) => updateStudio(studio, { borderStyle })}
            />
          </Row>

          <Row label={s.borderWidth}>
            <Slider value={settings.borderWidth} min={0} max={12}
              onChange={(borderWidth) => updateStudio(studio, { borderWidth })} />
          </Row>
          <Row label={s.cornerRadius}>
            <Slider value={settings.cornerRadius} min={0} max={25}
              onChange={(cornerRadius) => updateStudio(studio, { cornerRadius })} />
          </Row>
          <Row label={s.size}>
            <Slider value={settings.size} min={50} max={160}
              onChange={(value) => updateStudio(studio, { size: value })} />
          </Row>

          <Row label={s.recentColors}>
            <Swatches
              colours={saved.history}
              onPick={(colour) => setStudioColor(studio, target, colour)}
              size={34}
            />
          </Row>
          <div style={{ font: '500 14px Rubik,sans-serif', color: COLOURS.muted }}>{s.recentHint}</div>
        </div>

        <div style={{ marginTop: 22 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, flexWrap: 'wrap', marginBottom: 14
          }}>
            <div style={{ font: '600 16px Rubik,sans-serif', color: COLOURS.muted }}>
              {s.actualSize}: {size.width} × {size.height} cm · {s.clickToColor}
            </div>
            <button type="button" onClick={doExport} style={primaryButton}>
              ⤓ {isDesktop() ? s.downloadPdf : s.exportPdf}
            </button>
          </div>

          <SavedNote
            message={savedMessage}
            isError={transient.saveError}
            canReveal={!!transient.savedFile && !transient.saveError}
            revealLabel={s.showFile}
            onReveal={() => transient.savedFile && bridge()?.reveal(transient.savedFile.id)}
          />

          {saved.children.length === 0 ? (
            <div style={{ color: COLOURS.muted, font: '500 19px Rubik,sans-serif' }}>{s.addFirst}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 16 }}>
              {cards.map((c) => (
                <div
                  key={c.id}
                  data-studio={studio}
                  data-id={c.id}
                  onClick={() => selectCard(studio, c.id)}
                  style={{
                    cursor: 'pointer',
                    aspectRatio: `${size.width}/${size.height}`,
                    containerType: 'size',
                    borderRadius: c.borderRadius,
                    boxShadow: c.selected ? `0 0 0 4px ${COLOURS.accent}` : 'none'
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
          )}
        </div>
      </div>
    </div>
  );
}
