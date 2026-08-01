#!/usr/bin/env node
/**
 * The measurement: press every harvested edition of the contrast corpus and
 * record what happened. This is the figure the project wagered on and had
 * not taken (PRINCIPLES, "The wager").
 *
 * What is published is this dataset, never the editions: each stays under
 * its own rights, at its own address. Every row carries who verified it and
 * when, and the verification is by machine, not by a person: the column
 * `verified_by` names the model that ran it.
 *
 * Input:  data-local/corpus/<id>/   (tools/harvest.js)
 *         corpus-frame.csv          (tools/catalogues.js)
 *         corpus-sources.csv        (the discovery stage)
 * Output: corpus-results.csv        the dataset
 *         data-local/corpus/measure-log.json  the long form, with errors
 *
 *   node tools/measure-corpus.js [--only=0029] [--timeout=120000]
 */
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parseXML, inTEINamespace } from '../src/xml.js';
import { resolveIncludes } from '../src/xinclude.js';
import { isODD } from '../src/odd.js';
import { loadBaseData, buildClassMap } from '../src/classes.js';
import { buildModel } from '../src/model.js';
import { analyze } from '../src/analyze.js';
import { pressSite } from '../src/site.js';

const ROOT = new URL('..', import.meta.url).pathname;
const CORPUS = join(ROOT, 'data-local', 'corpus');

// who ran this, and when: the verification is automatic, and the dataset says so
const VERIFIED_BY = process.env.TORCHIO_VERIFIER || 'claude-opus-5';
const VERIFIED_ON = new Date().toISOString().slice(0, 10);
const ENGINE = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf-8')).version;

const opt = (n, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : d;
};
const only = opt('only', null);

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

/** Every XML/ODD file under a directory, recursively, dotfiles skipped. */
async function xmlFiles(dir, acc = [], depth = 0) {
  if (depth > 8) return acc;
  let entries = [];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await xmlFiles(p, acc, depth + 1);
    else if (/\.(xml|tei|odd|rng)$/i.test(e.name)) acc.push(p);
  }
  return acc;
}

/**
 * Which TEI the file speaks, read from the file itself: P5 by namespace (with
 * @version when declared), P4 by its DOCTYPE or the absence of the namespace
 * with a TEI.2 root, otherwise not declared.
 */
