/**
 * Entity reconciliation with the editor in the loop — not a places feature,
 * a registry feature: places, people,
 * organisations and institutions all reconcile against authority sources.
 *
 * The machine proposes, the editor disposes: a reconcile.json next to the
 * TEI holds one entry per harvested entity, with status suggested / confirmed
 * / rejected / missing. Editor decisions always survive re-runs. TEI-declared
 * data (geo, @ref to a populated registry) always wins.
 *
 * Sources in v0: GeoNames local gazetteer for places (tools/build-gazetteer.py).
 * People and organisations are harvested and prepared for authority ids
 * (viaf / wikidata / gnd / isil), filled by the editor; API-based suggesters
 * (e.g. Wikidata reconciliation) are tool-time plugins to come.
 *
 * Harvest anchors, per type (class-wide, not tag-narrow):
 *   place:  placeName, settlement, geogName, district, region, country,
 *           origPlace + registry places without geo
 *   person: persName without resolvable @ref + registry people
 *   org:    orgName, institution, repository + registry orgs
 */

import { walkModel, textOfModel } from './model.js';

const ANCHORS = {
  place: new Set(['placeName', 'settlement', 'geogName', 'district', 'region', 'country', 'origPlace']),
  person: new Set(['persName']),
  org: new Set(['orgName', 'institution', 'repository']),
};

export function normalizeKey(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function registryFor(model, type) {
  return { place: model.registries.places, person: model.registries.people, org: model.registries.orgs }[type];
}

/** Distinct entities to reconcile, per type, with their mention node ids. */
export function harvest(model) {
  const out = { place: new Map(), person: new Map(), org: new Map() };
  const resolvedRefs = new Set();
  for (const type of Object.keys(out)) {
    for (const e of registryFor(model, type)) {
      if (e.atts && e.atts['xml:id']) resolvedRefs.add('#' + e.atts['xml:id']);
      const needs = type === 'place' ? !e.geo : !(e.authorities && e.authorities.length);
      if (!needs) continue;
      const key = normalizeKey(e.label);
      if (key) out[type].set(key, { key, label: e.label, occurrences: [...e.occurrences] });
    }
  }
  for (const doc of model.documents) {
    for (const n of walkModel(doc.tree)) {
      const type = Object.keys(ANCHORS).find((k) => ANCHORS[k].has(n.element));
      if (!type) continue;
      if (n.atts.ref && resolvedRefs.has(n.atts.ref)) continue;
      const label = textOfModel(n).replace(/\s+/g, ' ').trim();
      const key = normalizeKey(label);
      if (!key || key.length < 2) continue;
      if (!out[type].has(key)) out[type].set(key, { key, label, occurrences: [] });
      out[type].get(key).occurrences.push(n.id);
    }
  }
  return {
    place: [...out.place.values()],
    person: [...out.person.values()],
    org: [...out.org.values()],
  };
}

/**
 * Build (or update) the reconciliation table.
 * @param sources { gazetteer?: Object }  place lookups; other types have no
 *        local source yet and come out as status "missing" for the editor.
 * @param previous a prior reconcile.json "entities" object; editor decisions
 *        (anything not "suggested") survive verbatim.
 */
export function reconcile(model, sources = {}, previous = {}) {
  const harvested = harvest(model);
  const entities = { place: {}, person: {}, org: {} };
  const stats = { suggested: 0, missing: 0, kept: 0 };

  for (const type of Object.keys(harvested)) {
    for (const h of harvested[type]) {
      const prev = previous[type]?.[h.key];
      // only real editor decisions survive; machine states (suggested,
      // missing) are recomputed at every run
      if (prev && (prev.status === 'confirmed' || prev.status === 'rejected')) {
        entities[type][h.key] = prev;
        stats.kept++;
        continue;
      }
      if (type === 'place' && sources.gazetteer) {
        const hits = sources.gazetteer[h.key] || [];
        if (hits.length) {
          const [name, lat, lon, country, pop, id] = hits[0];
          entities.place[h.key] = {
            label: h.label, status: 'suggested', source: 'geonames',
            lat, lon, country, geonames: id,
            alternatives: hits.slice(1, 5).map(([n2, la, lo, c2, p2, i2]) =>
              ({ name: n2, lat: la, lon: lo, country: c2, population: p2, geonames: i2 })),
          };
          stats.suggested++;
          continue;
        }
      }
      entities[type][h.key] = type === 'place'
        ? { label: h.label, status: 'missing', lat: null, lon: null,
            note: 'not in the gazetteer: fill in lat/lon, set status to confirmed' }
        : { label: h.label, status: 'missing',
            viaf: null, wikidata: null, gnd: null, isil: null,
            note: 'fill in one or more authority ids, set status to confirmed' };
      stats.missing++;
    }
  }
  return { entities, stats };
}

/**
 * Apply a reconciliation table to the model: coordinates for places,
 * authority ids for people and organisations. Harvested mentions without a
 * registry entry get one (so indices, map and exports see them).
 * TEI-declared geo is never overwritten.
 */
export function applyReconciliation(model, entities) {
  if (!entities) return model;
  // contributor references that are authority ids (an ORCID in @who)
  // resolve to the confirmed name in the reconciliation file (C31)
  if (model.collection && Array.isArray(model.collection.contributors) && entities.person) {
    const persons = Object.entries(entities.person);
    for (const c of model.collection.contributors) {
      const ref = String(c.ref);
      const hit = persons.find(([k, r]) => r && r.status === 'confirmed' && r.label
        && (k === ref || r.orcid === ref || (r.orcid && ref.endsWith(r.orcid))));
      if (hit) c.ref = hit[1].label;
    }
  }
  const harvested = harvest(model);
  for (const type of Object.keys(entities)) {
    const registry = registryFor(model, type);
    if (!registry) continue;
    const byKey = new Map(registry.map((e) => [normalizeKey(e.label), e]));
    const hByKey = new Map((harvested[type] || []).map((h) => [h.key, h]));
    for (const [key, r] of Object.entries(entities[type])) {
      if (!r || r.status === 'rejected' || r.status === 'missing') continue;
      const provenance = r.status === 'confirmed' ? (r.source || 'editor') : (r.source || 'suggested');
      let entry = byKey.get(key);
      if (!entry) {
        entry = { id: `${type}:${key}`, label: r.label || key, atts: {},
                  occurrences: hByKey.get(key)?.occurrences || [] };
        registry.push(entry);
        byKey.set(key, entry);
      }
      if (type === 'place') {
        if (!entry.geo && r.lat != null && r.lon != null) {
          entry.geo = { lat: r.lat, lon: r.lon };
          entry.geoSource = provenance;
        }
      } else {
        const ids = [];
        if (r.viaf) ids.push(`viaf:${r.viaf}`);
        if (r.wikidata) ids.push(`wikidata:${r.wikidata}`);
        if (r.gnd) ids.push(`gnd:${r.gnd}`);
        if (r.isil) ids.push(`isil:${r.isil}`);
        if (ids.length) {
          entry.authorities = [...new Set([...(entry.authorities || []), ...ids])];
          entry.authoritySource = provenance;
        }
      }
    }
  }
  return model;
}
