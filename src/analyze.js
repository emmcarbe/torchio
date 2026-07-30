/**
 * Document analysis: the configurator's first brick.
 *
 * Given parsed TEI documents and a class map, report:
 *   - element inventory with counts
 *   - coverage: how each element resolves (class / module / fallback)
 *   - which behaviour sections (hence which pieces) the markup activates
 */

import { walk, local } from './xml.js';

export function analyze(roots, classMap) {
  const inventory = new Map();
  for (const root of Array.isArray(roots) ? roots : [roots]) {
    for (const node of walk(root)) {
      const name = local(node.name);
      inventory.set(name, (inventory.get(name) || 0) + 1);
    }
  }

  const sections = new Map();
  const fallback = [];
  const resolved = [];
  for (const [name, count] of inventory) {
    const r = classMap.resolve(name);
    resolved.push({ element: name, count, section: r.section, via: r.via });
    sections.set(r.section, (sections.get(r.section) || 0) + count);
    if (r.via === 'fallback') fallback.push(name);
  }
  resolved.sort((a, b) => b.count - a.count);

  return {
    elements: resolved,
    distinctElements: inventory.size,
    sections: [...sections.entries()].sort((a, b) => b[1] - a[1]),
    fallback,
  };
}
