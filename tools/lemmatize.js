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
import { buildModel } from '../src/model.js';
import { collectTokens, conlluTypes, typesFromVotes, mergeLemmaTypes } from '../src/lemmas.js';

const UDPIPE = 'https://lindat.mff.cuni.cz/services/udpipe/api';
// language -> UDPipe model name prefix (resolved against the live model list)
const MODELS = {
  grc: 'ancient_greek-perseus', la: 'latin-ittb', it: 'italian-isdt',
  nl: 'dutch-alpino', fr: 'french-gsd', de: 'german-gsd', en: 'english-ewt',
  es: 'spanish-ancora', pt: 'portuguese-bosque',
};

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (name) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : null;
};
const [input] = args;
if (!input) {
  console.error('usage: node tools/lemmatize.js <edition.xml | folder> [--lang=xx] [--model=NAME] [--conllu=file] [--out=lemmas.json]');
  process.exit(1);
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
const formsInText = new Set(tokens.map((t) => t.form.toLowerCase()));
console.error(`tokens: ${tokens.length} (${formsInText.size} distinct forms)`);

// ---- suggestions: a local CoNLL-U, or UDPipe over REST ----
let conllu = '';
const conlluPath = opt('conllu');
if (conlluPath) {
  conllu = await readFile(conlluPath, 'utf-8');
  console.error(`conllu: ${conlluPath} (offline)`);
} else {
  const lang = opt('lang') || (model.meta.languages && model.meta.languages[0]) || '';
  let modelName = opt('model');
  if (!modelName) {
    const prefix = MODELS[lang.toLowerCase().split('-')[0]];
    if (!prefix) {
      console.error(`no UDPipe model known for language "${lang}": pass --model=NAME (list: ${UDPIPE}/models) or --conllu=file`);
      process.exit(1);
    }
    const list = await (await fetch(`${UDPIPE}/models`)).json();
    modelName = Object.keys(list.models).find((m) => m.startsWith(prefix));
    if (!modelName) { console.error(`no UDPipe model matches ${prefix}`); process.exit(1); }
  }
  console.error(`udpipe: ${modelName}`);
  const text = tokens.map((t) => t.form).join(' ');
  const CHUNK = 80000;
  for (let i = 0; i < text.length; i += CHUNK) {
    // cut on a space so no form is split across requests
    let end = Math.min(i + CHUNK, text.length);
    if (end < text.length) { const sp = text.lastIndexOf(' ', end); if (sp > i) end = sp; }
    const body = new URLSearchParams({
      model: modelName, tokenizer: '', tagger: '', data: text.slice(i, end),
    });
    const res = await fetch(`${UDPIPE}/process`, { method: 'POST', body });
    if (!res.ok) { console.error(`udpipe: HTTP ${res.status}`); process.exit(1); }
    conllu += (await res.json()).result;
    i = end - CHUNK; // the loop's += CHUNK resumes exactly at the cut
  }
}

// ---- aggregate, merge, write: the editor's decisions survive ----
const fresh = { types: typesFromVotes(conlluTypes(conllu), formsInText) };
const outPath = opt('out') || join(inputStat.isDirectory() ? input : dirname(input), 'lemmas.json');
let existing = null;
try { existing = JSON.parse(await readFile(outPath, 'utf-8')); } catch { /* first run */ }
const generator = conlluPath ? `conllu: ${conlluPath}` : `udpipe`;
const merged = mergeLemmaTypes(existing, fresh, generator);
await writeFile(outPath, JSON.stringify(merged, null, 2) + '\n');

const counts = { suggested: 0, review: 0, confirmed: 0, rejected: 0 };
for (const t of merged.types) counts[t.status] = (counts[t.status] || 0) + 1;
console.error(`written: ${outPath}`);
console.error(`  types: ${merged.types.length} (suggested ${counts.suggested}, review ${counts.review}, confirmed ${counts.confirmed}, rejected ${counts.rejected})`);
console.error('  review the file: confirm, correct or reject; your decisions survive re-runs.');
