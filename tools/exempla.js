/**
 * The TEI Guidelines' own examples, pressed as tests.
 *
 * The Guidelines document each element and attribute with <exemplum> fragments:
 * these are the specification's own authoritative witnesses of what a construct
 * looks like. This tool extracts every <egXML> from a p5subset.xml, presses
 * each through Torchio, and writes a capability ledger — element by element,
 * what the engine did with the canon's own cases.
 *
 * This stays inside principle 3: the examples are TEST CASES, never the
 * specification. Behaviour comes from the class system; here it is only
 * measured against the specification's examples.
 *
 *   node tools/exempla.js <p5subset.xml> [--out worlds/exempla-ledger.json]
 *   node tools/exempla.js --self-test        # prove the pipeline, no download
 *
 * The p5subset.xml is not shipped (30 MB). It is the official, licensed source
 * the class map already derives from: TEI Consortium, CC BY / BSD, at
 * https://tei-c.org/Vault/P5/current/xml/tei/odd/p5subset.xml
 */
import { parseXML, local } from '../src/xml.js';
import { loadBaseData, buildClassMap } from '../src/classes.js';
import { buildModel, walkModel, textOfModel } from '../src/model.js';

const TEI_NS = 'http://www.tei-c.org/ns/1.0';

/** Serialize a parsed node's children back to XML, dropping namespace prefixes
 *  and xmlns declarations so the fragment inherits the wrapper's TEI namespace.
 *  egXML content lives in the Examples namespace; stripped, its TEI elements
 *  resolve as themselves. */
function serialize(node) {
  if (typeof node === 'string') return escapeText(node);
  const name = local(node.name);
  const atts = Object.entries(node.attrs || {})
    .filter(([k]) => k !== 'xmlns' && !k.startsWith('xmlns:'))
    .map(([k, v]) => ` ${local(k) === k ? k : local(k)}="${escapeAttr(v)}"`).join('');
  const kids = (node.children || []).map(serialize).join('');
  return kids ? `<${name}${atts}>${kids}</${name}>` : `<${name}${atts}/>`;
}
const serializeInner = (node) => (node.children || []).map(serialize).join('');
const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => escapeText(s).replace(/"/g, '&quot;');

/** Walk a parsed tree, carrying the nearest documenting spec's ident, and
 *  collect every egXML with the element/class/macro it illustrates. */
function collect(node, spec, out) {
  if (typeof node === 'string') return;
  const ln = local(node.name);
  if (ln === 'elementSpec' || ln === 'classSpec' || ln === 'macroSpec') {
    spec = { kind: ln, ident: (node.attrs && node.attrs.ident) || '?' };
  }
  if (ln === 'egXML') {
    out.push({ spec, xml: serializeInner(node).trim() });
    return; // do not descend into an example looking for nested specs
  }
  for (const c of node.children || []) collect(c, spec, out);
}

export function extractExempla(xmlText) {
  const tree = parseXML(xmlText);
  const out = [];
  collect(tree, null, out);
  return out.filter((e) => e.xml);
}

const HEADER = '<teiHeader><fileDesc><titleStmt><title>exemplum</title></titleStmt>'
  + '<publicationStmt><p>TEI Guidelines example, pressed as a test</p></publicationStmt>'
  + '<sourceDesc><p>p5subset</p></sourceDesc></fileDesc></teiHeader>';

/** Wrap a fragment into a document Torchio can press. A full <TEI> example is
 *  pressed as-is; a fragment is placed in a minimal body. */
function wrap(xml) {
  if (/^<TEI[\s>]/.test(xml)) {
    return xml.includes('xmlns') ? xml
      : xml.replace(/^<TEI/, `<TEI xmlns="${TEI_NS}"`);
  }
  return `<TEI xmlns="${TEI_NS}">${HEADER}<text><body>${xml || '<p/>'}</body></text></TEI>`;
}

/** Press one exemplum and report what the engine did with it. */
export function pressOne(ex, classMap) {
  const row = { ident: ex.spec ? ex.spec.ident : '?', kind: ex.spec ? ex.spec.kind : '?',
    completed: false, textIn: (ex.xml.match(/>[^<]+</g) || []).join('').replace(/[><]/g, '').trim().length,
    textOut: 0, elements: 0, foreign: 0, inferred: 0, sections: {}, error: null };
  try {
    const model = buildModel(parseXML(wrap(ex.xml)), classMap);
    row.completed = true;
    for (const doc of model.documents) {
      row.textOut += textOfModel(doc.tree).replace(/\s+/g, ' ').trim().length;
      for (const n of walkModel(doc.tree)) {
        if (!n.element) continue;
        row.elements++;
        if (n.foreign) row.foreign++;
        if (n.inferred) row.inferred++;
        if (n.section) row.sections[n.section] = (row.sections[n.section] || 0) + 1;
      }
    }
  } catch (err) {
    row.error = `${err.name}: ${err.message}`;
  }
  return row;
}

export function summarize(rows) {
  const completed = rows.filter((r) => r.completed).length;
  const conserved = rows.filter((r) => r.completed && r.textIn > 0 && r.textOut >= r.textIn * 0.5).length;
  const withForeign = rows.filter((r) => r.foreign > 0).length;
  const withInferred = rows.filter((r) => r.inferred > 0).length;
  const failed = rows.filter((r) => !r.completed);
  return { total: rows.length, completed, conserved, withForeign, withInferred,
    failed: failed.map((r) => ({ ident: r.ident, error: r.error })) };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) return selfTest();
  const path = args.find((a) => !a.startsWith('--'));
  if (!path) {
    console.error('usage: node tools/exempla.js <p5subset.xml> [--out ledger.json]');
    console.error('   or: node tools/exempla.js --self-test');
    process.exit(2);
  }
  const { readFile, writeFile } = await import('node:fs/promises');
  const xml = await readFile(path, 'utf-8');
  const classMap = buildClassMap(null, await loadBaseData());
  const exempla = extractExempla(xml);
  const rows = exempla.map((e) => pressOne(e, classMap));
  const summary = summarize(rows);
  console.log(`\nTEI Guidelines exempla pressed: ${summary.total}`);
  console.log(`  completed:        ${summary.completed}/${summary.total}`);
  console.log(`  text conserved:   ${summary.conserved}`);
  console.log(`  with foreign ns:  ${summary.withForeign}`);
  console.log(`  with inference:   ${summary.withInferred}`);
  console.log(`  did not build:    ${summary.failed.length}`);
  const outIdx = args.indexOf('--out');
  if (outIdx >= 0 && args[outIdx + 1]) {
    await writeFile(args[outIdx + 1], JSON.stringify({ summary, rows }, null, 2));
    console.log(`\nledger → ${args[outIdx + 1]}`);
  }
  console.log('');
}

