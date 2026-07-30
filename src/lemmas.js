/**
 * Lemmas: concordances and frequencies, only where lemmas exist.
 *
 * Forms alone make no philological sense in flective traditions ("errò" and
 * "errare" are one word, not two), so the lemma index appears only when the
 * edition carries lemmas — and it says where they come from:
 *
 *   1. the markup decides: <w lemma="..."> (or @lemmaRef) is used as is;
 *   2. otherwise lemmas.json next to the TEI, in the reconciliation pattern:
 *      a working tool (tools/lemmatize.js) writes suggestions, the editor
 *      reviews, only the editor's decisions survive re-runs, the press
 *      consumes the reviewed file.
 *
 * No lemmas, no page: a concordance of raw forms is never passed off as an
 * index of lemmas. Traditions that are not lemmatized declare a different
 * strategy (or none); the lemma is never presumed.
 *
 * Tokenization is Intl.Segmenter (native Unicode, zero dependencies) over
 * the reading layer of the body: lem in app, reg/expan/corr in choice, add
 * kept, del/notes/header excluded. Segmentation follows the platform's ICU:
 * the suite asserts determinism within a build, not across engines.
 */

import { walkModel, textOfModel } from './model.js';

// excluded from the reading layer (diplomatic variants, editorial prose)
const SKIP = new Set(['teiHeader', 'note', 'rdg', 'orig', 'abbr', 'sic', 'del', 'fw']);

/** Collect the token stream of a document tree's reading layer. */
function collectFrom(node, docId, anchor, out, seg) {
  if (SKIP.has(node.element)) return;
  // a <w> is one token by definition; its @lemma is the markup's decision
  if (node.element === 'w') {
    const form = textOfModel(node).trim();
    if (form) {
      out.push({
        form, docId,
        anchor: node.id,
        lemma: node.atts.lemma || null,
        provenance: node.atts.lemma ? 'markup' : null,
      });
    }
    return;
  }
  const here = node.id || anchor;
  for (const child of node.children) {
    if (typeof child === 'string') {
      for (const s of seg.segment(child)) {
        if (!s.isWordLike) continue;
        out.push({ form: s.segment, docId, anchor: here, lemma: null, provenance: null });
      }
    } else {
      collectFrom(child, docId, here, out, seg);
    }
  }
}

/** The bodies to read: each document's text > body. */
function bodies(model) {
  const docs = model.documents
    ? model.documents.map((d) => ({ docId: d.id, tree: d.tree }))
    : [{ docId: model.tree ? model.tree.id : 'doc', tree: model.tree }];
  const found = [];
  for (const { docId, tree } of docs) {
    if (!tree) continue;
    for (const n of walkModel(tree)) {
      if (n.element === 'body') { found.push({ docId, body: n }); break; }
    }
  }
  return found;
}

export function collectTokens(model) {
  const locale = (model.meta.languages && model.meta.languages[0]) || undefined;
  let seg;
  try {
    seg = new Intl.Segmenter(locale, { granularity: 'word' });
  } catch {
    seg = new Intl.Segmenter(undefined, { granularity: 'word' });
  }
  const out = [];
  for (const { docId, body } of bodies(model)) collectFrom(body, docId, body.id, out, seg);
  return out;
}

/**
 * Build the lemma index and attach it to the model as model.lemmas.
 * `file` is the parsed lemmas.json (or null). Returns model.lemmas, which is
 * null when no lemma exists: the page gates itself on this.
 */
