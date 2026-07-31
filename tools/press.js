#!/usr/bin/env node
/**
 * Press one TEI document into a standalone HTML page (base rendering).
 * Usage: node tools/press.js <input.xml> [output.html]
 * This is a development tool; the real paths are the browser engine (path A)
 * and the GitHub Action (path B), both built on the same modules.
 */
import { readFile, writeFile, mkdir, stat, readdir, cp } from 'node:fs/promises';
import { dirname, join, basename, resolve, sep } from 'node:path';
import { parseXML, inTEINamespace } from '../src/xml.js';
import { resolveIncludes } from '../src/xinclude.js';
import { parseODD, isODD } from '../src/odd.js';
import { loadBaseData, buildClassMap } from '../src/classes.js';
import { buildModel } from '../src/model.js';
import { pressPage } from '../src/render.js';
import { pressSite } from '../src/site.js';
import { analyze } from '../src/analyze.js';
import { applyReconciliation } from '../src/reconcile.js';
import { attachLemmas, attachLexicon } from '../src/lemmas.js';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const site = process.argv.includes('--site');
/** A path an edition points to must stay inside the edition: an include or
 *  an extra page cannot reach out of the project root. */
function within(root, href) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) throw new Error(`remote reference refused: ${href}`);
  const base = resolve(root);
  const abs = resolve(base, href);
  if (abs !== base && !abs.startsWith(base + sep)) {
    throw new Error(`path outside the edition refused: ${href}`);
  }
  return abs;
}

const [input, output] = args;
if (!input) {
  console.error('usage: node tools/press.js [--site] <input.xml> [output.html | output-dir]');
  process.exit(1);
}

// the edition's ODD: --odd=file, or recognized on its own in directory input
// (a document carrying schemaSpec is a schema, not a text)
const oddArg = process.argv.find((a) => a.startsWith('--odd='));
let odd = null;
let oddFile = null;
if (oddArg) {
  oddFile = oddArg.slice('--odd='.length);
  odd = parseODD(await readFile(oddFile, 'utf-8'));
}

// input: one TEI file, a teiCorpus, or a whole directory of TEI files
const inputStat = await stat(input);
let roots = [];
let xml = null;
if (inputStat.isDirectory()) {
  const names = (await readdir(input)).filter((n) => /\.(xml|odd)$/i.test(n)).sort();
  for (const n of names) {
    try {
      const src = await readFile(join(input, n), 'utf-8');
      const r = parseXML(src);
      if (isODD(r)) {
        if (odd) { if (!oddFile || n !== basename(oddFile)) console.error(`second ODD ignored: ${n}`); continue; }
        odd = parseODD(r);
        oddFile = n;
        continue;
      }
      if (!inTEINamespace(r)) continue;
      await resolveIncludes(r, (href) => readFile(within(input, href), 'utf-8'));
      roots.push({ id: n.replace(/\.xml$/i, ''), root: r });
    } catch (err) {
      console.error(`skipped ${n}: ${err.message}`);
    }
  }
  console.error(`directory input: ${roots.length} TEI documents`);
} else {
  xml = await readFile(input, 'utf-8');
  const root = parseXML(xml);
  if (isODD(root)) {
    console.error('the input is an ODD: a schema, not an edition (pass it with --odd= next to a TEI input)');
    process.exit(1);
  }
  if (!inTEINamespace(root)) {
    console.error('warning: root element is not in the TEI namespace; pressing anyway (nothing is invisible)');
  }
  const { resolved, unresolved } = await resolveIncludes(root, (href) =>
    readFile(within(dirname(input), href), 'utf-8'));
  if (resolved) console.error(`xinclude: ${resolved} resolved`);
  for (const u of unresolved) console.error(`xinclude unresolved: ${u.href} (${u.reason})`);
  roots = [root];
}
if (oddFile) {
  console.error(`odd: ${oddFile} (${odd.customElements.length} custom elements, ${odd.deletedElements.size} deleted)`);
} else {
  console.error('odd: none, read against the whole of P5 (tei_all)');
}

