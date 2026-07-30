/**
 * Torchio test suite. Plain asserts, zero dependencies.
 *
 * The coverage test is the project's constitutional guarantee: every element
 * of the current TEI P5 release must resolve to a behaviour section or, at
 * worst, to the explicit base fallback — and the number of fallback elements
 * in plain P5 must be zero.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseXML, walk, local, textOf, decodeEntities, inTEINamespace } from '../src/xml.js';
import { loadBaseData, buildClassMap } from '../src/classes.js';
import { parseODD } from '../src/odd.js';
import { analyze } from '../src/analyze.js';
import { resolveIncludes } from '../src/xinclude.js';
import { buildModel, walkModel, textOfModel } from '../src/model.js';
import { renderBase, pressPage } from '../src/render.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed++;
  console.log(`  ✓ ${label}`);
}

console.log('xml.js');
{
  const doc = parseXML(`<?xml version="1.0"?><!DOCTYPE TEI [<!ENTITY x "y">]>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text xml:id="t1"><body><p n="1">Ciao <persName ref="#goethe">Goethe</persName> &amp; co. &#8212; fine.</p>
  <p/><!-- comment --><![CDATA[<raw>]]></body></text></TEI>`);
  ok(doc.name === 'TEI', 'root element parsed');
  const names = [...walk(doc)].map((n) => local(n.name));
  ok(names.includes('persName'), 'nested elements found');
  const p = [...walk(doc)].find((n) => n.attrs.n === '1');
  ok(textOf(p).includes('& co.') && textOf(p).includes('—'), 'entities decoded in text');
  const pers = [...walk(doc)].find((n) => local(n.name) === 'persName');
  ok(pers.attrs.ref === '#goethe', 'attributes parsed');
  ok(decodeEntities('&lt;x&gt;') === '<x>', 'decodeEntities works standalone');
  let threw = false;
  try { parseXML('<a><b></a>'); } catch { threw = true; }
  ok(threw, 'malformed XML throws (degradation is the caller’s job)');
}

console.log('classes.js — plain P5');
const data = await loadBaseData();
{
  const map = buildClassMap(null, data);
  ok(map.resolve('persName').section === '2-entita', 'persName -> 2-entita');
  ok(map.resolve('app').section === '4-apparato', 'app -> 4-apparato');
  ok(map.resolve('del').section === '3-trascrizionale', 'del -> 3-trascrizionale');
  ok(map.resolve('titlePage').section === '1-paratesti', 'titlePage -> 1-paratesti (correction C4)');
  ok(map.resolve('boiadibuio').section === 'base', 'unknown element -> base, never fails');

  // The constitutional test: full P5 coverage, zero fallbacks.
  let fallbacks = [];
  for (const name of Object.keys(data.p5.elements)) {
    const r = map.resolve(name);
    if (r.via === 'fallback') fallbacks.push(name);
  }
  ok(fallbacks.length === 0,
    `full P5 coverage: ${Object.keys(data.p5.elements).length} elements, 0 fallbacks (${data.p5.version.split('.').slice(0, 2).join('.')})`);
}

console.log('odd.js — the ODD decides');
{
  const oddSrc = await readFile(new URL('./fixtures/custom.odd.xml', import.meta.url), 'utf-8');
  const odd = parseODD(oddSrc);
  ok(odd.includedModules.has('namesdates'), 'moduleRef read');
  ok(odd.deletedElements.has('table') && odd.deletedElements.has('said'),
    'deletions read (mode="delete" and @except)');
  ok(odd.customElements.some((e) => e.ident === 'salvataggio'), 'custom element read');

  const map = buildClassMap(odd, data);
  ok(map.resolve('salvataggio').section === '3-trascrizionale',
    'legitimate extension inherits behaviour via memberOf (D0.3): salvataggio -> 3-trascrizionale');
  ok(map.resolve('softwareName').section === '2-entita',
    'legitimate extension inherits: softwareName -> 2-entita');
  ok(map.resolve('persName').section === '2-entita', 'P5 elements still resolve under ODD');
}

console.log('analyze.js');
{
  const map = buildClassMap(null, data);
  const doc = parseXML(`<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc/></teiHeader>
    <text><body><p>Vide <persName>Kurtz</persName> presso <placeName>il fiume</placeName>
    <app><lem>orrore</lem><rdg wit="#B">errore</rdg></app>.</p></body></text></TEI>`);
  const report = analyze(doc, map);
  ok(report.distinctElements === 11, 'inventory counts distinct elements');
  const secs = new Map(report.sections);
  ok(secs.has('2-entita') && secs.has('4-apparato'), 'sections detected: entities and apparatus');
  ok(report.fallback.length === 0, 'no fallbacks on plain TEI');
}

console.log('xml.js — C13: TEI namespace roots');
{
  const surf = parseXML('<surface xmlns="http://www.tei-c.org/ns/1.0" n="3r"><zone/></surface>');
  ok(inTEINamespace(surf), 'root <surface> in TEI namespace accepted (C13)');
  const pref = parseXML('<tei:TEI xmlns:tei="http://www.tei-c.org/ns/1.0"><tei:text/></tei:TEI>');
  ok(inTEINamespace(pref), 'prefixed TEI root recognized');
  const other = parseXML('<html xmlns="http://www.w3.org/1999/xhtml"/>');
  ok(!inTEINamespace(other), 'non-TEI namespace rejected');
}

console.log('xinclude.js — C12');
{
  const main = parseXML(`<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
    <include xmlns="http://www.w3.org/2001/XInclude" href="include-part.xml"/>
    <include xmlns="http://www.w3.org/2001/XInclude" href="missing.xml"/>
  </body></text></TEI>`);
  const loader = async (href) =>
    readFile(new URL(`./fixtures/${href}`, import.meta.url), 'utf-8');
  const { resolved, unresolved } = await resolveIncludes(main, loader);
  ok(resolved === 1, 'xi:include resolved and spliced in');
  ok([...walk(main)].some((n) => local(n.name) === 'p'), 'included content is in the tree');
  ok(unresolved.length === 1 && unresolved[0].href === 'missing.xml',
    'missing include degrades gracefully and is reported');
}

console.log('model.js — D1..D5');
const FIXTURE = `<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader><fileDesc>
    <titleStmt><title>Prova di stampa</title><author>E. C.</author></titleStmt>
    <publicationStmt><availability><licence target="https://creativecommons.org/licenses/by/4.0/">CC BY</licence></availability></publicationStmt>
    <sourceDesc><listWit><witness xml:id="A">Codice A</witness><witness xml:id="B">Codice B</witness></listWit></sourceDesc>
  </fileDesc>
  <profileDesc><particDesc><listPerson>
    <person xml:id="kurtz"><persName>Kurtz</persName></person>
  </listPerson></particDesc></profileDesc>
  </teiHeader>
  <text><body><p>Disse <persName ref="#kurtz">Kurtz</persName>:
  <app><lem wit="#A">l'orrore</lem><rdg wit="#B">l'errore</rdg></app>.</p></body></text></TEI>`;
{
  const map = buildClassMap(null, data);
  const model = buildModel(parseXML(FIXTURE), map);
  ok(model.meta.title === 'Prova di stampa', 'meta: title extracted');
  ok(model.meta.licence.target.includes('creativecommons'), 'meta: licence extracted');
  ok(model.registries.people.length === 1 && model.registries.people[0].label === 'Kurtz',
    'D4: person registry extracted with label');
  ok(model.registries.people[0].occurrences.length === 1,
    'D4: occurrences resolved via @ref');
  ok(model.registries.witnesses.length === 2, 'D4: witnesses extracted');
  ok(model.apparatus.length === 1 && model.apparatus[0].entries[0].readings.length === 2,
    'D5: apparatus register with lemma and reading');
  ok(model.apparatus[0].entries[0].readings.some((r) => r.witnesses.includes('B')),
    'D5: reading carries its witnesses');
  const model2 = buildModel(parseXML(FIXTURE), map);
  ok(JSON.stringify(model) === JSON.stringify(model2),
    'D1: deterministic — same XML, same model, byte for byte');
  const nodes = [...walkModel(model.documents[0].tree)];
  ok(nodes.every((n) => n.id && n.element && n.section), 'D2: every node has id, element, section');
}

console.log('render.js — rung 1');
{
  const map = buildClassMap(null, data);
  const model = buildModel(parseXML(FIXTURE), map);
  const html = renderBase(model.documents[0].tree);
  ok(html.includes('Kurtz') && html.includes('l&#39;orrore') || html.includes("l'orrore"),
    'rendered text present');
  ok(html.includes('data-el="persName"'), 'elements tagged in output');
  const page = pressPage(model);
  ok(page.startsWith('<!DOCTYPE html>') && page.includes('Prova di stampa'),
    'pressPage produces a complete page with the edition title');
  ok(page.includes('Published with') && page.includes('Torchio'), 'provenance footer present');
}

console.log('interact.js — first intelligent pieces');
{
  const map = buildClassMap(null, data);
  const model = buildModel(parseXML(FIXTURE), map);
  const html = renderBase(model.documents[0].tree);
  ok(html.includes('data-wit="#B"'), 'readings carry data-wit for the popup');
  ok(html.includes('data-ref="#kurtz"'), 'names carry data-ref for the entity card');
  const page = pressPage(model);
  ok(page.includes('torchio-bar') && page.includes('data-sw="app"'),
    'toolbar present with apparatus switch (markup-driven)');
  ok(page.includes('torchio-pop'), 'popup machinery shipped inline');
  const noApp = buildModel(parseXML('<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>solo testo</p></body></text></TEI>'), map);
  const plainPage = pressPage(noApp);
  ok(!plainPage.includes('data-sw="app"') && !plainPage.includes('data-mode="dipl"'),
    'toolbar controls appear only when the markup activates them');
}

console.log('site.js — the edition is a site, not a page');
{
  const { pressSite } = await import('../src/site.js');
  const map = buildClassMap(null, data);
  const model = buildModel(parseXML(FIXTURE), map);
  const files = pressSite(model);
  ok('index.html' in files && 'text.html' in files && 'indices.html' in files,
    'three pages pressed: edition, text, indices');
  ok(files['index.html'].includes('Witnesses') && files['index.html'].includes('Codice A'),
    'index.html: the header as a page (witnesses listed)');
  ok(files['text.html'].includes('t-teiHeader') && files['text.html'].includes('.t-teiHeader{display:none}'),
    'text.html: header present in the DOM but hidden (the toolbar toggle has something to show)');
  ok(files['indices.html'].includes('Kurtz') && files['indices.html'].includes('text.html#'),
    'indices.html: entities with links into the text');
  const plain = buildModel(parseXML('<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>solo testo</p></body></text></TEI>'), map);
  ok(!('indices.html' in pressSite(plain)), 'indices page only when registries are populated');
}

console.log('manifest.js + exports — composition level one, data page');
{
  const { pressSite } = await import('../src/site.js');
  const map = buildClassMap(null, data);
  const model = buildModel(parseXML(FIXTURE), map);

  const files = pressSite(model, { sourceXML: FIXTURE });
  ok('data.html' in files && 'data/model.json' in files && 'data/entities.csv' in files
    && 'data/apparatus.csv' in files && 'data/source.xml' in files,
    'level zero: data page and exports derived automatically');
  ok(files['data/entities.csv'].includes('person,kurtz,Kurtz,1'),
    'entities.csv: flattened registry rows');
  ok(files['data/apparatus.csv'].includes("l'errore") && files['data/apparatus.csv'].includes('B'),
    'apparatus.csv: one row per reading with witnesses');
  ok(JSON.parse(files['data/model.json']).meta.title === 'Prova di stampa',
    'model.json is the model itself');

  const withManifest = pressSite(model, {
    sourceXML: FIXTURE,
    manifest: {
      title: 'Il foglio di prova',
      pages: [
        { id: 'text', label: 'Testo' },
        { id: 'index', label: 'Edizione' },
        { id: 'nonsense', label: 'X' },
      ],
      pieces: { apparatus: false },
      exports: false,
    },
  });
  ok(withManifest['index.html'].includes('Il foglio di prova'), 'manifest: title override');
  ok(withManifest['text.html'].includes('>Testo<') && withManifest['index.html'].includes('>Edizione<'),
    'manifest: page labels and order');
  ok(!('indices.html' in withManifest) && !('data.html' in withManifest),
    'manifest: pages not listed (or exports off) are not pressed');
  ok(!withManifest['text.html'].includes('data-sw="app"')
    && withManifest['text.html'].includes('app-off'),
    'manifest: apparatus piece disabled, base rendering untouched');
}

console.log('accessibility — a guarantee, not a finish');
{
  const { pressSite } = await import('../src/site.js');
  const map = buildClassMap(null, data);
  const model = buildModel(parseXML(FIXTURE), map);
  const files = pressSite(model, { sourceXML: FIXTURE });

  ok(files['text.html'].includes('class="skip"') && files['text.html'].includes('id="main"'),
    'skip link and main landmark on every page');
  ok(files['text.html'].includes('makeTrigger') && files['text.html'].includes("'tabindex','0'"),
    'apparatus and entity triggers are keyboard-focusable');
  ok(files['text.html'].includes("'role','dialog'") && files['text.html'].includes('aria-expanded'),
    'popup is a dialog with expanded state on the trigger');
  ok(files['text.html'].includes('aria-pressed'), 'toolbar toggles expose aria-pressed');

  // WCAG contrast, computed from every theme's own tokens.
  const { THEMES } = await import('../src/themes.js');
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  for (const [themeName, theme] of Object.entries(THEMES)) {
    const v = theme.vars;
    for (const name of ['ink', 'soft', 'accent', 'link']) {
      const r = ratio(v[name], v.ground);
      ok(r >= 4.5, `theme ${themeName}: contrast --${name} on ground ${r.toFixed(2)}:1 (AA >= 4.5)`);
    }
  }
}

console.log('i18n — chrome in Italian or English');
{
  const { pressSite } = await import('../src/site.js');
  const map = buildClassMap(null, data);
  const model = buildModel(parseXML(FIXTURE), map);

  const it = pressSite(model, { sourceXML: FIXTURE, manifest: { lang: 'it' } });
  ok(it['text.html'].includes('>Apparato</button>') && it['text.html'].includes('Scheda del file'),
    'lang it: toolbar in Italian (markup-driven controls only)');
  ok(it['index.html'].includes('Testimoni') && it['index.html'].includes('Pubblicato con'),
    'lang it: labels and footer in Italian');
  ok(it['text.html'].includes('lang="it"'), 'lang it: html lang attribute');

  const en = pressSite(model, { sourceXML: FIXTURE });
  ok(en['text.html'].includes('>Apparatus</button>') && en['index.html'].includes('Witnesses'),
    'default: English chrome');
}

console.log('themes, map, simple pages — the template choice');
{
  const { pressSite } = await import('../src/site.js');
  const { markdown } = await import('../src/md.js');
  const map = buildClassMap(null, data);

  const model = buildModel(parseXML(FIXTURE), map);
  const perg = pressSite(model, { manifest: { theme: 'pergamena' } });
  ok(perg['index.html'].includes('--ground:#FBF9F6'), 'manifest theme: pergamena tokens applied');
  const savi = pressSite(model, {});
  ok(savi['index.html'].includes('--ground:#FFFFFF'), 'default theme: savi');

  const GEOFIX = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc>
    <titleStmt><title>Luoghi</title></titleStmt><publicationStmt><p/></publicationStmt>
    <sourceDesc><p/></sourceDesc></fileDesc>
    <profileDesc><settingDesc><listPlace>
      <place xml:id="ve"><placeName>Venezia</placeName><location><geo>45.4371 12.3326</geo></location></place>
      <place xml:id="pi"><placeName>Pisa</placeName><location><geo>43.7160 10.3966</geo></location></place>
    </listPlace></settingDesc></profileDesc></teiHeader>
    <text><body><p>Da <placeName ref="#ve">Venezia</placeName> a <placeName ref="#pi">Pisa</placeName>.</p></body></text></TEI>`;
  const geoModel = buildModel(parseXML(GEOFIX), map);
  const geoSite = pressSite(geoModel, {});
  ok('map.html' in geoSite, 'map page appears when geo coordinates exist');
  ok(geoSite['map.html'].includes('<svg') && geoSite['map.html'].includes('Venezia')
    && geoSite['map.html'].includes('openstreetmap.org'),
    'map: dependency-free SVG with labelled places and OSM links');
  ok(!('map.html' in pressSite(model, {})), 'no coordinates, no map page');

  const html = markdown('# Il progetto\n\nUna *prova* con [link](https://example.org).\n\n- uno\n- due');
  ok(html.includes('<h2 class="sec">Il progetto</h2>') && html.includes('<em>prova</em>')
    && html.includes('<li>uno</li>'), 'markdown: headings, emphasis, lists');
  ok(!markdown('<script>alert(1)</script>').includes('<script>'), 'markdown: input is escaped');

  const withExtra = pressSite(model, {
    manifest: { extra: [{ id: 'progetto', label: 'Il progetto', file: 'progetto.md' }] },
    extraPages: [{ id: 'progetto', label: 'Il progetto', html: '<p>ciao</p>' }],
  });
  ok('progetto.html' in withExtra && withExtra['progetto.html'].includes('<p>ciao</p>'),
    'simple page pressed with its content');
  ok(withExtra['index.html'].includes('progetto.html') && withExtra['index.html'].includes('Il progetto'),
    'simple page in the navigation of every page');
}

console.log('reconcile.js — entities, not just places');
{
  const { harvest, reconcile, applyReconciliation } = await import('../src/reconcile.js');
  const { pressSite } = await import('../src/site.js');
  const map = buildClassMap(null, data);
  const RECFIX = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc>
    <titleStmt><title>Riconciliazione</title></titleStmt><publicationStmt><p/></publicationStmt>
    <sourceDesc><msDesc><msIdentifier>
      <settlement>Vercelli</settlement>
      <institution>Biblioteca Capitolare</institution>
    </msIdentifier></msDesc></sourceDesc></fileDesc>
    <profileDesc><particDesc><listPerson>
      <person xml:id="kurtz"><persName>Kurtz</persName></person>
    </listPerson></particDesc></profileDesc></teiHeader>
    <text><body><p>Da <placeName>Venezia</placeName> scrisse a
    <persName ref="#kurtz">Kurtz</persName> della <orgName>Compagnia</orgName>.</p></body></text></TEI>`;
  const model = buildModel(parseXML(RECFIX), map);

  const h = harvest(model);
  ok(h.place.some((p) => p.key === 'venezia') && h.place.some((p) => p.key === 'vercelli'),
    'harvest: placeName and settlement both anchor places (class-wide, not tag-narrow)');
  ok(h.org.some((o) => o.key === 'biblioteca capitolare') && h.org.some((o) => o.key === 'compagnia'),
    'harvest: institutions and orgName are organisations');
  ok(h.person.some((p) => p.key === 'kurtz'), 'harvest: registry people without authority ids');

  const gaz = { venezia: [['Venezia', 45.4371, 12.3326, 'IT', 260000, 3164603]] };
  const { entities, stats } = reconcile(model, { gazetteer: gaz });
  ok(entities.place.venezia.status === 'suggested' && entities.place.venezia.lat === 45.4371,
    'reconcile: gazetteer hit becomes a suggestion with coordinates');
  ok(entities.place.vercelli.status === 'missing',
    'reconcile: no hit, the editor fills it in');
  ok(entities.person.kurtz.status === 'missing' && 'viaf' in entities.person.kurtz,
    'reconcile: people prepared for authority ids');

  const prev = { place: { vercelli: { label: 'Vercelli', status: 'confirmed', lat: 45.3206, lon: 8.4185, source: 'editor' } } };
  const second = reconcile(model, { gazetteer: gaz }, prev);
  ok(second.entities.place.vercelli.status === 'confirmed' && second.entities.place.vercelli.lat === 45.3206,
    'reconcile: editor decisions survive re-runs');

  second.entities.person.kurtz = { label: 'Kurtz', status: 'confirmed', viaf: '12345' };
  applyReconciliation(model, second.entities);
  ok(model.registries.places.some((p) => p.label === 'Venezia' && p.geo && p.geoSource === 'geonames'),
    'apply: suggested place enters the registry with provenance');
  ok(model.registries.places.some((p) => p.label === 'Vercelli' && p.geoSource === 'editor'),
    'apply: confirmed place carries editor provenance');
  ok(model.registries.people[0].authorities?.includes('viaf:12345'),
    'apply: authority ids reach the registry entry');
  const site2 = pressSite(model, {});
  ok('map.html' in site2 && site2['map.html'].includes('Venezia'),
    'reconciled places feed the map page');
}

console.log('collections — the register of anything');
{
  const { pressSite } = await import('../src/site.js');
  const map = buildClassMap(null, data);
  const CORPFIX = `<teiCorpus xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader><fileDesc><titleStmt><title>Carteggio di prova</title></titleStmt>
    <publicationStmt><p/></publicationStmt><sourceDesc><p/></sourceDesc></fileDesc></teiHeader>
  <TEI xml:id="l1"><teiHeader><fileDesc>
      <titleStmt><title>Lettera prima</title></titleStmt><publicationStmt><p/></publicationStmt><sourceDesc><p/></sourceDesc></fileDesc>
      <profileDesc><correspDesc>
        <correspAction type="sent"><persName>Anna</persName><placeName>Venezia</placeName><date when="1850-01-02">2 gennaio 1850</date></correspAction>
        <correspAction type="received"><persName>Bruno</persName></correspAction>
      </correspDesc></profileDesc></teiHeader>
    <text><body><p>Caro Bruno.</p></body></text></TEI>
  <TEI xml:id="l2"><teiHeader><fileDesc>
      <titleStmt><title>Lettera seconda</title></titleStmt><publicationStmt><p/></publicationStmt><sourceDesc><p/></sourceDesc></fileDesc>
      <profileDesc><correspDesc>
        <correspAction type="sent"><persName>Bruno</persName><date when="1850-02-10">10 febbraio 1850</date></correspAction>
        <correspAction type="received"><persName>Anna</persName></correspAction>
      </correspDesc></profileDesc></teiHeader>
    <text><body><p>Cara Anna.</p></body></text></TEI>
  </teiCorpus>`;
  const model = buildModel(parseXML(CORPFIX), map);
  ok(model.documents.length === 2, 'teiCorpus split into documents');
  ok(model.meta.title === 'Carteggio di prova', 'corpus header is the edition meta');
  const c1 = model.documents[0].card;
  ok(c1.from.includes('Anna') && c1.to.includes('Bruno') && c1.date.when === '1850-01-02'
    && c1.place === 'Venezia', 'card: from, to, date, place from correspDesc');

  const files = pressSite(model, {});
  ok(files['text.html'].includes('<table class="reg-table') && files['text.html'].includes('doc-l1.html'),
    'collection: text.html is a register with links');
  ok(files['text.html'].includes('Mittente') === false && files['text.html'].includes('From'),
    'register columns localized (en default) and only when populated');
  ok('doc-l1.html' in files && 'doc-l2.html' in files, 'one page per document');
  ok(files['doc-l1.html'].includes('doc-l2.html') && files['doc-l2.html'].includes('doc-l1.html'),
    'prev/next navigation between documents');
  ok(files['index.html'].includes('header-full'),
    'the full header rendered on the edition page (curation above, completeness below)');

  const single = buildModel(parseXML(FIXTURE), map);
  const sf = pressSite(single, {});
  ok(!sf['text.html'].includes('<table class="reg-table'), 'single document: no register, plain text page');
  ok(sf['index.html'].includes('header-full'), 'full header also on single-document editions');
}

console.log('zip.js — the archive of path A');
{
  const { crc32, buildZip } = await import('../src/zip.js');
  const vector = new TextEncoder().encode('123456789');
  ok(crc32(vector) === 0xCBF43926, 'crc32 matches the reference vector');

  const zip = buildZip({ 'index.html': '<p>ciao</p>', 'data/model.json': '{}' });
  ok(zip[0] === 0x50 && zip[1] === 0x4B && zip[2] === 3 && zip[3] === 4,
    'archive starts with a local file header');
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  // end of central directory: signature + entry count
  let eocd = -1;
  for (let i = zip.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054B50) { eocd = i; break; }
  }
  ok(eocd >= 0 && view.getUint16(eocd + 10, true) === 2,
    'end record found, two entries declared');
  // first entry: name and stored content readable back
  const nameLen = view.getUint16(26, true);
  const extraLen = view.getUint16(28, true);
  const name = new TextDecoder().decode(zip.slice(30, 30 + nameLen));
  const size = view.getUint32(22, true);
  const content = new TextDecoder().decode(
    zip.slice(30 + nameLen + extraLen, 30 + nameLen + extraLen + size));
  ok(name === 'index.html' && content === '<p>ciao</p>',
    'stored entry readable back, content intact');
  const again = buildZip({ 'index.html': '<p>ciao</p>', 'data/model.json': '{}' });
  ok(zip.length === again.length && zip.every((b, i) => b === again[i]),
    'same input, same archive, byte for byte (D1 for path A)');
}

console.log('path A — the press in the browser');
{
  const { execFileSync } = await import('node:child_process');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const built = join(tmpdir(), `torchio-press-test-${process.pid}.html`);
  execFileSync(process.execPath, [new URL('../tools/build-browser.js', import.meta.url).pathname, built]);
  const page = await readFile(built, 'utf-8');
  ok(page.includes('<title>Torchio · the press</title>'), 'the page is built');
  ok(!page.includes("from 'node:"), 'no Node import survives in the page');

  // the engine inside the page must press exactly like the modular engine
  const start = page.indexOf('/* ==== torchio engine');
  const end = page.indexOf('/* ==== torchio harness');
  ok(start > 0 && end > start, 'engine and harness markers present');
  const engineText = page.slice(start, end);
  const sandbox = new Function(
    engineText
    + '\nreturn { buildClassMap, buildModel, pressSite, buildZip, TORCHIO_BASE_DATA };')();
  ok(Object.keys(sandbox.TORCHIO_BASE_DATA.p5.elements).length > 500,
    'base data embedded in the page');

  const specimenXML = await readFile(new URL('../demo-src/specimen/specimen.xml', import.meta.url), 'utf-8');
  const specimenManifest = JSON.parse(
    await readFile(new URL('../demo-src/specimen/torchio.json', import.meta.url), 'utf-8'));

  const modularMap = buildClassMap(null, data);
  const modularModel = buildModel(parseXML(specimenXML), modularMap);
  const { pressSite } = await import('../src/site.js');
  const modularFiles = pressSite(modularModel, { manifest: specimenManifest, sourceXML: specimenXML });

  const bundledMap = sandbox.buildClassMap(null, sandbox.TORCHIO_BASE_DATA);
  const bundledModel = sandbox.buildModel(parseXML(specimenXML), bundledMap);
  const bundledFiles = sandbox.pressSite(bundledModel, { manifest: specimenManifest, sourceXML: specimenXML });

  ok(Object.keys(bundledFiles).join(',') === Object.keys(modularFiles).join(','),
    'bundled engine presses the same pages as the modular engine');
  ok(Object.entries(modularFiles).every(([n, c]) => bundledFiles[n] === c),
    'every page byte-identical between browser bundle and modular engine');
}

console.log('editionStmt — the version of the edition, declared in the TEI');
{
  const map = buildClassMap(null, data);
  const src = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc>
    <titleStmt><title>Prova</title></titleStmt>
    <editionStmt><edition n="2">Seconda edizione, riveduta</edition></editionStmt>
    <publicationStmt><p/></publicationStmt><sourceDesc><p/></sourceDesc>
  </fileDesc></teiHeader><text><body><p>Testo.</p></body></text></TEI>`;
  const model = buildModel(parseXML(src), map);
  ok(model.meta.edition.n === '2' && model.meta.edition.text.includes('Seconda edizione'),
    'editionStmt read: version number and statement');
  const { pressSite } = await import('../src/site.js');
  const files = pressSite(model, {});
  ok(files['index.html'].includes('Seconda edizione, riveduta'),
    'the version appears on the edition page (with revisionDesc it says what changed)');
}

console.log('odd — recognized on its own, wired to the press');
{
  const { isODD } = await import('../src/odd.js');
  const oddSrc = await readFile(new URL('./fixtures/custom.odd.xml', import.meta.url), 'utf-8');
  ok(isODD(parseXML(oddSrc)), 'a document carrying schemaSpec is an ODD');
  ok(!isODD(parseXML('<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p/></body></text></TEI>')),
    'a plain TEI text is not an ODD');

  // the CLI: the ODD sits next to the TEI in the same folder, nothing to declare
  const { spawnSync } = await import('node:child_process');
  const { mkdtemp, writeFile, cp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'torchio-odd-'));
  await writeFile(join(dir, 'doc.xml'),
    `<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc>
      <titleStmt><title>Prova ODD</title></titleStmt>
      <publicationStmt><p/></publicationStmt><sourceDesc><p/></sourceDesc>
    </fileDesc></teiHeader><text><body>
      <p>Bozza con <salvataggio xmlns="http://example.org/ns" when="2026-07-30">strato di autosalvataggio</salvataggio>.</p>
    </body></text></TEI>`);
  await cp(new URL('./fixtures/custom.odd.xml', import.meta.url), join(dir, 'schema.odd.xml'));
  const out = join(dir, 'pressed');
  const run = spawnSync(process.execPath,
    [new URL('../tools/press.js', import.meta.url).pathname, '--site', dir, out],
    { encoding: 'utf-8' });
  ok(run.status === 0 && run.stderr.includes('odd: schema.odd.xml'),
    'directory input: the ODD alongside is recognized and reported');
  const html = await readFile(join(out, 'text.html'), 'utf-8')
    .catch(() => readFile(join(out, 'doc-doc.html'), 'utf-8'));
  ok(html.includes('data-el="salvataggio"') && html.includes('s-3-trascrizionale'),
    'custom element inherits its behaviour in the pressed page (memberOf, zero code)');
  ok(!html.includes('data-el="salvataggio"') || !/data-el="salvataggio"[^>]*class="[^"]*s-base/.test(html),
    'custom element does not degrade to base when the ODD travels along');
  await rm(dir, { recursive: true, force: true });
}

console.log(`\n${passed} assertions passed.`);
