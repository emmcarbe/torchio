#!/usr/bin/env node
/**
 * The sampling frame, built from the field's two catalogues.
 *
 * The two do not overlap and do not agree: Franzini's Catalogue of Digital
 * Editions records structured facets (is there a TEI transcription, is the
 * XML downloadable) in a CSV; Sahle's Catalog of Digital Scholarly Editions
 * is itself a TEI file, wider, with the year of first publication. An
 * edition present in one and not the other is a fact about the field's
 * bookkeeping, so both memberships travel with every row.
 *
 * Input (data-local/catalogues/, fetched separately, not redistributed):
 *   digEds_cat.csv          Franzini, CC BY-SA, github.com/gfranzini/digEds_cat
 *   sahle_catalog_TEI.xml   Sahle, CC BY 4.0, git.uni-wuppertal.de/dhsfu/sde-catalog
 * Output:
 *   corpus-frame.csv        one row per edition, both catalogues merged
 *
 *   node tools/catalogues.js
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseXML } from '../src/xml.js';

const ROOT = new URL('..', import.meta.url).pathname;
const CAT = join(ROOT, 'data-local', 'catalogues');

function parseCSV(text) {
  const rows = []; let cur = '', row = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift().map((h) => h.trim());
  return rows.filter((r) => r.some((c) => c.trim()))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}

/** Compare editions by their address, since titles differ between catalogues. */
function urlKey(u) {
  return String(u || '').toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '')
    .replace(/\/(index\.html?|home\.html?)?$/, '').replace(/\/+$/, '').trim();
}

// the raw parser speaks name/attrs; element/atts are the model's names
const textOf = (n) => {
  if (typeof n === 'string') return n;
  if (!n || !n.children) return '';
  return n.children.map(textOf).join('');
};
function* walk(n) {
  if (!n || typeof n === 'string') return;
  yield n;
  for (const c of n.children || []) yield* walk(c);
}
const kids = (n, name) => (n.children || []).filter((c) => c && c.name === name);

async function main() {
  // Franzini: the structured facets
  const fr = parseCSV(await readFile(join(CAT, 'digEds_cat.csv'), 'utf-8'));
  const byUrl = new Map();
  for (const r of fr) {
    const key = urlKey(r.URL);
    if (!key) continue;
    byUrl.set(key, {
      title: r['Edition name'] || '', url: r.URL || '', editors: '', year: '',
      in_franzini: 'yes', in_sahle: 'no', franzini_id: r.id || '',
      tei_declared: r['XML-TEI Transcription'] || '',
      xml_downloadable: r['XML(-TEI) available to download'] || '',
      available: r['Current availability'] || '',
      period: r['Historical Period'] || '', language: r.Language || '',
      variance: r['Account of textual variance'] || '',
      ride: r['RIDE review'] || '', sahle_flag: r['Sahle Catalog'] || '',
    });
  }

  // Sahle: the wider list, in TEI, with the year of first publication
  const root = parseXML(await readFile(join(CAT, 'sahle_catalog_TEI.xml'), 'utf-8'));
  let added = 0, matched = 0;
  for (const n of walk(root)) {
    if (n.name !== 'bibl') continue;
    const title = kids(n, 'title').map(textOf).join(' ').replace(/\s+/g, ' ').trim();
    const url = kids(n, 'ref').map(textOf).join(' ').trim().split(/\s+/)[0] || '';
    const editors = kids(n, 'edition').map(textOf).join(' ').replace(/\s+/g, ' ').trim();
    const date = kids(n, 'date').find((d) => d.attrs && d.attrs.when);
    const year = date ? String(date.attrs.when).slice(0, 4) : '';
    const key = urlKey(url);
    if (!key) continue;
    const hit = byUrl.get(key);
    if (hit) {
      hit.in_sahle = 'yes'; matched++;
      if (!hit.editors) hit.editors = editors;
      if (!hit.year) hit.year = year;
    } else {
      byUrl.set(key, {
        title, url, editors, year, in_franzini: 'no', in_sahle: 'yes', franzini_id: '',
        tei_declared: '', xml_downloadable: '', available: '', period: '', language: '',
        variance: '', ride: '', sahle_flag: '',
      });
      added++;
    }
  }

  const rows = [...byUrl.values()].sort((a, b) => a.title.localeCompare(b.title));
  rows.forEach((r, i) => { r.id = String(i + 1).padStart(4, '0'); });

  const cols = ['id', 'title', 'url', 'editors', 'year', 'in_franzini', 'in_sahle',
    'franzini_id', 'tei_declared', 'xml_downloadable', 'available', 'period',
    'language', 'variance', 'ride'];
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
  await writeFile(join(ROOT, 'corpus-frame.csv'), csv);

  const both = rows.filter((r) => r.in_franzini === 'yes' && r.in_sahle === 'yes').length;
  const onlyF = rows.filter((r) => r.in_franzini === 'yes' && r.in_sahle === 'no').length;
  const onlyS = rows.filter((r) => r.in_sahle === 'yes' && r.in_franzini === 'no').length;
  const tei = rows.filter((r) => /^(yes|partly)/i.test(r.tei_declared)).length;
  const dl = rows.filter((r) => /^(yes|partly)/i.test(r.xml_downloadable)).length;
  console.error(`corpus-frame.csv: ${rows.length} editions`);
  console.error(`  in both catalogues: ${both} · only Franzini: ${onlyF} · only Sahle: ${onlyS}`);
  console.error(`  (Franzini facets) TEI declared: ${tei} · XML downloadable: ${dl}`);
  console.error(`  with a year: ${rows.filter((r) => r.year).length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
