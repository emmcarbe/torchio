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

export function normalizeManifest(raw = {}) {
  const m = {
    title: typeof raw.title === 'string' ? raw.title : null,
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : null,
    lang: raw.lang === 'it' || raw.lang === 'en' ? raw.lang : null,
    theme: typeof raw.theme === 'string' && isTheme(raw.theme) ? raw.theme : null,
    parent: raw.parent && typeof raw.parent.href === 'string'
      ? { href: raw.parent.href, label: String(raw.parent.label || '\u2039') }
      : null,
    extra: [],
    pages: null,
    pieces: { apparatus: true, entities: true, choice: true, ...(raw.pieces || {}) },
    exports: raw.exports === false ? false
      : (raw.exports && typeof raw.exports === 'object' ? raw.exports : true),
    warnings: [],
  };
  if (typeof raw.theme === 'string' && !isTheme(raw.theme)) {
    m.warnings.push(`unknown theme ignored: ${raw.theme}`);
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
