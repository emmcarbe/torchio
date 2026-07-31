/**
 * Torchio laboratory — the editorial worlds, run as tests.
 *
 * A world is a coherent editorial theory delimited by examples. Each example
 * is a legitimate TEI fragment and a check on the model Torchio builds from it.
 * A check does not ask "did the page render"; it asks "does the model tell the
 * truth about the document" — what it must contain, and what it must not infer.
 *
 * An assertion that fails is not a broken build. It is a debt with a name:
 * either the engine infers more than the source attests (an over-reading, the
 * worse fault), or it does not yet model enough (an under-reading, an honest
 * gap). Both are reported; neither aborts. The exit code is 0 by design: this
 * is a measurement, read the ledger.
 *
 *   node worlds/run.js            all worlds
 *   node worlds/run.js genetic    worlds whose id contains "genetic"
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadBaseData, buildClassMap } from '../src/classes.js';
import { parseXML } from '../src/xml.js';
import { buildModel, walkModel, textOfModel } from '../src/model.js';
import { pressPage } from '../src/render.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const HEADER_MIN = `<titleStmt><title>world</title></titleStmt>`
  + `<publicationStmt><p>laboratory fixture</p></publicationStmt>`
  + `<sourceDesc><p>constructed</p></sourceDesc>`;

/** Wrap an example into a legitimate TEI document. Declared hands become
 *  handNotes in the profile; declared changes become a listChange in the
 *  revision. The example stays readable; the document stays valid. */
function wrap(ex) {
  const hands = (ex.hands || [])
    .map((h) => `<handNote xml:id="${h.id || h}">${h.label || ''}</handNote>`).join('');
  const profile = hands ? `<profileDesc><handNotes>${hands}</handNotes></profileDesc>` : '';
  const changes = (ex.changes || [])
    .map((c) => `<change xml:id="${c.id}"${c.when ? ` when="${c.when}"` : ''}>${c.label || ''}</change>`).join('');
  const revision = changes ? `<revisionDesc><listChange>${changes}</listChange></revisionDesc>` : '';
  return `<TEI xmlns="http://www.tei-c.org/ns/1.0">`
    + `<teiHeader><fileDesc>${HEADER_MIN}</fileDesc>${profile}${revision}</teiHeader>`
    + `<text><body>${ex.body}</body></text></TEI>`;
}

let CLASS_MAP = null;
async function build(ex) {
  if (!CLASS_MAP) CLASS_MAP = buildClassMap(null, await loadBaseData());
  return buildModel(parseXML(wrap(ex)), CLASS_MAP);
}

/** The helpers a check receives: enough to interrogate the model, no more. */
function helpers(model) {
  const nodes = [];
  for (const doc of model.documents) for (const n of walkModel(doc.tree)) nodes.push(n);
  const modelText = model.documents.map((d) => textOfModel(d.tree)).join(' ').replace(/\s+/g, ' ').trim();
  return {
    model,
    genetic: model.genetic || null,
    ops: model.genetic ? model.genetic.operations : [],
    nodes,
    find: (pred) => nodes.find(pred) || null,
    findAll: (pred) => nodes.filter(pred),
    text: (n) => textOfModel(n).replace(/\s+/g, ' ').trim(),
    modelText,
    has: (s) => modelText.includes(s),
    // a world may assert on the rendered page, not only the model: a
    // visualization choice (how a mention, a glyph, a reference is shown) is
    // a claim about the page, and the page is where it must hold
    render: () => { try { return pressPage(model); } catch (e) { return ''; } },
  };
}

const KIND_MARK = { positive: '＋', contrastive: '↔', 'inference-limit': '⊘' };

async function runWorld(mod) {
  const { meta, examples } = mod;
  const lines = [];
  let pass = 0; let over = 0; let under = 0;
  for (const ex of examples) {
    let assertions;
    try {
      const model = await build(ex);
      assertions = ex.check(model, helpers(model)) || [];
    } catch (err) {
      assertions = [{ ok: false, kind: 'engine', label: 'the example builds a model',
        detail: `${err.name}: ${err.message}` }];
    }
    lines.push(`  ${KIND_MARK[ex.kind] || '·'} ${ex.id}${ex.note ? ` — ${ex.note}` : ''}`);
    for (const a of assertions) {
      const debt = a.ok ? '' : (a.over ? '  [OVER-READING]' : '  [gap]');
      lines.push(`      ${a.ok ? '✓' : '✗'} ${a.label}${a.ok ? '' : (a.detail ? ` — ${a.detail}` : '')}${debt}`);
      if (a.ok) pass++; else if (a.over) over++; else under++;
    }
  }
  return { meta, lines, pass, over, under };
}

