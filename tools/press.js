#!/usr/bin/env node
/**
 * Press one TEI document into a standalone HTML page (base rendering).
 * Usage: node tools/press.js <input.xml> [output.html]
 * This is a development tool; the real paths are the browser engine (path A)
 * and the GitHub Action (path B), both built on the same modules.
 */
import { readText } from '../src/decode.js';
import { readFile, writeFile, mkdir, stat, readdir, cp } from 'node:fs/promises';
import { realpathSync, mkdirSync, writeFileSync } from 'node:fs';
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
import { applyGeoref } from '../src/georef.js';
import { attachLemmas, attachLexicon } from '../src/lemmas.js';
import { validateODD, formatValidationIssue } from '../src/validate.js';
import { validateFiles } from './schema-validate.js';

// a tool an editor runs from the terminal must fail with a sentence, not a
// stack trace: a malformed file, a wrong encoding, a missing input are things
// the user can fix, and the message must say what
process.on('unhandledRejection', (err) => {
  console.error(`\nnot pressed: ${err && err.message ? err.message : err}`);
  process.exit(1);
});

/**
 * What the press has to say about this impression, kept rather than printed
 * as it happens: a file it could not read, an inclusion it could not resolve,
 * a page it was promised and did not find. Two levels, and the difference is
 * whether the edition published is the edition meant: a WARNING is something
 * the editor should know, an ERROR is something the reader would not see.
 * Errors stop the press unless --lenient is given, because publishing part of
 * an edition without saying so is the worst thing this tool could do.
 */
const REPORT = [];
/**
 * The files this impression was actually made from: the TEI read, the ones
 * an inclusion pulled in, the ODD, the manifest, the sidecars applied. Only
 * these travel with the edition. Walking the folder instead would publish
 * whatever happened to be beside it, which for an edition under rights, or
 * for working notes, is a decision nobody took.
 */
const USED = new Set();
const used = (path) => { if (path) USED.add(resolve(path)); };
const note = (level, what, detail) => REPORT.push({ level, what, detail });
const lenient = process.argv.includes('--lenient');
const allowRawHTML = process.argv.includes('--allow-raw-html');
const validateOdd = process.argv.includes('--validate-odd') || process.argv.includes('--strict-odd');
const rngArg = process.argv.find((a) => a.startsWith('--rng='));
const schematronArg = process.argv.find((a) => a.startsWith('--schematron='));
const strictSchema = process.argv.includes('--strict-schema') || !!rngArg || !!schematronArg;
const memoryReport = process.argv.includes('--memory');
const memoryMB = () => Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
const memoryStart = memoryMB();

function sayReport() {
  const errors = REPORT.filter((r) => r.level === 'error');
  const warnings = REPORT.filter((r) => r.level === 'warning');
  if (!REPORT.length) return errors;
  console.error('');
  console.error(`report: ${errors.length} error(s), ${warnings.length} warning(s)`);
  for (const r of REPORT) {
    console.error(`  ${r.level === 'error' ? 'ERROR  ' : 'warning'} ${r.what}${r.detail ? ': ' + r.detail : ''}`);
  }
  return errors;
}

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
  // resolving the written path is not enough: a link inside the edition may
  // point out of it, and then the path looks contained while the file is not.
  // What is compared is where the file really is
  try {
    const realBase = realpathSync(base);
    const realAbs = realpathSync(abs);
    if (realAbs !== realBase && !realAbs.startsWith(realBase + sep)) {
      throw new Error(`a link leads outside the edition, refused: ${href}`);
    }
  } catch (err) {
    // a path that does not exist yet is not a way out: only a real link is
    if (err && err.code !== 'ENOENT') throw err;
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
  used(oddFile);
}

