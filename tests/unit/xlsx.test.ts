// The spreadsheet writer, checked against the bytes the *shipped* app produces.
//
// tests/characterization/golden.json records the sha256 of an .xlsx exported
// from the pre-refactor bundle, for a known children list. This rebuilds the
// same spreadsheet through the extracted TypeScript and asserts the hash
// matches. If it does, the port is not merely similar — it is the same file.
//
// That makes this the one test that proves the extraction was faithful, so if
// it ever fails, the answer is to fix the code rather than the expectation.

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildAttendanceXlsx, columnName } from '../../src/renderer/lib/xlsx';
import { he } from '../../src/renderer/i18n/he';
import type { Child } from '../../src/renderer/lib/types';

const golden = JSON.parse(
  readFileSync(join(__dirname, '..', 'characterization', 'golden.json'), 'utf8')
);

// Exactly the fixture the characterization suite exports with.
const CHILDREN: Child[] = [
  { id: 1, first: 'Noa', last: 'Levi', tz: '111' },
  { id: 2, first: 'Noa', last: 'Cohen', tz: '222' },
  { id: 3, first: '', last: 'Mizrahi', tz: '333' },
  { id: 4, first: 'איתי', last: 'בר', tz: '444' }
];

const sha256 = (buf: Uint8Array) =>
  createHash('sha256').update(buf).digest('hex').slice(0, 32);

const buildFixture = () => buildAttendanceXlsx({
  children: CHILDREN,
  emptyRows: 2,
  rtl: true,
  strings: he
});

describe('buildAttendanceXlsx', () => {
  it('produces byte-for-byte the file the shipped app produces', () => {
    const bytes = buildFixture();
    expect(sha256(bytes)).toBe(golden.attendanceXlsx.sha256);
    expect(bytes.length).toBe(golden.attendanceXlsx.bytes);
  });

  it('packages the parts Excel expects, in order', () => {
    const bytes = buildFixture();
    const text = Buffer.from(bytes).toString('latin1');
    const names: string[] = [];
    const re = /PK\x03\x04[\s\S]{22}/g;
    let m: RegExpExecArray | null;
    const buf = Buffer.from(bytes);
    while ((m = re.exec(text))) {
      const nameLen = buf.readUInt16LE(m.index + 26);
      names.push(buf.slice(m.index + 30, m.index + 30 + nameLen).toString('utf8'));
    }
    expect(names).toEqual(golden.attendanceXlsx.entries);
  });

  it('is a zip: local headers, a central directory and an end record', () => {
    const buf = Buffer.from(buildFixture());
    expect(buf.readUInt32LE(0)).toBe(0x04034b50);
    expect(buf.toString('latin1')).toContain('PK\x01\x02');
    expect(buf.readUInt32LE(buf.length - 22)).toBe(0x06054b50);
  });

  it('adds the requested blank rows after the named children', () => {
    const withBlanks = buildAttendanceXlsx({
      children: CHILDREN, emptyRows: 5, rtl: true, strings: he
    });
    const text = Buffer.from(withBlanks).toString('utf8');
    // Two header rows plus four children plus five blanks.
    expect(text).toContain('<dimension ref="A1:AI11"/>');
    expect(text).toContain('<row r="11"');
    expect(text).not.toContain('<row r="12"');
  });

  it('tolerates emptyRows arriving as a string from the number input', () => {
    const asText = buildAttendanceXlsx({
      children: CHILDREN, emptyRows: '3' as unknown as number, rtl: true, strings: he
    });
    const asNumber = buildAttendanceXlsx({
      children: CHILDREN, emptyRows: 3, rtl: true, strings: he
    });
    expect(sha256(asText)).toBe(sha256(asNumber));
  });

  it('treats a blank or nonsense row count as none', () => {
    const none = buildAttendanceXlsx({
      children: CHILDREN, emptyRows: 0, rtl: true, strings: he
    });
    for (const bad of ['', 'abc', -4, NaN]) {
      const built = buildAttendanceXlsx({
        children: CHILDREN, emptyRows: bad as number, rtl: true, strings: he
      });
      expect(sha256(built)).toBe(sha256(none));
    }
  });

  it('lays the sheet out right to left only for Hebrew', () => {
    const hebrew = Buffer.from(buildFixture()).toString('utf8');
    expect(hebrew).toContain('rightToLeft="1"');

    const english = Buffer.from(buildAttendanceXlsx({
      children: CHILDREN, emptyRows: 2, rtl: false, strings: he
    })).toString('utf8');
    expect(english).not.toContain('rightToLeft="1"');
  });

  it('escapes names that would otherwise break the XML', () => {
    const built = buildAttendanceXlsx({
      children: [{ id: 1, first: 'A & B', last: '<script>', tz: '1' }],
      emptyRows: 0, rtl: false, strings: he
    });
    const text = Buffer.from(built).toString('utf8');
    expect(text).toContain('A &amp; B');
    expect(text).toContain('&lt;script&gt;');
    expect(text).not.toContain('<script>');
  });

  it('prints as one landscape page wide', () => {
    const text = Buffer.from(buildFixture()).toString('utf8');
    expect(text).toContain('orientation="landscape"');
    expect(text).toContain('fitToWidth="1"');
    expect(text).toContain('fitToHeight="0"');
    expect(text).toContain('<pageSetUpPr fitToPage="1"/>');
  });

  it('keeps the sheet name within what Excel accepts', () => {
    const built = buildAttendanceXlsx({
      children: CHILDREN, emptyRows: 0, rtl: false,
      strings: { ...he, attTitle: 'a/b\\c?d*e[f]g:h ' + 'x'.repeat(60) }
    });
    const text = Buffer.from(built).toString('utf8');
    const name = /<sheet name="([^"]*)"/.exec(text)?.[1] ?? '';
    expect(name.length).toBeLessThanOrEqual(31);
    expect(name).not.toMatch(/[\\/?*\[\]:]/);
  });
});

describe('columnName', () => {
  it('counts like a spreadsheet', () => {
    expect(columnName(1)).toBe('A');
    expect(columnName(26)).toBe('Z');
    expect(columnName(27)).toBe('AA');
    // The sheet is 35 columns wide: 4 plus 31 days.
    expect(columnName(35)).toBe('AI');
  });
});