export function attachLemmas(model, file = null, { kwicWindow = 5 } = {}) {
  const tokens = collectTokens(model);

  // the reviewed file: form (lowercased) -> {lemma, status}
  const byForm = new Map();
  let generator = null;
  if (file && Array.isArray(file.types)) {
    generator = typeof file.generator === 'string' ? file.generator : null;
    for (const t of file.types) {
      if (!t || typeof t.form !== 'string' || typeof t.lemma !== 'string') continue;
      if (t.status === 'rejected') continue;
      byForm.set(t.form.toLowerCase(), {
        lemma: t.lemma,
        status: t.status === 'confirmed' ? 'confirmed' : t.status === 'review' ? 'review' : 'suggested',
      });
    }
  }

  const provenance = { markup: 0, file: 0 };
  const pending = { suggested: 0, review: 0 };
  for (const tok of tokens) {
    if (tok.lemma) { provenance.markup++; continue; }
    const hit = byForm.get(tok.form.toLowerCase());
    if (hit) {
      tok.lemma = hit.lemma;
      tok.provenance = 'file';
      provenance.file++;
      if (hit.status === 'suggested') pending.suggested++;
      if (hit.status === 'review') pending.review++;
    }
  }

  const lemmatized = provenance.markup + provenance.file;
  if (!lemmatized) { model.lemmas = null; return null; }

  // the index: lemma -> forms, count, occurrences with KWIC context
  const entries = new Map();
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!tok.lemma) continue;
    let e = entries.get(tok.lemma);
    if (!e) { e = { lemma: tok.lemma, count: 0, forms: new Map(), occurrences: [] }; entries.set(tok.lemma, e); }
    e.count++;
    e.forms.set(tok.form, (e.forms.get(tok.form) || 0) + 1);
    const before = tokens.slice(Math.max(0, i - kwicWindow), i).map((t) => t.form).join(' ');
    const after = tokens.slice(i + 1, i + 1 + kwicWindow).map((t) => t.form).join(' ');
    e.occurrences.push({ docId: tok.docId, anchor: tok.anchor, form: tok.form, before, after });
  }

  const locale = (model.meta.languages && model.meta.languages[0]) || undefined;
  const sorted = [...entries.values()].sort((a, b) => a.lemma.localeCompare(b.lemma, locale));
  for (const e of sorted) {
    e.forms = [...e.forms.entries()].sort((a, b) => b[1] - a[1]);
  }

  model.lemmas = {
    entries: sorted,
    tokens: tokens.length,
    lemmatized,
    provenance,
    pending,
    generator,
  };
  return model.lemmas;
}

/* ------------------------------------------------------------------ */
/* Helpers for the working tool (tools/lemmatize.js): pure, testable.  */

/** CoNLL-U text -> Map form(lower) -> Map lemma -> votes. */
export function conlluTypes(conllu) {
  const votes = new Map();
  for (const line of String(conllu).split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const cols = line.split('\t');
    // skip multiword ranges (1-2) and empty nodes (1.1)
    if (cols.length < 3 || cols[0].includes('-') || cols[0].includes('.')) continue;
    const form = cols[1];
    const lemma = cols[2];
    if (!form || !lemma || lemma === '_') continue;
    const key = form.toLowerCase();
    let m = votes.get(key);
    if (!m) { m = new Map(); votes.set(key, m); }
    m.set(lemma, (m.get(lemma) || 0) + 1);
  }
  return votes;
}

/**
 * Votes -> lemmas.json types. Unanimous forms are "suggested"; forms where
 * the tagger disagreed with itself become "review" with the alternatives
 * listed: homographs are the editor's call, never the tool's.
 */
export function typesFromVotes(votes, formFilter = null) {
  const types = [];
  for (const [form, m] of votes) {
    if (formFilter && !formFilter.has(form)) continue;
    const ranked = [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const t = {
      form,
      lemma: ranked[0][0],
      status: 'suggested',
      count: ranked.reduce((s, [, n]) => s + n, 0),
    };
    if (ranked.length > 1) { t.status = 'review'; t.alternatives = ranked.map(([l]) => l); }
    types.push(t);
  }
  return types.sort((a, b) => a.form.localeCompare(b.form));
}

/**
 * Merge fresh suggestions into an existing lemmas.json: the tool proposes,
 * the editor decides, and only the editor's decisions survive re-runs
 * (confirmed / rejected / edited lemmas are never overwritten).
 */
export function mergeLemmaTypes(existing, fresh, generator = null) {
  const out = { generator: generator || (existing && existing.generator) || null, types: [] };
  if (existing && typeof existing.language === 'string') out.language = existing.language;
  if (fresh && typeof fresh.language === 'string') out.language = fresh.language;
  const seen = new Map();
  if (existing && Array.isArray(existing.types)) {
    for (const t of existing.types) {
      if (!t || typeof t.form !== 'string') continue;
      seen.set(t.form.toLowerCase(), { ...t });
    }
  }
  if (fresh && Array.isArray(fresh.types)) {
    for (const t of fresh.types) {
      if (!t || typeof t.form !== 'string') continue;
      const key = t.form.toLowerCase();
      const old = seen.get(key);
      if (!old) { seen.set(key, { ...t, status: t.status || 'suggested' }); continue; }
      // the editor's word is final; a mere suggestion may be refreshed
      if (old.status === 'suggested') {
        seen.set(key, { ...t, status: t.status || 'suggested' });
      }
    }
  }
  out.types = [...seen.values()].sort((a, b) => a.form.localeCompare(b.form));
  return out;
}
