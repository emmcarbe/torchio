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
  return JSON.stringify(model, null, 1);
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
  if (sourceXML) files['data/source.xml'] = sourceXML;
  return files;
}
