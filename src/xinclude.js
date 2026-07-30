/**
 * XInclude resolution (correction C12, imposed by the Shelley-Godwin Archive,
 * which composes its documents from thousands of xi:include).
 *
 * Pragmatic scope: elements whose local name is "include" carrying @href are
 * treated as XInclude. @xpointer is not interpreted in v0: the whole target
 * document is included and the xpointer is recorded as unresolved detail.
 * A failed load never fails the build: the include node stays in place and the
 * failure is reported (nothing is ever invisible, not even a missing file).
 *
 * The loader is injected: (href) => Promise<string>. In Node it reads files
 * relative to the including document; in the browser it fetches.
 */

import { parseXML, local } from './xml.js';

export async function resolveIncludes(root, loadText, { maxDepth = 16 } = {}) {
  const unresolved = [];
  let resolvedCount = 0;

  async function visit(node, depth) {
    const out = [];
    for (const child of node.children) {
      if (typeof child === 'string') { out.push(child); continue; }
      if (local(child.name) === 'include' && child.attrs.href) {
        if (depth >= maxDepth) {
          unresolved.push({ href: child.attrs.href, reason: 'max depth reached' });
          out.push(child);
          continue;
        }
        try {
          const text = await loadText(child.attrs.href);
          const included = parseXML(text);
          await visit(included, depth + 1);
          if (child.attrs.xpointer) {
            unresolved.push({ href: child.attrs.href, reason: `xpointer not interpreted: ${child.attrs.xpointer}`, partial: true });
          }
          resolvedCount++;
          out.push(included);
        } catch (err) {
          unresolved.push({ href: child.attrs.href, reason: String(err.message || err) });
          out.push(child); // degrade: keep the include node visible
        }
      } else {
        await visit(child, depth);
        out.push(child);
      }
    }
    node.children = out;
  }

  await visit(root, 0);
  return { root, resolved: resolvedCount, unresolved };
}