// input: one TEI file, a teiCorpus, or a whole directory of TEI files
const inputStat = await stat(input);
let roots = [];
const sourceFiles = [];
let xml = null;
if (inputStat.isDirectory()) {
  // the TEI files of the folder. A real edition often keeps its parts in
  // sibling folders (editions/, indices/, meta/), and they are one edition:
  // when the surface holds no TEI, go down and gather what is below, so the
  // texts and the registries that belong together arrive together. Names stay
  // relative to the input, so two files with the same basename do not collide
  const gather = async (dir, rel = '', depth = 0) => {
    if (depth > 4) return [];
    const out = [];
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) out.push(...await gather(join(dir, e.name), r, depth + 1));
      else if (/\.(xml|odd)$/i.test(e.name)) out.push(r);
    }
    return out;
  };
  let names = (await readdir(input)).filter((n) => /\.(xml|odd)$/i.test(n)).sort();
  if (!names.length) {
    names = (await gather(input)).sort();
    if (names.length) {
      console.error(`no TEI at the top level: gathered ${names.length} files from the folders below`);
    }
  }
  for (const n of names) {
    try {
      const src = await readText(join(input, n));
      used(join(input, n));
      sourceFiles.push(join(input, n));
      const r = parseXML(src);
      if (isODD(r)) {
        if (odd) { if (!oddFile || n !== basename(oddFile)) note('warning', 'a second ODD was ignored', n); continue; }
        odd = parseODD(r);
        oddFile = n;
        used(join(input, n));
        continue;
      }
      if (!inTEINamespace(r)) continue;
      await resolveIncludes(r, (href) => { const t = within(input, href); used(t); return readText(t); });
      roots.push({ id: n.replace(/\.xml$/i, '').replace(/[/\\]/g, '-'), root: r });
    } catch (err) {
      note('error', `a file could not be read, and its text is not in the edition (${n})`, err.message);
    }
  }
  console.error(`directory input: ${roots.length} TEI documents`);
  // a folder whose TEI lives in subfolders (editions/, indices/, meta/) is a
  // common shape for a real edition, and the press reads one directory: say
  // so, instead of failing later with an error about an absent document
  if (!roots.length) {
    console.error(`not pressed: no TEI document in ${input}, at any level.`);
    process.exit(1);
  }
} else {
  try { xml = await readText(input); used(input); }
  catch (err) { console.error(`not pressed: ${err.message}`); process.exit(1); }
  const root = parseXML(xml);
  sourceFiles.push(input);
  if (isODD(root)) {
    console.error('the input is an ODD: a schema, not an edition (pass it with --odd= next to a TEI input)');
    process.exit(1);
  }
  if (!inTEINamespace(root)) {
    console.error('warning: root element is not in the TEI namespace; pressing anyway (nothing is invisible)');
  }
  const { resolved, unresolved } = await resolveIncludes(root, (href) =>
    readText(within(dirname(input), href)));
  if (resolved) console.error(`xinclude: ${resolved} resolved`);
  for (const u of unresolved) note('error', `an inclusion did not resolve, so its text is missing (${u.href})`, u.reason);
  roots = [root];
}
if (rngArg || schematronArg) {
  const schemaReport = await validateFiles(sourceFiles.filter((file) => /\.(xml|tei)$/i.test(file)), {
    rng: rngArg?.slice(6), schematron: schematronArg?.slice(13),
  });
  for (const row of schemaReport.results) {
    if (row.valid) console.error(`schema: ${row.kind} valid (${row.file})`);
    else note('error', `${row.kind} validation failed (${row.file})`, row.detail);
  }
  for (const error of schemaReport.errors) if (!error.detail) note('error', 'schema validation', error.file);
  if (!schemaReport.results.length && schemaReport.errors.length) {
    for (const error of schemaReport.errors) note('error', 'schema validation', error.detail);
  }
  console.error(`schema validation: ${schemaReport.errors.length} error(s)`);
  if (schemaReport.errors.length && strictSchema && !lenient) {
    sayReport();
    process.exit(1);
  }
}
if (oddFile) {
  console.error(`odd: ${oddFile} (${odd.customElements.length} custom elements, ${odd.deletedElements.size} deleted)`);
  for (const warning of odd.warnings || []) {
    note('warning', 'an ODD processing instruction was not applied', warning);
  }
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
const memoryModel = memoryMB();

if (odd && validateOdd) {
  const validation = validateODD(roots, odd, data);
  for (const item of validation.errors) note('error', 'ODD validation', formatValidationIssue(item));
  for (const item of validation.warnings) note('warning', 'ODD validation', formatValidationIssue(item));
  console.error(`odd validation: ${validation.errors.length} error(s), ${validation.warnings.length} warning(s)`);
}

const baseDir = inputStat.isDirectory() ? input : dirname(input);
const manifestArg = process.argv.find((a) => a.startsWith('--manifest='));
const manifestPath = manifestArg
  ? manifestArg.slice('--manifest='.length)
  : join(baseDir, 'torchio.json');
let manifest = null;
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
  used(manifestPath);
  console.error(`manifest: ${manifestPath}`);
} catch { /* level zero: no manifest, everything derived */ }

// entity reconciliation (reconcile.json next to the manifest, or the input)
try {
  const rec = JSON.parse(await readFile(join(dirname(manifestPath), 'reconcile.json'), 'utf-8'));
  used(join(dirname(manifestPath), 'reconcile.json'));
  applyReconciliation(model, rec.entities);
  console.error('reconcile: reconcile.json applied');
} catch { /* nothing reconciled */ }

// georeferencing (georef.json next to the manifest): the coordinates a
// gazetteer proposed, each a suggestion carrying its source, drawn on the map
// as unconfirmed until the editor confirms. Coordinates the TEI declares win
try {
  const gr = JSON.parse(await readFile(join(dirname(manifestPath), 'georef.json'), 'utf-8'));
  used(join(dirname(manifestPath), 'georef.json'));
  applyGeoref(model, gr.places);
  console.error('georef: georef.json applied');
} catch { /* nothing georeferenced */ }

