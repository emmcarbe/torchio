#!/usr/bin/env node
/**
 * Georeference an edition's places against the local gazetteer, with the
 * editor in the loop. Writes (or updates) georef.json next to the input:
 * editor decisions in the existing file always survive.
 *
 * Usage: node tools/georeference.js <input.xml> [georef.json]
 * Requires data-local/gazetteer.json (tools/build-gazetteer.py).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseXML } from '../src/xml.js';
import { resolveIncludes } from '../src/xinclude.js';
import { loadBaseData, buildClassMap } from '../src/classes.js';
import { buildModel } from '../src/model.js';
import { georeference } from '../src/georef.js';

const [input, outArg] = process.argv.slice(2);
if (!input) {
  console.error('usage: node tools/georeference.js <input.xml> [georef.json]');
  process.exit(1);
}
const outPath = outArg || join(dirname(input), 'georef.json');

let gazetteer;
try {
  gazetteer = JSON.parse(await readFile(
    new URL('../data-local/gazetteer.json', import.meta.url), 'utf-8'));
} catch {
  console.error('gazetteer not found: run  python3 tools/build-gazetteer.py  first');
  process.exit(1);
}

// Pleiades for the ancient world (optional): built by tools/build-pleiades.js
let pleiades = null;
try {
  pleiades = JSON.parse(await readFile(
    new URL('../data-local/pleiades-gazetteer.json', import.meta.url), 'utf-8'));
} catch { /* no Pleiades: GeoNames only */ }

// terminus ante quem: a text written no later than this year cannot name a
// place in the Americas. Declared in the edition's torchio.json ("notAfter"),
// it prunes New World homonyms (Carthage, Illinois). Absent: no period filter.
let notAfter = null;
try {
  const cfg = JSON.parse(await readFile(join(dirname(input), 'torchio.json'), 'utf-8'));
  if (Number.isFinite(cfg.notAfter)) notAfter = cfg.notAfter;
} catch { /* no config, or no notAfter */ }

const xml = await readFile(input, 'utf-8');
const root = parseXML(xml);
await resolveIncludes(root, (href) => readFile(join(dirname(input), href), 'utf-8'));
const data = await loadBaseData();
const model = buildModel(root, buildClassMap(null, data));

let previous = {};
try { previous = JSON.parse(await readFile(outPath, 'utf-8')).places || {}; } catch {}

const { places, stats } = georeference(model, gazetteer, previous, pleiades, notAfter);
await writeFile(outPath, JSON.stringify({
  source: 'GeoNames cities1000 (CC BY 4.0) + Pleiades (CC BY), via torchio',
  howto: 'every coordinate is a SUGGESTION, and the machine can pick the wrong place (a Troia in Egypt, not Homer\'s): review each, set status to "confirmed" (correcting lat/lon), or "rejected"; fill in coordinates for "missing". Each carries its source (geonames / pleiades). Your edits survive re-runs.',
  places,
}, null, 1));
console.error(`georeferenced: ${stats.found} found, ${stats.missing} missing, ${stats.kept} kept (GeoNames + ${pleiades ? 'Pleiades' : 'no Pleiades'})`);

console.error(`georef: ${outPath}`);
console.error(`  suggested from gazetteer: ${stats.found}`);
console.error(`  missing (editor fills in): ${stats.missing}`);
console.error(`  editor decisions kept: ${stats.kept}`);
for (const [key, p] of Object.entries(places)) {
  if (p.status === 'missing') console.error(`  ? ${p.label}`);
}
