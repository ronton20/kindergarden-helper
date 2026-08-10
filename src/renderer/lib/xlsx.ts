// Builds a genuine .xlsx (OOXML) file — no "file format may not be supported"
// warning, real fonts, and a landscape-A4 fit-to-width print setup. The whole
// 35-column table is scaled to one landscape page wide via fitToWidth.
//
// Ported from the pre-refactor bundle with the output held byte-for-byte
// identical; `tests/unit/xlsx.test.ts` checks it against the hash the
// characterization suite recorded from the shipped app. Every string below,
// including the order of attributes, is part of that contract.

import { zipStore, type ZipEntry } from './zip';
import type { Child } from './types';

/** The base point size the sheet is laid out around. */
const FONT_PT = 11;
/** #, first, last, ID, then a column per day of the month. */
const NCOLS = 4 + 31;

export interface AttendanceStrings {
  className: string;
  month: string;
  year: string;
  first: string;
  last: string;
  idCol: string;
  attTitle: string;
}

export interface AttendanceInput {
  children: Child[];
  /** Blank rows to add under the named children, for latecomers. */
  emptyRows: number | string;
  /** Hebrew lays the sheet out right to left and aligns names to the right. */
  rtl: boolean;
  strings: AttendanceStrings;
}

const escapeXml = (v: unknown): string =>
  String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 1 -> A, 26 -> Z, 27 -> AA. */
export function columnName(n: number): string {
  let out = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    out = String.fromCharCode(65 + m) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

// `s` is an index into cellXfs below.
const cellNum = (ref: string, style: number, v: number | string) =>
  `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
const cellStr = (ref: string, style: number, v: string) =>
  `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`;
const cellEmpty = (ref: string, style: number) => `<c r="${ref}" s="${style}"/>`;

export function buildAttendanceXlsx(input: AttendanceInput): Uint8Array {
  const { children, rtl, strings: s } = input;
  const lastCol = columnName(NCOLS);

  const extra = Math.max(0, parseInt(String(input.emptyRows), 10) || 0);
  const rowCount = children.length + extra;

  let rowsXml = '';

  // Row 1: class / month / year, blank so they can be filled in by hand,
  // merged across the full width.
  rowsXml += `<row r="1" ht="24" customHeight="1">` +
    cellStr('A1', 4, `${s.className}: __________     ${s.month}: __________     ${s.year}: __________`) +
    `</row>`;

  // Row 2: header.
  let header = `<row r="2" ht="22" customHeight="1">`;
  header += cellStr('A2', 1, '#') + cellStr('B2', 1, s.first) +
    cellStr('C2', 1, s.last) + cellStr('D2', 1, s.idCol);
  for (let d = 1; d <= 31; d++) header += cellNum(columnName(4 + d) + '2', 1, d);
  rowsXml += header + `</row>`;

  // Data rows, then any blank ones.
  for (let i = 0; i < rowCount; i++) {
    const c = children[i] || ({} as Partial<Child>);
    const r = i + 3;
    let row = `<row r="${r}" ht="26" customHeight="1">`;
    row += cellNum('A' + r, 3, i + 1) + cellStr('B' + r, 2, c.first || '') +
      cellStr('C' + r, 2, c.last || '') + cellStr('D' + r, 3, c.tz || '');
    for (let d = 1; d <= 31; d++) row += cellEmpty(columnName(4 + d) + r, 3);
    rowsXml += row + `</row>`;
  }

  // Excel forbids these in a sheet name, and caps it at 31 characters.
  const sheetName = String(s.attTitle || 'Sheet1').replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31) || 'Sheet1';

  const styles =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="2">` +
      `<font><sz val="${FONT_PT}"/><name val="Arial"/></font>` +
      `<font><b/><sz val="${FONT_PT}"/><name val="Arial"/></font>` +
    `</fonts>` +
    `<fills count="3">` +
      `<fill><patternFill patternType="none"/></fill>` +
      `<fill><patternFill patternType="gray125"/></fill>` +
      `<fill><patternFill patternType="solid"><fgColor rgb="FFF2E7D5"/><bgColor indexed="64"/></patternFill></fill>` +
    `</fills>` +
    `<borders count="2">` +
      `<border><left/><right/><top/><bottom/><diagonal/></border>` +
      `<border><left style="thin"><color rgb="FF333333"/></left><right style="thin"><color rgb="FF333333"/></right><top style="thin"><color rgb="FF333333"/></top><bottom style="thin"><color rgb="FF333333"/></bottom><diagonal/></border>` +
    `</borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="5">` +
      `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
      `<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>` +
      `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="${rtl ? 'right' : 'left'}" vertical="center"/></xf>` +
      `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +
      `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="${rtl ? 'right' : 'left'}" vertical="center"/></xf>` +
    `</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`;

  const sheet =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>` +
    `<dimension ref="A1:${lastCol}${rowCount + 2}"/>` +
    `<sheetViews><sheetView ${rtl ? 'rightToLeft="1" ' : ''}workbookViewId="0"/></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>` +
      `<col min="1" max="1" width="4" customWidth="1"/>` +
      `<col min="2" max="2" width="14" customWidth="1"/>` +
      `<col min="3" max="3" width="14" customWidth="1"/>` +
      `<col min="4" max="4" width="12" customWidth="1"/>` +
      `<col min="5" max="${NCOLS}" width="3" customWidth="1"/>` +
    `</cols>` +
    `<sheetData>${rowsXml}</sheetData>` +
    `<mergeCells count="1"><mergeCell ref="A1:${lastCol}1"/></mergeCells>` +
    `<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>` +
    `<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0" horizontalDpi="300" verticalDpi="300"/>` +
    `</worksheet>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>`;

  const wbRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  const enc = new TextEncoder();
  const files: ZipEntry[] = [
    ['[Content_Types].xml', enc.encode(contentTypes)],
    ['_rels/.rels', enc.encode(rootRels)],
    ['xl/workbook.xml', enc.encode(workbook)],
    ['xl/_rels/workbook.xml.rels', enc.encode(wbRels)],
    ['xl/styles.xml', enc.encode(styles)],
    ['xl/worksheets/sheet1.xml', enc.encode(sheet)]
  ];

  return zipStore(files);
}

export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
