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

console.log('lemmas — concordances and frequencies, only where lemmas exist');
{
  const { attachLemmas, collectTokens, conlluTypes, typesFromVotes, mergeLemmaTypes } =
    await import('../src/lemmas.js');
  const { pressSite } = await import('../src/site.js');
  const map = buildClassMap(null, data);

  // 1. the markup decides: w/@lemma
  const MARKED = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc>
    <titleStmt><title>Lemmi dal markup</title></titleStmt>
    <publicationStmt><p/></publicationStmt><sourceDesc><p/></sourceDesc>
  </fileDesc><profileDesc><langUsage><language ident="it">italiano</language></langUsage></profileDesc>
  </teiHeader><text><body>
    <p n="1"><w lemma="errare">errò</w> molto, e ancora <w lemma="errare">erra</w>;
    il suo <w lemma="errore">errore</w> resta. <note>errò qui non conta.</note></p>
  </body></text></TEI>`;
  const m1 = buildModel(parseXML(MARKED), map);
  const L1 = attachLemmas(m1, null);
  ok(L1 && L1.provenance.markup === 3 && L1.provenance.file === 0,
    'w/@lemma read from the markup, notes excluded from the reading layer');
  const errare = L1.entries.find((e) => e.lemma === 'errare');
  ok(errare.count === 2 && errare.forms.length === 2,
    'two forms gathered under one lemma: the reason forms alone are not enough');
  ok(errare.occurrences[0].after.includes('molto'),
    'KWIC context collected around each occurrence');
  const site1 = pressSite(m1, {});
  ok('lemmas.html' in site1 && site1['lemmas.html'].includes('errare')
    && site1['lemmas.html'].includes('errò (1), erra (1)'),
    'the lemma page presses: lemma, forms, counts, concordance');
  ok('data/lemmas.csv' in site1 && site1['data/lemmas.csv'].includes('errare'),
    'lemmas.csv exported: every view is a projection of the model');

  // 2. no lemmas, no page
  const PLAIN = MARKED.replace(/ lemma="[^"]*"/g, '');
  const m2 = buildModel(parseXML(PLAIN), map);
  ok(attachLemmas(m2, null) === null && !('lemmas.html' in pressSite(m2, {})),
    'no lemmas, no page: forms are never passed off as an index of lemmas');

  // 3. the reviewed file: lemmas.json in the reconciliation pattern
  const L3 = attachLemmas(m2, { generator: 'test', types: [
    { form: 'errò', lemma: 'errare', status: 'confirmed' },
    { form: 'erra', lemma: 'errare', status: 'suggested' },
    { form: 'errore', lemma: 'errore', status: 'rejected' },
  ] });
  ok(L3.provenance.file === 2 && L3.pending.suggested === 1
    && !L3.entries.some((e) => e.lemma === 'errore'),
    'lemmas.json applied: rejected types stay out, pending counted');

  // 4. the tool's aggregation: unanimity suggests, disagreement asks the editor
  const CONLLU = ['# text', '1\terrò\terrare\tVERB', '2\terra\terrare\tVERB',
    '3\tErra\tErra\tPROPN', '4\terrore\terrore\tNOUN'].join('\n');
  const types = typesFromVotes(conlluTypes(CONLLU));
  const erra = types.find((t) => t.form === 'erra');
  ok(erra.status === 'review' && erra.alternatives.length === 2,
    'a form with two candidate lemmas becomes review: the homograph is the editor’s call');
  ok(types.find((t) => t.form === 'errò').status === 'suggested',
    'unanimous forms are plain suggestions');

  // 5. the language of a token is the markup's decision: xml:lang wins,
  //    langUsage is the fallback, ISO 639-2 and 639-1 are one declaration
  const MULTI = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc>
    <titleStmt><title>Multilingue</title></titleStmt>
    <publicationStmt><p/></publicationStmt><sourceDesc><p/></sourceDesc>
  </fileDesc><profileDesc><langUsage><language ident="lat">Latin</language></langUsage></profileDesc>
  </teiHeader><text><body>
    <p>arma uirumque cano, <foreign xml:lang="grc">μῆνιν ἄειδε θεά</foreign>, Troiae qui primus.</p>
  </body></text></TEI>`;
  const m5 = buildModel(parseXML(MULTI), map);
  const toks = collectTokens(m5);
  ok(toks.filter((t) => t.lang === 'grc').length === 3
    && toks.filter((t) => t.lang === 'lat').length === 6,
    'token language from the nearest xml:lang, langUsage as fallback');
  const L5 = attachLemmas(m5, { types: [
    { form: 'arma', lemma: 'arma', lang: 'la', status: 'confirmed' },
    { form: 'μῆνιν', lemma: 'μῆνις', lang: 'grc', status: 'confirmed' },
  ] });
  ok(L5.entries.length === 2
    && L5.entries[0].lang === 'la' && L5.entries[1].lang === 'grc',
    'lang-typed entries match their language only; "lat" and "la" are one declaration');
  const site5 = pressSite(m5, {});
  ok(site5['lemmas.html'].includes('<h2 class="sec">la</h2>')
    && site5['lemmas.html'].includes('<h2 class="sec">grc</h2>'),
    'a multilingual edition groups the lemma index by language');
  ok(site5['data/tokens.csv'].trim().split('\n').length === 10
    && site5['data/tokens.csv'].includes('position,doc,lang,form,lemma,anchor'),
    'tokens.csv: the token stream as data, position without markers, anchor back to the markup');

  // 6. the editor's decisions survive re-runs
  const merged = mergeLemmaTypes(
    { types: [{ form: 'errò', lemma: 'vagare', status: 'confirmed' },
              { form: 'erra', lemma: 'sbagliare', status: 'suggested' }] },
    { types: [{ form: 'errò', lemma: 'errare', status: 'suggested' },
              { form: 'erra', lemma: 'errare', status: 'suggested' }] });
  ok(merged.types.find((t) => t.form === 'errò').lemma === 'vagare'
    && merged.types.find((t) => t.form === 'erra').lemma === 'errare',
    'confirmed entries are never overwritten; mere suggestions are refreshed');
}

