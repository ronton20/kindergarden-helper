// Export names, and the characters Windows will not accept in one.

import { describe, it, expect } from 'vitest';
import { safeFilename, exportName } from '../../src/renderer/lib/filename';
import { he } from '../../src/renderer/i18n/he';
import { en } from '../../src/renderer/i18n/en';

const AT_2026 = new Date(2026, 5, 1);

describe('exportName', () => {
  it('names each file after its tab, in Hebrew', () => {
    expect(exportName(he.tabLarge, 'pdf', AT_2026)).toBe('שמות למגירות 2026.pdf');
    expect(exportName(he.tabSmall, 'pdf', AT_2026)).toBe('שמות לסלסלאות 2026.pdf');
    expect(exportName(he.tabAtt, 'xlsx', AT_2026)).toBe('טבלת נוכחות 2026.xlsx');
    expect(exportName(he.tabGrad, 'png', AT_2026)).toBe('תמונת סיום 2026.png');
  });

  it('names each file after its tab, in English', () => {
    expect(exportName(en.tabLarge, 'pdf', AT_2026)).toBe('Drawer names 2026.pdf');
    expect(exportName(en.tabSmall, 'pdf', AT_2026)).toBe('Basket names 2026.pdf');
    expect(exportName(en.tabAtt, 'xlsx', AT_2026)).toBe('Attendance 2026.xlsx');
    expect(exportName(en.tabGrad, 'png', AT_2026)).toBe('Graduation photo 2026.png');
  });

  it('uses the calendar year, so next year is a different file', () => {
    expect(exportName('Attendance', 'xlsx', new Date(2027, 0, 1))).toBe('Attendance 2027.xlsx');
  });
});

describe('safeFilename', () => {
  it('leaves Hebrew alone', () => {
    expect(safeFilename('טבלת נוכחות 2026')).toBe('טבלת נוכחות 2026');
  });

  it('replaces every character Windows forbids', () => {
    expect(safeFilename('a:b*c?d"e<f>g|h')).toBe('a b c d e f g h');
  });

  it('replaces path separators rather than keeping a path', () => {
    expect(safeFilename('a/b\\c')).toBe('a b c');
  });

  it('never returns something that starts or ends with a dot', () => {
    expect(safeFilename('...hidden')).toBe('hidden');
    expect(safeFilename('trailing...')).toBe('trailing');
  });

  it('falls back rather than returning nothing', () => {
    expect(safeFilename('')).toBe('Kindergarten Helper');
    expect(safeFilename('   ')).toBe('Kindergarten Helper');
    expect(safeFilename('...')).toBe('Kindergarten Helper');
    expect(safeFilename(null as unknown as string)).toBe('Kindergarten Helper');
  });

  it('collapses runs of whitespace, including what it just replaced', () => {
    expect(safeFilename('a   b')).toBe('a b');
    expect(safeFilename('a///b')).toBe('a b');
  });

  it('caps the length so no filesystem rejects it', () => {
    expect(safeFilename('x'.repeat(400))).toHaveLength(150);
  });

  it('strips control characters instead of writing them into a name', () => {
    expect(safeFilename('a\u0000b\u001Fc\u007F')).toBe('abc');
  });
});
