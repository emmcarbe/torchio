#!/usr/bin/env node
/**
 * Press one TEI document into a standalone HTML page (base rendering).
 * Usage: node tools/press.js <input.xml> [output.html]
 * This is a development tool; the real paths are the browser engine (path A)
 * and the GitHub Action (path B), both built on the same modules.
 */
import { readFile, writeFile, mkdir, stat, readdir } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { parseXML, inTEINamespace } from '../src/xml.js';
import { resolveIncludes } from '../src/xinclude.js';
import { loadBaseData, buildClassMap } from '../src/classes.js';
import { buildModel } from '../src/model.js';
import { pressPage } from '../src/render.js';
import { pressSite } from '../src/site.js';
import { analyze } from '../src/analyze.js';
import { applyReconciliation } from '../src/reconcile.js';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const site = process.argv.includes('--site');
const [input, output] = args;
if (!input) {
  console.error('usage: node tools/press.js [--site] <input.xml> [output.html | output-dir]');
  process.exit(1);
}

// input: one TEI file, a teiCorpus, or a whole directory of TEI files
const inputStat = await stat(input);
let roots = [];
let xml = null;
if (inputStat.isDirectory()) {
  const names = (await readdir(input)).filter((n) => n.endsWith('.xml')).sort();
  for (const n of names) {
    try {
      const src = await readFile(join(input, n), 'utf-8');
      const r = parseXML(src);
      if (!inTEINamespace(r)) continue;
      await resolveIncludes(r, (href) => readFile(join(input, href), 'utf-8'));
      roots.push({ id: n.replace(/\.xml$/i, ''), root: r });
    } catch (err) {
      console.error(`skipped ${n}: ${err.message}`);
    }
  }
  console.error(`directory input: ${roots.length} TEI documents`);
} else {
  xml = await readFile(input, 'utf-8');
  const root = parseXML(xml);
  if (!inTEINamespace(root)) {
    console.error('warning: root element is not in the TEI namespace; pressing anyway (nothing is invisible)');
  }
  const { resolved, unresolved } = await resolveIncludes(root, (href) =>
    readFile(join(dirname(input), href), 'utf-8'));
  if (resolved) console.error(`xinclude: ${resolved} resolved`);
  for (const u of unresolved) console.error(`xinclude unresolved: ${u.href} (${u.reason})`);
  roots = [root];
}

const data = await loadBaseData();
const map = buildClassMap(null, data);
const model = buildModel(roots.length === 1 && !roots[0].root ? roots[0] : roots, map);

const baseDir = inputStat.isDirectory() ? input : dirname(input);
const manifestArg = process.argv.find((a) => a.startsWith('--manifest='));
const manifestPath = manifestArg
  ? manifestArg.slice('--manifest='.length)
  : join(baseDir, 'torchio.json');
let manifest = null;
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
  console.error(`manifest: ${manifestPath}`);
} catch { /* level zero: no manifest, everything derived */ }

// entity reconciliation (reconcile.json next to the manifest, or the input)
try {
  const rec = JSON.parse(await readFile(join(dirname(manifestPath), 'reconcile.json'), 'utf-8'));
  applyReconciliation(model, rec.entities);
  console.error('reconcile: reconcile.json applied');
} catch { /* nothing reconciled */ }

const report = analyze(roots.map((r) => r.root || r), map);

// the editor's simple pages: markdown or html files next to the manifest
const extraPages = [];
if (manifest && Array.isArray(manifest.extra)) {
  const { markdown } = await import('../src/md.js');
  for (const e of manifest.extra) {
    if (!e || !e.id || !e.file) continue;
    try {
      const raw = await readFile(join(dirname(manifestPath), e.file), 'utf-8');
      const html = e.file.endsWith('.html') ? raw : markdown(raw);
      extraPages.push({ id: e.id, label: e.label || e.id, html });
    } catch (err) {
      console.error(`extra page skipped (${e.file}): ${err.message}`);
    }
  }
}

let out;
if (site) {
  out = output || basename(input).replace(/\.xml$/i, '');
  await mkdir(out, { recursive: true });
  const files = pressSite(model, { manifest, sourceXML: xml, extraPages });
  for (const [name, content] of Object.entries(files)) {
    await mkdir(dirname(join(out, name)), { recursive: true });
    await writeFile(join(out, name), content);
  }
  console.error(`pressed site: ${out}/ (${Object.keys(files).join(', ')})`);
} else {
  out = output || basename(input).replace(/\.xml$/i, '') + '.html';
  await writeFile(out, pressPage(model));
  console.error(`pressed: ${out}`);
}
console.error(`  title: ${model.meta.title || '(none)'}`);
console.error(`  elements: ${report.distinctElements} distinct, fallbacks: ${report.fallback.length ? report.fallback.join(', ') : 'none'}`);
console.error(`  registries: ${Object.entries(model.registries).map(([k, v]) => `${k}:${v.length}`).join(' ')}`);
console.error(`  apparatus registers: ${model.apparatus.length}`);
