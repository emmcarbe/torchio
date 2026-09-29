/**
 * Reviewed spreadsheets, one reading for every press.
 *
 * The editor's round trip for names and lemmas goes through a spreadsheet:
 * the press proposes, the editor confirms, corrects or rejects in Excel (or
 * LibreOffice, or Numbers), and drops the sheet back. The browser press and
 * the command-line press must read that sheet the same way, or the edition
 * made in one cannot be remade in the other: this module is that one reading
 *. It never guesses what a sheet is from its file name: a names sheet
 * is recognised by its header (label + type), a lemma sheet by its own
 * (form + lemma); anything else is reported, not applied.
 */

import { readZip } from './zip.js';
import { reviewRows } from './xlsx.js';
import { applyReconciliation, canonicalKey, expandMentions } from './reconcile.js';
import { applyReview, normLang } from './lemmas.js';

const registrySize = (model) => (model.registries.people || []).length
  + (model.registries.places || []).length + (model.registries.orgs || []).length;

function parseAuthority(rec, v) {
  for (const part of String(v).split(/[\s;]+/)) {
    const m = part.match(/^(wikidata|viaf|gnd|isil):(.+)$/i);
    if (m) rec[m[1].toLowerCase()] = m[2];
    else if (/^Q\d+$/i.test(part)) rec.wikidata = part;
    else if (/^\d+$/.test(part)) rec.viaf = part;
  }
}

/** A names sheet: what the editor confirmed becomes the registries. */
function applyNamesSheet(model, head, rows) {
  const iL = head.indexOf('label'), iT = head.indexOf('type'), iK = head.indexOf('kind'),
    iS = head.indexOf('status'), iLa = head.indexOf('lat'),
    iLo = head.indexOf('lon'), iA = head.indexOf('authority'), iO = head.indexOf('occId');
  const entities = { person: {}, place: {}, org: {} };
  const confirmedOcc = new Map(); // occId -> the editor's type
  const sheetLabels = new Map(); // label -> {type,label}: the exact proposal set
  // one identity for a name, the register's own (case, accents and
  // punctuation ignored): a stricter key made "Musée d'Orsay" a
  // second entry beside the declared one (C129)
  const nk = (s) => canonicalKey(s);
  for (const r of rows) {
    const type = r[iT], label = r[iL] == null ? '' : String(r[iL]);
    const status = iS >= 0 ? (r[iS] || 'suggested') : 'suggested';
    if (!label) continue;
    const kind = iK >= 0 ? r[iK] : 'marked';
    if (!sheetLabels.has(label)) sheetLabels.set(label, { type: type || '', label });
    if (kind === 'unmarked' || kind === 'candidate') {
      // an occurrence judged in place: confirmed here means "yes, and it is a
      // person / place / org", the type from this very row
      if (status === 'confirmed' && iO >= 0 && r[iO] && entities[type]) {
        confirmedOcc.set(r[iO], type);
        // a confirmed candidate needs its entity to exist
        if (!entities[type][nk(label)]) {
          entities[type][nk(label)] = { label, status: 'confirmed', source: 'editor' };
        }
      }
      continue;
    }
    if (!entities[type]) continue;
    const rec = { label, status, source: 'editor' };
    // an empty lat/lon cell is not a coordinate: Number('') is 0, which would
    // plant the place at 0,0 (the Gulf of Guinea). A blank cell means none
    const latRaw = String(r[iLa] == null ? '' : r[iLa]).trim();
    const lonRaw = String(r[iLo] == null ? '' : r[iLo]).trim();
    const lat = Number(latRaw), lon = Number(lonRaw);
    if (latRaw !== '' && lonRaw !== '' && Number.isFinite(lat) && Number.isFinite(lon)) { rec.lat = lat; rec.lon = lon; }
    if (iA >= 0 && r[iA]) parseAuthority(rec, r[iA]);
    entities[type][nk(label)] = rec;
  }
  const before = registrySize(model);
  applyReconciliation(model, entities);
  const added = registrySize(model) - before;
  const grown = confirmedOcc.size
    ? expandMentions(model, confirmedOcc, { labels: [...sheetLabels.values()] }) : 0;
  const kept = Object.values(entities).reduce((n, o) =>
    n + Object.values(o).filter((r) => r.status === 'confirmed').length, 0);
  return { kept, added, grown };
}

