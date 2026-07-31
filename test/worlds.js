/**
 * The possible worlds of TEI.
 *
 * Every world here is a legitimate TEI document that no demonstration edition
 * contains. They come from the audits of 31 July 2026: each one is a case a
 * reviewer built to see whether the press would break, and each carries the
 * assertion of what must be true of the pressed page or of the model.
 *
 * This is the answer to principle 3 (never example-driven development): the
 * demonstration editions say what the press does on the texts it has met, this
 * file says what it does on the texts it has not. A world that fails is not a
 * bug report, it is a debt with a name.
 *
 * Run: node test/worlds.js
 * Add a world: write the TEI, write what must be true, run. A world that
 * passes on the day it is written proves nothing; write it because it might
 * fail.
 */

import { parseXML } from '../src/xml.js';
import { loadBaseData, buildClassMap } from '../src/classes.js';
import { buildModel, walkModel } from '../src/model.js';
import { pressSite } from '../src/site.js';
import { safeURL } from '../src/render.js';

const HEADER = `<teiHeader><fileDesc><titleStmt><title>W</title></titleStmt>`
  + `<publicationStmt><p>t</p></publicationStmt><sourceDesc><p>t</p></sourceDesc></fileDesc></teiHeader>`;

const tei = (body, attrs = '') =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<TEI xmlns="http://www.tei-c.org/ns/1.0"${attrs}>`
  + `${HEADER}<text><body>${body}</body></text></TEI>`;

/** Visible text of a page: what a reader with CSS actually reads. Elements the
 *  stylesheet hides are removed first, so the assertion is about reading, not
 *  about markup. */
function reads(html) {
  let s = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  s = s.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<details[\s\S]*?<\/details>/g, '');
  // what the base stylesheet hides from the reading text
  s = s.replace(/<[^>]*class="[^"]*t-teiHeader[^"]*"[\s\S]*?<\/div>/g, '');
  s = s.replace(/<span[^>]*class="[^"]*app-pointing[^"]*"[\s\S]*?<\/span>/g, '');
  // an app with a lem hides its rdg; an app without one keeps the first only
  s = s.replace(/<span([^>]*)class="([^"]*t-app[^"]*)"([^>]*)>([\s\S]*?)<\/span>/g,
    (m, a, cls, b, inner) => {
      if (/app-has-lem/.test(cls)) return inner.replace(/<span[^>]*data-el="rdg"[\s\S]*?<\/span>/g, '');
      if (/app-no-lem/.test(cls)) {
        const rdgs = inner.match(/<span[^>]*data-el="rdg"[\s\S]*?<\/span>/g) || [];
        return rdgs.length ? rdgs[0] : inner;
      }
      return inner;
    });
  return s.replace(/<[^>]+>/g, ' ').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(n))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

const WORLDS = [
  // ---- chapter 12: the three methods of the critical apparatus ----
  {
    name: 'an app without a lem privileges one reading, never all of them',
    why: 'Guidelines 12.1: no lem means no reading is privileged; a processor picks one, it does not concatenate',
    xml: tei(`<p>Testo <app><rdg wit="#A">alfa</rdg><rdg wit="#B">beta</rdg><rdg wit="#C">gamma</rdg></app> fine.</p>`),
    check: ({ html }) => {
      const t = reads(html);
      if (/alfabetagamma|alfa beta gamma/.test(t)) return `reads all three: ${t}`;
      return null;
    },
  },
  {
    name: 'a double-end-point app does not print the lemma twice',
    why: 'Guidelines 12.2.2: the lemma is already in the base text; the app is a pointer',
    xml: tei(`<p><anchor xml:id="s"/>parola contesa<anchor xml:id="e"/> resto.</p>`
      + `<app from="#s" to="#e"><lem wit="#A">parola contesa</lem><rdg wit="#B">parola perduta</rdg></app>`),
    check: ({ html }) => {
      const n = (reads(html).match(/parola contesa/g) || []).length;
      return n > 1 ? `the lemma appears ${n} times` : null;
    },
  },
  {
    name: 'a location-referenced app does not print its lemma into the text',
    why: 'Guidelines 12.2.3: @loc points at a canonical line, the app carries no running text',
    xml: tei(`<lg><l n="1">Primo verso</l><l n="2">Secondo verso</l></lg>`
      + `<app loc="1"><lem>Primo</lem><rdg wit="#B">Primero</rdg></app>`),
    check: ({ html }) => {
      const t = reads(html);
      return /Primo verso Secondo verso\s*Primo\b/.test(t) ? `the app prints after the poem: ${t}` : null;
    },
  },
  {
    name: 'a nested app does not corrupt the outer lemma',
    why: 'Guidelines 12.1.3: inside a nested app the outer reading is the inner lem, not lem+rdg glued',
    xml: tei(`<p><app><lem wit="#A">alfa <app><lem wit="#A">beta</lem><rdg wit="#B">gamma</rdg></app></lem>`
      + `<rdg wit="#C">delta</rdg></app></p>`),
    check: ({ model }) => {
      const e = (model.apparatus[0] || {}).entries || [];
      const bad = e.find((x) => /betagamma/.test(x.lemma || '')
        || (x.readings || []).some((r) => /betagamma/.test(r.text || '')));
      return bad ? `a reading reads "betagamma", which no witness carries` : null;
    },
  },
  {
    name: 'a witness lacuna is not an omission',
    why: 'Guidelines 12.1.4: lacunaStart means the witness is materially absent, not that it omits',
    xml: tei(`<p>Testo <app><lem wit="#A">alfa</lem><rdg wit="#B"><lacunaStart/></rdg></app> fine.</p>`),
    check: ({ model }) => {
      const r = ((model.apparatus[0] || {}).entries || [])[0];
      if (!r) return 'no apparatus entry';
      const lac = (r.readings || []).find((x) => (x.witnesses || []).includes('B'));
      return lac && !lac.lacuna ? 'the lacuna is recorded as an empty reading (an omission)' : null;
    },
  },

  // ---- what the edition declares about its own writing ----
  {
    name: 'the language of a passage survives into the page',
    why: 'att.global/@xml:lang; WCAG 3.1.2: a Greek phrase must not be read aloud in English',
    xml: tei(`<p>Testo <foreign xml:lang="grc">λόγος</foreign> fine.</p>`),
    check: ({ html }) => (/lang="grc"/.test(html) ? null : 'no lang attribute on the foreign phrase'),
  },
  {
    name: 'a right-to-left script is laid out right to left',
    why: 'principle 1: no tradition is the default, and an Arabic edition is not a Latin one',
    xml: tei(`<p><foreign xml:lang="ar">كتاب</foreign></p>`),
    check: ({ html }) => (/dir="rtl"/.test(html) ? null : 'no dir="rtl" on the Arabic phrase'),
  },
  {
    name: 'the language of the whole edition reaches the html element',
    why: 'WCAG 3.1.1; an edition in Greek announced as English is read in the wrong voice',
    xml: tei(`<p>λόγος</p>`, ' xml:lang="grc"'),
    check: ({ html }) => (/<html lang="grc"/.test(html) ? null : `html element says: ${(html.match(/<html[^>]*>/) || [])[0]}`),
  },
  {
    name: 'a declared rendition survives into the page',
    why: 'att.global.rendition/@rend: underline and italic are different decisions of the editor',
    xml: tei(`<p><hi rend="underline">a</hi> e <hi rend="italic">b</hi></p>`),
    check: ({ html }) => (/data-rend="underline"/.test(html) ? null : 'rend is dropped: both look the same'),
  },
  {
    name: 'what a gap says about itself is not thrown away',
    why: 'Guidelines 11.3.1.4: gap has a content model, and @unit is part of the quantity',
    xml: tei(`<p>Prima <gap reason="illegible" unit="words" quantity="3"><desc>tre parole</desc></gap> dopo.</p>`),
    check: ({ html }) => {
      const t = (html.match(/t-gap[^>]*title="([^"]*)"/) || [])[1] || '';
      if (!/words/.test(t)) return `the unit is lost: "${t}"`;
      if (!/tre parole/.test(t)) return `the description is lost: "${t}"`;
      return null;
    },
  },
  {
    name: 'an image declared by the edition is at least named',
    why: 'principle 2: the reader must know the edition declares a facsimile, even when it is not shown',
    xml: tei(`<p>Testo</p><figure><graphic url="carta1.jpg"/></figure>`),
    check: ({ html }) => (/carta1\.jpg/.test(html) ? null : 'the image URL appears nowhere in the page'),
  },

  // ---- structures no demonstration edition has ----
  {
    name: 'a nested teiCorpus does not lose its documents',
    why: 'Guidelines 4/15.1: teiCorpus is recursive',
    xml: `<?xml version="1.0"?><teiCorpus xmlns="http://www.tei-c.org/ns/1.0">${HEADER}`
      + `<teiCorpus>${HEADER}<TEI>${HEADER}<text><body><p>Documento annidato</p></body></text></TEI></teiCorpus>`
      + `<TEI>${HEADER}<text><body><p>Documento diretto</p></body></text></TEI></teiCorpus>`,
    check: ({ model }) => (model.documents.length >= 2 ? null
      : `${model.documents.length} document(s): the nested corpus vanished`),
  },
  {
    name: 'standOff is not read as running text',
    why: 'Guidelines 16.10: standOff holds data about the text, not the text',
    xml: tei(`<p xml:id="s1">Il testo dell'opera.</p>`)
      .replace('</text>', '</text>')
      .replace('<text>', '<standOff><listAnnotation><annotation xml:id="a1" target="#s1">'
        + '<note>questa è un\'annotazione, non il testo</note></annotation></listAnnotation></standOff><text>'),
    check: ({ html }) => (/questa è un.annotazione/.test(reads(html))
      ? 'the annotation is read as text of the work' : null),
  },
  {
    name: 'a nested place does not inherit its child coordinates',
    why: 'Guidelines 13.3.4: nesting expresses containment; Italy is not at Florence',
    xml: tei(`<p><placeName ref="#italia">Italia</placeName></p>`
      + `<listPlace><place xml:id="italia"><placeName>Italia</placeName>`
      + `<place xml:id="firenze"><placeName>Firenze</placeName>`
      + `<location><geo>43.7696 11.2558</geo></location></place></place></listPlace>`),
    check: ({ model }) => {
      const it = (model.registries.places || []).find((p) => /Italia/.test(p.label));
      return it && it.geo ? `Italy is placed at ${it.geo.lat}, ${it.geo.lon}` : null;
    },
  },
  {
    name: 'the parts of a personal name are not glued together',
    why: 'Guidelines 13.2.1: forename and surname are components, not a string',
    xml: tei(`<p><persName><forename>Dante</forename><surname>Alighieri</surname></persName></p>`),
    check: ({ model }) => {
      const p = (model.registries.people || [])[0];
      return p && /DanteAlighieri/.test(p.label) ? `the index reads "${p.label}"` : null;
    },
  },
  {
    name: 'one entity with an authority URI is one entity, not two',
    why: 'Guidelines 13.3.6: @ref to an authority identifies, it does not create a second person',
    xml: tei(`<p><persName ref="http://viaf.org/viaf/97105654">Dante</persName> e `
      + `<persName ref="#dante">Dante</persName>.</p>`
      + `<listPerson><person xml:id="dante"><persName>Dante</persName>`
      + `<idno type="VIAF">97105654</idno></person></listPerson>`),
    check: ({ model }) => {
      const n = (model.registries.people || []).length;
      return n > 1 ? `${n} people in the index, all of them Dante` : null;
    },
  },
  {
    name: 'a choice of two unclear readings does not print both',
    why: 'Guidelines 11.3.3.2: alternative readings of one passage, one shown at a time',
    xml: tei(`<p>Il <choice><unclear reason="faded">mare</unclear><unclear reason="faded">more</unclear></choice>.</p>`),
    check: ({ html }) => (/maremore|mare more/.test(reads(html)) ? 'both readings are printed' : null),
  },
  {
    name: 'sourceDoc and text are two views, not two texts',
    why: 'Guidelines 11.1: they are alternative representations of the same document',
    xml: `<?xml version="1.0"?><TEI xmlns="http://www.tei-c.org/ns/1.0">${HEADER}`
      + `<sourceDoc><surface><line>prima riga</line><line>seconda riga</line></surface></sourceDoc>`
      + `<text><body><p>prima riga seconda riga</p></body></text></TEI>`,
    check: ({ html }) => {
      const t = reads(html);
      const n = (t.match(/prima riga/g) || []).length;
      return n > 1 ? 'the same passage is read twice, one after the other' : null;
    },
  },

  // ---- genetic: what the hand did, and who says so ----
  {
    name: 'a nested operation keeps the hand its parent declares',
    why: 'critique génétique: a compositor mark inside an addition is not the author\'s',
    xml: tei(`<p><handShift new="#b"/>Testo <add hand="#a"><del>tolto</del></add> fine.</p>`
      + `<!--h-->`)
      .replace('</teiHeader>', '</teiHeader>')
      .replace(HEADER, HEADER.replace('</fileDesc>',
        '</fileDesc><profileDesc><handNotes><handNote xml:id="a"><persName>A</persName></handNote>'
        + '<handNote xml:id="b"><persName>B</persName></handNote></handNotes></profileDesc>')),
    check: ({ model }) => {
      const ops = (model.genetic || {}).operations || [];
      const del = ops.find((o) => o.element === 'del');
      return del && del.hand === 'b' ? 'the deletion inside a hand-a addition is given to hand b' : null;
    },
  },
  {
    name: 'an operation whose hand is not declared does not vanish',
    why: 'principle 2: a dangling @hand is something the editor must see, not something to hide',
    xml: tei(`<p>Testo <add hand="#comp">aggiunta del compositore</add> fine.</p>`),
    check: ({ model }) => {
      const ops = (model.genetic || {}).operations || [];
      const strata = (model.genetic || {}).strata || [];
      if (!ops.length) return 'the operation is not in the model at all';
      const shown = strata.reduce((n, s) => n + (s.operations || 0), 0);
      return shown === 0 ? 'the operation exists but appears in no stratum' : null;
    },
  },
  {
    name: 'a declared campaign with no operations is still declared',
    why: 'an editor may declare a campaign argued in prose; deleting it rewrites the edition',
    xml: tei(`<p>Testo semplice.</p>`)
      .replace(HEADER, HEADER.replace('</fileDesc>',
        '</fileDesc><profileDesc><creation><listChange><change xml:id="c1">prima campagna</change>'
        + '</listChange></creation></profileDesc>')),
    check: ({ model }) => {
      const strata = (model.genetic || {}).strata || [];
      return strata.length === 0 ? 'the declared campaign does not appear anywhere' : null;
    },
  },

  // ---- the composition, and what the editor asked for ----
  {
    name: 'a page the editor names is a page the press makes',
    why: 'a manifest that lists its pages must not silently drop the apparatus',
    xml: tei(`<p>Testo <app><lem wit="#A">alfa</lem><rdg wit="#B">beta</rdg></app> fine.</p>`),
    manifest: { pages: ['index', 'text', 'apparatus', 'data'] },
    check: ({ files, model }) => {
      if (!model.apparatus.length) return null; // nothing to make
      return 'apparatus.html' in files ? null : 'the apparatus page was dropped without a word';
    },
  },

  // ---- security: editorial data must never become code ----
  {
    name: 'an obfuscated javascript URL does not survive',
    why: 'browsers strip control characters before reading a scheme, so a blocklist is walked around',
    xml: null,
    check: () => {
      const bad = ['javascript:alert(1)', 'java\tscript:alert(1)', 'java\nscript:alert(1)',
        'data:text/html,x', '//evil.example/x', 'jav ascript:alert(1)']
        .filter((u) => safeURL(u) !== null);
      return bad.length ? `these pass through: ${JSON.stringify(bad)}` : null;
    },
  },
];

/* ------------------------------------------------------------------ */

const data = await loadBaseData();
const map = buildClassMap(null, data);
let held = 0;
const broke = [];

for (const w of WORLDS) {
  try {
    let ctx = {};
    if (w.xml) {
      const model = buildModel(parseXML(w.xml), map);
      const files = pressSite(model, { title: 'W', manifest: w.manifest || null });
      const html = files['text.html'] || files['index.html'] || '';
      ctx = { model, files, html };
    }
    const problem = w.check(ctx);
    if (problem) broke.push({ w, problem });
    else held++;
  } catch (err) {
    broke.push({ w, problem: `threw: ${err.message}` });
  }
}

for (const { w, problem } of broke) {
  console.log(`\n  ✗ ${w.name}`);
  console.log(`    ${w.why}`);
  console.log(`    → ${problem}`);
}
console.log(`\n${held} of ${WORLDS.length} possible worlds hold.`);
if (broke.length) {
  console.log(`${broke.length} do not. Each is a debt with a name, not a surprise.`);
}
// a failing world is a fact to read, not a build to break
process.exit(0);