// lemmas: from the markup (w/@lemma), or from a reviewed lemmas.json
let lemmasJson = null;
try {
  lemmasJson = JSON.parse(await readFile(join(dirname(manifestPath), 'lemmas.json'), 'utf-8'));
  used(join(dirname(manifestPath), 'lemmas.json'));
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
      // an .html page is inserted as it is, so it can carry scripts: that is
      // trust, not a format. Markdown is the ordinary way to write a page,
      // and raw HTML has to be asked for, once, in the open
      let html;
      if (e.file.endsWith('.html')) {
        if (!allowRawHTML) {
          note('error', `a page is raw HTML and raw HTML was not allowed (${e.file})`,
            'it can carry scripts: press again with --allow-raw-html if the file is yours, or write the page in Markdown');
          continue;
        }
        html = raw;
        note('warning', `a page is raw HTML and is published as it is (${e.file})`,
          'nothing in it has been checked');
      } else html = markdown(raw);
      extraPages.push({ id: e.id, label: e.label || e.id, html });
    } catch (err) {
      note('error', `a page the manifest promises is missing (${e.file})`, err.message);
    }
  }
}

let out;
if (site) {
  out = output || basename(input).replace(/\.xml$/i, '');
  await mkdir(out, { recursive: true });
  const streamed = process.argv.includes('--stream');
  const streamedFiles = [];
  const files = pressSite(model, {
    manifest, sourceXML: xml, extraPages,
    collect: !streamed,
    onFile: streamed ? (name, content) => {
      const target = join(out, name);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
      streamedFiles.push(name);
    } : null,
  });
  if (!streamed) for (const [name, content] of Object.entries(files)) {
    await mkdir(dirname(join(out, name)), { recursive: true });
    await writeFile(join(out, name), content);
  }
  const fileNames = streamed ? streamedFiles : Object.keys(files);
  if (fileNames.includes('map.html')) {

    await cp(new URL('../data-assets/leaflet', import.meta.url),
      join(out, 'assets', 'leaflet'), { recursive: true });
    console.error('assets: leaflet copied');
  }

  // the edition's own images/ folder, for the simple pages: copied verbatim to
  // the site root, next to the pages, so a page's ![x](images/f1r.jpg) resolves.
  // Gated on the folder existing, not on a map (unlike leaflet). Looked for both
  // next to the sources and next to the manifest, the two plausible roots
  for (const dir of [...new Set([join(baseDir, 'images'), join(dirname(manifestPath), 'images')])]) {
    try {
      if ((await stat(dir)).isDirectory()) {
        await cp(dir, join(out, 'images'), { recursive: true, dereference: false });
        console.error('assets: images/ copied from ' + dir);
      }
    } catch { /* no images folder at this root */ }
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
    const baseAbs = resolve(base);
    const copied = [];
    // only what this impression was made from, and only from within the
    // edition's own folder: a file read from elsewhere is named in the index
    // but not republished, since the edition does not own it
    const outside = [];
    for (const abs of [...USED].sort()) {
      if (!abs.startsWith(baseAbs + sep)) { outside.push(abs); continue; }
      const rel = abs.slice(baseAbs.length + 1);
      try {
        await mkdir(dirname(join(srcDir, rel)), { recursive: true });
        await cp(abs, join(srcDir, rel));
        copied.push(rel);
      } catch (err) { note('warning', `a source file could not be copied (${rel})`, err.message); }
    }
    await writeFile(join(srcDir, 'index.json'), JSON.stringify({
      note: 'the files this impression was made from, and only those',
      files: copied.sort(), count: copied.length,
      readFromOutsideTheEdition: outside.map((p) => basename(p)),
    }, null, 1));
    console.error(`sources: ${copied.length} files copied to data/source/`);
  } catch (err) { note('warning', 'the sources were not copied', err.message); }
  console.error(`pressed site: ${out}/ (${fileNames.length} files${streamed ? ', streamed' : ''})`);
  if (memoryReport) console.error(`memory: start ${memoryStart} MB, model ${memoryModel} MB, site ${memoryMB()} MB`);
} else {
  out = output || basename(input).replace(/\.xml$/i, '') + '.html';
  await writeFile(out, pressPage(model));
  console.error(`pressed: ${out}`);
}
console.error(`  title: ${model.meta.title || '(none)'}`);
console.error(`  elements: ${report.distinctElements} distinct, fallbacks: ${report.fallback.length ? report.fallback.join(', ') : 'none'}`);
if (report.fallbackDetails?.length) {
  for (const item of report.fallbackDetails) {
    console.error(`  fallback: <${item.element}> in ${item.doc} @ ${item.path}`);
  }
}
console.error(`  registries: ${Object.entries(model.registries).map(([k, v]) => `${k}:${v.length}`).join(' ')}`);
console.error(`  apparatus registers: ${model.apparatus.length}`);

// what the press has to say, and what it does about it. An edition published
// with a hole in it, and nothing said, is worse than an edition not published
const errors = sayReport();
if (errors.length && !lenient) {
  console.error('');
  console.error('not published: the edition above is incomplete. Fix what is listed,');
  console.error('or press again with --lenient to publish it as it is, knowingly.');
  process.exit(1);
}
