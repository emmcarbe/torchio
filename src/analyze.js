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
  const fallbackDetails = [];
  const resolved = [];
  for (const [name, count] of inventory) {
    const r = classMap.resolve(name);
    resolved.push({ element: name, count, section: r.section, via: r.via });
    sections.set(r.section, (sections.get(r.section) || 0) + count);
    if (r.via === 'fallback') fallback.push(name);
  }
  for (const root of Array.isArray(roots) ? roots : [roots]) {
    const doc = root?.id || root?.attrs?.['xml:id'] || 'document';
    const visit = (node, path = '0') => {
      if (!node || typeof node === 'string') return;
      const name = local(node.name);
      if (classMap.resolve(name).via === 'fallback') fallbackDetails.push({ element: name, doc, path });
      let i = 0;
      for (const child of node.children || []) {
        if (typeof child !== 'string') visit(child, `${path}.${i++}`);
      }
    };
    visit(root);
  }
  resolved.sort((a, b) => b.count - a.count);

  return {
    elements: resolved,
    distinctElements: inventory.size,
    sections: [...sections.entries()].sort((a, b) => b[1] - a[1]),
    fallback,
    fallbackDetails,
  };
}
