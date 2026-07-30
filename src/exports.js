/**
 * Exports — the edition as reusable data.
 *
 * Every export is a projection of the model (Separation 1): JSON is the model
 * itself; CSV flattens the registries and the apparatus into tables. The
 * source XML travels alongside untouched: the repository is the edition.
 */

function csvCell(v) {
  const s = v == null ? '' : String(v);
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
  const rows = [['register', 'entry', 'lemma', 'reading', 'witnesses', 'type', 'isLemma']];
  for (const reg of model.apparatus) {
    for (const entry of reg.entries) {
      for (const r of entry.readings) {
        rows.push([reg.type, entry.id, entry.lemma ?? '', r.text, r.witnesses.join(' '), r.type ?? '', r.isLemma]);
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
export function buildExports(model, { sourceXML = null } = {}) {
  const files = {};
  files['data/model.json'] = modelJSON(model);
  const reg = model.registries;
  if (reg.people.length + reg.places.length + reg.orgs.length > 0) {
    files['data/entities.csv'] = entitiesCSV(model);
  }
  if (model.apparatus.length) {
    files['data/apparatus.csv'] = apparatusCSV(model);
  }
  if (model.lemmas && model.lemmas.entries.length) {
    files['data/lemmas.csv'] = lemmasCSV(model);
  }
  if (model.tokens && model.tokens.length) {
    files['data/tokens.csv'] = tokensCSV(model, model.tokens);
  }
  if (sourceXML) files['data/source.xml'] = sourceXML;
  return files;
}
