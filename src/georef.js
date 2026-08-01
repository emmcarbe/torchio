/**
 * Georeferencing with the editor in the loop.
 *
 * The machine proposes, the editor disposes: lookups against a local
 * GeoNames extract produce a georef.json next to the TEI, with three states
 * per place: suggested (top candidate, alternatives listed), ambiguous is
 * just suggested with alternatives, and missing (the editor fills in the
 * coordinates). The editor edits the file: confirm, correct, reject. Editor
 * decisions always survive re-runs. Coordinates declared in the TEI (geo)
 * always win; every coordinate carries its provenance (tei | geonames | editor).
 *
 * No runtime service: the gazetteer is a generated local file
 * (tools/build-gazetteer.py, GeoNames cities1000, CC BY 4.0).
 */

import { walkModel, textOfModel } from './model.js';

export function normalizePlace(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Collect the places to georeference: the listPlace registry entries without
 * geo, plus — when the registry has no entry for them — the distinct
 * placeName mentions in the text (the common case in real corpora).
 * @returns [{key, label, occurrences}]
 */
export function harvestPlaces(model) {
  const out = new Map();
  for (const p of model.registries.places) {
    if (p.geo) continue;
    const key = normalizePlace(p.label);
    if (key) out.set(key, { key, label: p.label, occurrences: [...p.occurrences] });
  }
  for (const doc of model.documents) {
    for (const n of walkModel(doc.tree)) {
      if (n.element !== 'placeName') continue;
      const label = textOfModel(n).replace(/\s+/g, ' ').trim();
      const key = normalizePlace(label);
      if (!key) continue;
      if (!out.has(key)) {
        const inRegistry = model.registries.places.some(
          (p) => normalizePlace(p.label) === key && p.geo);
        if (inRegistry) continue;
        out.set(key, { key, label, occurrences: [] });
      }
      out.get(key).occurrences.push(n.id);
    }
  }
  return [...out.values()];
}

/**
 * Match harvested places against the gazetteer.
 * @param gazetteer {Object<string, Array<[name,lat,lon,country,pop,id]>>}
 * @param previous  a previously written georef.places object; editor
 *                  decisions (confirmed / rejected / edited coords) survive.
 */
/**
 * The Americas, across the Atlantic gap: longitude between -170 and -34. The
 * Old World's westernmost inhabited land (the Azores, Cape Verde) sits around
 * -31, so -34 separates the two hemispheres cleanly.
 */
function inTheAmericas(lon) { return lon > -170 && lon < -34; }

/**
 * A place a text written no later than `notAfter` cannot name. A pre-Columbian
 * edition cannot refer to a place in the Americas: drop those candidates, so a
 * "Carthage, Illinois" never even surfaces as an alternative to Carthago. A
 * heuristic on the edition's terminus ante quem, not a universal truth.
 */
function pruneByPeriod(hits, notAfter) {
  if (notAfter == null || notAfter >= 1492) return hits;
  return hits.filter(([, , lon]) => !inTheAmericas(lon));
}

export function georeference(model, gazetteer, previous = {}, pleiades = null, notAfter = null) {
  const places = {};
  let found = 0, missing = 0, kept = 0;
  for (const h of harvestPlaces(model)) {
    const prev = previous[h.key];
    if (prev && prev.status !== 'suggested') { // confirmed, rejected, or editor-set
      places[h.key] = prev;
      kept++;
      continue;
    }
    // Pleiades wins when it has the place: a toponym that is in Pleiades is an
    // ancient place, so for a classical or medieval text it is the right
    // reading, over a modern homonym (Carthage, Illinois; Troy, New York).
    // GeoNames covers everything Pleiades does not (the modern world). Both
    // sources stay visible as alternatives, and every hit is only a
    // SUGGESTION carrying its source: the machine can still pick the wrong
    // Troia (Egypt, not Homer's), so the editor confirms.
    const pleHits = pruneByPeriod((pleiades && pleiades[h.key]) || [], notAfter);
    const geoHits = pruneByPeriod(gazetteer[h.key] || [], notAfter);
    const src = pleHits.length ? 'pleiades' : 'geonames';
    const primary = pleHits.length ? pleHits : geoHits;
    const other = pleHits.length ? geoHits : pleHits;
    const otherSrc = pleHits.length ? 'geonames' : 'pleiades';
    if (primary.length) {
      const [name, lat, lon, country, pop, id] = primary[0];
      const alt = (source) => ([n2, la, lo, c2, p2, i2]) =>
        ({ name: n2, lat: la, lon: lo, country: c2, population: p2, source, [source]: i2 });
      places[h.key] = {
        label: h.label, status: 'suggested',
        lat, lon, country, [src]: id, source: src,
        alternatives: [
          ...primary.slice(1, 4).map(alt(src)),
          ...other.slice(0, 2).map(alt(otherSrc)),
        ],
      };
      found++;
    } else {
      places[h.key] = {
        label: h.label, status: 'missing',
        lat: null, lon: null, source: 'editor',
        note: 'not in the gazetteer: fill in lat/lon and set status to confirmed',
      };
      missing++;
    }
  }
  return { places, stats: { found, missing, kept } };
}

/**
 * Apply a georef file to the model: inject coordinates (and, for harvested
 * mentions, registry entries) for places with status suggested or confirmed.
 * TEI-declared geo is never overwritten.
 */
export function applyGeoref(model, georefPlaces) {
  if (!georefPlaces) return model;
  const byKey = new Map(model.registries.places.map((p) => [normalizePlace(p.label), p]));
  const harvested = new Map(harvestPlaces(model).map((h) => [h.key, h]));
  for (const [key, g] of Object.entries(georefPlaces)) {
    if (!g || g.status === 'rejected' || g.status === 'missing') continue;
    if (g.lat == null || g.lon == null) continue;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.geo) {
        existing.geo = { lat: g.lat, lon: g.lon };
        existing.geoSource = g.status === 'confirmed' ? (g.source || 'editor') : 'geonames';
      }
    } else {
      const h = harvested.get(key);
      model.registries.places.push({
        id: `georef:${key}`,
        label: g.label || key,
        atts: {},
        occurrences: h ? h.occurrences : [],
        geo: { lat: g.lat, lon: g.lon },
        geoSource: g.status === 'confirmed' ? (g.source || 'editor') : 'geonames',
      });
    }
  }
  return model;
}