async function main() {
  const filter = process.argv[2] || '';
  const files = (await readdir(HERE)).filter((f) => f.endsWith('.world.js'));
  const worlds = [];
  for (const f of files) {
    const mod = await import(join(HERE, f));
    if (!mod.meta || !mod.examples) continue;
    if (filter && !mod.meta.id.includes(filter)) continue;
    worlds.push(mod);
  }
  worlds.sort((a, b) => a.meta.id.localeCompare(b.meta.id));

  let P = 0; let O = 0; let U = 0;
  const debts = [];
  console.log(`\nTorchio laboratory — ${worlds.length} editorial world(s)\n`);
  for (const mod of worlds) {
    const r = await runWorld(mod);
    console.log(`▶ ${r.meta.title}  (${r.meta.id})`);
    if (r.meta.tradition) console.log(`  tradition: ${r.meta.tradition}`);
    console.log(r.lines.join('\n'));
    console.log(`  ── ${r.pass} held, ${r.under} gap, ${r.over} over-reading\n`);
    P += r.pass; O += r.over; U += r.under;
  }
  console.log('─'.repeat(60));
  console.log(`held: ${P}   gaps: ${U}   over-readings: ${O}`);
  console.log(O > 0
    ? `\n${O} over-reading(s): the engine infers more than the source attests. `
      + `These are the faults that make a page lie, and they come first.`
    : `\nNo over-readings: where the engine falls short it under-models, it does not misread.`);
  console.log('');
}

/** The TEI Guidelines' own examples, pressed as the systematic base beneath the
 *  hand-written worlds: every <egXML> the specification gives, measured for
 *  coverage. Not contrastive like a world; the canon's authoritative witnesses,
 *  pressed to see what the engine does with them. Principle 3: examples are test
 *  cases, not the specification. The corpus is worlds/exempla-corpus.json,
 *  generated by tools/exempla.js from the official p5subset. */
async function pressExempla() {
  let corpus;
  try { corpus = JSON.parse(await readFile(join(HERE, 'exempla-corpus.json'), 'utf-8')); }
  catch { return null; }
  if (!CLASS_MAP) CLASS_MAP = buildClassMap(null, await loadBaseData());
  let completed = 0; let conserved = 0; let inferred = 0; const failed = [];
  for (const ex of corpus.examples) {
    const wrapped = /^<TEI[\s>]/.test(ex.xml) ? ex.xml
      : `<TEI xmlns="http://www.tei-c.org/ns/1.0">`
        + `<teiHeader><fileDesc>${HEADER_MIN}</fileDesc></teiHeader>`
        + `<text><body>${ex.xml || '<p/>'}</body></text></TEI>`;
    try {
      const model = buildModel(parseXML(wrapped), CLASS_MAP);
      completed++;
      let text = 0; let inf = 0;
      for (const doc of model.documents) {
        text += textOfModel(doc.tree).trim().length;
        for (const n of walkModel(doc.tree)) if (n.inferred) inf++;
      }
      const inLen = (ex.xml.match(/>[^<]+</g) || []).join('').replace(/[><]/g, '').trim().length;
      if (inLen > 0 && text >= inLen * 0.5) conserved++;
      if (inf > 0) inferred++;
    } catch { failed.push(ex.ident); }
  }
  return { total: corpus.examples.length, completed, conserved, inferred, failed, source: corpus.source };
}

async function main2() {
  await main();
  const ex = await pressExempla();
  if (ex) {
    console.log(`▶ The TEI Guidelines' own examples`);
    console.log(`  source: ${ex.source}`);
    console.log(`  ${ex.total} pressed · ${ex.completed} completed · ${ex.conserved} conserve their text`
      + ` · ${ex.failed.length} did not build · ${ex.inferred} drew an inference`);
    console.log(ex.inferred === 0
      ? `  no over-reading: the engine adds no inference to the canon's own examples\n`
      : `  ${ex.inferred} example(s) drew an inference: check they are not over-readings\n`);
  }
}

main2().catch((e) => { console.error(e); process.exit(0); });
