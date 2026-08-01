#!/usr/bin/env node
/**
 * Build a Pleiades gazetteer for the ancient world, in the same shape as the
 * GeoNames one, so georeference() can query it: a place name (normalized) maps
 * to its coordinates. Pleiades is the reference for classical geography, where
 * GeoNames is thin (Troia, Ithaca, the toponyms of ancient texts).
 *
 * Input:  data-local/pleiades-places.csv  (official dump, CC-BY)
 * Output: data-local/pleiades-gazetteer.json  { key: [[title, lat, lon, '', 0, 'pleiades:ID'] ] }
 *
 *   node tools/build-pleiades.js
 */
import { readFile, writeFile } from 'node:fs/promises';
import { normalizePlace } from '../src/georef.js';

/** A minimal CSV row reader: handles quoted fields with commas and doubled
 *  quotes. The Pleiades dump is well-formed CSV. */
function parseRow(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

async function main() {
  const path = new URL('../data-local/pleiades-places.csv', import.meta.url);
  const text = await readFile(path, 'utf-8');
  // rows can carry embedded newlines inside quotes; split on real record
  // boundaries by tracking quote parity
  const rows = [];
  let rec = ''; let q = false;
  for (const line of text.split('\n')) {
    rec += (rec ? '\n' : '') + line;
    for (const ch of line) if (ch === '"') q = !q;
    if (!q) { rows.push(rec); rec = ''; }
  }
  const header = parseRow(rows[0]);
  const iTitle = header.indexOf('title');
  const iLat = header.indexOf('reprLat');
  const iLon = header.indexOf('reprLong');
  const iId = header.indexOf('id') >= 0 ? header.indexOf('id') : header.indexOf('path');
  if (iTitle < 0 || iLat < 0 || iLon < 0) {
    console.error('Pleiades columns not found (title/reprLat/reprLong):', header.slice(0, 30));
    process.exit(1);
  }
  const gaz = {};
  let n = 0;
  for (let r = 1; r < rows.length; r++) {
    if (!rows[r].trim()) continue;
    const f = parseRow(rows[r]);
    const title = (f[iTitle] || '').trim();
    const lat = Number(f[iLat]); const lon = Number(f[iLon]);
    if (!title || !Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) continue;
    const key = normalizePlace(title);
    if (!key) continue;
    const id = 'pleiades:' + ((f[iId] || '').replace(/^.*\//, '') || '?');
    (gaz[key] = gaz[key] || []).push([title, Math.round(lat * 1e4) / 1e4, Math.round(lon * 1e4) / 1e4, '', 0, id]);
    n++;
  }
  const outPath = new URL('../data-local/pleiades-gazetteer.json', import.meta.url);
  await writeFile(outPath, JSON.stringify(gaz));
  console.error(`Pleiades gazetteer: ${n} places, ${Object.keys(gaz).length} distinct names -> data-local/pleiades-gazetteer.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
