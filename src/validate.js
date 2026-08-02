/**
 * Validation against the part of an ODD that Torchio can make claims about.
 * This is deliberately not presented as a Relax NG or Schematron validator:
 * content models and arbitrary attribute constraints need a schema engine.
 */

import { local, walk, TEI_NS } from './xml.js';

const SPECIAL_MODULES = new Set(['tei', 'tei_all', 'all']);

function namespaceMap(node, inherited = {}) {
  const ns = { ...inherited };
  for (const [name, value] of Object.entries(node.attrs || {})) {
    if (name === 'xmlns') ns[''] = value;
    else if (name.startsWith('xmlns:')) ns[name.slice(6)] = value;
  }
  return ns;
}

function namespaceOf(node, inherited = {}) {
  const ns = namespaceMap(node, inherited);
  const colon = node.name.indexOf(':');
  return colon < 0 ? (ns[''] || null) : (ns[node.name.slice(0, colon)] || null);
}

function walkPaths(root, inherited = {}, path = '0') {
  const scope = namespaceMap(root, inherited);
  const item = { node: root, ns: namespaceOf(root, inherited), path };
  const children = [];
  let index = 0;
  for (const child of root.children || []) {
    if (typeof child === 'string') continue;
    children.push(...walkPaths(child, scope, `${path}.${index++}`));
  }
  return [item, ...children];
}

function issue(severity, code, message, item) {
  return { severity, code, message, element: local(item.node.name), path: item.path };
}

/**
 * Validate TEI roots against the ODD coverage and declarations available to
 * the press. `data` is the generated P5 element/module table.
 */
export function validateODD(roots, odd, data) {
  const errors = [];
  const warnings = [];
  const docs = Array.isArray(roots) ? roots : [roots];
  const specs = odd?.elementSpecs || new Map();
  const custom = new Map((odd?.customElements || []).map((spec) => [spec.ident, spec]));
  const p5 = data?.p5?.elements || {};
  const modules = odd?.includedModules || new Set();
  const includedElements = odd?.includedElements || new Map();
  const moduleRestricted = modules.size > 0 && ![...modules].some((m) => SPECIAL_MODULES.has(m));
  const supportsModule = (module) => !moduleRestricted || modules.has(module);

  for (const root of docs) {
    const doc = root?.id || root?.root?.attrs?.['xml:id'] || 'document';
    const tree = root?.root || root;
    for (const item of walkPaths(tree)) {
      const name = local(item.node.name);
      if (item.ns !== TEI_NS) {
        const spec = custom.get(name);
        if (!spec || (spec.ns && spec.ns !== item.ns)) {
          errors.push({ ...issue('error', 'ODD-UNKNOWN-CUSTOM-ELEMENT',
            `foreign element <${name}> is not declared by the ODD for namespace ${item.ns || '(none)'}`, item), doc });
        }
        continue;
      }
      const base = p5[name];
      const spec = specs.get(name);
      if (odd.deletedElements.has(name)) {
        errors.push({ ...issue('error', 'ODD-DELETED-ELEMENT',
          `element <${name}> is deleted by the ODD`, item), doc });
        continue;
      }
      if (base) {
        if (!supportsModule(base.module)) {
          errors.push({ ...issue('error', 'ODD-MODULE-EXCLUDED',
            `element <${name}> belongs to module ${base.module}, which the ODD does not include`, item), doc });
        } else if (includedElements.get(base.module)?.size
            && !includedElements.get(base.module).has(name)) {
          errors.push({ ...issue('error', 'ODD-ELEMENT-EXCLUDED',
            `element <${name}> is outside the module ${base.module} whitelist declared by the ODD`, item), doc });
        }
        continue;
      }
      if (!spec || !custom.has(name)) {
        errors.push({ ...issue('error', 'ODD-UNKNOWN-TEI-ELEMENT',
          `TEI element <${name}> is not declared by the ODD or the P5 base`, item), doc });
      }
    }
  }

  for (const [ident, spec] of specs) {
    for (const className of spec.memberOf || []) {
      if (!data?.p5?.classes?.[className] && !odd.customClasses.some((c) => c.ident === className)) {
        errors.push({ severity: 'error', code: 'ODD-UNKNOWN-CLASS',
          message: `elementSpec ${ident} refers to unknown class ${className}`, element: ident, path: 'ODD' });
      }
    }
    const models = odd.processingModels.get(ident) || [];
    for (const model of models) {
      const behaviours = model.sequence ? model.sequence.map((part) => part.behaviour) : [model.behaviour];
      for (const behaviour of behaviours) {
        if (!behaviour) warnings.push({ severity: 'warning', code: 'ODD-MODEL-NO-BEHAVIOUR',
          message: `processing model for ${ident} has no behaviour`, element: ident, path: 'ODD' });
      }
    }
  }

  if (odd.elementSpecs.size) warnings.push({ severity: 'warning', code: 'ODD-CONTENT-MODEL-UNVALIDATED',
    message: 'content models and attribute constraints are not validated by the dependency-free press',
    element: 'ODD', path: 'ODD' });
  return { errors, warnings, valid: errors.length === 0 };
}

export function formatValidationIssue(item) {
  return `${item.code}: ${item.message} (${item.doc || 'ODD'} @ ${item.path})`;
}
