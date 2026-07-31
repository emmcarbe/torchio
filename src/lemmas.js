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
// one definition only: two functions of the same name, flattened into one
// script by the browser build, silently overwrite each other, and the one
// that lost carried the guard against spreadsheet formulas
import { csvCell } from './exports.js';

// excluded from the reading layer (diplomatic variants, editorial prose)
const SKIP = new Set(['teiHeader', 'note', 'rdg', 'orig', 'abbr', 'sic', 'del', 'fw']);

// editions declare languages in ISO 639-2/3 as often as 639-1 ("lat" and
// "la" are the same declaration): matching normalizes, display follows
const LANG_ALIASES = {
  lat: 'la', ita: 'it', eng: 'en', deu: 'de', ger: 'de', fra: 'fr', fre: 'fr',
  nld: 'nl', dut: 'nl', spa: 'es', por: 'pt', ell: 'el',
};
export function normLang(l) {
  const k = (l || '').toLowerCase().split('-')[0];
  return LANG_ALIASES[k] || k;
}

/** Collect the token stream of a document tree's reading layer.
 *  The language of a token is the markup's decision: the nearest ancestor
 *  with xml:lang, falling back to the edition's declared language. */
function collectFrom(node, docId, anchor, out, segFor, lang) {
  if (SKIP.has(node.element)) return;
  if (node.atts['xml:lang']) lang = node.atts['xml:lang'];
  // a <w> is one token by definition; its @lemma is the markup's decision
  if (node.element === 'w') {
    const form = textOfModel(node).trim();
    if (form) {
      out.push({
        form, docId, lang,
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
      for (const s of segFor(lang).segment(child)) {
        if (!s.isWordLike) continue;
        // a token without a single letter (page numbers, years) is not a
        // word: it stays in the text, never in the lemma index
        if (!/\p{L}/u.test(s.segment)) continue;
        out.push({ form: s.segment, docId, lang, anchor: here, lemma: null, provenance: null });
      }
    } else {
      collectFrom(child, docId, here, out, segFor, lang);
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
  const baseLang = (model.meta.languages && model.meta.languages[0]) || '';
  const segs = new Map();
  const segFor = (lang) => {
    let seg = segs.get(lang);
    if (!seg) {
      try { seg = new Intl.Segmenter(lang || undefined, { granularity: 'word' }); }
      catch { seg = new Intl.Segmenter(undefined, { granularity: 'word' }); }
      segs.set(lang, seg);
    }
    return seg;
  };
  const out = [];
  for (const { docId, body } of bodies(model)) {
    collectFrom(body, docId, body.id, out, segFor, baseLang);
  }
  return out;
}

/**
 * Build the lemma index and attach it to the model as model.lemmas.
 * `file` is the parsed lemmas.json (or null). Returns model.lemmas, which is
 * null when no lemma exists: the page gates itself on this.
 */
export function attachLemmas(model, file = null, { kwicWindow = 5 } = {}) {
  const tokens = collectTokens(model);
  // the token stream is data in its own right (data/tokens.csv), lemmas or
  // not: position without markers, anchor as the way back into the markup
  model.tokens = tokens;

  // the reviewed file: entries may carry a language ("lang"); a typed entry
  // matches only tokens of its language, an untyped one matches any
  const byForm = new Map();
  let generator = null;
  if (file && Array.isArray(file.types)) {
    generator = typeof file.generator === 'string' ? file.generator : null;
    for (const t of file.types) {
      if (!t || typeof t.form !== 'string' || typeof t.lemma !== 'string') continue;
      if (t.status === 'rejected') continue;
      const key = `${normLang(t.lang)}|${t.form.toLowerCase()}`;
      byForm.set(key, {
        lemma: t.lemma,
        status: t.status === 'confirmed' ? 'confirmed' : t.status === 'review' ? 'review' : 'suggested',
      });
    }
  }

  const provenance = { markup: 0, file: 0 };
  const pendingTypes = { suggested: new Set(), review: new Set() };
  for (const tok of tokens) {
    if (tok.lemma) { provenance.markup++; continue; }
    const key = `${normLang(tok.lang)}|${tok.form.toLowerCase()}`;
    const hit = byForm.get(key) || byForm.get(`|${tok.form.toLowerCase()}`);
    if (hit) {
      tok.lemma = hit.lemma;
      tok.provenance = 'file';
      provenance.file++;
      // pending is counted by TYPE: the editor reviews forms, not tokens
      if (hit.status === 'suggested') pendingTypes.suggested.add(key);
      if (hit.status === 'review') pendingTypes.review.add(key);
    }
  }
  const pending = {
    suggested: pendingTypes.suggested.size,
    review: pendingTypes.review.size,
  };

  const lemmatized = provenance.markup + provenance.file;
  if (!lemmatized) { model.lemmas = null; return null; }

  // the index: (language, lemma) -> forms, count, occurrences with KWIC
  // context; "a" in Italian and "a" in Latin are two entries, not one
  const entries = new Map();
  const perLang = new Map();
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const lang = normLang(tok.lang);
    let stat = perLang.get(lang);
    if (!stat) { stat = { lang, tokens: 0, lemmatized: 0 }; perLang.set(lang, stat); }
    stat.tokens++;
    if (!tok.lemma) continue;
    stat.lemmatized++;
    const key = `${lang}|${tok.lemma}`;
    let e = entries.get(key);
    if (!e) { e = { lemma: tok.lemma, lang, count: 0, forms: new Map(), occurrences: [] }; entries.set(key, e); }
    e.count++;
    e.forms.set(tok.form, (e.forms.get(tok.form) || 0) + 1);
    const before = tokens.slice(Math.max(0, i - kwicWindow), i).map((t) => t.form).join(' ');
    const after = tokens.slice(i + 1, i + 1 + kwicWindow).map((t) => t.form).join(' ');
    e.occurrences.push({ docId: tok.docId, anchor: tok.anchor, form: tok.form, before, after });
  }

  const baseLang = normLang((model.meta.languages && model.meta.languages[0]) || '');
  const sorted = [...entries.values()].sort((a, b) =>
    (a.lang === b.lang ? 0 : a.lang === baseLang ? -1 : b.lang === baseLang ? 1 : a.lang.localeCompare(b.lang))
    || a.lemma.localeCompare(b.lemma, a.lang || undefined));
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
    languages: [...perLang.values()].sort((a, b) =>
      a.lang === baseLang ? -1 : b.lang === baseLang ? 1 : a.lang.localeCompare(b.lang)),
  };
  return model.lemmas;
}

/* ------------------------------------------------------------------ */
/* Helpers for the working tool (tools/lemmatize.js): pure, testable.  */

/** CoNLL-U text -> Map form(lower) -> Map "lemma\u0000UPOS" -> votes.
 *  The part of speech travels with the vote: lemmatization depends on it
 *  (porta the noun goes to porta, porta the verb to portare), and a homograph
 *  must reach the editor with its reason attached. */
export function conlluTypes(conllu) {
  const votes = new Map();
  for (const line of String(conllu).split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const cols = line.split('\t');
    // skip multiword ranges (1-2) and empty nodes (1.1)
    if (cols.length < 3 || cols[0].includes('-') || cols[0].includes('.')) continue;
    const form = cols[1];
    const lemma = cols[2];
    const upos = cols[3] && cols[3] !== '_' ? cols[3] : '';
    if (!form || !lemma || lemma === '_') continue;
    const key = form.toLowerCase();
    let m = votes.get(key);
    if (!m) { m = new Map(); votes.set(key, m); }
    const vk = lemma + '\u0000' + upos;
    m.set(vk, (m.get(vk) || 0) + 1);
  }
  return votes;
}

/**
 * Votes -> lemmas.json types. Unanimous forms are "suggested"; forms where
 * the tagger disagreed with itself become "review" with the alternatives
 * listed: homographs are the editor's call, never the tool's.
 */
export function typesFromVotes(votes, formFilter = null, lang = null) {
  const types = [];
  for (const [form, m] of votes) {
    if (formFilter && !formFilter.has(form)) continue;
    // fold the POS-tagged votes by lemma, keeping each lemma's parts of speech
    const byLemma = new Map();
    for (const [vk, n] of m) {
      const [lemma, upos] = vk.split('\u0000');
      let e = byLemma.get(lemma);
      if (!e) { e = { n: 0, pos: new Map() }; byLemma.set(lemma, e); }
      e.n += n;
      if (upos) e.pos.set(upos, (e.pos.get(upos) || 0) + n);
    }
    const ranked = [...byLemma.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]));
    const posOf = (e) => [...e.pos.keys()].join('+');
    const t = {
      form,
      lemma: ranked[0][0],
      status: 'suggested',
      count: ranked.reduce((s, [, e]) => s + e.n, 0),
    };
    const pos = posOf(ranked[0][1]);
    if (pos) t.pos = pos;
    if (lang) t.lang = lang;
    if (ranked.length > 1) {
      // a homograph: the same form under different lemmas, each explained by
      // its part of speech (porta: NOUN -> porta, VERB -> portare)
      t.status = 'review';
      t.alternatives = ranked.map(([l, e]) => posOf(e) ? `${l} (${posOf(e)})` : l);
    }
    types.push(t);
  }
  return types.sort((a, b) => a.form.localeCompare(b.form));
}

