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
  // the coordinates the editor has already settled, from the TEI or from a
  // previous confirmation: they pull ambiguous forms toward the right region
  const anchors = [];
  for (const e of registryFor(model, 'place')) if (e.geo) anchors.push([e.geo.lat, e.geo.lon]);
  for (const r of Object.values(previous.place || {})) {
    if (r && r.status === 'confirmed' && r.lat != null && r.lon != null) anchors.push([r.lat, r.lon]);
  }
  const nearest = (lat, lon, pts) => {
    let best = Infinity;
    for (const [pa, po] of pts) {
      const d = (lat - pa) * (lat - pa) + (lon - po) * (lon - po);
      if (d < best) best = d;
    }
    return best;
  };

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
        const hits = [...(sources.gazetteer[h.key] || [])];
        if (hits.length) {
          // spatial coherence: among candidates for one form, the one nearest
          // the places the editor already confirmed comes first. Suvó in Kyushu
          // beats Suvó in Fiji when the edition is a Japan mission (declarative
          // re-rank, never invented: the anchors are the editor's own)
          if (anchors.length) {
            hits.sort((a, b) => nearest(a[1], a[2], anchors) - nearest(b[1], b[2], anchors));
          }
          const [name, lat, lon, country, pop, id] = hits[0];
          entities.place[h.key] = {
            label: h.label, status: 'suggested', source: 'geonames',
            // provenance: which form was queried and which canonical name the
            // gazetteer answered with (Romae -> Roma), so the editor can judge
            found: name, matched: h.label !== name ? h.label : null,
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

/**
 * A marked entity teaches its hidden occurrences (C, declarative): where the
 * editor confirmed an entity, the same label found as bare text elsewhere is
 * a mention too. Only the exact form is matched: variants (Roma / Romae) and
 * the authority behind them (GeoNames) are a further, gazetteer-driven layer,
 * never guessed here. Returns the number of occurrences added.
 * @param confirmed Set< occId >, where occId = `${docId}#${type}:${label}#${n}`
 *        marks the n-th bare occurrence of that label in that document.
 */
// every harvestable label, from marked entities and registry
function bareLabels(model) {
  const h = harvest(model);
  const out = [];
  for (const type of ['place', 'person', 'org']) {
    for (const e of h[type]) out.push({ type, label: e.label });
  }
  return out;
}

/** One entry per bare-text occurrence of a harvestable label, with the words
 *  around it, so the editor can judge each in place (Roma the city here, a
 *  surname there). occId is the same key expandMentions confirms against. */
export function listBareOccurrences(model, { context = 6 } = {}) {
  const labels = bareLabels(model).sort((a, b) => b.label.length - a.label.length);
  const seen = new Map();
  const list = [];
  const isBoundary = (ch) => ch === undefined || !/[\p{L}\p{N}]/u.test(ch);
  const scan = (node, docId, buf) => {
    if (node.element === 'teiHeader') return; // context is the text, not the metadata
    if (ANCHORS.place.has(node.element) || ANCHORS.person.has(node.element)
      || ANCHORS.org.has(node.element)) { buf.text += textOfModel(node); return; }
    for (const child of node.children) {
      if (typeof child !== 'string') { scan(child, docId, buf); continue; }
      let cursor = child, base = buf.text.length;
      let offset = 0;
      while (cursor.length) {
        let best = null;
        for (const w of labels) {
          const i = cursor.indexOf(w.label);
          if (i >= 0 && isBoundary(cursor[i - 1]) && isBoundary(cursor[i + w.label.length])
            && (best === null || i < best.i)) best = { i, w };
        }
        if (!best) { buf.text += cursor; break; }
        const { i, w } = best;
        buf.text += cursor.slice(0, i + w.label.length);
        const stem = `${docId}#${w.type}:${w.label}`;
        const n = (seen.get(stem) || 0); seen.set(stem, n + 1);
        list.push({ occId: `${stem}#${n}`, type: w.type, label: w.label, at: buf.text.length - w.label.length });
        cursor = cursor.slice(i + w.label.length);
      }
    }
  };
  for (const doc of model.documents) {
    const buf = { text: '' };
    scan(doc.tree, doc.id, buf);
    for (const item of list) {
      if (item.before !== undefined) continue;
      const words = (s) => s.split(/\s+/).filter(Boolean);
      item.before = words(buf.text.slice(0, item.at)).slice(-context).join(' ');
      item.after = words(buf.text.slice(item.at + item.label.length)).slice(0, context).join(' ');
    }
  }
  return list;
}

export function expandMentions(model, confirmed) {
  if (!confirmed || !confirmed.size) return 0;
  const PRIMARY = { place: 'placeName', person: 'persName', org: 'orgName' };
  const wanted = bareLabels(model); // {type,label} of every harvestable entity
  const byKey = {};
  for (const type of ['place', 'person', 'org']) {
    byKey[type] = new Map(registryFor(model, type).map((e) => [normalizeKey(e.label), e]));
  }
  const seen = new Map(); // "docId#type:label" -> running index
  let added = 0, serial = 0;
  const isBoundary = (ch) => ch === undefined || !/[\p{L}\p{N}]/u.test(ch);
  const labels = wanted.sort((a, b) => b.label.length - a.label.length);
  const scan = (node, docId) => {
    if (ANCHORS.place.has(node.element) || ANCHORS.person.has(node.element)
      || ANCHORS.org.has(node.element)) return;
    const out = [];
    for (const child of node.children) {
      if (typeof child !== 'string') { scan(child, docId); out.push(child); continue; }
      let cursor = child; const pieces = []; let touched = false;
      outer: while (cursor.length) {
        let best = null;
        for (const w of labels) {
          const i = cursor.indexOf(w.label);
          if (i >= 0 && isBoundary(cursor[i - 1]) && isBoundary(cursor[i + w.label.length])
            && (best === null || i < best.i)) best = { i, w };
        }
        if (!best) break;
        const { i, w } = best;
        const stem = `${docId}#${w.type}:${w.label}`;
        const n = (seen.get(stem) || 0); seen.set(stem, n + 1);
        const occId = `${stem}#${n}`;
        if (i > 0) pieces.push(cursor.slice(0, i));
        if (confirmed.has(occId)) {
          const entry = byKey[w.type].get(normalizeKey(w.label));
          if (entry) {
            const id = `${docId}:mention.${serial++}`;
            pieces.push({ id, element: PRIMARY[w.type], section: 'base', atts: {}, children: [w.label] });
            entry.occurrences = entry.occurrences || [];
            entry.occurrences.push(id);
            added++;
            touched = true;
          } else pieces.push(w.label);
        } else pieces.push(w.label);
        cursor = cursor.slice(i + w.label.length);
      }
      if (touched) { if (cursor) pieces.push(cursor); out.push(...pieces); }
      else out.push(child);
    }
    node.children = out;
  };
  for (const doc of model.documents) scan(doc.tree, doc.id);
  return added;
}
