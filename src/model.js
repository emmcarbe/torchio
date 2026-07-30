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

  // meta: the corpus header if there is one, else the first document's
  const firstHeader = findFirst(model.documents[0]?.tree, 'teiHeader');
  model.meta = corpusMeta || (firstHeader ? extractMeta(firstHeader) : {});

  // registries and apparatus from all documents
  for (const doc of model.documents) {
    for (const node of walkModel(doc.tree)) {
      collectRegistries(node, model.registries, byXmlId);
      collectApparatus(node, appByType);
    }
  }
  model.apparatus = [...appByType.values()];

  // occurrences: nodes pointing into registries via @ref/@key
  for (const doc of model.documents) {
    for (const node of walkModel(doc.tree)) {
      const target = node.atts.ref || node.atts.key;
      if (!target) continue;
      for (const t of target.split(/\s+/)) {
        const entry = byXmlId.get(t.startsWith('#') ? t.slice(1) : t);
        if (entry) entry.occurrences.push(node.id);
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

function extractMeta(header) {
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
      const resp = findFirst(n, 'resp');
      const name = findFirst(n, 'name') || findFirst(n, 'persName');
      meta.responsibility.push({
        role: resp ? textOfModel(resp).trim() : 'resp',
        name: name ? textOfModel(name).trim() : '',
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
      if (d) card.date = { when: d.atts.when || d.atts.from || null, text: clean(d) };
    }
    if (!card.date) {
      const od = findFirst(header, 'origDate');
      if (od) card.date = { when: od.atts.when || od.atts.notBefore || null, text: clean(od) };
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
  const t = textOfModel(node).trim().replace(/\s+/g, ' ');
  return t.length > 80 ? t.slice(0, 77) + '…' : t;
}

/* ---------------------------------------------------------------- */

function collectApparatus(node, appByType) {
  if (node.element !== 'app') return;
  const type = node.atts.type || 'critical';
  if (!appByType.has(type)) appByType.set(type, { type, entries: [] });
  const readings = [];
  let lemma = null;
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    if (child.element === 'lem' || child.element === 'rdg') {
      const reading = {
        text: textOfModel(child).trim(),
        witnesses: (child.atts.wit || '').split(/\s+/).filter(Boolean).map((w) => w.replace(/^#/, '')),
        type: child.atts.type || null,
        isLemma: child.element === 'lem',
      };
      readings.push(reading);
      if (child.element === 'lem') lemma = reading.text;
    }
  }
  appByType.get(type).entries.push({ id: node.id, anchor: node.id, lemma, readings });
}
