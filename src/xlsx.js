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
export function buildXLSX(header, rows, { sheet = 'Review', widths = [], choices = null, choices2 = null } = {}) {
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
      + `<sheets><sheet name="${esc(sheet)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>`
      + `</Relationships>`,
    'xl/worksheets/sheet1.xml':
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
      + `<sheetViews><sheetView workbookViewId="0" tabSelected="1">`
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
  return buildZip(files);
}