/** A lemma sheet: its decisions merged over what is already known. */
function mergeLemmaSheet(lemmasJson, head, rows) {
  const iF = head.indexOf('form'), iLa = head.indexOf('lang'),
    iLe = head.indexOf('lemma'), iS = head.indexOf('status');
  const reviewed = rows.filter((r) => r[iF] != null && String(r[iF]) !== '').map((r) => ({
    form: String(r[iF]), lang: iLa >= 0 ? r[iLa] : undefined,
    lemma: r[iLe] == null ? r[iLe] : String(r[iLe]), status: iS >= 0 ? r[iS] : undefined,
  }));
  // forms this sheet brings that no earlier sheet or lemmas.json knew become
  // types first, so the review can decide them
  const typeKey = (t) => normLang(t.lang) + '|' + String(t.form).toLowerCase();
  const known = new Set(((lemmasJson && lemmasJson.types) || []).map(typeKey));
  const base = { ...(lemmasJson || {}), types: [...((lemmasJson && lemmasJson.types) || []),
    ...reviewed.filter((r) => !known.has(typeKey(r)))
      .map((r) => ({ form: r.form, lang: r.lang, lemma: r.lemma, status: 'suggested' }))] };
  // applyReview returns { json, decided }: passing the wrapper on made
  // attachLemmas find no types, so a sheet reported "applied" and lemmatized
  // nothing
  return { json: applyReview(base, reviewed).json, forms: reviewed.length };
}

/**
 * Apply every reviewed sheet: names immediately (they change the
 * registries), lemmas merged into the lemmas.json the caller then attaches.
 * @param sheets [{ name, bytes: Uint8Array }]
 * @returns { lemmasJson, notes: string[], status: { names: [], lemmas: [] },
 *            lemmaSheets: { names: string[], forms: number } }
 */
export function applyReviewSheets(model, sheets, lemmasJson = null) {
  const notes = [];
  const status = { names: [], lemmas: [] };
  const lemmaSheets = { names: [], forms: 0 };
  for (const sheet of sheets || []) {
    try {
      // Excel resaves in its own dialect (sharedStrings, numeric cells): the
      // reader understands both ours and Excel's, and finds the data sheet by
      // its header wherever the spreadsheet put it
      const rows = reviewRows(readZip(sheet.bytes), ['form', 'label', 'key']);
      const head = (rows.shift() || []).map((c) => String(c == null ? '' : c).trim());
      if (head.indexOf('label') >= 0 && head.indexOf('type') >= 0) {
        const { kept, added, grown } = applyNamesSheet(model, head, rows);
        const msg = 'Names sheet «' + sheet.name + '» loaded: ' + kept + ' names confirmed, '
          + added + ' new names added to the registers, ' + grown + ' further occurrences confirmed.';
        notes.push(msg);
        status.names.push({ ok: true, text: msg });
      } else if (head.indexOf('form') >= 0 && head.indexOf('lemma') >= 0) {
        const r = mergeLemmaSheet(lemmasJson, head, rows);
        lemmasJson = r.json;
        lemmaSheets.names.push(sheet.name);
        lemmaSheets.forms += r.forms;
      } else {
        const msg = 'The sheet «' + sheet.name + '» is neither a names sheet (label, type) '
          + 'nor a lemma sheet (form, lemma): its first row reads '
          + (head.filter(Boolean).slice(0, 6).join(', ') || '(nothing)') + '.';
        notes.push(msg);
        status.lemmas.push({ ok: false, text: msg });
      }
    } catch (err) {
      const msg = 'The sheet «' + sheet.name + '» could not be read: ' + err.message;
      notes.push(msg);
      status.lemmas.push({ ok: false, text: msg });
    }
  }
  return { lemmasJson, notes, status, lemmaSheets };
}

/** After attachLemmas: say what the lemma sheets actually did to the text. */
export function reportLemmaSheets(model, result) {
  const ls = result.lemmaSheets;
  if (!ls || !ls.names.length) return;
  const words = model.lemmas ? model.lemmas.lemmatized : 0;
  const ok = words > 0;
  const msg = 'Lemma sheet «' + ls.names.join('», «') + '» loaded: '
    + ls.forms + ' forms, ' + words + ' words of the text lemmatized'
    + (ok ? '.' : ': no word of the text matched these forms (check the form and lang columns).');
  result.notes.push(msg);
  result.status.lemmas.push({ ok, text: msg });
}
