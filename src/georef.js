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
export function georeference(model, gazetteer, previous = {}) {
  const places = {};
  let found = 0, missing = 0, kept = 0;
  for (const h of harvestPlaces(model)) {
    const prev = previous[h.key];
    if (prev && prev.status !== 'suggested') { // confirmed, rejected, or editor-set
      places[h.key] = prev;
      kept++;
      continue;
    }
    const hits = gazetteer[h.key] || [];
    if (hits.length) {
      const [name, lat, lon, country, pop, id] = hits[0];
      places[h.key] = {
        label: h.label, status: 'suggested',
        lat, lon, country, geonames: id, source: 'geonames',
        alternatives: hits.slice(1, 5).map(([n2, la, lo, c2, p2, i2]) =>
          ({ name: n2, lat: la, lon: lo, country: c2, population: p2, geonames: i2 })),
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
