/**
 * A spreadsheet the editor can actually open. An .xlsx file is a zip of XML
 * parts, and this project has both: no dependency is needed to write one.
 *
 * It exists because a review file is read and corrected by an editor, not by
 * a program: CSV opens badly, turns words into dates and hides the columns.
 * The engine keeps working on JSON; the editor never sees it.
 */

import { buildZip } from './zip.js';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const colName = (i) => {
  let n = i + 1, s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
};

/**
 * @param {string[]} header  the first row, frozen
 * @param {Array<Array<string|number>>} rows
 * @param {{sheet?: string, widths?: number[]}} opts
 * @returns {Uint8Array} the .xlsx file
 */
export function buildXLSX(header, rows, { sheet = 'Review', widths = [], choices = null, choices2 = null, howto = null } = {}) {
  const all = [header, ...rows];
  const body = all.map((row, r) => {
    const cells = row.map((v, c) => {
      const ref = `${colName(c)}${r + 1}`;
      // everything is text: an editor's word must never become a date or a formula
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    }).join('');
    return `<row r="${r + 1}">${cells}</row>`;
  }).join('');

  const cols = widths.length
    ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';

  const files = {
    '[Content_Types].xml':
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
      + `<Default Extension="xml" ContentType="application/xml"/>`
      + `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
      + `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      + (howto ? `<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` : '')
      + `</Types>`,
    '_rels/.rels':
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>`
      + `</Relationships>`,
    'xl/workbook.xml':
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"`
      + ` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
      + `<sheets>`
      + (howto ? `<sheet name="READ ME FIRST" sheetId="1" r:id="rId2"/>` : '')
      + `<sheet name="${esc(sheet)}" sheetId="${howto ? 2 : 1}" r:id="rId1"/>`
      + `</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>`
      + (howto ? `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>` : '')
      + `</Relationships>`,
    'xl/worksheets/sheet1.xml':
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
      + `<sheetViews><sheetView workbookViewId="0"${howto ? '' : ' tabSelected="1"'}>`
      + `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>`
      + `</sheetView></sheetViews>`
      + cols
      + `<sheetData>${body}</sheetData>`
      + (choices ? (() => {
          const dv = (c) => {
            const col = colName(c.col);
            const list = c.options.map((o) => o.replace(/"/g, '')).join(',');
            return `<dataValidation type="list" allowBlank="1" showInputMessage="1"`
              + ` showErrorMessage="1" sqref="${col}2:${col}${all.length}">`
              + `<formula1>&quot;${esc(list)}&quot;</formula1></dataValidation>`;
          };
          const parts = [dv(choices)];
          if (choices2) parts.push(dv(choices2));
          return `<dataValidations count="${parts.length}">${parts.join('')}</dataValidations>`;
        })() : '')
      + `</worksheet>`,
  };
  if (howto) {
    // the instructions live inside the file the editor opens: one line each,
    // in a sheet of their own, so the data sheet stays clean
    const hrows = howto.map((line, r) =>
      `<row r="${r + 1}"><c r="A${r + 1}" t="inlineStr"><is><t xml:space="preserve">${esc(line)}</t></is></c></row>`).join('');
    files['xl/worksheets/sheet2.xml'] =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
      + `<sheetViews><sheetView workbookViewId="0" tabSelected="1"/></sheetViews>`
      + `<cols><col min="1" max="1" width="110" customWidth="1"/></cols>`
      + `<sheetData>${hrows}</sheetData></worksheet>`;
  }
  return buildZip(files);
}

/* ------------------------------------------------------------------ */
/* Reading back what the editor saved. Excel rewrites the file in its  */
/* own dialect: numbers as <v>, strings via sharedStrings. A reader    */
/* that only knew our inlineStr came back empty from a resaved file.   */

const unesc = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

const colIndex = (ref) => {
  let n = 0;
  for (const ch of ref) {
    if (ch >= 'A' && ch <= 'Z') n = n * 26 + (ch.charCodeAt(0) - 64);
    else break;
  }
  return n - 1;
};

/** All the <t> runs of one shared-string item, joined (rich text splits them). */
function sharedStrings(parts) {
  const xml = parts.get('xl/sharedStrings.xml');
  if (!xml) return [];
  const out = [];
  for (const si of xml.match(/<si>[\s\S]*?<\/si>/g) || []) {
    out.push((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [])
      .map((t) => unesc(t.replace(/^<t[^>]*>/, '').replace(/<\/t>$/, ''))).join(''));
  }
  return out;
}

/** One worksheet part -> rows as arrays, columns in their true positions. */
export function sheetRows(parts, path) {
  const xml = parts.get(path);
  if (!xml) return [];
  const shared = sharedStrings(parts);
  const rows = [];
  for (const rowXml of xml.match(/<row[\s\S]*?<\/row>/g) || []) {
    const row = [];
    for (const cell of rowXml.match(/<c [^>]*(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
      const ref = (cell.match(/r="([A-Z]+)\d+"/) || [])[1];
      if (!ref) continue;
      const type = (cell.match(/t="(\w+)"/) || [])[1] || '';
      let value = '';
      if (type === 'inlineStr') {
        value = (cell.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [])
          .map((t) => unesc(t.replace(/^<t[^>]*>/, '').replace(/<\/t>$/, ''))).join('');
      } else {
        const v = (cell.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        if (v === undefined) value = '';
        else if (type === 's') value = shared[Number(v)] ?? '';
        else value = unesc(v);
      }
      row[colIndex(ref)] = value;
    }
    // normalize sparse rows: holes become empty strings
    for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = '';
    rows.push(row);
  }
  return rows;
}

/** Find the data sheet by its header, wherever the spreadsheet put it. */
export function reviewRows(parts, headerHints) {
  for (const path of [...parts.keys()].filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/.test(p)).sort()) {
    const rows = sheetRows(parts, path);
    if (!rows.length) continue;
    const head = (rows[0] || []).map((c) => String(c).trim().toLowerCase());
    if (headerHints.some((h) => head.includes(h))) return rows;
  }
  return [];
}