/** Prove the pipeline on a p5subset-shaped sample, so the only step the real
 *  run adds is the download. */
async function selfTest() {
  const sample = `<?xml version="1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <elementSpec ident="add">
    <desc>marks an addition</desc>
    <exemplum><egXML xmlns="http://www.tei-c.org/ns/Examples">
      <p>Nel testo <add place="above">parola</add> aggiunta.</p>
    </egXML></exemplum>
  </elementSpec>
  <elementSpec ident="choice">
    <exemplum><egXML xmlns="http://www.tei-c.org/ns/Examples">
      <choice><sic>teh</sic><corr>the</corr></choice>
    </egXML></exemplum>
  </elementSpec>
  <classSpec ident="model.pPart.edit" type="model">
    <exemplum><egXML xmlns="http://www.tei-c.org/ns/Examples">
      <subst><del>casa</del><add>dimora</add></subst>
    </egXML></exemplum>
  </classSpec>
</TEI>`;
  const exempla = extractExempla(sample);
  console.log(`\nself-test: extracted ${exempla.length} exempla`);
  const classMap = buildClassMap(null, await loadBaseData());
  const rows = exempla.map((e) => pressOne(e, classMap));
  for (const r of rows) {
    console.log(`  ${r.completed ? '✓' : '✗'} ${r.kind} ${r.ident}`
      + ` — in ${r.textIn} / out ${r.textOut} chars, ${r.elements} elements`
      + (r.error ? ` — ${r.error}` : ''));
  }
  const s = summarize(rows);
  console.log(`\nsummary: ${s.completed}/${s.total} completed, ${s.conserved} conserved text`);
  const ok = exempla.length === 3 && s.completed === 3 && s.conserved === 3;
  console.log(ok ? '\nself-test PASSED — ready to run against a real p5subset.xml\n'
    : '\nself-test FAILED\n');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
