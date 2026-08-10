// The blank monthly attendance sheet.
//
// What is on screen is a preview of what the spreadsheet will contain; the
// spreadsheet itself is built by lib/xlsx.ts, whose bytes are pinned by tests.

import type { AppApi } from '../../state';
import { buildAttendanceXlsx, XLSX_MIME } from '../../lib/xlsx';
import { exportName } from '../../lib/filename';
import { downloadBlob, bridge } from '../../lib/desktop';
import { COLOURS, SavedNote, SectionTitle, primaryButton } from '../../ui/controls';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export function AttendanceTab({ api }: { api: AppApi }) {
  const { saved, transient, strings: s, patch, updateAtt } = api;

  const extra = Math.max(0, parseInt(String(saved.att.emptyRows), 10) || 0);
  const rows = [
    ...saved.children.map((c, i) => ({ num: i + 1, first: c.first, last: c.last, tz: c.tz })),
    ...Array.from({ length: extra }, (_, i) => ({
      num: saved.children.length + i + 1, first: '', last: '', tz: ''
    }))
  ];

  const download = () => {
    patch({ savedFile: null, saveError: false });
    const bytes = buildAttendanceXlsx({
      children: saved.children,
      emptyRows: saved.att.emptyRows,
      rtl: saved.lang === 'he',
      strings: s
    });
    // A fresh ArrayBuffer, because Blob will not take a view over a larger one.
    downloadBlob(new Blob([bytes], { type: XLSX_MIME }), exportName(s.tabAtt, 'xlsx'));
  };

  const savedMessage = transient.saveError ? s.saveFailed : (transient.savedFile ? s.savedToDocuments : '');
  const stickyStart = saved.lang === 'he' ? 'right' : 'left';

  const cell = (extraStyle: React.CSSProperties = {}): React.CSSProperties => ({
    border: `1px solid ${COLOURS.line}`,
    padding: '6px 8px',
    font: '500 15px Rubik,sans-serif',
    whiteSpace: 'nowrap',
    ...extraStyle
  });

  return (
    <div>
      <SectionTitle title={s.attTitle} help={s.attHelp} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, font: '600 18px Rubik,sans-serif', color: '#4A443E' }}>
          {s.emptyRowsLabel}
          <input
            type="number"
            min={0}
            max={100}
            value={String(saved.att.emptyRows)}
            onChange={(e) => updateAtt({ emptyRows: e.target.value })}
            style={{
              width: 88, height: 48, border: `2px solid ${COLOURS.line}`, borderRadius: 12,
              padding: '0 12px', font: '500 18px Rubik,sans-serif', background: COLOURS.white, color: COLOURS.ink
            }}
          />
        </label>
        <button type="button" onClick={download} style={{ ...primaryButton, marginInlineStart: 'auto' }}>
          ⤓ {s.downloadXlsx}
        </button>
      </div>

      <SavedNote
        message={savedMessage}
        isError={transient.saveError}
        canReveal={!!transient.savedFile && !transient.saveError}
        revealLabel={s.showFile}
        onReveal={() => transient.savedFile && bridge()?.reveal(transient.savedFile.id)}
      />

      <div style={{
        background: COLOURS.white, border: `2px solid ${COLOURS.line}`, borderRadius: 16,
        padding: 16, overflowX: 'auto', overflowY: 'hidden', maxWidth: '100%'
      }}>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={cell({ background: '#F2E7D5', position: 'sticky', [stickyStart]: 0 } as React.CSSProperties)}>#</th>
              <th style={cell({ background: '#F2E7D5' })}>{s.first}</th>
              <th style={cell({ background: '#F2E7D5' })}>{s.last}</th>
              <th style={cell({ background: '#F2E7D5' })}>{s.idCol}</th>
              {DAYS.map((d) => (
                <th key={d} style={cell({ background: '#F2E7D5', width: 26, textAlign: 'center' })}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.num}>
                <td style={cell({ textAlign: 'center', position: 'sticky', [stickyStart]: 0, background: COLOURS.white } as React.CSSProperties)}>{row.num}</td>
                <td style={cell({ minWidth: 110 })}>{row.first}</td>
                <td style={cell({ minWidth: 110 })}>{row.last}</td>
                <td style={cell({ minWidth: 90, textAlign: 'center' })}>{row.tz}</td>
                {DAYS.map((d) => <td key={d} style={cell({ width: 26 })} />)}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div style={{ padding: 12, color: COLOURS.muted, font: '500 18px Rubik,sans-serif' }}>{s.addFirst}</div>
        )}
      </div>
    </div>
  );
}
