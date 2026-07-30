#!/usr/bin/env node
/**
 * The lemma adapter: a working tool, never part of the press.
 *
 * Reads the edition's reading text, obtains lemma suggestions, and writes
 * lemmas.json next to the input, in the reconciliation pattern: every entry
 * is "suggested" (or "review" where the tagger disagreed with itself: the
 * homograph is the editor's call); the editor reviews the file; decisions
 * (confirmed / rejected / edited) survive every re-run. The press consumes
 * the reviewed file; without it, only w/@lemma counts.
 *
 * Suggestions come from UDPipe (LINDAT, Charles University) over REST at
 * working time — network use is declared, chosen per run, and never happens
 * at press time — or from a local CoNLL-U file produced by any pipeline
 * (UDPipe run elsewhere, CLTK, a treebank): --conllu=file, fully offline.
 *
 * The text is sent as the token stream (types are aggregated, alignment is
 * not needed); sentence structure is lost, a declared limit of v0 tagging.
 *
 * Usage:
 *   node tools/lemmatize.js <edition.xml | folder> [--lang=la] [--model=NAME]
 *   node tools/lemmatize.js <edition.xml | folder> --conllu=parsed.conllu
 */
import { readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseXML, inTEINamespace } from '../src/xml.js';
import { resolveIncludes } from '../src/xinclude.js';
import { isODD } from '../src/odd.js';
import { loadBaseData, buildClassMap } from '../src/classes.js';
import { buildModel, walkModel } from '../src/model.js';
import { collectTokens, conlluTypes, typesFromVotes, mergeLemmaTypes,
  reviewCSV, parseReviewCSV, applyReview } from '../src/lemmas.js';

const UDPIPE = 'https://lindat.mff.cuni.cz/services/udpipe/api';
// language -> UDPipe model name prefix (resolved against the live model list)
const MODELS = {
  grc: 'ancient_greek-perseus', la: 'latin-ittb', it: 'italian-isdt',
  nl: 'dutch-alpino', fr: 'french-gsd', de: 'german-gsd', en: 'english-ewt',
  es: 'spanish-ancora', pt: 'portuguese-bosque',
};
// editions declare languages in ISO 639-2/3 as often as 639-1: both count
const ALIASES = {
  lat: 'la', ita: 'it', eng: 'en', deu: 'de', ger: 'de', fra: 'fr', fre: 'fr',
  nld: 'nl', dut: 'nl', spa: 'es', por: 'pt', ell: 'el',
};
const normLang = (l) => {
  const k = (l || '').toLowerCase().split('-')[0];
  return ALIASES[k] || k;
};

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (name) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : null;
};
const [input] = args;
if (!input) {
  console.error('usage: node tools/lemmatize.js <edition.xml | folder> [--lang=xx] [--model=NAME] [--conllu=file] [--out=lemmas.json]');
  console.error('       node tools/lemmatize.js <edition.xml | folder> --import=lemmas-review.csv');
  process.exit(1);
}

// ---- the review circuit: spreadsheet decisions back into lemmas.json ----
const importPath = opt('import');
if (importPath) {
  const jsonPath = opt('out')
    || join((await stat(input)).isDirectory() ? input : dirname(input), 'lemmas.json');
  const existing = JSON.parse(await readFile(jsonPath, 'utf-8'));
  const rows = parseReviewCSV(await readFile(importPath, 'utf-8'));
  const { json, decided } = applyReview(existing, rows);
  await writeFile(jsonPath, JSON.stringify(json, null, 2) + '\n');
  await writeFile(jsonPath.replace(/\.json$/, '-review.csv'), reviewCSV(json.types));
  const counts = { suggested: 0, review: 0, confirmed: 0, rejected: 0 };
  for (const t of json.types) counts[t.status] = (counts[t.status] || 0) + 1;
  console.error(`imported: ${decided} decisions from ${importPath}`);
  console.error(`  types: ${json.types.length} (suggested ${counts.suggested}, review ${counts.review}, confirmed ${counts.confirmed}, rejected ${counts.rejected})`);
  process.exit(0);
}

// ---- the edition's token stream (same modules as the press) ----
const inputStat = await stat(input);
let roots = [];
if (inputStat.isDirectory()) {
  for (const n of (await readdir(input)).filter((x) => /\.(xml|tei)$/i.test(x)).sort()) {
    try {
      const r = parseXML(await readFile(join(input, n), 'utf-8'));
      if (isODD(r) || !inTEINamespace(r)) continue;
      await resolveIncludes(r, (href) => readFile(join(input, href), 'utf-8'));
      roots.push({ id: n.replace(/\.xml$/i, ''), root: r });
    } catch (err) { console.error(`skipped ${n}: ${err.message}`); }
  }
} else {
  const r = parseXML(await readFile(input, 'utf-8'));
  await resolveIncludes(r, (href) => readFile(join(dirname(input), href), 'utf-8'));
  roots = [r];
}
const map = buildClassMap(null, await loadBaseData());
const model = buildModel(roots.length === 1 && !roots[0].root ? roots[0] : roots, map);
const tokens = collectTokens(model);
if (!tokens.length) { console.error('no tokens in the reading text'); process.exit(1); }