console.log('the archive — a loose collection presents the project, not a document');
{
  const { pressSite } = await import('../src/site.js');
  const map = buildClassMap(null, data);
  const doc = (title, lic, lang, when) => `<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc>
    <titleStmt><title>${title}</title></titleStmt>
    <publicationStmt><availability><licence target="${lic}">${lic}</licence></availability></publicationStmt>
    <sourceDesc><p/></sourceDesc></fileDesc>
    <profileDesc><langUsage><language ident="${lang}">x</language></langUsage>
    <creation><date when="${when}">${when}</date></creation></profileDesc>
    <revisionDesc><change who="0000-0003-4347-011X" when="${when}">Rivisto.</change>
    <change who="0000-0003-4347-011X" when="${when}">Codificato.</change></revisionDesc>
  </teiHeader><text><body><p>Testo di ${title}.</p></body></text></TEI>`;

  const A = { id: 'a', root: parseXML(doc('Alpha', 'https://cc.org/by/', 'lat', '1250')) };
  const B = { id: 'b', root: parseXML(doc('Beta', 'https://cc.org/by-nc/', 'ita', '1654')) };
  const m = buildModel([A, B], map);
  ok(m.collection && m.collection.count === 2 && !m.meta.title,
    'a loose collection is an archive: no document header speaks for the whole');
  ok(m.collection.years[0] === 1250 && m.collection.years[1] === 1654
    && m.meta.languages.length === 2 && m.collection.licenceVaries,
    'the archive aggregates: span of years, union of languages, licence policy');
  const site = pressSite(m, { manifest: { title: 'Archivio di prova' } });
  ok(!site['index.html'].includes('<div class="header-full">'),
    'the archive home shows no document header (each document keeps its own file card)');
  ok(site['index.html'].includes('2 documents') && site['index.html'].includes('1250-1654')
    && site['index.html'].includes('its own licence'),
    'the archive home: register link, years, languages, licence policy');
  ok(m.collection.contributors[0].count === 4
    && site['index.html'].includes('https://orcid.org/0000-0003-4347-011X')
    && site['index.html'].includes('4 interventions'),
    'the contributors card: who worked on the archive, counted by intervention, ORCIDs linked');

  // a source may reuse one identifier across people (the ELA Volpi case):
  // the change's own prose names the agent and wins; unambiguous
  // co-occurrences become aliases for identifier-only changes
  const REUSED = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc>
    <titleStmt><title>Uno</title></titleStmt>
    <publicationStmt><p/></publicationStmt><sourceDesc><p/></sourceDesc></fileDesc>
    <revisionDesc>
      <change when="2019-01-10" who="0000-0002-1022-023X">E. Bartoli: transcription</change>
      <change when="2019-01-10" who="0000-0002-1022-023X">I. Volpi: transcription</change>
      <change when="2019-12-15" who="0000-0003-4347-011X">E. Carbé: TEI (level 2)</change>
      <change when="2020-01-01" who="0000-0003-4347-011X">Revised encoding.</change>
    </revisionDesc>
  </teiHeader><text><body><p>a</p></body></text></TEI>`;
  const OTHER = REUSED.replace('Uno', 'Due').replace(/<revisionDesc>[^]*<\/revisionDesc>/, '');
  const m3 = buildModel([{ id: 'u', root: parseXML(REUSED) }, { id: 'd', root: parseXML(OTHER) }], map);
  const by = Object.fromEntries(m3.collection.contributors.map((c) => [c.ref, c.count]));
  ok(by['I. Volpi'] === 1 && by['E. Bartoli'] === 1,
    'a reused identifier never absorbs another person’s intervention: the prose names the agent');
  ok(by['E. Carbé'] === 2 && !by['0000-0003-4347-011X'],
    'identifier-only changes count under the person via the unambiguous alias');

  const C = { id: 'c', root: parseXML(doc('Gamma', 'https://cc.org/by/', 'lat', '1300')) };
  const m2 = buildModel([A, C], map);
  ok(m2.meta.licence && m2.meta.licence.target === 'https://cc.org/by/',
    'a uniform licence across the archive surfaces on the home');
}

console.log('standoff notes follow their targets; long indices open with their own index');
{
  const { pressSite } = await import('../src/site.js');
  const map = buildClassMap(null, data);
  // a long two-section body plus an endnotes div: the note targets a word
  // in section one, so it must be pressed there, and the endnotes div,
  // left with nothing but its heading, must not become a reading page
  const pad = 'Lorem ipsum dolore magna aliqua. '.repeat(700);
  const NOTED = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc>
    <titleStmt><title>Cronaca</title></titleStmt>
    <publicationStmt><p/></publicationStmt><sourceDesc><p/></sourceDesc>
  </fileDesc></teiHeader><text><body>
    <div n="1"><head>Liber primus</head><p>Initium <seg xml:id="pass1">clarum</seg>. ${pad}</p></div>
    <div n="2"><head>Liber secundus</head><p>${pad}</p></div>
    <div type="notes"><head>Adnotationes critice</head>
      <note target="#pass1" type="textcrit">Lectio dubia: clarum an carum.</note>
    </div>
  </body></text></TEI>`;
  const site = pressSite(buildModel(parseXML(NOTED), map), {});
  ok(!('text-notes.html' in site) && !Object.keys(site).some((k) => /text-(3|notes)/.test(k)),
    'an endnotes div emptied by relocation never becomes a reading page');
  ok(site['text-1.html'].includes('Lectio dubia')
    && site['text-1.html'].includes('data-target="#pass1"')
    && !site['text-2.html'].includes('Lectio dubia'),
    'a standoff note is pressed on the page of its target, ready for the margin machinery');
  ok(!site['text.html'].includes('Adnotationes'),
    'the contents page no longer promises the endnotes chapter');

  // the index of the indices: two sections and many entries open with anchors
  let people = '';
  let mentions = '';
  for (let i = 0; i < 20; i++) {
    people += `<person xml:id="p${i}"><persName>Persona ${i}</persName></person>`;
    mentions += `<persName ref="#p${i}">P${i}</persName> in <placeName key="Locus ${i}">loco</placeName>. `;
  }
  const MANY = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc>
    <titleStmt><title>Indici</title></titleStmt>
    <publicationStmt><p/></publicationStmt><sourceDesc><p/></sourceDesc></fileDesc>
    <profileDesc><particDesc><listPerson>${people}</listPerson></particDesc></profileDesc>
  </teiHeader><text><body><p>${mentions}</p></body></text></TEI>`;
  const site2 = pressSite(buildModel(parseXML(MANY), map), {});
  ok(site2['indices.html'].includes('class="idx-toc"')
    && site2['indices.html'].includes('href="#idx-0"') && site2['indices.html'].includes('href="#idx-1"')
    && site2['indices.html'].includes('id="idx-1"'),
    'long indices open with an index of the indices, one anchor per section with its count');
}

console.log('the register — two shapes, and the editor chooses the columns');
{
  const { pressSite } = await import('../src/site.js');
  const map = buildClassMap(null, data);
  const work = (title, author, when) => `<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc>
    <titleStmt><title>${title}</title><author>${author}</author></titleStmt>
    <publicationStmt><p/></publicationStmt><sourceDesc><p/></sourceDesc></fileDesc>
    <profileDesc><creation><date when="${when}">${when}</date></creation></profileDesc>
  </teiHeader><text><body><p>${title}.</p></body></text></TEI>`;
  const m = buildModel([
    { id: 'a', root: parseXML(work('Historia', 'Martini', '1654')) },
    { id: 'b', root: parseXML(work('Relatio', 'Carpini', '1247')) },
  ], map);
  const site = pressSite(m, { manifest: { title: 'Opere' } });
  const head = site['text.html'].match(/<thead>[^]*?<\/thead>/)[0];
  ok(/Author[^]*Title[^]*Date/.test(head) && !head.includes('From'),
    'an archive of works reads author-title-year, not from-to: the majority of the markup decides');
  ok(site['text.html'].includes('>Texts<') || site['index.html'].includes('>Texts<'),
    'a collection calls the register page Texts, not Text');
  const chosen = pressSite(m, { manifest: { title: 'Opere', register: { columns: ['date', 'author'] } } });
  const head2 = chosen['text.html'].match(/<thead>[^]*?<\/thead>/)[0];
  ok(/Title[^]*Date[^]*Author/.test(head2) && !head2.includes('Place'),
    'the manifest chooses columns and order; the title column always stays (the way in)');
}

console.log('authority refs — an external @ref is an identity declaration');
{
  const { pressSite } = await import('../src/site.js');
  const map = buildClassMap(null, data);
  const SRC = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc>
    <titleStmt><title>Con autorità</title></titleStmt>
    <publicationStmt><p/></publicationStmt><sourceDesc><p/></sourceDesc>
  </fileDesc></teiHeader><text><body>
    <p><persName ref="https://viaf.org/viaf/12554068">Martinus Martini</persName> scripsit;
    idem <persName ref="https://viaf.org/viaf/12554068">Martini</persName> narrat de
    <placeName ref="https://www.geonames.org/1816670">Pequino</placeName>.</p>
  </body></text></TEI>`;
  const model = buildModel(parseXML(SRC), map);
  const p = model.registries.people.find((e) => e.id === 'https://viaf.org/viaf/12554068');
  ok(p && p.occurrences.length === 2 && p.label === 'Martinus Martini',
    'mentions sharing a VIAF reference are one entity, no registry needed');
  ok(model.registries.places.some((e) => e.id === 'https://www.geonames.org/1816670'),
    'a GeoNames reference makes a place entry the same way');
  const files = pressSite(model, {});
  ok(files['text.html'].includes('href="https://viaf.org/viaf/12554068"')
    && files['text.html'].includes('target="_blank" rel="noopener"'),
    'the mention is a real link, opening in its own tab');
  ok('indices.html' in files && files['indices.html'].includes('Martinus Martini'),
    'authority-linked mentions feed the indices');

  // @key declares identity too: the canonical name groups the mentions
  const KEYED = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc>
    <titleStmt><title>Con chiavi</title></titleStmt>
    <publicationStmt><p/></publicationStmt><sourceDesc><p/></sourceDesc>
  </fileDesc></teiHeader><text><body>
    <p><persName key="Figueredo, Thomas de">Thomas</persName> venit;
    <persName key="Figueredo, Thomas de">Figueredo</persName> scripsit apud
    <placeName key="Pequinum">Pequini</placeName>.</p>
  </body></text></TEI>`;
  const m2 = buildModel(parseXML(KEYED), map);
  const fig = m2.registries.people.find((e) => e.id === 'Figueredo, Thomas de');
  ok(fig && fig.occurrences.length === 2 && fig.label === 'Figueredo, Thomas de',
    'mentions sharing a @key are one entity, labelled by the canonical form');
  const f2 = pressSite(m2, {});
  ok(f2['indices.html'].includes('Figueredo, Thomas de')
    && !f2['text.html'].includes('href="Figueredo'),
    'keyed entities feed the indices; no fake link where there is no URI');
}

console.log('traditions — no tradition is the default (principle 1)');
{
  const { pressSite } = await import('../src/site.js');
  const map = buildClassMap(null, data);
  const SRC = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc>
    <titleStmt><title>Tradizioni</title></titleStmt>
    <publicationStmt><p/></publicationStmt><sourceDesc><p/></sourceDesc>
  </fileDesc><profileDesc><langUsage><language ident="it">italiano</language></langUsage></profileDesc>
  </teiHeader><text><body><p>Prova <choice><abbr>sig.</abbr><expan>signore</expan></choice>.</p></body></text></TEI>`;
  const model = buildModel(parseXML(SRC), map);
  const it = pressSite(model, {});
  ok(it['text.html'].includes('Interpretativa') && it['text.html'].includes('Diplomatica'),
    'the Italian default is the tradition’s canonical pair: diplomatica / interpretativa');
  const own = pressSite(model, { manifest: { labels: { reading: 'Costituito' } } });
  ok(own['text.html'].includes('Costituito') && !own['text.html'].includes('Interpretativa'),
    'an edition’s tradition renames the levels through the manifest');
}