/* ------------------------------------------------------------------ */
/* The review circuit: errors exist, so reviewing must be cheap.       */
/* A CSV the editor opens in a spreadsheet, sorted by what deserves    */
/* the eye first: entries the tagger itself doubted, then frequency.   */



export function reviewCSV(types) {
  const rows = [['form', 'lang', 'pos', 'lemma', 'status', 'count', 'alternatives']];
  const sorted = [...types].sort((a, b) =>
    (a.status === 'review' ? 0 : 1) - (b.status === 'review' ? 0 : 1)
    || (b.count || 0) - (a.count || 0)
    || a.form.localeCompare(b.form));
  for (const t of sorted) {
    rows.push([t.form, t.lang || '', t.pos || '', t.lemma, t.status || 'suggested',
      t.count ?? '', (t.alternatives || []).join('; ')]);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

export function parseReviewCSV(text) {
  const rows = [];
  let row = [], cell = '', inQ = false;
  const push = () => { row.push(cell); cell = ''; };
  const endRow = () => { if (row.length > 1 || row[0] !== '') rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') push();
    else if (c === '\n') { push(); endRow(); }
    else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) { push(); endRow(); }
  const [header, ...body] = rows;
  const col = (name) => header.indexOf(name);
  const iF = col('form'), iL = col('lang'), iLe = col('lemma'), iS = col('status');
  if (iF < 0 || iLe < 0) throw new Error('review CSV: "form" and "lemma" columns are required');
  return body.map((r) => ({
    form: r[iF],
    lang: iL >= 0 && r[iL] ? r[iL] : undefined,
    lemma: r[iLe],
    status: iS >= 0 && r[iS] ? r[iS] : undefined,
  })).filter((t) => t.form);
}

/**
 * Apply the editor's reviewed rows to an existing lemmas.json.
 * The rules: an explicit status (confirmed / rejected) is a decision; an
 * edited lemma is a decision too (confirmed), even if the status column was
 * left alone. Untouched rows stay exactly as they were.
 */
export function applyReview(existing, rows) {
  const out = { ...existing, types: existing.types.map((t) => ({ ...t })) };
  const byKey = new Map();
  for (const t of out.types) byKey.set(`${normLang(t.lang)}|${t.form.toLowerCase()}`, t);
  let decided = 0;
  for (const r of rows) {
    const t = byKey.get(`${normLang(r.lang)}|${r.form.toLowerCase()}`);
    if (!t) continue;
    const lemmaEdited = r.lemma && r.lemma !== t.lemma;
    const statusSet = r.status === 'confirmed' || r.status === 'rejected';
    if (!lemmaEdited && !statusSet) continue;
    if (lemmaEdited) t.lemma = r.lemma;
    t.status = statusSet ? r.status : 'confirmed';
    delete t.alternatives;
    decided++;
  }
  return { json: out, decided };
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
  const keyOf = (t) => `${(t.lang || '').toLowerCase()}|${t.form.toLowerCase()}`;
  const seen = new Map();
  if (existing && Array.isArray(existing.types)) {
    for (const t of existing.types) {
      if (!t || typeof t.form !== 'string') continue;
      seen.set(keyOf(t), { ...t });
    }
  }
  if (fresh && Array.isArray(fresh.types)) {
    for (const t of fresh.types) {
      if (!t || typeof t.form !== 'string') continue;
      const key = keyOf(t);
      const old = seen.get(key);
      if (!old) { seen.set(key, { ...t, status: t.status || 'suggested' }); continue; }
      // the editor's word is final; a mere suggestion may be refreshed
      if (old.status === 'suggested') {
        seen.set(key, { ...t, status: t.status || 'suggested' });
      }
    }
  }
  out.types = [...seen.values()].sort((a, b) =>
    (a.lang || '').localeCompare(b.lang || '') || a.form.localeCompare(b.form));
  return out;
}

/** A small stopword list per language: function words carry no lexical
 *  weight, so the frequencies drop them. It is a declaration, not
 *  a rule: an edition can replace it, and the concordance never applies it. */
export const STOPWORDS = {
  it: 'il lo la i gli le un uno una di a da in con su per tra fra e o ma se che chi cui non ne ci vi si mi ti come dove quando perche del dello della dei degli delle al allo alla ai agli alle dal dalla nel nella sul sulla è era sono ho hai ha abbiamo essere avere questo questa quello quella'.split(' '),
  la: 'et in ad de cum ex per pro sed non nec ut si quod qui quae quod is ea id hic haec hoc ille illa illud sum es est sunt erat esse atque aut vel enim autem tamen iam etiam ac a ab e'.split(' '),
  en: 'the a an of to in on at by for with and or but if that which who whom this these those is are was were be been being have has had do does did not no as it its from'.split(' '),
  grc: 'ὁ ἡ τό καί δέ τε γάρ μέν οὖν ἐν εἰς ἐκ ἐπί πρός διά κατά μετά ἀλλά οὐ μή τις τι ὡς εἰ γε'.split(' '),
  fr: 'le la les un une des de du au aux et ou mais si que qui dont ne pas ce cette ces son sa ses leur dans sur pour par avec est sont était être avoir je tu il elle nous vous ils'.split(' '),
  de: 'der die das ein eine und oder aber wenn dass welche wer den dem des in auf mit für von zu aus bei nach ist sind war sein haben ich du er sie es wir ihr nicht kein'.split(' '),
  es: 'el la los las un una de a en con por para y o pero si que quien cuyo no ni se le lo su sus del al es son era ser haber este esta ese esa aquel'.split(' '),
  // historical stages need their own lists: an earlier language is not the modern one
  enm: 'the a an of to in on at by for with and or but if that whiche who this thise tho is are was were be ben have hath had nat no as it his hir hem ther thanne'.split(' '),  // Middle English
  ang: 'se seo þæt and ac gif þe þa þonne on in to of mid for is wæs wæron beon habban ne na þis he heo hit we ge hi'.split(' '),  // Old English
  fro: 'li le la les un une de a en et ou mais se que qui ne pas ce cist cele son sa ses lor dedenz sor por par o est sont ert estre avoir jo tu il ele'.split(' '),  // Old French
};

/** Readable names for the stopword lists, stage included: an editor of a
 *  Middle English text needs enm, not en. */
export const STOPWORD_NAMES = {
  it: 'Italiano', la: 'Latino', en: 'English', grc: 'Ancient Greek', fr: 'Français',
  de: 'Deutsch', es: 'Español', enm: 'Middle English', ang: 'Old English', fro: 'Ancien français',
};

/** The lexical statistics of the text: frequencies of the attested forms and
 *  a concordance, from the same tokens the lemma page uses. It is the raw
 *  layer (forms, not lemmata); the grouping under a lemma is the other page.
 *  Attached as model.lexicon, gated by the piece. */
export function attachLexicon(model, { stopwords = null, kwic = 6 } = {}) {
  const tokens = collectTokens(model);
  if (!tokens.length) { model.lexicon = null; return null; }
  // the whole token stream, so the concordance can be computed over the entire
  // text and every form is findable, hapax included: the Odyssey is not cut to
  // a top-N. Set here too, not only in attachLemmas, for a lexicon without lemmas
  if (!model.tokens) model.tokens = tokens;
  const langs = [...new Set(tokens.map((t) => normLang(t.lang)).filter(Boolean))];
  const stop = new Set();
  for (const l of langs.length ? langs : ['']) {
    for (const w of (stopwords && stopwords[l]) || STOPWORDS[l] || []) stop.add(w.toLowerCase());
  }
  // per-language stopword sets, so a form is judged against its own language
  const stopByLang = new Map();
  for (const l of langs.length ? langs : ['']) {
    stopByLang.set(l, new Set(((stopwords && stopwords[l]) || STOPWORDS[l] || []).map((w) => w.toLowerCase())));
  }
  const forms = new Map();
  const conc = new Map();
  tokens.forEach((t, i) => {
    const l = normLang(t.lang) || (langs[0] || '');
    const key = t.form.toLowerCase();
    if (!forms.has(key)) forms.set(key, { count: 0, lang: l });
    forms.get(key).count++;
    if (!conc.has(key)) conc.set(key, []);
    if (conc.get(key).length < 60) {
      const before = tokens.slice(Math.max(0, i - kwic), i)
        .filter((x) => x.docId === t.docId).map((x) => x.form).join(' ');
      const after = tokens.slice(i + 1, i + 1 + kwic)
        .filter((x) => x.docId === t.docId).map((x) => x.form).join(' ');
      conc.get(key).push({ docId: t.docId, anchor: t.anchor, before, after, form: t.form });
    }
  });
  const total = tokens.length;
  const frequencies = [...forms.entries()]
    .map(([form, v]) => ({ form, count: v.count, lang: v.lang,
      rel: Math.round((v.count / total) * 1000000) / 1000, // per thousand, 3 decimals
      stop: (stopByLang.get(v.lang) || stop).has(form) }))
    .sort((a, b) => b.count - a.count || a.form.localeCompare(b.form));
  model.lexicon = {
    total,
    distinct: forms.size,
    // type-token ratio: lexical variety, distinct forms over running words
    ttr: Math.round((forms.size / total) * 10000) / 10000,
    frequencies,
    concordance: Object.fromEntries(conc),
    languages: langs,
  };
  return model.lexicon;
}
