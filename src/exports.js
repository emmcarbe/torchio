/**
 * Exports — the edition as reusable data.
 *
 * Every export is a projection of the model (Separation 1): JSON is the model
 * itself; CSV flattens the registries and the apparatus into tables. The
 * source XML travels alongside untouched: the repository is the edition.
 */

export function csvCell(v) {
  let s = v == null ? '' : String(v);
  // a cell that opens with =, +, - or @ is a formula for spreadsheets:
  // editorial text must arrive as text
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(rows) {
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

export function modelJSON(model) {
  // the token stream travels as tokens.csv, not duplicated inside the JSON
  return JSON.stringify({ ...model, tokens: undefined }, null, 1);
}

export function entitiesCSV(model) {
  const rows = [['type', 'id', 'label', 'occurrences', 'lat', 'lon']];
  const reg = model.registries;
  for (const [type, entries] of [['person', reg.people], ['place', reg.places], ['org', reg.orgs]]) {
    for (const e of entries) {
      rows.push([type, e.id, e.label, e.occurrences.length, e.geo?.lat ?? '', e.geo?.lon ?? '']);
    }
  }
  return csv(rows);
}

export function apparatusCSV(model) {
  const rows = [['register', 'entry', 'lemma', 'reading', 'witnesses',
    'source', 'resp', 'cert', 'type', 'isLemma']];
  for (const reg of model.apparatus) {
    for (const entry of reg.entries) {
      for (const r of entry.readings) {
        rows.push([reg.type, entry.id, entry.lemma ?? '', r.text, r.witnesses.join(' '),
          (r.sources || []).join(' '), (r.resp || []).join(' '), r.cert ?? '', r.type ?? '', r.isLemma]);
      }
    }
  }
  return csv(rows);
}

/**
 * The token stream as data: one row per token of the reading layer, in
 * text order. "position" is the sequential index in the reading text with
 * the markup stripped; "anchor" is the way back into the marked text. All
 * quantitative work (frequencies, dispersion, collocations, n-grams)
 * derives from this table without ever re-parsing the TEI.
 */
export function tokensCSV(model, tokens) {
  const rows = [['position', 'doc', 'lang', 'form', 'lemma', 'anchor']];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    rows.push([i, t.docId, t.lang || '', t.form, t.lemma || '', t.anchor]);
  }
  return csv(rows);
}

export function lemmasCSV(model) {
  const rows = [['lemma', 'form', 'count', 'total']];
  for (const e of model.lemmas.entries) {
    for (const [form, n] of e.forms) rows.push([e.lemma, form, n, e.count]);
  }
  return csv(rows);
}

/**
 * Assemble the export files for an edition.
 * @returns {Object<string,string>} path (relative to the site root) -> content
 */
/** Word frequencies, in full: what the page shows is what a page can carry,
 *  this is everything. Absolute count, per-thousand, language, stopword flag. */
export function frequenciesCSV(model) {
  const L = model.lexicon;
  if (!L) return '';
  const rows = [['form', 'lang', 'count', 'per_thousand', 'stopword']];
  for (const f of L.frequencies) {
    rows.push([f.form, f.lang || '', f.count, f.rel, f.stop ? 'yes' : 'no']);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

/** The concordance of the attested forms: every occurrence with its context
 *  and the anchor that leads back into the text. */
export function concordanceCSV(model) {
  const L = model.lexicon;
  if (!L) return '';
  const rows = [['form', 'doc', 'before', 'keyword', 'after', 'anchor']];
  for (const [form, occ] of Object.entries(L.concordance)) {
    for (const o of occ) rows.push([form, o.docId, o.before, o.form, o.after, o.anchor]);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

/** The concordance under the lemma, where the edition has lemmas: the same
 *  evidence grouped as the editor grouped it. */
export function lemmaConcordanceCSV(model) {
  if (!model.lemmas) return '';
  const rows = [['lemma', 'lang', 'form', 'doc', 'before', 'keyword', 'after', 'anchor']];
  for (const e of model.lemmas.entries) {
    for (const o of e.occurrences || []) {
      rows.push([e.lemma, e.lang || '', o.form, o.docId, o.before, o.form, o.after, o.anchor]);
    }
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

export function buildExports(model, { sourceXML = null, only = null } = {}) {
  // `only` is the manifest's exports object: each piece defaults to true
  // and is switched off explicitly ("exports": {"model": false})
  const want = (k) => !only || only[k] !== false;
  const files = {};
  if (want('model')) {
    const json = modelJSON(model);
    // a file the repository cannot carry is not published: GitHub refuses any
    // blob over 100 MB, so an edition that emits one cannot be pushed at all,
    // and the Data page would promise a download that answers 404. The model
    // is then split per document, which is also the shape a reader wants
    const MAX = 90 * 1024 * 1024;
    if (json.length <= MAX) files['data/model.json'] = json;
    else if (model.documents && model.documents.length > 1) {
      const index = { split: true, reason: 'the whole model exceeds what a repository can carry',
        bytes: json.length, documents: [] };
      for (const d of model.documents) {
        const one = JSON.stringify({ meta: model.meta, generator: model.generator,
          documents: [d] }, null, 1);
        const name = `data/model/${String(d.id).replace(/[^\w.-]/g, '_')}.json`;
        files[name] = one;
        index.documents.push({ id: d.id, file: name.replace('data/', ''), bytes: one.length });
      }
      files['data/model.json'] = JSON.stringify(index, null, 1);
    }
  }
  const reg = model.registries;
  if (want('entities') && reg.people.length + reg.places.length + reg.orgs.length > 0) {
    files['data/entities.csv'] = entitiesCSV(model);
  }
  if (want('apparatus') && model.apparatus.length) {
    files['data/apparatus.csv'] = apparatusCSV(model);
  }
  if (want('lemmas') && model.lemmas && model.lemmas.entries.length) {
    files['data/lemmas.csv'] = lemmasCSV(model);
    files['data/lemma-concordance.csv'] = lemmaConcordanceCSV(model);
  }
  if (want('lexicon') && model.lexicon && model.lexicon.total) {
    files['data/frequencies.csv'] = frequenciesCSV(model);
    files['data/concordance.csv'] = concordanceCSV(model);
  }
  if (want('tokens') && model.tokens && model.tokens.length) {
    files['data/tokens.csv'] = tokensCSV(model, model.tokens);
  }
  if (want('source') && sourceXML) files['data/source.xml'] = sourceXML;
  return files;
}