function teiModel(xml, root) {
  const ver = root && root.attrs && (root.attrs.version || root.attrs['tei:version']);
  if (/xmlns\s*=\s*["']http:\/\/www\.tei-c\.org\/ns\/1\.0["']/.test(xml)) {
    return ver ? `P5 ${ver}` : 'P5';
  }
  if (/<!DOCTYPE\s+TEI\.2/i.test(xml) || (root && root.name === 'TEI.2')) return 'P4';
  if (/teipm|tei_?p4/i.test(xml.slice(0, 2000))) return 'P4?';
  return 'not declared';
}

/** The taxonomy of failures: one cause per failure, the way LABORATORY asks. */
function classify(err) {
  const m = String(err && err.message || err);
  if (/not well-formed|unexpected|mismatched|unclosed/i.test(m)) return 'not well-formed';
  if (/No TEI document|is an ODD|not in the TEI namespace/i.test(m)) return 'no TEI found';
  if (/ENOENT|not found|include/i.test(m)) return 'unresolved inclusion';
  if (/Maximum call stack|RangeError/i.test(m)) return 'depth or size';
  if (/heap|memory/i.test(m)) return 'memory';
  return 'engine error';
}

async function measureOne(id, meta, source) {
  const dir = join(CORPUS, id);
  const row = {
    id, title: meta.title || '', url: meta.url || '', editors: meta.editors || '',
    year: meta.year || '', doi: source.doi || '',
    in_franzini: meta.in_franzini || '', in_sahle: meta.in_sahle || '',
    ride: meta.ride || '',
    source_kind: source.source_kind || '', source_url: source.source_url || '',
    licence: source.licence || '',
    xml_files: 0, tei_files: 0, odd_declared: source.odd_declared || 'unknown',
    odd_present: 'no', tei_model: '', pressed: 'not attempted', failure_cause: '',
    elements: 0, fallbacks: 0, pages: 0, documents: 0, words: 0,
    note: '', verified_by: VERIFIED_BY, verified_on: VERIFIED_ON, engine_version: ENGINE,
  };

  let files = [];
  try { await stat(dir); files = await xmlFiles(dir); }
  catch { row.pressed = 'not fetched'; row.note = 'nothing harvested'; return row; }
  row.xml_files = files.length;
  if (!files.length) { row.pressed = 'not fetched'; row.note = 'no XML in the harvested files'; return row; }

  const odds = files.filter((f) => /\.(odd|rng)$/i.test(f));
  row.odd_present = odds.length ? 'yes' : 'no';

  // the TEI documents, and the model they speak
  const data = await loadBaseData();
  const map = buildClassMap(null, data);
  const roots = [];
  let firstModel = '';
  for (const f of files) {
    if (/\.(odd|rng)$/i.test(f)) continue;
    let xml;
    try { xml = await readFile(f, 'utf-8'); } catch { continue; }
    let r;
    try { r = parseXML(xml); } catch { continue; }
    if (isODD(r)) { row.odd_present = 'yes'; continue; }
    const model = teiModel(xml, r);
    if (!firstModel) firstModel = model;
    if (!inTEINamespace(r) && model !== 'P4') continue;
    roots.push({ id: f.slice(dir.length + 1).replace(/\.(xml|tei)$/i, ''), root: r, file: f });
    if (roots.length >= 200) break; // enough to characterize a large edition
  }
  row.tei_model = firstModel || 'not declared';
  row.tei_files = roots.length;
  if (!roots.length) { row.pressed = 'no'; row.failure_cause = 'no TEI found'; return row; }

  try {
    for (const r of roots) {
      await resolveIncludes(r.root, async (href) => {
        const base = r.file.slice(0, r.file.lastIndexOf('/'));
        return readFile(join(base, href), 'utf-8');
      });
    }
    const model = buildModel(roots.length === 1 ? roots[0].root : roots, map);
    const an = analyze(roots.map((r) => r.root), map);
    const files_out = pressSite(model, { manifest: {}, sourceXML: null, extraPages: [] });
    row.pressed = 'yes';
    row.elements = an.elements ? an.elements.length : 0;
    row.fallbacks = an.fallbacks ? an.fallbacks.length : 0;
    row.documents = (model.documents || []).length;
    row.pages = Object.keys(files_out).filter((n) => n.endsWith('.html')).length;
    row.words = (model.tokens || []).length;
  } catch (err) {
    row.pressed = 'no';
    row.failure_cause = classify(err);
    row.note = String(err.message || err).slice(0, 160);
  }
  return row;
}

async function main() {
  const frame = parseCSV(await readFile(join(ROOT, 'corpus-frame.csv'), 'utf-8'));
  const byId = new Map(frame.map((r) => [r.id, r]));
  let sources = [];
  try { sources = parseCSV(await readFile(join(ROOT, 'corpus-sources.csv'), 'utf-8')); }
  catch { console.error('corpus-sources.csv not found: run the discovery stage first'); process.exit(1); }

  const rows = [];
  for (const s of sources) {
    if (only && s.id !== only) continue;
    const meta = byId.get(s.id) || {};
    const row = await measureOne(s.id, meta, s);
    rows.push(row);
    console.error(`${row.pressed.padEnd(13)} ${row.id} ${(row.title || '').slice(0, 46)}`
      + (row.failure_cause ? `  [${row.failure_cause}]` : '')
      + (row.pressed === 'yes' ? `  ${row.documents} docs, ${row.elements} elements, ${row.fallbacks} fallbacks` : ''));
  }

  const cols = ['id', 'title', 'url', 'editors', 'year', 'doi', 'in_franzini', 'in_sahle',
    'ride', 'source_kind', 'source_url', 'licence', 'xml_files', 'tei_files',
    'odd_declared', 'odd_present', 'tei_model', 'pressed', 'failure_cause',
    'documents', 'pages', 'elements', 'fallbacks', 'words', 'note',
    'verified_by', 'verified_on', 'engine_version'];
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  await writeFile(join(ROOT, 'corpus-results.csv'),
    [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n');
  await writeFile(join(CORPUS, 'measure-log.json'), JSON.stringify({
    measured_on: new Date().toISOString(), verified_by: VERIFIED_BY, engine_version: ENGINE,
    rows,
  }, null, 1) + '\n');

  const ok = rows.filter((r) => r.pressed === 'yes').length;
  const no = rows.filter((r) => r.pressed === 'no').length;
  const nf = rows.filter((r) => r.pressed === 'not fetched').length;
  console.error(`\ncorpus-results.csv: ${rows.length} rows`);
  console.error(`  pressed: ${ok} · failed: ${no} · not fetched: ${nf}`);
  const causes = {};
  rows.filter((r) => r.failure_cause).forEach((r) => { causes[r.failure_cause] = (causes[r.failure_cause] || 0) + 1; });
  if (Object.keys(causes).length) console.error(`  causes: ${JSON.stringify(causes)}`);
  console.error(`  verified by ${VERIFIED_BY} on ${VERIFIED_ON}, engine ${ENGINE} (machine verification, not human)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
