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

import { walk, local, textOf, TEI_NS } from './xml.js';

export function buildModel(docs, classMap) {
  let list = (Array.isArray(docs) ? docs : [docs]).map((d, i) =>
    d.root ? d : { id: null, root: d, index: i });

  // A teiCorpus is recursive. Every nested TEI remains a document; otherwise
  // a legitimate corpus inside a corpus silently disappears.
  const expanded = [];
  const expand = (item) => {
    const rootName = item.root.name.replace(/^.*:/, '');
    if (rootName === 'teiCorpus') {
      for (const child of item.root.children) {
        if (typeof child === 'string') continue;
        const childName = child.name.replace(/^.*:/, '');
        if (childName === 'TEI') {
          expanded.push({ id: child.attrs?.['xml:id'] || null, root: child, index: expanded.length });
        } else if (childName === 'teiCorpus') {
          expand({ id: child.attrs?.['xml:id'] || null, root: child, index: expanded.length });
        } else if (childName === 'teiHeader') {
          expanded.push({ id: '__corpusHeader', root: child, index: -1, corpusHeader: true });
        }
      }
    } else {
      expanded.push({ ...item, index: expanded.length });
    }
  };
  for (const item of list) expand(item);
  list = expanded;

  const model = {
    meta: {},
    documents: [],
    registries: { people: [], places: [], orgs: [], witnesses: [], hands: [], layers: [] },
    apparatus: [],
    facsimiles: [],
    generator: { name: 'torchio', tei: classMap.teiVersion },
  };

  // xml:id is unique PER DOCUMENT, not per collection (XML 1.0). Two documents
  // may both declare <person xml:id="p1">, and a #p1 in document A must resolve
  // to A's entry, never to whichever document happened to be read last (C86).
  // The corpus header is the one shared scope: its listWit is referenced from
  // every document by design (C29)
  const ids = { corpus: new Map(), docs: new Map() };
  const idScope = (docId) => {
    if (docId == null) return ids.corpus;
    let m = ids.docs.get(docId);
    if (!m) { m = new Map(); ids.docs.set(docId, m); }
    return m;
  };
  const resolveId = (raw, docId) => {
    const id = raw.startsWith('#') ? raw.slice(1) : raw;
    const local = ids.docs.get(docId);
    return (local && local.get(id)) || ids.corpus.get(id) || null;
  };
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
      collectRegistries(node, model.registries, idScope(null));
    }
  }
  for (const doc of model.documents) {
    const scope = idScope(doc.id);
    for (const node of walkModel(doc.tree)) {
      collectRegistries(node, model.registries, scope);
      collectApparatus(node, appByType);
      collectFacsimile(node, model.facsimiles);
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
      // A hand declared on an operation governs its nested operations, while a
      // handShift governs following document order. These are different kinds
      // of scope and must not overwrite one another.
      const visit = (parent, activeHand = null, inheritedHand = null) => {
        let current = activeHand;
        for (const n of parent.children) {
          if (typeof n === 'string') continue;
          if (n.element === 'handShift') {
            current = (n.atts.new || '').replace(/^#/, '') || null;
            continue;
          }
          const isOperation = GENETIC.has(n.element);
          const layer = isOperation ? (n.atts.change || '').replace(/^#/, '') || null : null;
          const attestedHand = isOperation ? (n.atts.hand || '').replace(/^#/, '') : '';
          const hand = isOperation ? (attestedHand || inheritedHand || current) : inheritedHand;
          const parentSubstitutionIsAttributed = parent.element === 'subst'
            && !!((parent.atts.change || '').replace(/^#/, '') || (parent.atts.hand || '').replace(/^#/, ''));
          // A bare operation is preserved in the tree but does not become a
          // genetic assertion. A dangling @hand still is a declared signal.
          // If subst itself is attributed, its del/add are constituents and
          // are not counted again as independent operations.
          const recordOperation = isOperation && !!(layer || hand)
            && !parentSubstitutionIsAttributed;
          if (recordOperation) {
        // the hand in force reaches the operation even where the markup left
        // it to the handShift, but INFERENCE IS NOT ATTESTATION (C85): the
        // deduced hand never enters n.atts, where it would look identical to a
        // hand the source declares. It lives apart, and every consumer that
        // shows it says it is inferred
            if (!attestedHand && hand) {
              n.inferred = { ...(n.inferred || {}), hand: '#' + hand,
                handRule: inheritedHand ? 'ancestor' : 'handShift' };
            }
            ops.push({
              id: n.id, doc: doc.id, element: n.element, layer, hand,
              handInferred: !attestedHand && !!hand,
              place: n.atts.place || null, seq: n.atts.seq || null,
              text: textOfModel(n).trim().replace(/\s+/g, ' ').slice(0, 160),
            });
          }
          current = visit(n, current, isOperation ? hand : inheritedHand);
        }
        return current;
      };
      visit(doc.tree);
    }
    const referencedLayers = new Set(ops.map((o) => o.layer).filter(Boolean));
    model.registries.layers = model.registries.layers
      .filter((layer) => layer.context !== 'revision' || referencedLayers.has(layer.id));
    if (ops.length || model.registries.layers.length) {
      const substitutions = [];
      for (const doc of model.documents) {
        for (const n of walkModel(doc.tree)) {
          if (n.element !== 'subst') continue;
          const deleted = n.children.find((c) => typeof c !== 'string' && c.element === 'del');
          const added = n.children.find((c) => typeof c !== 'string' && c.element === 'add');
          if (!deleted || !added) continue;
          const inherited = (n.atts.hand || '').replace(/^#/, '') || null;
          const deletedHand = (deleted.atts.hand || '').replace(/^#/, '') || inherited;
          const addedHand = (added.atts.hand || '').replace(/^#/, '') || inherited;
          substitutions.push({ id: n.id, doc: doc.id, deleted: deleted.id, added: added.id,
            hand: deletedHand && deletedHand === addedHand ? deletedHand : null,
            hands: [...new Set([deletedHand, addedHand].filter(Boolean))],
            handConflict: !!(deletedHand && addedHand && deletedHand !== addedHand) });
        }
      }
      // a change in revisionDesc that names an editor is the file's own
      // history, not a campaign of the author: only strata with operations
      // attributed to them are strata (C73)
      const strata = model.registries.layers
        .filter((l) => l.context !== 'revision' || ops.some((o) => o.layer === l.id))
        .map((l) => ({
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
      for (const hand of new Set(ops.map((o) => o.hand).filter(Boolean))) {
        if (!strata.some((x) => x.id === hand)) {
          strata.push({ id: hand, label: `Unresolved hand: ${hand}`, order: strata.length,
            hand: true, unresolved: true, operations: ops.filter((o) => o.hand === hand).length });
        }
      }
      const unassigned = ops.filter((o) => !o.layer && !o.hand);
      if (unassigned.length) {
        strata.push({ id: '__unassigned', label: 'Unassigned operations',
          order: strata.length, unresolved: true, unassigned: true, operations: unassigned.length });
      }
      model.genetic = { strata, operations: ops, substitutions };
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
  const authorityKey = (value) => String(value || '').trim().toLowerCase()
    .replace(/^https?:\/\/(?:www\.)?/, '').replace(/\/$/, '');
  const authorityEntries = new Map();
  for (const regKey of ['people', 'places', 'orgs']) {
    for (const entry of model.registries[regKey]) {
      for (const ident of entry.identifiers || []) authorityEntries.set(authorityKey(ident), entry);
    }
  }
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
          const entry = resolveId(t, doc.id);
          if (entry) { entry.occurrences.push(node.id); continue; }
          const reg = mentionRegistryOf(node);
          if (/^https?:\/\//.test(t) && reg) {
            const declared = authorityEntries.get(authorityKey(t));
            if (declared) { declared.occurrences.push(node.id); continue; }
            addIdentity(reg, t,
              textOfModel(node).trim().replace(/\s+/g, ' ') || t, node, true);
          }
        }
      }
      if (node.atts.key) {
        const k = node.atts.key.trim();
        if (!k) continue;
        const entry = resolveId(k, doc.id);
        if (entry) entry.occurrences.push(node.id);
        else {
          const reg = mentionRegistryOf(node);
          if (reg) addIdentity(reg, k, k, node, false);
        }
      }
    }
  }

  return model;
}

/* ---------------------------------------------------------------- */

/** The namespace in force at this node, from the xmlns declarations gathered
 *  on the way down. A prefixed name resolves against its prefix; a bare name
 *  against the default. Absent default is treated as TEI-compatible, because
 *  Torchio has always pressed non-namespaced TEI. */
function nsOf(node, nsCtx) {
  const i = node.name.indexOf(':');
  if (i >= 0) return nsCtx[node.name.slice(0, i)] || null;
  return nsCtx[''] || null;
}

function hasElement(node, wanted, deep = false) {
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    if (local(child.name) === wanted) return true;
    if (deep && hasElement(child, wanted, true)) return true;
  }
  return false;
}

function stripOuter(value) {
  let s = value.trim();
  while (s.startsWith('(') && s.endsWith(')')) {
    let depth = 0; let quoted = null; let closesAt = -1;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (quoted) { if (ch === quoted && s[i - 1] !== '\\') quoted = null; continue; }
      if (ch === '"' || ch === "'") { quoted = ch; continue; }
      if (ch === '(') depth++;
      if (ch === ')' && --depth === 0) { closesAt = i; break; }
    }
    if (closesAt !== s.length - 1) break;
    s = s.slice(1, -1).trim();
  }
  return s;
}

function splitTopLevel(value, operator) {
  const parts = []; let start = 0; let depth = 0; let quoted = null;
  for (let i = 0; i <= value.length - operator.length; i++) {
    const ch = value[i];
    if (quoted) { if (ch === quoted && value[i - 1] !== '\\') quoted = null; continue; }
    if (ch === '"' || ch === "'") { quoted = ch; continue; }
    if (ch === '(' || ch === '[') { depth++; continue; }
    if (ch === ')' || ch === ']') { depth--; continue; }
    if (depth === 0 && value.slice(i, i + operator.length) === operator
        && (i === 0 || /\s/.test(value[i - 1]))
        && (i + operator.length === value.length || /\s/.test(value[i + operator.length]))) {
      parts.push(value.slice(start, i).trim());
      start = i + operator.length;
      i = start - 1;
    }
  }
  if (parts.length) parts.push(value.slice(start).trim());
  return parts;
}

function childMatches(node, expression) {
  const match = String(expression).trim().match(/^([\w.-]+)(?:\[(?:@([\w:.-]+)\s*=\s*(['"])(.*?)\3|(\d+))\])?$/);
  if (!match) return false;
  const [, name, attr, , expected, position] = match;
  const children = node.children.filter((c) => typeof c !== 'string' && local(c.name) === name);
  if (position) return !!children[Number(position) - 1];
  return children.some((c) => !attr || c.attrs[attr] === expected);
}

function axisMatches(item, expression) {
  const match = String(expression).trim().match(/^([\w.-]+)(?:\[@([\w:.-]+)\s*=\s*(['"])(.*?)\3\])?$/);
  if (!match) return false;
  const [, name, attr, , expected] = match;
  const element = typeof item === 'string' ? item : item.name;
  if (local(element) !== name) return false;
  return !attr || (typeof item !== 'string' && item.attrs?.[attr] === expected);
}

function pathValue(node, expression, ancestry) {
  const path = String(expression).trim();
  if (path === '.') return [node];
  const attr = path.match(/^@([\w:.-]+)$/);
  if (attr) return node.attrs[attr[1]] == null ? [] : [node.attrs[attr[1]]];
  const self = path.match(/^self::([\w.-]+)$/);
  if (self) return local(node.name) === self[1] ? [node] : [];
  const parent = path.match(/^parent::(.+)$/);
  if (parent) return ancestry.length && axisMatches(ancestry[ancestry.length - 1], parent[1]) ? [true] : [];
  const ancestor = path.match(/^ancestor::(.+)$/);
  if (ancestor) return ancestry.some((item) => axisMatches(item, ancestor[1])) ? [true] : [];
  const descendant = path.match(/^(?:\.\/\/|descendant::)([\w.-]+)(?:\/@([\w:.-]+))?$/);
  if (descendant) {
    const values = [];
    for (const child of walk(node)) {
      if (child === node || local(child.name) !== descendant[1]) continue;
      if (descendant[2]) {
        if (child.attrs[descendant[2]] != null) values.push(child.attrs[descendant[2]]);
      } else values.push(child);
    }
    return values;
  }
  const childAttr = path.match(/^([\w.-]+)\/@([\w:.-]+)$/);
  if (childAttr) return node.children
    .filter((c) => typeof c !== 'string' && local(c.name) === childAttr[1]
      && c.attrs[childAttr[2]] != null)
    .map((c) => c.attrs[childAttr[2]]);
  return childMatches(node, path) ? [true] : [];
}

/** A deliberately small XPath predicate evaluator for the ODD Processing
 * Model. Unknown expressions do not match: silently applying a rule in the
 * wrong context would be worse than the base rendering. */
function processingPredicate(expr, node, ancestry) {
  if (!expr) return true;
  const source = String(expr).trim();
  const boolean = (value) => {
    const s = stripOuter(value);
    const ors = splitTopLevel(s, 'or');
    if (ors.length > 1) return ors.some(boolean);
    const ands = splitTopLevel(s, 'and');
    if (ands.length > 1) return ands.every(boolean);
    const neg = s.match(/^not\((.*)\)$/s);
    if (neg) return !boolean(neg[1]);
    const exists = s.match(/^(exists|empty)\((.*)\)$/s);
    if (exists) return exists[1] === 'exists'
      ? pathValue(node, exists[2], ancestry).length > 0
      : pathValue(node, exists[2], ancestry).length === 0;
    const contains = s.match(/^(contains|starts-with|ends-with)\((@?[\w:.-]+)\s*,\s*(['"])(.*?)\3\)$/);
    if (contains) {
      const value = pathValue(node, contains[2], ancestry)[0];
      if (value == null) return false;
      return contains[1] === 'contains' ? String(value).includes(contains[4])
        : contains[1] === 'starts-with' ? String(value).startsWith(contains[4])
          : String(value).endsWith(contains[4]);
    }
    const attrValue = s.match(/^(@?[\w:./-]+)\s*(=|eq|!=|ne)\s*(?:\(([^)]*)\)|(['"])(.*?)\5)$/);
    if (attrValue) {
      const actual = pathValue(node, attrValue[1], ancestry).map(String);
      const expected = (attrValue[3] || attrValue[5] || '').split(/\s*,\s*/)
        .map((v) => v.replace(/^(['"])(.*)\1$/, '$2'));
      const equal = actual.some((v) => expected.includes(v));
      return attrValue[2] === '!=' || attrValue[2] === 'ne' ? !equal : equal;
    }
    const attr = s.match(/^@([\w:.-]+)$/);
    if (attr) return node.attrs[attr[1]] != null && node.attrs[attr[1]] !== '';
    if (s === 'text()') return node.children.some((c) => typeof c === 'string' && c.trim());
    if (s === '.') return textOfModel(node).trim().length > 0;
    if (/^(?:[\w.-]+|(?:child|descendant)::[\w.-]+|\.\/\/)/.test(s)) {
      return pathValue(node, s, ancestry).length > 0;
    }
    return false;
  };
  return boolean(source);
}

function processingFor(resolution, node, ancestry) {
  for (const model of resolution.models || []) {
    if (model.output && !/^(web|html|screen)$/i.test(model.output)) continue;
    if (model.sequence) {
      if (!processingPredicate(model.predicate, node, ancestry)) continue;
      if (model.sequence.some((part) => !processingPredicate(part.predicate, node, ancestry))) continue;
      const parts = model.sequence;
      const merged = parts.reduce((out, part) => ({
        ...out,
        ...part,
        behaviour: out.behaviour || part.behaviour,
        cssClass: [out.cssClass, part.cssClass].filter(Boolean).join(' ') || null,
        outputRendition: [out.outputRendition, part.outputRendition].filter(Boolean).join('; '),
        params: { ...(out.params || {}), ...(part.params || {}) },
        useSourceRendition: out.useSourceRendition || part.useSourceRendition,
      }), { ...model, sequence: parts });
      return { ...merged, source: 'odd' };
    }
    if (processingPredicate(model.predicate, node, ancestry)) return { ...model, source: 'odd' };
  }
  if (resolution.defaultBehaviour) return {
    behaviour: resolution.defaultBehaviour,
    source: 'tei-all',
    via: resolution.defaultBehaviourVia,
    params: {},
  };
  return null;
}

function convert(node, docId, path, classMap,
    nsCtx = { xml: 'http://www.w3.org/XML/1998/namespace' }, sourceContext = {}, ancestry = []) {
  // extend the namespace scope with this node's own xmlns declarations
  let ns = nsCtx;
  for (const a in node.attrs) {
    if (a === 'xmlns') { ns = ns === nsCtx ? { ...nsCtx } : ns; ns[''] = node.attrs[a]; }
    else if (a.startsWith('xmlns:')) { ns = ns === nsCtx ? { ...nsCtx } : ns; ns[a.slice(6)] = node.attrs[a]; }
  }
  const uri = nsOf(node, ns);
  const element = local(node.name);
  // the fallback scale: a node the ODD adopts (declared memberOf a TEI class)
  // is interpreted whatever its namespace, because the edition said so; a node
  // in a non-TEI namespace that no ODD claims is preserved, never interpreted
  // as a TEI element with that local name (C87). No namespace, or the TEI
  // namespace, is TEI as before
  const r = classMap.resolve(element);
  // A foreign namespace is structural only when the ODD has not declared the
  // local name. Declared extension elements keep their ODD processing model.
  const declared = classMap.elements?.has(element);
  const foreign = uri != null && uri !== TEI_NS && !declared;
  const out = {
    id: node.attrs['xml:id'] || `${docId}:${path}`, // D1
    element,                                        // D2
    section: foreign ? 'base' : r.section,          // D2
    atts: { ...node.attrs },                        // D3
    children: [],
  };
  const nextContext = {
    creation: sourceContext.creation || element === 'creation',
    revision: sourceContext.revision || element === 'revisionDesc',
  };
  if (element === 'change') {
    out.context = nextContext.creation ? 'campaign' : (nextContext.revision ? 'revision' : 'declared');
  }
  const processing = processingFor(r, node, ancestry);
  if (processing && !foreign) out.processing = processing;
  if (foreign) { out.foreign = true; out.qname = node.name; out.ns = uri; }
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
    } else out.children.push(convert(child, docId, `${path}.${i++}`, classMap, ns, nextContext,
      [...ancestry, { name: element, attrs: { ...node.attrs } }]));
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
  region: 'places', country: 'places', district: 'places', bloc: 'places', pubPlace: 'places',
  orgName: 'orgs', institution: 'orgs', repository: 'orgs',
};

/** Which registry a mention belongs to. An editor may mark a person or a place
 *  with a dedicated element (persName, placeName) or with a generic <name> or
 *  <rs> disambiguated by @type: both are recognised, so the tool does not force
 *  one encoding typology on the edition. A bare generic <name>/<rs> with no
 *  @type is left unmapped: the machine does not guess what it is. */
function mentionRegistryOf(node) {
  const direct = MENTION_REGISTRY[node.element];
  if (direct) return direct;
  if (node.element === 'name' || node.element === 'rs') {
    const t = (node.atts.type || '').toLowerCase();
    if (/^(person|pers|people|persname)$/.test(t)) return 'people';
    if (/^(place|loc|location|settlement|geog|geogname|placename)$/.test(t)) return 'places';
    if (/^(org|organization|organisation|institution|orgname)$/.test(t)) return 'orgs';
  }
  return null;
}

function collectRegistries(node, reg, idMap) {
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
  if (node.element === 'change') entry.context = node.context;
  if (key === 'places') {
    const findOwnGeo = (parent) => {
      for (const child of parent.children) {
        if (typeof child === 'string' || child.element === 'place') continue;
        if (child.element === 'geo') return child;
        const nested = findOwnGeo(child);
        if (nested) return nested;
      }
      return null;
    };
    const geo = findOwnGeo(node);
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
  const identifiers = [];
  for (const n of walkModel(node)) {
    if (n.element !== 'idno') continue;
    const value = textOfModel(n).trim();
    if (!value) continue;
    identifiers.push(value);
    if (/^viaf$/i.test(n.atts.type || '') && /^\d+$/.test(value)) {
      identifiers.push(`viaf.org/viaf/${value}`);
    }
  }
  if (identifiers.length) entry.identifiers = identifiers;
  reg[key].push(entry);
  if (node.atts['xml:id']) idMap.set(node.atts['xml:id'], entry);
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
    if (c.element === 'app') {
      const candidates = [...walkModel(c)]
        .filter((n) => n !== c && (n.element === 'lem' || n.element === 'rdg'));
      const chosen = candidates.find((n) => n.element === 'lem') || candidates[0];
      if (chosen) out += textOfReading(chosen);
      continue;
    }
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
        lacuna: [...walkModel(child)].some((n) =>
          n.element === 'lacunaStart' || n.element === 'lacunaEnd' || n.element === 'lacuna'),
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

function collectFacsimile(node, facsimiles) {
  if (!['facsimile', 'surface', 'surfaceGrp', 'zone', 'graphic'].includes(node.element)) return;
  const url = node.atts.url || node.atts.facs || node.atts.target || null;
  facsimiles.push({
    id: node.id,
    element: node.element,
    label: node.atts.n || node.atts['xml:id'] || node.element,
    url,
    ulx: node.atts.ulx || null,
    uly: node.atts.uly || null,
    lrx: node.atts.lrx || null,
    lry: node.atts.lry || null,
    corresp: node.atts.corresp || null,
    source: node.atts.source || null,
  });
}
