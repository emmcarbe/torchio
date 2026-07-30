/**
 * ODD reader: the edition's TEI customization as the engine's configuration.
 *
 * Reads a (source) ODD and extracts what the class map needs:
 *   - which modules the schema includes (moduleRef)
 *   - deleted elements (elementSpec mode="delete", or moduleRef @except)
 *   - custom elements and their class memberships (elementSpec mode="add"
 *     with classes/memberOf) — these inherit behaviour with zero code
 *   - custom classes (classSpec mode="add")
 *
 * Everything else in the ODD (content models, value lists, constraints) is the
 * schema's business, not the viewer's: validation happens in CI.
 */

import { parseXML, walk, local } from './xml.js';

export function parseODD(source) {
  const root = typeof source === 'string' ? parseXML(source) : source;

  const includedModules = new Set();
  const deletedElements = new Set();
  const customElements = [];
  const customClasses = [];

  for (const node of walk(root)) {
    const name = local(node.name);

    if (name === 'moduleRef') {
      const key = node.attrs.key;
      if (key) {
        includedModules.add(key);
        const except = node.attrs.except;
        if (except) for (const e of except.split(/\s+/)) if (e) deletedElements.add(e);
        // @include narrows to a whitelist: everything else in the module is out.
        // We record the module as included and let the schema enforce the list;
        // the class map stays permissive (rendering more is safe, hiding is not).
      }
    }

    if (name === 'elementSpec') {
      const mode = node.attrs.mode || 'add';
      const ident = node.attrs.ident;
      if (!ident) continue;
      if (mode === 'delete') {
        deletedElements.add(ident);
      } else if (mode === 'add') {
        customElements.push({
          ident,
          module: node.attrs.module || 'custom',
          memberOf: memberships(node),
        });
      }
      // mode="change"/"replace" alter content or attributes, not identity:
      // class membership changes come through classes/memberOf below if present.
      if (mode === 'change' || mode === 'replace') {
        const m = memberships(node);
        // a change adds memberships, it does not replace the element's own:
        // an element that joins a class keeps the behaviour it already had
        if (m.length) customElements.push({ ident, module: node.attrs.module || '', memberOf: m, merge: mode === 'change' });
      }
    }

    if (name === 'classSpec' && (node.attrs.mode || 'add') === 'add' && node.attrs.ident) {
      customClasses.push({
        ident: node.attrs.ident,
        type: node.attrs.type || 'model',
        memberOf: memberships(node),
      });
    }
  }

  return { includedModules, deletedElements, customElements, customClasses };
}

/**
 * An ODD is recognized on its own: a document carrying a schemaSpec is a
 * schema, not a text. The ODD travels next to the TEI, in the same folder
 * or the same drop, and the press tells the two apart.
 */
export function isODD(root) {
  for (const node of walk(root)) if (local(node.name) === 'schemaSpec') return true;
  return false;
}

function memberships(spec) {
  const out = [];
  for (const node of walk(spec)) {
    if (local(node.name) === 'memberOf' && node.attrs.key) {
      if ((node.attrs.mode || 'add') !== 'delete') out.push(node.attrs.key);
    }
  }
  return out;
}