// the language of each token is the markup's decision (nearest xml:lang,
// falling back to langUsage); --lang= overrides everything
const langOverride = opt('lang');
const byLang = new Map();
for (const t of tokens) {
  const lang = normLang(langOverride || t.lang);
  let g = byLang.get(lang);
  if (!g) { g = { forms: new Set(), tokens: [] }; byLang.set(lang, g); }
  g.forms.add(t.form.toLowerCase());
  g.tokens.push(t);
}
console.error(`tokens: ${tokens.length} in ${byLang.size} language(s): `
  + [...byLang.entries()].map(([l, g]) => `${l || '?'} (${g.tokens.length})`).join(', '));

// the date of the text (creation/origDate in the header) can pick a better
// model: for Latin, classical vs post-classical is a real difference
function creationYear() {
  for (const doc of model.documents) {
    for (const n of walkModel(doc.tree)) {
      if (n.element !== 'creation') continue;
      for (const d of walkModel(n)) {
        if (d.element === 'date' || d.element === 'origDate') {
          const w = d.atts.when || d.atts['when-iso'] || d.atts.notBefore || '';
          const y = parseInt(w, 10);
          if (!Number.isNaN(y)) return y;
        }
      }
    }
  }
  return null;
}

async function udpipeConllu(modelName, text) {
  let conllu = '';
  const CHUNK = 80000;
  for (let i = 0; i < text.length; i += CHUNK) {
    // cut on a space so no form is split across requests
    let end = Math.min(i + CHUNK, text.length);
    if (end < text.length) { const sp = text.lastIndexOf(' ', end); if (sp > i) end = sp; }
    const body = new URLSearchParams({
      model: modelName, tokenizer: '', tagger: '', data: text.slice(i, end),
    });
    const res = await fetch(`${UDPIPE}/process`, { method: 'POST', body });
    if (!res.ok) throw new Error(`udpipe: HTTP ${res.status}`);
    conllu += (await res.json()).result;
    i = end - CHUNK; // the loop's += CHUNK resumes exactly at the cut
  }
  return conllu;
}

// ---- suggestions per language: a local CoNLL-U, or UDPipe over REST ----
const freshTypes = [];
const conlluPath = opt('conllu');
if (conlluPath) {
  // an external pipeline speaks one language per file: say which with --lang
  const lang = (langOverride || [...byLang.keys()][0] || '');
  const conllu = await readFile(conlluPath, 'utf-8');
  console.error(`conllu: ${conlluPath} (offline, language "${lang || '?'}")`);
  freshTypes.push(...typesFromVotes(conlluTypes(conllu), byLang.get(lang)?.forms || null, lang || null));
} else {
  let modelList = null;
  for (const [lang, group] of byLang) {
    let modelName = byLang.size === 1 ? opt('model') : null;
    if (!modelName) {
      let prefix = MODELS[lang];
      if (lang === 'la') {
        const year = creationYear();
        if (year !== null && year < 300) prefix = 'latin-perseus';
        console.error(`latin model by date: ${year === null ? 'no creation date, default' : `dated ${year}, ${year < 300 ? 'classical (perseus)' : 'post-classical (ittb)'}`}; --model= overrides`);
      }
      if (!prefix) {
        console.error(`skipped "${lang || '?'}" (${group.tokens.length} tokens): no UDPipe model known; pass --model= with --lang=, or --conllu=`);
        continue;
      }
      if (!modelList) modelList = await (await fetch(`${UDPIPE}/models`)).json();
      modelName = Object.keys(modelList.models).find((m) => m.startsWith(prefix));
      if (!modelName) { console.error(`skipped "${lang}": no UDPipe model matches ${prefix}`); continue; }
    }
    console.error(`udpipe [${lang || '?'}]: ${modelName}`);
    const conllu = await udpipeConllu(modelName, group.tokens.map((t) => t.form).join(' '));
    freshTypes.push(...typesFromVotes(conlluTypes(conllu), group.forms, lang || null));
  }
}
if (!freshTypes.length) { console.error('no suggestions produced'); process.exit(1); }

// ---- aggregate, merge, write: the editor's decisions survive ----
const fresh = { types: freshTypes };
const outPath = opt('out') || join(inputStat.isDirectory() ? input : dirname(input), 'lemmas.json');
let existing = null;
try { existing = JSON.parse(await readFile(outPath, 'utf-8')); } catch { /* first run */ }
const generator = conlluPath ? `conllu: ${conlluPath}` : `udpipe`;
const merged = mergeLemmaTypes(existing, fresh, generator);
await writeFile(outPath, JSON.stringify(merged, null, 2) + '\n');
// the same content as a spreadsheet, sorted by what deserves the eye first:
// entries the tagger itself doubted, then frequency (Zipf pays: on a real
// corpus a few hundred types cover half the tokens)
const reviewPath = outPath.replace(/\.json$/, '-review.csv');
await writeFile(reviewPath, reviewCSV(merged.types));

const counts = { suggested: 0, review: 0, confirmed: 0, rejected: 0 };
for (const t of merged.types) counts[t.status] = (counts[t.status] || 0) + 1;
console.error(`written: ${outPath}`);
console.error(`  types: ${merged.types.length} (suggested ${counts.suggested}, review ${counts.review}, confirmed ${counts.confirmed}, rejected ${counts.rejected})`);
console.error(`  review: ${reviewPath} (open in a spreadsheet: doubted entries first, then by frequency;`);
console.error('  fix a lemma or set the status, then run again with --import=...; your decisions survive re-runs.');
