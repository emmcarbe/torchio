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

const xml = await readFile(input, 'utf-8');
const root = parseXML(xml);
await resolveIncludes(root, (href) => readFile(join(dirname(input), href), 'utf-8'));
const data = await loadBaseData();
const model = buildModel(root, buildClassMap(null, data));

let previous = {};
try { previous = JSON.parse(await readFile(outPath, 'utf-8')).places || {}; } catch {}

const { places, stats } = georeference(model, gazetteer, previous);
await writeFile(outPath, JSON.stringify({
  source: 'GeoNames cities1000 (CC BY 4.0), via torchio build-gazetteer',
  howto: 'review each place: set status to "confirmed" (correcting lat/lon if needed), or "rejected"; fill in coordinates for status "missing". Your edits survive re-runs.',
  places,
}, null, 1));

console.error(`georef: ${outPath}`);
console.error(`  suggested from gazetteer: ${stats.found}`);
console.error(`  missing (editor fills in): ${stats.missing}`);
console.error(`  editor decisions kept: ${stats.kept}`);
for (const [key, p] of Object.entries(places)) {
  if (p.status === 'missing') console.error(`  ? ${p.label}`);
}