console.log('lemma review — errors exist, so reviewing must be cheap');
{
  const { reviewCSV, parseReviewCSV, applyReview } = await import('../src/lemmas.js');
  const types = [
    { form: 'et', lemma: 'et', status: 'suggested', count: 900 },
    { form: 'legge', lemma: 'lex', status: 'review', count: 7, alternatives: ['lex', 'legere'] },
    { form: 'errò', lemma: 'erro', status: 'suggested', count: 3 },
  ];
  const csvText = reviewCSV(types);
  const lines = csvText.trim().split('\n');
  ok(lines[1].startsWith('legge,') && lines[2].startsWith('et,'),
    'the review CSV puts doubted entries first, then frequency: the eye goes where it pays');
  const rows = parseReviewCSV(csvText);
  ok(rows.length === 3 && rows[1].form === 'et' && rows[1].lemma === 'et',
    'the CSV reads back: spreadsheet in, decisions out');

  // the editor fixes one lemma, sets one status, leaves the rest alone
  const edited = parseReviewCSV(csvText
    .replace('errò,,erro,suggested', 'errò,,errare,suggested')
    .replace('legge,,lex,review', 'legge,,lex,confirmed'));
  const { json, decided } = applyReview({ generator: 'test', types }, edited);
  const byForm = Object.fromEntries(json.types.map((t) => [t.form, t]));
  ok(decided === 2
    && byForm['errò'].lemma === 'errare' && byForm['errò'].status === 'confirmed'
    && byForm['legge'].status === 'confirmed' && !byForm['legge'].alternatives
    && byForm['et'].status === 'suggested',
    'an edited lemma is a decision (confirmed); explicit statuses count; untouched rows stay');
}

