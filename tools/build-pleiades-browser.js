#!/usr/bin/env node
/**
 * Build a COMPACT Pleiades index for the browser wizard: the full gazetteer
 * (data-local/pleiades-gazetteer.json, ~2.4MB with names and alternatives) is
 * too large to carry, so keep only what a coordinate suggestion needs: the
 * normalized name to its top candidate's [lat, lon, pleiadesId]. GeoNames is
 * far larger and stays the command-line route; in the browser Pleiades covers
 * the ancient world (offline, fetched next to the wizard) and Wikidata the rest.
 *
 * Input:  data-local/pleiades-gazetteer.json  (tools/build-pleiades.js)
 * Output: data-assets/pleiades-browser.json   { normkey: [lat, lon, id] }
 *
 *   node tools/build-pleiades-browser.js
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const src = new URL('../data-local/pleiades-gazetteer.json', import.meta.url);
let full;
try {
  full = JSON.parse(await readFile(src, 'utf-8'));
} catch {
  console.error('Pleiades gazetteer not found: run  node tools/build-pleiades.js  first');
  process.exit(1);
}

const out = {};
let n = 0;
for (const key in full) {
  const top = full[key][0];
  if (!top) continue;
  const id = String(top[5] || '').replace(/^pleiades:/, '');
  out[key] = [top[1], top[2], id ? Number(id) : 0];
  n++;
}

const dir = new URL('../data-assets/', import.meta.url);
await mkdir(dir, { recursive: true });
const dest = new URL('../data-assets/pleiades-browser.json', import.meta.url);
await writeFile(dest, JSON.stringify(out));
console.error(`Pleiades browser index: ${n} places -> data-assets/pleiades-browser.json`);
