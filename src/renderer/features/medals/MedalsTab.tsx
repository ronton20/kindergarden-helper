// The medals studio. Built on the same pattern as the card studios — uniform
// or per-child colours, the same three colour slots, the same shared swatches
// and recent-colour history — so it feels like the tabs beside it rather than
// a separate app.

import { useState } from 'react';
import type { AppApi } from '../../state';
import { renderMedals, clampDiameter, MIN_MEDAL_CM, MAX_MEDAL_CM } from '../../lib/medals';
import { exportName } from '../../lib/filename';
import { printCards } from '../../lib/print';
import { isDesktop, bridge } from '../../lib/desktop';
import type { ColorTarget, Ornament } from '../../lib/types';
import {
  COLOURS, FONT_CHOICES, PALETTE, Row, SavedNote, SectionTitle,
  Segmented, Slider, Swatches, card, primaryButton
} from '../../ui/controls';
import { Medal } from './Medal';

/** A4 less its 1 cm margins, and the gap the sheet lays out with. */
const PRINTABLE_CM = { w: 19, h: 27.7 };
const GAP_CM = 0.5;

export function medalsPerPage(diameter: number): number {
  const across = Math.max(0, Math.floor((PRINTABLE_CM.w + GAP_CM) / (diameter + GAP_CM)));
  const down = Math.max(0, Math.floor((PRINTABLE_CM.h + GAP_CM) / (diameter + GAP_CM)));
  return across * down;
}

export function MedalsTab({ api }: { api: AppApi }) {
  const { saved, transient, strings: s, patch, updateMedals, setMedalColor, selectMedal } = api;
  const settings = saved.medals;
  const medals = renderMedals(settings, saved.children);
  const [target, setTarget] = useState<ColorTarget>('bg');

  const active = (() => {
    if (settings.uniform || !settings.selectedId) return settings;
    const o = settings.overrides[settings.selectedId] || {};
    return { bg: o.bg || settings.bg, text: o.text || settings.text, border: o.border || settings.border };
  })();

  const editingLabel = settings.uniform || !settings.selectedId
    ? s.editingAll
    : s.editingOne + (saved.children.find((c) => c.id === settings.selectedId)?.first || '—');

  const ornaments: ReadonlyArray<{ value: Ornament; label: string }> = [
    { value: 'clear', label: s.ornClear },
    { value: 'border', label: s.ornBorder },
    { value: 'ribbon', label: s.ornRibbon },
    { value: 'frills', label: s.ornFrills }
  ];

  const doExport = async () => {
    if (!saved.children.length) return;
    patch({ savedFile: null, saveError: false });
    const outcome = await printCards('medals', exportName(s.tabMedals, 'pdf'));
    if (outcome === 'failed') patch({ saveError: true });
  };

  const savedMessage = transient.saveError ? s.saveFailed : (transient.savedFile ? s.savedToDocuments : '');

  return (
    <div>
      <SectionTitle title={s.medalsTitle} help={s.medalsHelp} />

      <div>
        <div style={card}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, font: '700 18px Rubik,sans-serif', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.uniform}
              onChange={() => updateMedals({ uniform: !settings.uniform, selectedId: null })}
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
              // The ornament reuses the border slot, so it is named for what it
              // colours here rather than for the slot it happens to use.
              label={slot === 'bg' ? s.bgLabel : slot === 'text' ? s.textLabel : s.ornamentColour}
            >
              <input
                type="color"
                value={active[slot]}
                onFocus={() => setTarget(slot)}
                onChange={(e) => setMedalColor(slot, e.target.value)}
                title={s.moreColours}
                style={{ width: 40, height: 40 }}
              />
              <Swatches
                colours={PALETTE}
                current={active[slot]}
                onPick={(colour) => { setTarget(slot); setMedalColor(slot, colour); }}
              />
            </Row>
          ))}

          <Row label={s.ornamentLabel}>
            <Segmented
              options={ornaments}
              current={settings.ornament}
              onPick={(ornament) => updateMedals({ ornament })}
            />
          </Row>

          <Row label={s.medalPhrase}>
            <input
              value={settings.phrase}
              onChange={(e) => updateMedals({ phrase: e.target.value })}
              style={{
                height: 48, border: `2px solid ${COLOURS.line}`, borderRadius: 12, padding: '0 14px',
                font: '500 18px Rubik,sans-serif', minWidth: 240, flex: 1,
                background: COLOURS.white, color: COLOURS.ink
              }}
            />
          </Row>

          <Row label={s.font}>
            <Segmented
              options={FONT_CHOICES.map((f) => ({ value: f.family, label: s[f.labelKey] }))}
              current={settings.font}
              onPick={(font) => updateMedals({ font })}
              fontFamily={(family) => family}
            />
          </Row>

          <Row label={s.borderWidth}>
            <Slider value={settings.borderWidth} min={0} max={20}
              onChange={(borderWidth) => updateMedals({ borderWidth })} />
          </Row>
          <Row label={s.size}>
            <Slider value={settings.size} min={50} max={160}
              onChange={(size) => updateMedals({ size })} />
          </Row>

          <Row label={s.medalDiameter}>
            <DiameterInput
              label={s.diameterCm}
              value={settings.diameter}
              onCommit={(diameter) => updateMedals({ diameter: clampDiameter(diameter, settings.diameter) })}
            />
            <span style={{ font: '500 15px Rubik,sans-serif', color: COLOURS.muted }}>
              {s.perPage}: {medalsPerPage(settings.diameter)}
            </span>
          </Row>

          <Row label={s.recentColors}>
            <Swatches colours={saved.history} onPick={(colour) => setMedalColor(target, colour)} size={34} />
          </Row>
        </div>

        <div style={{ marginTop: 22 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, flexWrap: 'wrap', marginBottom: 14
          }}>
            <div style={{ font: '600 16px Rubik,sans-serif', color: COLOURS.muted }}>
              {s.actualSize}: {settings.diameter} cm · {s.clickToColor}
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5cm', alignContent: 'flex-start' }}>
              {medals.map((medal) => (
                <div
                  key={medal.id}
                  data-medal-id={medal.id}
                  onClick={() => selectMedal(medal.id)}
                  style={{
                    cursor: 'pointer', borderRadius: '50%',
                    boxShadow: medal.selected ? `0 0 0 4px ${COLOURS.accent}` : 'none'
                  }}
                >
                  <Medal
                    medal={medal}
                    ornament={settings.ornament}
                    borderWidth={settings.borderWidth}
                    diameterCm={settings.diameter}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Same commit-on-blur behaviour as the card studios' size fields. */
function DiameterInput({
  label, value, onCommit
}: { label: string; value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, font: '600 15px Rubik,sans-serif' }}>
      {label}
      <input
        type="number"
        min={MIN_MEDAL_CM}
        max={MAX_MEDAL_CM}
        step={0.5}
        value={editing ? draft : String(value)}
        onFocus={() => { setDraft(String(value)); setEditing(true); }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); onCommit(parseFloat(draft)); }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        style={{
          width: 80, height: 44, border: `2px solid ${COLOURS.line}`, borderRadius: 10,
          padding: '0 10px', font: '500 17px Rubik,sans-serif',
          background: COLOURS.white, color: COLOURS.ink
        }}
      />
    </label>
  );
}
