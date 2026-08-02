/**
 * ODD reader: the edition's TEI customization as the engine's configuration.
 *
 * Reads a (source) ODD and extracts what the class map needs:
 *   - which modules the schema includes (moduleRef)
 *   - deleted elements (elementSpec mode="delete", or moduleRef @except)
 *   - custom elements and their class memberships (elementSpec mode="add"
 *     with classes/memberOf) — these inherit behaviour with zero code
 *   - custom classes (classSpec mode="add")
 *   - a conservative web subset of the TEI Processing Model (`model` and
 *     `modelGrp`): behaviour, predicate, params, cssClass, and outputRendition
 *
 * Content models, value lists, and constraints remain the schema's business.
 * Unsupported processing constructs are reported instead of silently guessed.
 */

import { parseXML, walk, local, textOf } from './xml.js';

export function parseODD(source) {
  const root = typeof source === 'string' ? parseXML(source) : source;

  const includedModules = new Set();
  const includedElements = new Map();
  const deletedElements = new Set();
  const customElements = [];
  const customClasses = [];
  const processingModels = new Map();
  const elementSpecs = new Map();
  const warnings = [];

  for (const node of walk(root)) {
    const name = local(node.name);

    if (name === 'moduleRef') {
      const key = node.attrs.key;
      if (key) {
        includedModules.add(key);
        if (node.attrs.include) includedElements.set(key,
          new Set(node.attrs.include.split(/\s+/).filter(Boolean)));
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
      const spec = { ident, mode, ns: node.attrs.ns || null,
        memberOf: memberships(node) };
      elementSpecs.set(ident, spec);
      const models = readProcessingModels(node, warnings, ident);
      if (models.length) processingModels.set(ident, models);
      if (mode === 'delete') {
        deletedElements.add(ident);
      } else if (mode === 'add') {
        customElements.push({
          ident,
          module: node.attrs.module || 'custom',
          ns: node.attrs.ns || null,
          memberOf: memberships(node),
        });
      }
      // mode="change"/"replace" alter content or attributes, not identity:
      // class membership changes come through classes/memberOf below if present.
      if (mode === 'change' || mode === 'replace') {
        const m = memberships(node);
        // a change adds memberships, it does not replace the element's own:
        // an element that joins a class keeps the behaviour it already had
        if (m) customElements.push({ ident, module: node.attrs.module || '',
          ns: node.attrs.ns || null, memberOf: m, merge: mode === 'change' });
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

  return { includedModules, includedElements, deletedElements, customElements, customClasses,
    processingModels, elementSpecs, warnings };
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

function elementChildren(node, name = null) {
  return node.children.filter((child) => typeof child !== 'string'
    && (name == null || local(child.name) === name));
}

function readModel(node, inheritedOutput = null) {
  const params = {};
  const renditions = [];
  for (const child of elementChildren(node)) {
    const name = local(child.name);
    if (name === 'param' && child.attrs.name) params[child.attrs.name] = child.attrs.value || '';
    if (name === 'outputRendition') renditions.push(textOf(child).trim());
  }
  return {
    behaviour: node.attrs.behaviour,
    predicate: node.attrs.predicate || null,
    output: node.attrs.output || inheritedOutput || null,
    cssClass: node.attrs.cssClass || null,
    useSourceRendition: node.attrs.useSourceRendition === 'true',
    params,
    outputRendition: renditions.filter(Boolean).join('; '),
  };
}

function readProcessingUnit(node, inheritedOutput = null, warnings = [], ident = '') {
  const name = local(node.name);
  if (name === 'model') {
    return node.attrs.behaviour ? readModel(node, inheritedOutput) : null;
  }
  if (name === 'modelSequence') {
    const sequence = elementChildren(node)
      .filter((child) => ['model', 'modelSequence'].includes(local(child.name)))
      .map((child) => readProcessingUnit(child, inheritedOutput, warnings, ident))
      .filter(Boolean);
    if (sequence.length < 2) {
      warnings.push(`${ident}: modelSequence needs at least two processing models`);
      return null;
    }
    return {
      sequence: sequence.flatMap((part) => part.sequence || [part]),
      predicate: node.attrs.predicate || null,
      output: node.attrs.output || inheritedOutput || null,
      useSourceRendition: node.attrs.useSourceRendition === 'true',
    };
  }
  return null;
}

/** Read processing alternatives and sequences. A sequence is kept as one
 * candidate, because TEI defines it as one unit of actions, not as alternatives. */
function readProcessingModels(spec, warnings, ident) {
  const out = [];
  for (const child of elementChildren(spec)) {
    const name = local(child.name);
    if (name === 'model' || name === 'modelSequence') {
      const model = readProcessingUnit(child, null, warnings, ident);
      if (model) out.push(model);
    } else if (name === 'modelGrp') {
      const output = child.attrs.output || null;
      for (const modelNode of elementChildren(child)) {
        if (!['model', 'modelSequence'].includes(local(modelNode.name))) continue;
        const model = readProcessingUnit(modelNode, output, warnings, ident);
        if (model) out.push(model);
      }
    }
  }
  return out;
}
