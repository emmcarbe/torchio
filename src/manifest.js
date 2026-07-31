/**
 * The composition manifest — Separation 3, level one.
 *
 * Level zero needs no file: pages and pieces are derived from the markup.
 * Level one is a single small JSON file (torchio.json) next to the TEI:
 * declarative, ten lines, never a configuration system.
 *
 *   {
 *     "title": "Bellum Alexandrinum",
 *     "subtitle": "a digital critical edition",
 *     "pages": [
 *       { "id": "index",   "label": "Edizione" },
 *       { "id": "text",    "label": "Testo" },
 *       { "id": "indices", "label": "Indici" },
 *       { "id": "data",    "label": "Dati" }
 *     ],
 *     "pieces": { "apparatus": true, "entities": true, "choice": true },
 *     "exports": true
 *   }
 *
 * Rules: unknown page ids are ignored with a warning; a page listed here but
 * not activated by the markup is skipped (the markup decides existence, the
 * manifest decides presence, order and labels); pieces set to false disable
 * the interactive layer, never the base rendering (nothing invisible).
 */

import { isTheme } from './themes.js';

const KNOWN_PAGES = ['index', 'front', 'text', 'back', 'indices', 'lemmas', 'map', 'data'];
const REGISTER_COLUMNS = ['date', 'title', 'from', 'to', 'author', 'place', 'idno'];

export function normalizeManifest(raw = {}) {
  const m = {
    title: typeof raw.title === 'string' ? raw.title : null,
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : null,
    lang: raw.lang === 'it' || raw.lang === 'en' ? raw.lang : null,
    theme: typeof raw.theme === 'string' && isTheme(raw.theme) ? raw.theme : null,
    parent: raw.parent && typeof raw.parent.href === 'string'
      ? { href: raw.parent.href, label: String(raw.parent.label || '\u2039') }
      : null,
    // the register's columns, chosen by the editor among the card fields
    // the headers populate; unknown names are ignored with a warning
    register: (raw.register && Array.isArray(raw.register.columns))
      ? { columns: raw.register.columns.filter((c) => REGISTER_COLUMNS.includes(c)) }
      : null,
    // interface labels the edition's tradition wants otherwise (principle
    // 1): string overrides of the i18n keys, e.g. {"reading": "Costituito"}
    labels: (raw.labels && typeof raw.labels === 'object')
      ? Object.fromEntries(Object.entries(raw.labels)
          .filter(([, v]) => typeof v === 'string' && v.trim()))
      : {},
    extra: [],
    pages: null,
    // what kind of thing this edition is: it decides which columns the
    // register wears and what the pages are called. Declared, never guessed
    genre: ['edition', 'archive', 'correspondence', 'tradition'].includes(raw.genre)
      ? raw.genre : null,
    version: raw.version != null && String(raw.version).trim() ? String(raw.version).trim() : null,
    apparatusKind: ['critical', 'genetic', 'both'].includes(raw.apparatusKind) ? raw.apparatusKind : null,
    pieces: { apparatus: true, entities: true, choice: true, map: true, lemmas: true,
      persons: true, places: true, orgs: true, ...(raw.pieces || {}) },
    // the lexicon views are opt-in, each on its own; the old pieces.lexicon
    // switches all three on
    align: raw.align && typeof raw.align === 'object' ? {
      elements: Array.isArray(raw.align.elements) ? raw.align.elements.map(String) : ['l'],
      strip: raw.align.strip ? String(raw.align.strip) : null,
      stripSuffix: raw.align.stripSuffix ? String(raw.align.stripSuffix) : null,
      apparatusUnder: raw.align.apparatusUnder ? String(raw.align.apparatusUnder) : null,
    } : null,
    exports: raw.exports === false ? false
      : (raw.exports && typeof raw.exports === 'object' ? raw.exports : true),
    warnings: [],
  };
  if (typeof raw.theme === 'string' && !isTheme(raw.theme)) {
    m.warnings.push(`unknown theme ignored: ${raw.theme}`);
  }
  if (raw.register && Array.isArray(raw.register.columns)) {
    for (const c of raw.register.columns) {
      if (!REGISTER_COLUMNS.includes(c)) m.warnings.push(`unknown register column ignored: ${c}`);
    }
  }
  if (Array.isArray(raw.extra)) {
    for (const e of raw.extra) {
      if (e && typeof e.id === 'string' && /^[a-z][a-z0-9-]*$/.test(e.id)
          && !KNOWN_PAGES.includes(e.id) && typeof e.file === 'string') {
        m.extra.push({ id: e.id, label: e.label ? String(e.label) : e.id, file: e.file });
      } else {
        m.warnings.push(`invalid extra page ignored: ${e && e.id}`);
      }
    }
  }
  const extraIds = m.extra.map((e) => e.id);
  if (Array.isArray(raw.pages)) {
    m.pages = [];
    for (const p of raw.pages) {
      const id = typeof p === 'string' ? p : p?.id;
      const label = typeof p === 'object' && p?.label ? String(p.label) : null;
      if (!KNOWN_PAGES.includes(id) && !extraIds.includes(id)) {
        m.warnings.push(`unknown page id ignored: ${id}`);
        continue;
      }
      m.pages.push({ id, label });
    }
  }
  return m;
}
