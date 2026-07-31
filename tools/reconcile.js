#!/usr/bin/env node
/**
 * Reconcile an edition's entities (places, people, organisations) with the
 * editor in the loop. Writes or updates reconcile.json next to the input;
 * editor decisions in the existing file always survive.
 *
 * Usage: node tools/reconcile.js <input.xml> [reconcile.json]
 * Place lookups need data-local/gazetteer.json (tools/build-gazetteer.py);
 * without it, places come out as "missing" like the other types.
 */
import { readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseXML } from '../src/xml.js';
import { resolveIncludes } from '../src/xinclude.js';
import { loadBaseData, buildClassMap } from '../src/classes.js';
import { buildModel } from '../src/model.js';
import { reconcile } from '../src/reconcile.js';
import { buildXLSX } from '../src/xlsx.js';
import { readZip } from '../src/zip.js';

const [input, outArg] = process.argv.slice(2);
if (!input) {
  console.error('usage: node tools/reconcile.js <input.xml> [reconcile.json]');
  process.exit(1);
}
let gazetteer = null;
try {
  gazetteer = JSON.parse(await readFile(
    new URL('../data-local/gazetteer.json', import.meta.url), 'utf-8'));
} catch {
  console.error('note: no gazetteer (run tools/build-gazetteer.py); places will be "missing"');
}

const inputStat = await stat(input);
const outPath = outArg
  || (inputStat.isDirectory() ? join(input, 'reconcile.json') : join(dirname(input), 'reconcile.json'));
let roots = [];
if (inputStat.isDirectory()) {
  for (const n of (await readdir(input)).filter((x) => x.endsWith('.xml')).sort()) {
    try {
      const r = parseXML(await readFile(join(input, n), 'utf-8'));
      await resolveIncludes(r, (href) => readFile(join(input, href), 'utf-8'));
      roots.push({ id: n.replace(/\.xml$/i, ''), root: r });
    } catch { /* skip unparsable */ }
  }
} else {
  const root = parseXML(await readFile(input, 'utf-8'));
  await resolveIncludes(root, (href) => readFile(join(dirname(input), href), 'utf-8'));
  roots = [root];
}
const data = await loadBaseData();
const model = buildModel(roots.length === 1 && !roots[0].root ? roots[0] : roots, buildClassMap(null, data));

// a reviewed places sheet (.xlsx) folds the editor's decisions back into
// reconcile.json: the same round trip as the browser, from the command line
if (outArg && /\.xlsx$/i.test(outArg)) {
  const jsonPath = inputStat.isDirectory() ? join(input, 'reconcile.json') : join(dirname(input), 'reconcile.json');
  let table = { entities: { place: {}, person: {}, org: {} } };
  try { table = JSON.parse(await readFile(jsonPath, 'utf-8')); } catch {}
  const parts = readZip(new Uint8Array(await readFile(outArg)));
  const sheet = parts.get('xl/worksheets/sheet1.xml') || '';
  const rows = [];
  for (const rowXml of sheet.match(/<row[\s\S]*?<\/row>/g) || []) {
    rows.push([...rowXml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
      .map((m) => m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')));
  }
  const head = rows.shift() || [];
  const iK = head.indexOf('key'), iS = head.indexOf('status'), iLa = head.indexOf('lat'), iLo = head.indexOf('lon');
  let applied = 0;
  for (const r of rows) {
    const key = r[iK]; if (!key || !table.entities.place[key]) continue;
    const e = table.entities.place[key];
    if (iS >= 0 && r[iS]) e.status = r[iS];
    const lat = Number(r[iLa]), lon = Number(r[iLo]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) { e.lat = lat; e.lon = lon; }
    applied++;
  }
  await writeFile(jsonPath, JSON.stringify(table, null, 1));
  console.error(`applied ${applied} reviewed places to ${jsonPath}`);
  process.exit(0);
}

let previous = {};
try { previous = JSON.parse(await readFile(outPath, 'utf-8')).entities || {}; } catch {}

const { entities, stats } = reconcile(model, { gazetteer }, previous);
await writeFile(outPath, JSON.stringify({
  sources: 'places: GeoNames cities1000 (CC BY 4.0). People and organisations: fill in viaf / wikidata / gnd / isil.',
  howto: 'review each entry: set status to "confirmed" (correcting data if needed) or "rejected"; fill in data for "missing". Your edits survive re-runs.',
  entities,
}, null, 1));

// the places sheet: what the gazetteer answered, for the editor to judge.
// The form in the text, the canonical name found, where it came from
const placeRows = Object.entries(entities.place).map(([key, e]) => [
  e.label || key, e.found || '', e.matched ? 'variant \u2192 ' + e.found : (e.source || ''),
  e.lat == null ? '' : e.lat, e.lon == null ? '' : e.lon, e.status || 'suggested',
  (e.alternatives || []).map((a) => a.name + ' (' + a.country + ')').join('; '), key,
]);
if (placeRows.length) {
  const xlsxPath = outPath.replace(/\.json$/i, '') + '-places.xlsx';
  const xlsx = buildXLSX(
    ['label', 'found', 'source', 'lat', 'lon', 'status', 'alternatives', 'key'],
    placeRows,
    { sheet: 'Places', widths: [18, 18, 16, 10, 10, 12, 40, 1],
      choices: { col: 5, options: ['confirmed', 'rejected', 'suggested'] } });
  await writeFile(xlsxPath, xlsx);
  console.error(`  places sheet: ${xlsxPath} (open it, confirm or reject, then: node tools/reconcile.js <input> ${xlsxPath})`);
}

console.error(`reconcile: ${outPath}`);
console.error(`  suggested: ${stats.suggested} · missing (editor fills in): ${stats.missing} · editor decisions kept: ${stats.kept}`);
for (const type of Object.keys(entities)) {
  const es = Object.values(entities[type]);
  if (es.length) console.error(`  ${type}: ${es.length} (${es.filter((e) => e.status === 'missing').length} missing)`);
}