// ---- the three apparatus methods of chapter 12 ----
{
  const { readFileSync } = await import('node:fs');
  const { pressSite: pressM } = await import('../src/site.js');
  const model = buildModel(parseXML(readFileSync('test/fixtures/apparatus-methods.xml', 'utf-8')),
    buildClassMap(null, data));
  const entries = model.apparatus.flatMap((r) => r.entries);
  const methods = entries.map((e) => e.method).sort();
  ok(methods.join(',') === 'double-end-point,location-referenced,parallel-segmentation',
    'the three methods of chapter 12 are told apart by what the app declares');
  const loc = entries.find((e) => e.method === 'location-referenced');
  ok(loc.loc === '3' && loc.readings.some((r) => (r.sources || []).includes('Heinsius')),
    'a location-referenced app keeps its place and its conjecture keeps its author');
  const site = pressM(model, { title: 'methods' });
  const page = site['text.html'];
  ok(/data-from="#a1"/.test(page) && /data-loc="3"/.test(page)
    && /id="a1"/.test(page) && /data-el="l" data-n="3"/.test(page),
    'anchors and canonical places survive into the page, where the reader-side wiring finds them');
}

// ---- hostile fixtures: editorial data must never become executable code ----
{
  const { readFileSync } = await import('node:fs');
  const { pressSite: press } = await import('../src/site.js');
  const hostile = [
    'test/security-fixtures/attribute-quote-breakout.xml',
    'test/security-fixtures/script-end-tag.xml',
  ];
  // editorial data may appear as escaped text (that is data); what it must
  // never do is become code: close a script block, open an event handler,
  // or carry a javascript: URL
  for (const file of hostile) {
    const model = buildModel(parseXML(readFileSync(file, 'utf-8')), buildClassMap(null, data));
    const site = press(model, { title: 'hostile' });
    for (const [name, page] of Object.entries(site)) {
      if (!name.endsWith('.html')) continue;
      const scripts = [...page.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
      const clean = scripts.every((code) => !/<\/script/i.test(code))
        && !/ on\w+\s*=\s*"/i.test(page)
        && !/javascript:/i.test(page);
      ok(clean, `editorial data stays data, never code: ${file.split('/').pop()} in ${name}`);
    }
  }
}

console.log(`\n${passed} assertions passed.`);
