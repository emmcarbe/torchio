/**
 * The edition model builder — Separation 1 executed.
 *
 * TEI in, model out; every view and every export consumes the model, never
 * the XML. Design decisions (vault, "Modello dell'edizione — schema"):
 *   D0  the ODD decides: pass the class map built with the edition's ODD
 *   D1  every node has a stable id: xml:id if present, otherwise generated
 *       deterministically from the traversal path (same XML -> same model)
 *   D2  every node carries both the TEI element and its behaviour section
 *   D3  lossless: all original attributes are kept verbatim on the node
 *   D4  registries (people, places, orgs, witnesses, hands, layers) are
 *       extracted and text nodes point into them
 *   D5  the apparatus is a set of typed registers with anchors
 *
 * v0 scope: meta, document trees, entity/witness/hand/layer registries with
 * occurrences, typed apparatus. Facsimile and alignments: next iteration.
 */

import { walk, local, textOf } from './xml.js';

export function buildModel(docs, classMap) {
  let list = (Array.isArray(docs) ? docs : [docs]).map((d, i) =>
    d.root ? d : { id: null, root: d, index: i });

  // a teiCorpus root is a collection: its TEI children become documents
  const expanded = [];
  for (const item of list) {
    const rootName = item.root.name.replace(/^.*:/, '');
    if (rootName === 'teiCorpus') {
      let i = 0;
      for (const child of item.root.children) {
        if (typeof child === 'string') continue;
        const childName = child.name.replace(/^.*:/, '');
        if (childName === 'TEI') {
          expanded.push({ id: child.attrs?.['xml:id'] || null, root: child, index: expanded.length });
        } else if (childName === 'teiHeader') {
          expanded.push({ id: '__corpusHeader', root: child, index: -1, corpusHeader: true });
        }
        i++;
      }
    } else {
      expanded.push({ ...item, index: expanded.length });
    }
  }
  list = expanded;

  const model = {
    meta: {},
    documents: [],
    registries: { people: [], places: [], orgs: [], witnesses: [], hands: [], layers: [] },
    apparatus: [],
    generator: { name: 'torchio', tei: classMap.teiVersion },
  };

  const byXmlId = new Map(); // '#id' -> registry entry
  const appByType = new Map();

  let corpusMeta = null;
  for (const { id, root, index, corpusHeader } of list) {
    if (corpusHeader) {
      const tree = convert(root, 'corpus', '0', classMap);
      corpusMeta = extractMeta(tree);
      model.corpusHeaderTree = tree;
      continue;
    }
    const docId = id || root.attrs?.['xml:id'] || `doc${index ?? 0}`;
    const tree = convert(root, docId, '0', classMap);
    const header = findFirst(tree, 'teiHeader');
    model.documents.push({
      id: docId, tree,
      card: extractCard(header, tree, docId),
    });
  }

  // meta: the corpus header if there is one; the first document's for a
  // single-document edition. A loose collection (many files, no corpus
  // header) is an ARCHIVE: no document's header speaks for the whole, so
  // the meta is aggregated (languages, uniform licence) and the identity
  // comes from the manifest. The archive grammar of ALIM / ELA / BibIt:
  // the home is the project, every document keeps its own card.
  const firstHeader = findFirst(model.documents[0]?.tree, 'teiHeader');
  const loose = model.documents.length > 1 && !corpusMeta;
  if (loose) {
    const langs = new Set();
    const licences = new Map();
    let years = [];
    for (const doc of model.documents) {
      const h = findFirst(doc.tree, 'teiHeader');
      if (!h) continue;
      const lu = findFirst(h, 'langUsage');
      if (lu) for (const n of walkModel(lu)) {
        if (n.element === 'language' && n.atts.ident) langs.add(n.atts.ident);
      }
      const lic = findFirst(h, 'licence');
      if (lic) {
        const text = textOfModel(lic).trim().replace(/\s+/g, ' ') || null;
        licences.set(lic.atts.target || text, { target: lic.atts.target || null, text });
      }
      const y = parseInt(doc.card?.date?.when || '', 10);
      if (!Number.isNaN(y)) years.push(y);
    }
    // who worked on the archive, with the number of interventions: every
    // revisionDesc change is one intervention, every respStmt one per
    // document. The change's own prose names the agent ("I. Volpi:
    // transcription"): that declaration wins over @who, because a source
    // may reuse an identifier across people, and an ambiguous identifier
    // must never absorb someone else's intervention. Unambiguous
    // name-identifier co-occurrences become aliases, so identifier-only
    // changes still count under the person; local #refs resolve to names.
    const contributors = new Map();
    const names = new Map();
    const changes = [];
    const prefixName = (n) => {
      const m = textOfModel(n).trim().match(/^([^:]{2,40}?)\s*:/);
      return m && /\p{Lu}/u.test(m[1]) && !/\d/.test(m[1]) ? m[1].trim() : null;
    };
    for (const doc of model.documents) {
      const h = findFirst(doc.tree, 'teiHeader');
      if (!h) continue;
      for (const n of walkModel(h)) {
        if (n.element === 'persName' || n.element === 'name') {
          const label = textOfModel(n).trim().replace(/\s+/g, ' ');
          if (n.atts['xml:id']) names.set('#' + n.atts['xml:id'], label);
          // an ORCID (or any URI) in @ref names its person: show the name
          if (n.atts.ref && label) names.set(n.atts.ref, label);
        }
        if (n.element === 'change') changes.push(n);
        if (n.element === 'respStmt') {
          const who = findFirst(n, 'name') || findFirst(n, 'persName');
          const label = who ? textOfModel(who).trim().replace(/\s+/g, ' ') : null;
          if (label) contributors.set(label, (contributors.get(label) || 0) + 1);
        }
      }
    }
    // pass 1: learn identifier -> name aliases from co-occurrence; an
    // identifier seen with two different names is ambiguous, never trusted
    const alias = new Map();
    for (const n of changes) {
      const name = prefixName(n);
      if (!name || !n.atts.who) continue;
      for (const w of n.atts.who.split(/\s+/)) {
        if (!w) continue;
        if (!alias.has(w)) alias.set(w, name);
        else if (alias.get(w) !== name) alias.set(w, null);
      }
    }
    // pass 2: count under the declared name first, then the (unambiguous)
    // alias or a name the header gives the identifier, else the raw id
    for (const n of changes) {
      const name = prefixName(n);
      if (name) { contributors.set(name, (contributors.get(name) || 0) + 1); continue; }
      for (const w of (n.atts.who || '').split(/\s+/)) {
        if (!w) continue;
        const key = names.get(w) || alias.get(w) || w;
        contributors.set(key, (contributors.get(key) || 0) + 1);
      }
    }
    model.meta = {};
    if (langs.size) model.meta.languages = [...langs];
    if (licences.size === 1) model.meta.licence = [...licences.values()][0];
    model.collection = {
      count: model.documents.length,
      years: years.length ? [Math.min(...years), Math.max(...years)] : null,
      licenceVaries: licences.size > 1,
      contributors: [...contributors.entries()]
        .map(([ref, count]) => ({ ref: names.get(ref) || ref, count }))
        .sort((a, b) => b.count - a.count || String(a.ref).localeCompare(String(b.ref))),
    };
  } else {
    model.meta = corpusMeta
      || (firstHeader ? extractMeta(firstHeader, model.documents[0] && model.documents[0].tree) : {});
  }

  // registries and apparatus from all documents; the corpus header too
  // declares registry entries (C29: a collection's listWit lives there)
  if (model.corpusHeaderTree) {
    for (const node of walkModel(model.corpusHeaderTree)) {
      collectRegistries(node, model.registries, byXmlId);
    }
  }
  for (const doc of model.documents) {
    for (const node of walkModel(doc.tree)) {
      collectRegistries(node, model.registries, byXmlId);
      collectApparatus(node, appByType);
    }
  }
  model.apparatus = [...appByType.values()];

  // the genetic apparatus: here the primary dimension is not the witness but
  // time. Campaigns of correction are declared in listChange; each writing
  // operation says which campaign and which hand it belongs to (@change,
  // @hand), and the stratigraphy is the order the edition declares (D7)
  {
    const GENETIC = new Set(['add', 'del', 'subst', 'restore', 'retrace', 'mod',
      'addSpan', 'delSpan', 'transpose', 'metamark']);
    const ops = [];
    for (const doc of model.documents) {
      // documentary editions do not repeat @hand on every operation: a
      // handShift declares the hand in force until the next one (C72)
      let current = null;
      for (const n of walkModel(doc.tree)) {
        if (n.element === 'handShift') {
          current = (n.atts.new || '').replace(/^#/, '') || null;
          continue;
        }
        if (!GENETIC.has(n.element)) continue;
        const layer = (n.atts.change || '').replace(/^#/, '') || null;
        const hand = (n.atts.hand || '').replace(/^#/, '') || current;
        // the hand in force is stamped on the operation, so the page can show
        // whose hand it is even where the markup left it to the handShift (C79)
        if (!n.atts.hand && current) n.atts.hand = '#' + current;
        if (!layer && !hand) continue;
        ops.push({
          id: n.id, doc: doc.id, element: n.element, layer, hand,
          place: n.atts.place || null, seq: n.atts.seq || null,
          text: textOfModel(n).trim().replace(/\s+/g, ' ').slice(0, 160),
        });
      }
    }
    if (ops.length) {
      // a change in revisionDesc that names an editor is the file's own
      // history, not a campaign of the author: only strata with operations
      // attributed to them are strata (C73)
      const strata = model.registries.layers.map((l) => ({
        id: l.id, label: l.label, order: l.order,
        when: l.atts && (l.atts.when || l.atts.notBefore) || null,
        operations: ops.filter((o) => o.layer === l.id).length,
      }));
      for (const h of model.registries.hands) {
        if (!strata.some((x) => x.id === h.id) && ops.some((o) => o.hand === h.id)) {
          strata.push({ id: h.id, label: h.label, order: strata.length, hand: true,
            operations: ops.filter((o) => o.hand === h.id).length });
        }
      }
      const kept = strata.filter((x) => x.operations > 0);
      if (kept.length) model.genetic = { strata: kept, operations: ops };
    }
  }

  // agreement between witnesses: how often two of them carry the same
  // reading. The stemma is the editor's argument, never derived; this is
  // the evidence an editor weighs while building it (D6)
  const wits = model.registries.witnesses.map((w) => w.id);
  if (wits.length > 1) {
    const pair = new Map();
    const seen = new Map();
    for (const reg of model.apparatus) {
      for (const e of reg.entries) {
        for (const r of e.readings) {
          const ws = (r.witnesses || []).filter((w) => wits.includes(w));
          for (const w of ws) seen.set(w, (seen.get(w) || 0) + 1);
          for (let i = 0; i < ws.length; i++) {
            for (let j = i + 1; j < ws.length; j++) {
              const k = [ws[i], ws[j]].sort().join('\u0000');
              pair.set(k, (pair.get(k) || 0) + 1);
            }
          }
        }
      }
    }
    if (pair.size) {
      model.agreement = {
        witnesses: [...seen.entries()].map(([id, readings]) => ({ id, readings })),
        pairs: [...pair.entries()]
          .map(([k, n]) => { const [a, b] = k.split('\u0000'); return { a, b, together: n }; })
          .sort((x, y) => y.together - x.together),
      };
    }
  }

  // occurrences: nodes pointing into registries via @ref/@key. An external
  // authority URI is an identity declaration of its own: mentions sharing
  // the same VIAF/Wikidata/GeoNames reference are one entity, and enter the
  // registries keyed by that URI (the markup decides, no registry needed)
  // @key too declares identity: TEI's canonical-name key ("Figueredo,
  // Thomas de") groups mentions the same way, label = the canonical form
  const byUri = new Map();
  const addIdentity = (regKey, id, label, node, external) => {
    let e = byUri.get(id);
    if (!e) {
      e = {
        id,
        label,
        atts: external ? { ref: id } : { key: id },
        external: !!external,
        occurrences: [],
      };
      byUri.set(id, e);
      model.registries[regKey].push(e);
    }
    e.occurrences.push(node.id);
  };
  for (const doc of model.documents) {
    for (const node of walkModel(doc.tree)) {
      if (node.atts.ref) {
        for (const t of node.atts.ref.split(/\s+/)) {
          const entry = byXmlId.get(t.startsWith('#') ? t.slice(1) : t);
          if (entry) { entry.occurrences.push(node.id); continue; }
          if (/^https?:\/\//.test(t) && MENTION_REGISTRY[node.element]) {
            addIdentity(MENTION_REGISTRY[node.element], t,
              textOfModel(node).trim().replace(/\s+/g, ' ') || t, node, true);
          }
        }
      }
      if (node.atts.key) {
        const k = node.atts.key.trim();
        if (!k) continue;
        const entry = byXmlId.get(k.startsWith('#') ? k.slice(1) : k);
        if (entry) entry.occurrences.push(node.id);
        else if (MENTION_REGISTRY[node.element]) {
          addIdentity(MENTION_REGISTRY[node.element], k, k, node, false);
        }
      }
    }
  }

  return model;
}

/* ---------------------------------------------------------------- */

function convert(node, docId, path, classMap) {
  const element = local(node.name);
  const r = classMap.resolve(element);
  const out = {
    id: node.attrs['xml:id'] || `${docId}:${path}`, // D1
    element,                                        // D2
    section: r.section,                             // D2
    atts: { ...node.attrs },                        // D3
    children: [],
  };
  let i = 0;
  const wordInternal = WORD_INTERNAL.has(element);
  for (const child of node.children) {
    if (typeof child === 'string') {
      if (wordInternal) {
        // C20: inside word-level elements, whitespace is source formatting,
        // not text; word separation comes from pc and element boundaries
        const s = child.replace(/\s+/g, '');
        if (s) out.children.push(s);
      } else if (ELEMENT_ONLY.has(element) && !child.trim()) {
        // C20: these content models admit no character data, so
        // whitespace-only nodes can only be source formatting
        continue;
      } else {
        out.children.push(child);
      }
    } else out.children.push(convert(child, docId, `${path}.${i++}`, classMap));
  }
  return out;
}

/** Elements whose direct text content is a single word or smaller (TEI
 *  model.segLike, sub-word members): internal whitespace is indentation. */
const WORD_INTERNAL = new Set(['w', 'm', 'c']);

/** Elements whose P5 content model is element-only (alternations and
 *  groupings, no character data): whitespace between children is indentation. */
const ELEMENT_ONLY = new Set(['choice', 'subst', 'app', 'rdgGrp']);

export function* walkModel(node) {
  if (!node) return;
  yield node;
  for (const child of node.children) {
    if (typeof child !== 'string') yield* walkModel(child);
  }
}

export function textOfModel(node) {
  let out = '';
  for (const child of node.children) {
    out += typeof child === 'string' ? child : textOfModel(child);
  }
  return out;
}

function findFirst(tree, element) {
  if (!tree) return null;
  for (const n of walkModel(tree)) if (n.element === element) return n;
  return null;
}

/* ---------------------------------------------------------------- */

function extractMeta(header, root = null) {
  const meta = {};
  const titleStmt = findFirst(header, 'titleStmt');
  const title = titleStmt && findFirst(titleStmt, 'title');
  if (title) meta.title = textOfModel(title).trim().replace(/\s+/g, ' ');
  const licence = findFirst(header, 'licence');
  if (licence) {
    meta.licence = {
      target: licence.atts.target || null,
      text: textOfModel(licence).trim().replace(/\s+/g, ' ') || null,
    };
  }
  meta.responsibility = [];
  if (titleStmt) for (const n of walkModel(titleStmt)) {
    if (n.element === 'author' || n.element === 'editor') {
      meta.responsibility.push({ role: n.element, name: textOfModel(n).trim().replace(/\s+/g, ' ') });
    }
    if (n.element === 'respStmt') {
      // a respStmt may name more than one person: all of them are responsible
      const resp = findFirst(n, 'resp');
      const names = [];
      for (const c of walkModel(n)) {
        if (c.element === 'name' || c.element === 'persName' || c.element === 'orgName') {
          names.push(textOfModel(c).trim().replace(/\s+/g, ' '));
        }
      }
      meta.responsibility.push({
        role: resp ? textOfModel(resp).trim() : 'resp',
        name: names.filter(Boolean).join(', '),
      });
    }
  }
  // the edition's own version: editionStmt is the scholarly place for it
  // ("first edition", "version 2.1"); revisionDesc below records the changes
  const editionStmt = findFirst(header, 'editionStmt');
  if (editionStmt) {
    const ed = findFirst(editionStmt, 'edition');
    if (ed) {
      const text = textOfModel(ed).trim().replace(/\s+/g, ' ');
      if (text || ed.atts.n) meta.edition = { n: ed.atts.n || null, text };
    }
  }

  const langUsage = findFirst(header, 'langUsage');
  if (langUsage) {
    meta.languages = [];
    for (const n of walkModel(langUsage)) {
      if (n.element === 'language' && n.atts.ident) meta.languages.push(n.atts.ident);
    }
  }
  // an edition may declare its language on the root instead of in langUsage:
  // both are legitimate, and a text in Greek must not be announced as English
  if ((!meta.languages || !meta.languages.length) && root && root.atts && root.atts['xml:lang']) {
    meta.languages = [root.atts['xml:lang']];
  }
  const revisions = [];
  const revDesc = findFirst(header, 'revisionDesc');
  if (revDesc) for (const n of walkModel(revDesc)) {
    if (n.element === 'change') {
      revisions.push({
        when: n.atts.when || null,
        who: n.atts.who || null,
        what: textOfModel(n).trim().replace(/\s+/g, ' '),
      });
    }
  }
  if (revisions.length) meta.revisions = revisions;
  return meta;
}

/**
 * The document card: curated metadata for the collection register.
 * A convenience digest, never exclusive: the full header is always rendered
 * on the document's page. Priority chains, markup decides:
 *   date:  correspDesc(sent) -> creation -> origDate -> docDate
 *   from/to: correspAction persons; author as fallback agent
 *   place: correspDesc(sent) -> origPlace -> pubPlace
 */
function extractCard(header, tree, docId) {
  const card = { id: docId, title: null, date: null, from: [], to: [], author: null, place: null, idno: null };
  const clean = (n) => textOfModel(n).trim().replace(/\s+/g, ' ');

  if (header) {
    const titleStmt = findFirst(header, 'titleStmt');
    const title = titleStmt && findFirst(titleStmt, 'title');
    if (title) card.title = clean(title);
    const author = titleStmt && findFirst(titleStmt, 'author');
    if (author) card.author = clean(author);

    for (const n of walkModel(header)) {
      if (n.element !== 'correspAction') continue;
      const kind = n.atts.type;
      for (const m of walkModel(n)) {
        if (m.element === 'persName' || m.element === 'orgName' || m.element === 'name') {
          const who = clean(m);
          if (who) (kind === 'received' ? card.to : card.from).push(who);
        }
        if (kind !== 'received' && (m.element === 'placeName' || m.element === 'settlement') && !card.place) {
          card.place = clean(m);
        }
        if (kind !== 'received' && m.element === 'date' && !card.date) {
          card.date = { when: m.atts.when || m.atts.from || null, text: clean(m) };
        }
      }
    }
    if (!card.date) {
      const creation = findFirst(header, 'creation');
      const d = creation && findFirst(creation, 'date');
      if (d) card.date = { when: d.atts.when || d.atts['when-iso'] || d.atts.from || d.atts.notBefore || null, text: clean(d) };
    }
    if (!card.date) {
      const od = findFirst(header, 'origDate');
      if (od) card.date = { when: od.atts.when || od.atts['when-iso'] || od.atts.notBefore || null, text: clean(od) };
    }
    if (!card.place) {
      const op = findFirst(header, 'origPlace');
      if (op) card.place = clean(op);
    }
    const msId = findFirst(header, 'msIdentifier');
    const idno = (msId && findFirst(msId, 'idno')) || findFirst(header, 'idno');
    if (idno) card.idno = clean(idno);
  }
  if (!card.date) {
    const dd = findFirst(tree, 'docDate');
    if (dd) card.date = { when: dd.atts.when || null, text: clean(dd) };
  }
  if (!card.title) {
    const head = findFirst(tree, 'head');
    if (head) card.title = clean(head).slice(0, 120);
  }
  card.from = [...new Set(card.from)];
  card.to = [...new Set(card.to)];
  return card;
}

const REGISTRY_ELEMENTS = {
  person: 'people',
  place: 'places',
  org: 'orgs',
  witness: 'witnesses',
  handNote: 'hands',
  change: 'layers',
};

/** Mention elements whose external @ref declares an entity's identity. */
const MENTION_REGISTRY = {
  persName: 'people', author: 'people',
  placeName: 'places', settlement: 'places', geogName: 'places', origPlace: 'places',
  orgName: 'orgs', institution: 'orgs', repository: 'orgs',
};

function collectRegistries(node, reg, byXmlId) {
  const key = REGISTRY_ELEMENTS[node.element];
  if (!key) return;
  // layers only from listChange, witnesses only from listWit-ish contexts are
  // not enforced in v0: the element itself is the signal.
  const entry = {
    id: node.atts['xml:id'] || node.id,
    label: registryLabel(node),
    atts: node.atts,
    occurrences: [],
  };
  if (key === 'places') {
    const geo = findFirst(node, 'geo');
    if (geo) {
      const [lat, lon] = textOfModel(geo).trim().split(/[\s,]+/).map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lon)) entry.geo = { lat, lon };
    }
  }
  if (key === 'witnesses') {
    // the register page can carry the full description, untruncated
    entry.full = pointersText(node).trim().replace(/\s+/g, ' ');
  }
  if (key === 'hands') entry.scope = node.atts.scope || null;
  if (key === 'layers') entry.order = reg.layers.length;
  reg[key].push(entry);
  if (node.atts['xml:id']) byXmlId.set(node.atts['xml:id'], entry);
}

/** Text with pointers surfaced: a ptr or an empty ref yields its @target,
 *  so bibliographic entries never end in a dangling "URL:" (nothing is
 *  invisible). */
function pointersText(node) {
  let out = '';
  for (const c of node.children) {
    if (typeof c === 'string') { out += c; continue; }
    if (c.element === 'ptr' || c.element === 'ref') {
      const inner = pointersText(c);
      out += inner.trim() ? inner : (c.atts.target || '');
      continue;
    }
    out += pointersText(c);
  }
  return out;
}

function registryLabel(node) {
  for (const el of ['persName', 'placeName', 'orgName', 'name', 'label']) {
    const n = findFirst(node, el);
    if (n) return textOfModel(n).trim().replace(/\s+/g, ' ');
  }
  // no truncation: the model is lossless, compactness belongs to the pages
  return pointersText(node).trim().replace(/\s+/g, ' ');
}

/* ---------------------------------------------------------------- */

/** Reading text without the embedded witness lists (wit/idno inside rdg). */
function textOfReading(node) {
  let out = '';
  for (const c of node.children) {
    if (typeof c === 'string') { out += c; continue; }
    if (c.element === 'wit' || c.element === 'witDetail') continue;
    out += textOfReading(c);
  }
  return out;
}

function collectApparatus(node, appByType) {
  if (node.element !== 'app') return;
  const type = node.atts.type || 'critical';
  if (!appByType.has(type)) appByType.set(type, { type, entries: [] });
  const readings = [];
  let lemma = null;
  // readings grouped in rdgGrp are readings: the grouping is not a hiding
  const children = [];
  for (const c of node.children) {
    if (typeof c === 'string') continue;
    if (c.element === 'rdgGrp') {
      for (const g of c.children) if (typeof g !== 'string') children.push(g);
    } else children.push(c);
  }
  for (const child of children) {
    if (child.element === 'lem' || child.element === 'rdg') {
      const reading = {
        text: textOfReading(child).trim(),
        witnesses: (child.atts.wit || '').split(/\s+/).filter(Boolean).map((w) => w.replace(/^#/, '')),
        // a conjecture has no witness: its authority is its source or the
        // scholar who proposed it (@source, @resp)
        sources: (child.atts.source || '').split(/\s+/).filter(Boolean).map((w) => w.replace(/^#/, '')),
        resp: (child.atts.resp || '').split(/\s+/).filter(Boolean).map((w) => w.replace(/^#/, '')),
        cert: child.atts.cert || null,
        type: child.atts.type || null,
        isLemma: child.element === 'lem',
      };
      readings.push(reading);
      if (child.element === 'lem') lemma = reading.text;
    }
  }
  // the three methods of chapter 12, told apart by what the app declares
  const from = node.atts.from || null, to = node.atts.to || null;
  const loc = node.atts.loc || null;
  const method = loc ? 'location-referenced'
    : (from && /^#/.test(from)) ? 'double-end-point'
    : 'parallel-segmentation';
  appByType.get(type).entries.push({
    id: node.id, anchor: node.id, lemma, readings, method, loc,
    n: node.atts.n || null, from, to,
  });
}
