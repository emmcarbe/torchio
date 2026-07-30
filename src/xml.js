/**
 * Minimal, dependency-free XML parser.
 *
 * Scope: well-formed XML only. Validation is not this parser's job (it belongs
 * to the edition's CI, against the ODD-generated schema). On malformed input it
 * throws with a position, so callers can degrade gracefully.
 *
 * Node shape: { name, attrs: {name: value}, children: [node|string] }
 * Text nodes are plain strings. Namespace prefixes are kept as written
 * (e.g. "xml:id" stays "xml:id"); use local() to strip prefixes.
 */

const PREDEFINED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      // a code point out of range is not a character: keep the reference as
  // written instead of throwing (the engine degrades, it does not break)
  return (Number.isFinite(code) && code >= 0 && code <= 0x10FFFF
    && !(code >= 0xD800 && code <= 0xDFFF)) ? String.fromCodePoint(code) : m;
    }
    return PREDEFINED[body] ?? m; // unknown named entity: kept literal
  });
}

export function local(name) {
  const i = name.indexOf(':');
  return i === -1 ? name : name.slice(i + 1);
}

export function parseXML(input) {
  const s = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  let pos = 0;
  const len = s.length;
  const stack = [];
  let root = null;

  const fail = (msg) => {
    const line = s.slice(0, pos).split('\n').length;
    throw new Error(`XML error at position ${pos} (line ${line}): ${msg}`);
  };
  const top = () => stack[stack.length - 1];
  const append = (node) => {
    if (stack.length) top().children.push(node);
    else if (typeof node !== 'string' && root === null) root = node;
    else if (typeof node !== 'string') fail('multiple root elements');
  };

  while (pos < len) {
    if (s[pos] === '<') {
      if (s.startsWith('<!--', pos)) {
        const end = s.indexOf('-->', pos + 4);
        if (end === -1) fail('unterminated comment');
        pos = end + 3;
      } else if (s.startsWith('<![CDATA[', pos)) {
        const end = s.indexOf(']]>', pos + 9);
        if (end === -1) fail('unterminated CDATA');
        append(s.slice(pos + 9, end));
        pos = end + 3;
      } else if (s.startsWith('<?', pos)) {
        const end = s.indexOf('?>', pos + 2);
        if (end === -1) fail('unterminated processing instruction');
        pos = end + 2;
      } else if (s.startsWith('<!DOCTYPE', pos)) {
        let depth = 0;
        let i = pos;
        for (; i < len; i++) {
          if (s[i] === '[') depth++;
          else if (s[i] === ']') depth--;
          else if (s[i] === '>' && depth === 0) break;
        }
        if (i >= len) fail('unterminated DOCTYPE');
        pos = i + 1;
      } else if (s[pos + 1] === '/') {
        const end = s.indexOf('>', pos + 2);
        if (end === -1) fail('unterminated closing tag');
        const name = s.slice(pos + 2, end).trim();
        if (!stack.length) fail(`closing </${name}> with nothing open`);
        if (top().name !== name) fail(`closing </${name}> but <${top().name}> is open`);
        const done = stack.pop();
        if (!stack.length && root === null) root = done;
        pos = end + 1;
      } else {
        // opening tag
        let i = pos + 1;
        while (i < len && !/[\s/>]/.test(s[i])) i++;
        const name = s.slice(pos + 1, i);
        if (!name) fail('empty tag name');
        const node = { name, attrs: {}, children: [] };
        // attributes
        while (i < len) {
          while (i < len && /\s/.test(s[i])) i++;
          if (s[i] === '>' || (s[i] === '/' && s[i + 1] === '>')) break;
          let j = i;
          while (j < len && !/[\s=/>]/.test(s[j])) j++;
          const attName = s.slice(i, j);
          while (j < len && /\s/.test(s[j])) j++;
          if (s[j] !== '=') fail(`attribute "${attName}" without value`);
          j++;
          while (j < len && /\s/.test(s[j])) j++;
          const quote = s[j];
          if (quote !== '"' && quote !== "'") fail(`unquoted value for "${attName}"`);
          const endQ = s.indexOf(quote, j + 1);
          if (endQ === -1) fail(`unterminated value for "${attName}"`);
          node.attrs[attName] = decodeEntities(s.slice(j + 1, endQ));
          i = endQ + 1;
        }
        if (s[i] === '/' && s[i + 1] === '>') {
          append(node);
          if (!stack.length && root === null) root = node;
          pos = i + 2;
        } else if (s[i] === '>') {
          append(node);
          stack.push(node);
          pos = i + 1;
        } else fail(`unterminated tag <${name}>`);
      }
    } else {
      const next = s.indexOf('<', pos);
      const end = next === -1 ? len : next;
      const text = s.slice(pos, end);
      if (stack.length && text) top().children.push(decodeEntities(text));
      pos = end;
    }
  }
  if (stack.length) fail(`unclosed element <${top().name}>`);
  if (!root) fail('no root element');
  return root;
}

/** Depth-first walk over element nodes. */
export function* walk(node) {
  yield node;
  for (const child of node.children) {
    if (typeof child !== 'string') yield* walk(child);
  }
}

export const TEI_NS = 'http://www.tei-c.org/ns/1.0';

/**
 * True if the node lives in the TEI namespace, whatever its name (correction
 * C13: Shelley-Godwin surface files have root <surface>, not <TEI>).
 * Checks the default xmlns, or the prefix binding matching the node's prefix.
 */
export function inTEINamespace(node) {
  const i = node.name.indexOf(':');
  const prefix = i === -1 ? null : node.name.slice(0, i);
  if (prefix) return node.attrs[`xmlns:${prefix}`] === TEI_NS;
  return node.attrs.xmlns === TEI_NS;
}

/** Concatenated text content of a node. */
export function textOf(node) {
  let out = '';
  for (const child of node.children) {
    out += typeof child === 'string' ? child : textOf(child);
  }
  return out;
}