// the colophon of this impression: version, commit, date
try {
  const { execSync } = await import('node:child_process');
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf-8'));
  let commit = '';
  try {
    commit = execSync('git -C ' + JSON.stringify(dirname(new URL('.', import.meta.url).pathname))
      + ' rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch { /* pressed outside a checkout */ }
  const { setColophon } = await import('../src/page-shell.js');
  setColophon(`v${pkg.version}${commit ? ` · ${commit}` : ''} · ${new Date().toISOString().slice(0, 10)}`);
} catch { /* the footer keeps its default */ }

const data = await loadBaseData();
const map = buildClassMap(odd, data);
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

// lemmas: from the markup (w/@lemma), or from a reviewed lemmas.json
let lemmasJson = null;
try {
  lemmasJson = JSON.parse(await readFile(join(dirname(manifestPath), 'lemmas.json'), 'utf-8'));
} catch { /* no file: the markup alone decides */ }
const lemmas = attachLemmas(model, lemmasJson);
attachLexicon(model);
if (lemmas) {
  console.error(`lemmas: ${lemmas.entries.length} lemmas, ${lemmas.lemmatized}/${lemmas.tokens} tokens`
    + (lemmas.provenance.markup ? ` (markup: ${lemmas.provenance.markup})` : '')
    + (lemmas.provenance.file ? ` (lemmas.json: ${lemmas.provenance.file})` : ''));
}

const report = analyze(roots.map((r) => r.root || r), map);

// the editor's simple pages: markdown or html files next to the manifest
const extraPages = [];
if (manifest && Array.isArray(manifest.extra)) {
  const { markdown } = await import('../src/md.js');
  for (const e of manifest.extra) {
    if (!e || !e.id || !e.file) continue;
    try {
      const raw = await readFile(within(dirname(manifestPath), e.file), 'utf-8');
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
  if ('map.html' in files) {

    await cp(new URL('../data-assets/leaflet', import.meta.url),
      join(out, 'assets', 'leaflet'), { recursive: true });
    console.error('assets: leaflet copied');
  }

  // the sources travel with the edition: every TEI file that went into it,
  // including the ones pulled in by XInclude, is downloadable from the site.
  // UNLESS the editor said no: exports.source false is a rights decision,
  // and it governs the whole source folder, not only the single-file export
  const exportsOff = manifest && (manifest.exports === false
    || (manifest.exports && manifest.exports.source === false));
  if (exportsOff) {
    console.error('sources: not copied (exports.source is false in the manifest)');
  } else try {
    const srcDir = join(out, 'data', 'source');
    await mkdir(srcDir, { recursive: true });
    const base = (await stat(input)).isDirectory() ? input : dirname(input);
    // never copy the pressed output into its own sources: pressing next to
    // the input must not nest site/data/source/site/... at every run
    const outAbs = resolve(out);
    const copied = [];
    const walkDir = async (dir, rel = '') => {
      for (const e of await readdir(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.')) continue;
        const from = join(dir, e.name), r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
          if (resolve(from) === outAbs) continue;
          await walkDir(from, r); continue;
        }
        if (!/\.(xml|odd|rng|json)$/i.test(e.name)) continue;
        await mkdir(dirname(join(srcDir, r)), { recursive: true });
        await cp(from, join(srcDir, r));
        copied.push(r);
      }
    };
    await walkDir(base);
    // always the same place and the same rule, whatever the size: the
    // sources of an edition are part of the edition. index.json lists them,
    // so a reader with a thousand files takes the archive instead of the list
    await writeFile(join(srcDir, 'index.json'),
      JSON.stringify({ files: copied.sort(), count: copied.length }, null, 1));
    console.error(`sources: ${copied.length} files copied to data/source/`);
  } catch (err) { console.error(`sources not copied: ${err.message}`); }
  console.error(`pressed site: ${out}/ (${Object.keys(files).length} files)`);
} else {
  out = output || basename(input).replace(/\.xml$/i, '') + '.html';
  await writeFile(out, pressPage(model));
  console.error(`pressed: ${out}`);
}
console.error(`  title: ${model.meta.title || '(none)'}`);
console.error(`  elements: ${report.distinctElements} distinct, fallbacks: ${report.fallback.length ? report.fallback.join(', ') : 'none'}`);
console.error(`  registries: ${Object.entries(model.registries).map(([k, v]) => `${k}:${v.length}`).join(' ')}`);
console.error(`  apparatus registers: ${model.apparatus.length}`);
