/**
 * The class map: element name -> TEI classes -> behaviour section.
 *
 * Base data is generated from the official p5subset (data/p5-classes.json).
 * An ODD overlay (see odd.js) can add custom elements, declare their class
 * memberships, and exclude elements or modules: the ODD decides, not the tool.
 *
 * Resolution order (first match wins):
 *   1. by class, in the order of data/sections.json byClass
 *   2. by module
 *   3. "base" — the guaranteed fallback: rendered, never invisible.
 */

let P5 = null;
let SECTIONS = null;

async function loadJSON(rel) {
  // Dynamic import keeps this module loadable in the browser (path A),
  // where loadBaseData is never called: the page embeds the data instead.
  const { readFile } = await import('node:fs/promises');
  const url = new URL(`../data/${rel}`, import.meta.url);
  return JSON.parse(await readFile(url, 'utf-8'));
}

/** Load base data once (Node). In the browser, pass data to buildClassMap directly. */
export async function loadBaseData() {
  if (!P5) P5 = await loadJSON('p5-classes.json');
  if (!SECTIONS) SECTIONS = await loadJSON('sections.json');
  return { p5: P5, sections: SECTIONS };
}

/**
 * Build the effective class map for an edition.
 * @param {object|null} odd  parsed ODD overlay from odd.js (or null for plain P5)
 * @param {object} [data]    {p5, sections} — required in the browser
 */
export function buildClassMap(odd = null, data = { p5: P5, sections: SECTIONS }) {
  const { p5, sections } = data;
  if (!p5 || !sections) throw new Error('base data not loaded: call loadBaseData() first');

  // effective element table: P5 base, minus ODD exclusions, plus ODD custom elements
  const elements = new Map(Object.entries(p5.elements));
  const classes = new Map(Object.entries(p5.classes));

  if (odd) {
    for (const name of odd.deletedElements) elements.delete(name);
    if (odd.includedModules.size) {
      for (const [name, info] of elements) {
        if (info.module && !odd.includedModules.has(info.module)) elements.delete(name);
      }
    }
    for (const spec of odd.customClasses) {
      classes.set(spec.ident, { type: spec.type || 'model', memberOf: spec.memberOf });
    }
    for (const spec of odd.customElements) {
      const prev = elements.get(spec.ident);
      const memberOf = spec.merge && prev
        ? [...new Set([...(prev.memberOf || []), ...spec.memberOf])]
        : spec.memberOf;
      elements.set(spec.ident, { module: spec.module || (prev && prev.module) || 'custom', memberOf });
    }
  }

  const closureCache = new Map();
  function closure(memberOf) {
    const key = memberOf.join('|');
    if (closureCache.has(key)) return closureCache.get(key);
    const seen = new Set();
    const queue = [...memberOf];
    while (queue.length) {
      const c = queue.pop();
      if (seen.has(c)) continue;
      seen.add(c);
      const spec = classes.get(c);
      if (spec) queue.push(...spec.memberOf);
    }
    closureCache.set(key, seen);
    return seen;
  }

  const resolveCache = new Map();

  /**
   * Resolve an element name to its behaviour assignment.
   * Never fails: unknown elements get {section: "base", via: "fallback"}.
   */
  function resolve(name) {
    if (resolveCache.has(name)) return resolveCache.get(name);
    let result;
    const info = elements.get(name);
    if (!info) {
      result = { element: name, module: null, classes: new Set(), section: 'base', via: 'fallback' };
    } else {
      const cls = closure(info.memberOf);
      let section = null;
      let via = null;
      if (sections.byElement && sections.byElement[name]) {
        section = sections.byElement[name];
        via = 'element';
      }
      if (!section) for (const [cname, sec] of sections.byClass) {
        if (cls.has(cname)) { section = sec; via = `class:${cname}`; break; }
      }
      if (!section && sections.byModule[info.module]) {
        section = sections.byModule[info.module];
        via = `module:${info.module}`;
      }
      if (!section) { section = 'base'; via = 'fallback'; }
      result = { element: name, module: info.module, classes: cls, section, via };
    }
    resolveCache.set(name, result);
    return result;
  }

  return { resolve, elements, classes, teiVersion: p5.version };
}
