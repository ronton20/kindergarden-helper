// The children's list, and the backup card that protects it.

import type { ChangeEvent } from 'react';
import type { AppApi } from '../../state';
import { COLOURS, SectionTitle, card } from '../../ui/controls';
import { downloadBlob } from '../../lib/desktop';
import { fromSaved } from '../../lib/storage';
import type { SavedState } from '../../lib/types';

interface BackupFile {
  kh: 'kindergarten-helper';
  v: 1;
  savedAt: string;
  data: SavedState;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function ChildrenTab({ api }: { api: AppApi }) {
  const { saved, transient, strings: s, patch, addChild, removeChild, editChild, replaceAll } = api;

  const exportBackup = () => {
    const payload: BackupFile = {
      kh: 'kindergarten-helper',
      v: 1,
      savedAt: new Date().toISOString(),
      data: saved
    };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const d = new Date();
    downloadBlob(blob, `kindergarten-helper ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`);
    // Stored as a key rather than text, so it stays correct if the language is
    // switched while it is still on screen.
    patch({ backupNote: 'backupDone', backupErr: false });
  };

  const importBackup = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';  // let the same file be picked twice in a row
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      let parsed: unknown = null;
      try { parsed = JSON.parse(String(reader.result)); } catch { /* handled below */ }

      // Accept our own wrapper, and also a bare kh_v1 payload, so a blob copied
      // straight out of localStorage still restores.
      const record = parsed as { data?: unknown; children?: unknown } | null;
      const body = record && (record.data ?? (Array.isArray(record.children) ? record : null));
      if (!body || !Array.isArray((body as { children?: unknown }).children)) {
        patch({ backupNote: 'backupBad', backupErr: true });
        return;
      }

      replaceAll(fromSaved(body, navigator.language).state);
      patch({ backupNote: 'backupRestored', backupErr: false });
    };
    reader.onerror = () => patch({ backupNote: 'backupBad', backupErr: true });
    reader.readAsText(file);
  };

  const noteText = transient.backupNote ? s[transient.backupNote] : '';

  const field = (
    value: string,
    id: number,
    key: 'first' | 'last' | 'tz',
    placeholder: string,
    flex: number,
    numeric = false
  ) => (
    <input
      value={value}
      placeholder={placeholder}
      inputMode={numeric ? 'numeric' : undefined}
      onChange={(e) => editChild(id, key, e.target.value)}
      style={{
        flex, minWidth: 0, height: 54, border: `2px solid ${COLOURS.line}`,
        borderRadius: 12, padding: '0 14px', font: '500 20px Rubik,sans-serif',
        background: COLOURS.white, color: COLOURS.ink
      }}
    />
  );

  return (
    <div>
      <SectionTitle title={s.childrenTitle} help={s.childrenHelp} />

      <div style={{ ...card, maxWidth: 720 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {saved.children.map((child, index) => (
            <div key={child.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{
                width: 34, height: 34, flex: 'none', borderRadius: 10, background: COLOURS.paper,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                font: '700 16px Rubik,sans-serif', color: COLOURS.muted
              }}>{index + 1}</div>
              {field(child.first, child.id, 'first', s.first, 1)}
              {field(child.last, child.id, 'last', s.last, 1)}
              {field(child.tz, child.id, 'tz', s.idCol, 0.75, true)}
              <button
                type="button"
                onClick={() => removeChild(child.id)}
                title={s.remove}
                style={{
                  flex: 'none', width: 54, height: 54, border: '2px solid #EED9D9',
                  background: COLOURS.white, color: '#B23A48', borderRadius: 12,
                  cursor: 'pointer', font: '700 24px Rubik,sans-serif'
                }}
              >×</button>
            </div>
          ))}
        </div>

        {saved.children.length === 0 && (
          <div style={{ padding: '18px 4px', color: COLOURS.muted, font: '500 19px Rubik,sans-serif' }}>
            {s.noChildren}
          </div>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap', marginTop: 18
        }}>
          <button
            type="button"
            onClick={addChild}
            style={{
              height: 56, padding: '0 24px', borderRadius: 14, border: 'none',
              background: COLOURS.accent, color: '#fff', font: '700 20px Rubik,sans-serif',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10
            }}
          >＋ {s.addChild}</button>
          <div style={{ font: '600 16px Rubik,sans-serif', color: COLOURS.green }}>
            ✓ {s.saved} · {saved.children.length}{saved.lang === 'he' ? ' ילדים' : ' children'}
          </div>
        </div>
      </div>

      {/* The list is the only irreplaceable thing here, and it lives in
          localStorage — which anything touching packaging or origins can in
          principle orphan. This is the way out and back in. */}
      <div style={{ ...card, maxWidth: 720, marginTop: 18 }}>
        <div style={{ font: '700 20px Rubik,sans-serif', marginBottom: 6 }}>{s.backupTitle}</div>
        <div style={{ font: '500 17px Rubik,sans-serif', color: COLOURS.muted, marginBottom: 16 }}>
          {s.backupHelp}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={exportBackup}
            style={{
              height: 56, padding: '0 22px', borderRadius: 14, border: `2px solid ${COLOURS.line}`,
              background: COLOURS.white, color: COLOURS.ink, font: '700 18px Rubik,sans-serif',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10
            }}
          >⤓ {s.backupSave}</button>
          <label style={{
            height: 56, padding: '0 22px', borderRadius: 14, border: `2px solid ${COLOURS.line}`,
            background: COLOURS.white, color: COLOURS.ink, font: '700 18px Rubik,sans-serif',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10
          }}>
            ⤒ {s.backupLoad}
            <input type="file" accept="application/json,.json" onChange={importBackup} style={{ display: 'none' }} />
          </label>
        </div>
        {noteText && (
          <div style={{
            font: '600 16px Rubik,sans-serif', marginTop: 14,
            color: transient.backupErr ? COLOURS.red : COLOURS.green
          }}>
            {noteText}
          </div>
        )}
      </div>
    </div>
  );
}
