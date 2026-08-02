/**
 * The base renderer — the guarantee made visible.
 *
 * Renders any model tree to HTML with nothing lost: every element becomes a
 * block or inline container tagged with its TEI element and behaviour section.
 * No intelligence here: intelligence belongs to the pieces (plugins). This is
 * rung 1 of the four-rung ladder: whatever happens, this renders.
 */

import { walkModel, textOfModel } from './model.js';
import { interactCSS, buildInteractJS, toolbarHTML } from './interact.js';
import { i18n, resolveLang } from './i18n.js';
import { themeCSS } from './themes.js';

const BLOCKS = new Set([
  'TEI', 'text', 'body', 'front', 'back', 'div', 'div1', 'div2', 'div3',
  'p', 'ab', 'lg', 'l', 'head', 'sp', 'stage', 'castList', 'castItem',
  'list', 'item', 'table', 'row', 'quote', 'cit', 'epigraph', 'argument',
  'titlePage', 'docTitle', 'titlePart', 'byline', 'docImprint', 'docDate',
  'opener', 'closer', 'salute', 'signed', 'dateline', 'postscript',
  'listWit', 'witness', 'listPerson', 'person', 'listPlace', 'place',
  'listOrg', 'org', 'listChange', 'change', 'listBibl', 'bibl', 'note',
  'teiHeader', 'fileDesc', 'sourceDesc', 'msDesc', 'figure', 'group', 'floatingText',
  // documentary transcription (sourceDoc): a line of the page is a line on
  // screen, never joined into prose. A word split across lines stays split,
  // as it is in the notebook (C80)
  'sourceDoc', 'surface', 'surfaceGrp', 'zone', 'line',
]);

/** Facsimile image regions: surfaces, zones and graphics pointing at page
 *  images. Torchio does not render facsimiles yet, so one that carries no text
 *  is not shown as an empty bordered box (renderBase returns it as nothing). A
 *  documentary surface holds lines of text and is unaffected. */
const FACSIMILE_ELEMENTS = new Set(['facsimile', 'surface', 'surfaceGrp', 'zone', 'graphic']);

/**
 * An address an editor typed into running prose (the text of a note, a
 * witness description) is an address: it becomes a link that opens in its
 * own tab. The input is already escaped; the pattern stops before closing
 * punctuation, so a citation ending in a full stop does not swallow it.
 */
export function linkifyText(escaped) {
  return escaped.replace(/(https?:\/\/[^\s<"]*[^\s<".,;:)\]])/g,
    (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
}

/** Escapes for both text and attribute contexts: quotes included, because
 *  a `&quot;` in a TEI attribute would otherwise close the HTML attribute
 *  and inject markup. Entities render identically as text. */
/** The HTML element that carries a TEI element's structural meaning: a
 *  heading is a heading, a list is a list, a table is a table. The class
 *  and the data-el keep the TEI name, so nothing is lost; what changes is
 *  that the structure survives without CSS, and assistive technology and
 *  the plainest browser can read it. */
function htmlTagFor(node) {
  const el = node.element;
  const blockChild = (n) => n.children.some((c) => typeof c !== 'string'
    && (BLOCKS.has(c.element) || c.element === 'note' || c.element === 'list'
      || c.element === 'table' || blockChild(c)));
  const behaviour = node.processing && node.processing.behaviour;
  const byBehaviour = {
    inline: 'span', text: 'span', block: 'div', body: 'div', document: 'article',
    heading: 'h2', section: 'section', listItem: 'li', table: 'table', row: 'tr',
    note: 'aside', figure: 'figure',
  };
  if (behaviour === 'paragraph') return blockChild(node) ? 'div' : 'p';
  if (behaviour === 'list') return /^(ordered|numbered)$/i.test(node.atts.type || '') ? 'ol' : 'ul';
  if (behaviour === 'cell') return (node.atts.role || '') === 'label' ? 'th' : 'td';
  if (byBehaviour[behaviour]) return byBehaviour[behaviour];
  switch (el) {
    case 'head': return 'h2';
    case 'list': return /^(ordered|numbered)$/i.test(node.atts.type || '') ? 'ol' : 'ul';
    case 'item': return 'li';
    case 'table': return 'table';
    case 'row': return 'tr';
    case 'cell': return (node.atts.role || '') === 'label' ? 'th' : 'td';
    case 'p':
    case 'ab':
      // a TEI p may hold blocks, which HTML paragraphs may not
      return blockChild(node) ? 'div' : 'p';
    case 'quote':
    case 'cit':
      return blockChild(node) ? 'blockquote' : 'span';
    default:
      // An element not on the list is not therefore a phrase: what decides is
      // what it holds. A span that contains a div is invalid HTML, and the
      // page then cannot be re-parsed, which is how a static edition is
      // verified. Ten thousand such cases came from a list of sixty-three
      // names against the 588 elements of P5 (C83)
      return BLOCKS.has(el) || blockChild(node) ? 'div' : 'span';
  }
}

export const escapeHTML = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** A URL that comes from the edition may point out, never run code:
 *  relative paths, fragments, http(s) and mailto survive; anything else
 *  (javascript:, data:, unknown schemes) is refused. */
export function safeURL(value) {
  // browsers strip TAB, LF and CR from a URL before reading its scheme, so
  // "java\tscript:" runs. Strip them first, then allow instead of deny: an
  // allowlist cannot be walked around by a scheme nobody thought of
  const v = String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!v) return null;
  if (/^\/\//.test(v)) return null;                     // //host is absolute, not relative
  if (/^[#/.]/.test(v)) return v;                       // fragment or relative
  if (/^(https?|mailto):/i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null;      // any other scheme
  return v;                                             // bare relative name
}

function safeStyle(value) {
  if (!value || /url\s*\(|expression\s*\(|@import|-moz-binding|behavior\s*:/i.test(value)) return '';
  const allowed = new Set(['color', 'background-color', 'font-style', 'font-weight',
    'font-size', 'font-family', 'text-align', 'text-decoration', 'text-transform',
    'letter-spacing', 'line-height', 'margin', 'margin-left', 'margin-right',
    'margin-top', 'margin-bottom', 'padding', 'padding-left', 'padding-right',
    'padding-top', 'padding-bottom', 'border', 'border-top', 'border-bottom',
    'border-left', 'border-right', 'display', 'vertical-align', 'white-space']);
  const declarations = [];
  for (const declaration of String(value).split(';')) {
    const i = declaration.indexOf(':');
    if (i < 1) continue;
    const property = declaration.slice(0, i).trim().toLowerCase();
    const val = declaration.slice(i + 1).trim();
    if (allowed.has(property) && val && !/[<>]/.test(val)) declarations.push(`${property}:${val}`);
  }
  return declarations.join(';');
}

function processingParam(node, name) {
  const expression = node.processing && node.processing.params && node.processing.params[name];
  if (expression == null || expression === '.') return null;
  const attr = String(expression).match(/^@([\w:.-]+)$/);
  if (attr) return node.atts[attr[1]] || '';
  const literal = String(expression).match(/^(['"])(.*)\1$/s);
  if (literal) return literal[2];
  const childMatch = String(expression).match(/^([\w.-]+)(?:\[(?:@([\w:.-]+)\s*=\s*(['"])(.*?)\3|(\d+))\])?$/);
  const child = childMatch
    ? node.children.filter((c) => typeof c !== 'string' && c.element === childMatch[1])
      .filter((c) => !childMatch[2] || c.atts[childMatch[2]] === childMatch[4])
      [childMatch[5] ? Number(childMatch[5]) - 1 : 0]
    : node.children.find((c) => typeof c !== 'string' && c.element === expression);
  return child ? textOfModel(child) : String(expression);
}

function processingChildExpressionMatches(child, expression) {
  const match = String(expression || '').match(/^([\w.-]+)(?:\[(?:@([\w:.-]+)\s*=\s*(['"])(.*?)\3|(\d+))\])?$/);
  if (!match || child.element !== match[1]) return false;
  if (match[2]) return child.atts[match[2]] === match[4];
  return true;
}

function processingData(node, behaviour) {
  if (!behaviour) return '';
  const source = node.processing && node.processing.source;
  let data = ` data-behaviour="${escapeHTML(behaviour)}"`;
  if (source) data += ` data-behaviour-source="${escapeHTML(source)}"`;
  const sequence = node.processing && node.processing.sequence;
  if (sequence) data += ` data-behaviour-sequence="${escapeHTML(sequence.map((part) => part.behaviour).filter(Boolean).join(' '))}"`;
  const content = node.processing && node.processing.params && node.processing.params.content;
  if (content) data += ` data-processing-content="${escapeHTML(content)}"`;
  // Kept for compatibility with existing themes that target edition ODD rules.
  if (source === 'odd') data += ` data-odd-behaviour="${escapeHTML(behaviour)}"`;
  return data;
}

export function renderBase(node, hooks) {
  const oddBehaviour = node.processing && node.processing.behaviour;
  if (oddBehaviour === 'omit') return '';
  if (oddBehaviour === 'break') {
    return `<br id="${escapeHTML(node.id)}" class="t-${escapeHTML(node.element)} odd-break"`
      + ` data-el="${escapeHTML(node.element)}"${processingData(node, 'break')}>`;
  }
  if (oddBehaviour === 'graphic') {
    const raw = processingParam(node, 'url') || node.atts.url || node.atts.target || '';
    const href = safeURL(raw);
    const label = escapeHTML(raw || textOfModel(node).trim() || node.element);
    return `<figure id="${escapeHTML(node.id)}" class="t-${escapeHTML(node.element)} odd-graphic"`
      + ` data-el="${escapeHTML(node.element)}"${processingData(node, 'graphic')}>`
      + `${href ? `<img src="${escapeHTML(href)}" alt="${escapeHTML(textOfModel(node).trim())}">` : label}</figure>`;
  }
  // Until a facsimile viewer exists, an image declaration must still be
  // visible and actionable. A URL is editorial evidence, not empty markup.
  if (node.element === 'graphic' && node.atts.url) {
    const raw = String(node.atts.url);
    const href = safeURL(raw);
    const label = escapeHTML(raw);
    return `<span id="${escapeHTML(node.id)}" class="t-graphic s-${node.section}" data-el="graphic"`
      + ` data-url="${label}">${href ? `<a href="${escapeHTML(href)}">${label}</a>` : label}</span>`;
  }
  // a facsimile image region (surface / zone / graphic under <facsimile>) carries
  // no text, only pointers to images Torchio does not render yet: as an empty
  // bordered box it is noise. Such an element with no text content renders as
  // nothing, until facsimiles are supported. A documentary surface, which holds
  // lines of text, is not empty and keeps its rendering (C80)
  if (FACSIMILE_ELEMENTS.has(node.element) && !textOfModel(node).trim()) return '';
  // a node from a non-TEI namespace is preserved, never interpreted: it keeps
  // its qualified name and namespace so nothing is lost and nothing is
  // falsified, and a later plugin (SVG, MathML) can find it (C87)
  if (node.foreign) {
    const tag = node.children.some((c) => typeof c !== 'string') ? 'div' : 'span';
    let inner = '';
    for (const child of node.children) {
      inner += typeof child === 'string' ? escapeHTML(child) : renderBase(child, hooks);
    }
    const atts = Object.entries(node.atts)
      .map(([k, v]) => `${escapeHTML(k)}=${escapeHTML(v)}`).join(' ');
    return `<${tag} id="${escapeHTML(node.id)}" class="tei-foreign"`
      + ` data-name="${escapeHTML(node.qname || node.element)}"`
      + `${node.ns ? ` data-ns="${escapeHTML(node.ns)}"` : ''}`
      + `${atts ? ` data-atts="${escapeHTML(atts)}"` : ''}>${inner}</${tag}>`;
  }
  if (node.element === 'lb') {
    // lineation belongs to the diplomatic level: the reading mode flows,
    // and @break="no" rejoins a word split across lines (CSS in interact)
    const nb = node.atts.break === 'no' ? ' data-break="no"' : '';
    return `<span id="${escapeHTML(node.id)}" class="t-lb"${nb}><br/></span>`;
  }
  if (node.element === 'pb') {
    const n = node.atts.n ? escapeHTML(node.atts.n) : '';
    return `<span id="${escapeHTML(node.id)}" class="t-pb" role="separator" title="page break">${n ? `[${n}]` : ''}</span>`;
  }
  if (node.element === 'note') {
    // anchor marker in the text, tied to the floated margin note
    const inner = node.children.map((c) => typeof c === 'string'
      // an address an editor typed into the prose of a note is an address:
      // it becomes a link, opening in its own tab, the way the witness
      // register already treats one. Only the text the source wrote is
      // touched; markup that already declares a pointer goes its own way
      ? linkifyText(escapeHTML(c))
      : renderBase(c, hooks)).join('');
    let nd = '';
    for (const a of DATA_ATTS) {
      if (node.atts[a] != null) nd += ` data-${a}="${escapeHTML(node.atts[a])}"`;
    }
    return `<span class="t-note-mark" aria-hidden="true">°</span>`
      + `<div id="${escapeHTML(node.id)}" class="t-note s-${node.section}" data-el="note"${nd}>${inner}</div>`;
  }
  // editorial signs belong to the text, not to the stylesheet: brackets and
  // the lacuna mark are real characters, selectable and copyable
  if (node.element === 'gap') {
    const reason = node.atts.reason ? ` (${escapeHTML(node.atts.reason)})` : '';
    return `<span id="${escapeHTML(node.id)}" class="t-gap s-${node.section}" data-el="gap"`
      + ` title="${escapeHTML([node.atts.reason || 'gap',
        [node.atts.quantity, node.atts.unit].filter(Boolean).join(' ') || node.atts.extent,
        textOfModel(node).trim()].filter(Boolean).join(', '))}">[…]</span>`;
  }
  const tag = htmlTagFor(node);
  let cls = `t-${node.element} s-${node.section}`;
  if (node.processing && node.processing.cssClass) {
    const extra = String(node.processing.cssClass).split(/\s+/)
      .filter((c) => /^[a-zA-Z_][\w-]*$/.test(c));
    if (extra.length) cls += ' ' + extra.join(' ');
  }
  // verse numbering: mark every fifth line so the theme can show its number
  if (node.element === 'l' && /^\d+$/.test(node.atts.n || '') && Number(node.atts.n) % 5 === 0) {
    cls += ' ln5';
  }
  const id = ` id="${escapeHTML(node.id)}"`;
  let data = ` data-el="${escapeHTML(node.element)}"`;
  data += processingData(node, oddBehaviour);
  const oddStyle = safeStyle([
    node.processing && node.processing.outputRendition,
    node.processing && node.processing.useSourceRendition ? node.atts.style : '',
  ].filter(Boolean).join(';'));
  if (oddStyle) data += ` style="${escapeHTML(oddStyle)}"`;
  // the language the edition declares is not decoration: it governs
  // hyphenation, quotation marks, the voice of a screen reader and the
  // direction of the script. It must survive into the page as a real
  // HTML attribute, never as data-*
  const xl = node.atts['xml:lang'];
  if (xl) {
    data += ` lang="${escapeHTML(xl)}"`;
    if (RTL.has(String(xl).split('-')[0].toLowerCase())) data += ' dir="rtl"';
  }
  for (const a of DATA_ATTS) {
    if (node.atts[a] != null) data += ` data-${a}="${escapeHTML(node.atts[a])}"`;
  }
  // an inferred value (the hand a handShift puts in force where the markup is
  // silent) is emitted as its own attribute and flagged: the page can act on
  // it, and a reader or a machine can tell it from what the source declares
  if (node.inferred && node.inferred.hand && node.atts.hand == null) {
    data += ` data-hand="${escapeHTML(node.inferred.hand)}" data-hand-inferred="true"`;
  }
  let inner = '';
  let prevApp = null;
  const appHasLemma = node.element === 'app'
    && node.children.some((c) => typeof c !== 'string' && c.element === 'lem');
  let appAlternative = 0;
  let unclearAlternative = 0;
  const oddAlternate = oddBehaviour === 'alternate'
    ? processingParam(node, 'default') : null;
  const processingContent = processingParam(node, 'content');
  const children = processingContent == null ? node.children : [processingContent];
  for (const child of children) {
    if (typeof child !== 'string' && child.element === 'app'
        && prevApp && Number(child.atts.from) > Number(prevApp.atts.to)) {
      // segment apparatus (C27): disjoint declared token ranges imply a
      // separator between adjacent app elements
      inner += ' ';
    }
    if (typeof child === 'string') {
      inner += escapeHTML(child);
    } else {
      let rendered = renderBase(child, hooks);
      const hideAppAlternative = node.element === 'app' && !appHasLemma
        && (child.element === 'rdg' || child.element === 'rdgGrp') && appAlternative++ > 0;
      const hideUnclearAlternative = node.element === 'choice' && child.element === 'unclear'
        && unclearAlternative++ > 0;
      const hideODDAlternative = oddAlternate && !processingChildExpressionMatches(child, oddAlternate);
      if (hideAppAlternative || hideUnclearAlternative || hideODDAlternative) {
        rendered = rendered.replace(/^<([a-z][a-z0-9]*)/i, '<$1 hidden aria-hidden="true"');
      }
      inner += rendered;
    }
    prevApp = (typeof child !== 'string' && child.element === 'app') ? child : null;
  }
  const after = hooks && hooks.after ? hooks.after(node) : '';
  if (oddBehaviour === 'link') {
    const raw = processingParam(node, 'uri') || node.atts.target || node.atts.ref || '';
    const href = safeURL(raw);
    if (href) return `<a${id} class="${cls}" href="${escapeHTML(href)}"${data}>${inner}</a>${after}`;
  }
  // a pointer is a pointer: `ref` and `ptr` whose target is an external
  // address become real links, opening in their own tab. A `ptr` carries no
  // text of its own, so the address itself is what the reader clicks; a
  // `ref` keeps the words the edition chose. An internal target (#id) is
  // left to the interactive layer, and a target the safety rules refuse is
  // left as plain text rather than turned into a link nobody vetted
  if ((node.element === 'ref' || node.element === 'ptr')) {
    const t = node.atts.target || node.atts.ref || '';
    if (/^https?:\/\//.test(t)) {
      const href = safeURL(t);
      if (href) {
        const label = inner.trim() || escapeHTML(t.replace(/^https?:\/\//, ''));
        return `<a${id} class="${cls} ent-ext" href="${escapeHTML(href)}"`
          + ` target="_blank" rel="noopener"${data}>${label}</a>${after}`;
      }
    }
  }
  // a mention whose @ref is an external authority URI (VIAF, Wikidata,
  // GeoNames...) is a real link: it opens in its own tab, markup decides
  if (tag === 'span' && MENTION_ELEMENTS.has(node.element)) {
    const ref = node.atts.ref || '';
    // the attributes the source declares about this mention, surfaced verbatim
    // so a reader sees them on hover without a script and without an invented
    // gloss (attestation, not inference): the type, the reference, the key
    const bits = [];
    for (const a of ['type', 'role', 'ref', 'key', 'cert']) {
      if (node.atts[a]) bits.push(`${a}: ${node.atts[a]}`);
    }
    const title = bits.length ? ` title="${escapeHTML(bits.join(' · '))}"` : '';
    // an @ref that is an external authority URI (VIAF, Wikidata, GeoNames...) is
    // a real link: it opens in its own tab, markup decides
    if (/^https?:\/\//.test(ref)) {
      return `<a${id} class="${cls} ent-ext" href="${escapeHTML(ref)}"`
        + ` target="_blank" rel="noopener"${title}${data}>${inner}</a>${after}`;
    }
    // an internal reference (#id), a key or a type is not a link, but the
    // attribute is still shown on hover, so it is never invisible until a
    // script runs (the earlier behaviour: only external links did anything)
    if (title) {
      return `<${tag}${id} class="${cls}"${title}${data}>${inner}</${tag}>${after}`;
    }
  }
  // a metamark is the writer's sign about the text (the caret of an
  // insertion, a paragraph mark), not text of the work: shown as it is, but
  // each explains itself in plain words on hover
  // an apparatus entry says, in the class, what CSS then acts on: no :has()
  // (a browser without it would print every variant inside the critical text)
  // and no guessing. An app that points (@from/@to, @loc) has its text in the
  // base text already: rendering it inline would print the lemma twice
  if (node.element === 'app') {
    const hasLem = appHasLemma;
    const points = node.atts.loc != null
      || (node.atts.from != null && /^#/.test(String(node.atts.from)));
    const appCls = cls + (hasLem ? ' app-has-lem' : ' app-no-lem')
      + (points ? ' app-pointing' : '');
    return `<${tag}${id} class="${appCls}"${data}>${inner}</${tag}>${after}`;
  }
  if (node.element === 'metamark') {
    const MM = {
      insertion: 'insertion mark: the words written above the line enter here',
      insert: 'insertion mark: the words written above the line enter here',
      paragraph: 'paragraph mark: the hand says a new paragraph begins here',
      transposition: 'transposition mark: the hand says these passages swap places',
      deletion: 'deletion mark: the hand strikes this out',
      used: 'the hand marks this passage as used',
    };
    const fn = (node.atts.function || '').toLowerCase();
    const why = MM[fn] || ('a sign of the writing hand' + (fn ? `: ${fn}` : ''));
    return `<${tag}${id} class="${cls}"${data}`
      + ` title="${escapeHTML(why)}">${inner}</${tag}>${after}`;
  }
  if (node.element === 'supplied') {
    return `<${tag}${id} class="${cls}"${data}>`
      + `<span class="t-sign">[</span>${inner}<span class="t-sign">]</span></${tag}>${after}`;
  }
  return `<${tag}${id} class="${cls}"${data}>${inner}</${tag}>${after}`;
}

/** Entity mentions that may carry an authority reference. */
const MENTION_ELEMENTS = new Set(['persName', 'placeName', 'orgName', 'name',
  'settlement', 'geogName', 'institution', 'repository', 'author', 'rs', 'term']);

/** Attributes surfaced as data-* for the interactive pieces (readable, safe). */
/** Scripts written right to left: an edition in these languages must not be
 *  laid out left to right (principle 1: no tradition is the default). */
const RTL = new Set(['ar', 'he', 'fa', 'ur', 'syr', 'arc', 'sam', 'dv', 'ps', 'yi', 'ku', 'ckb']);

const DATA_ATTS = ['wit', 'source', 'resp', 'cert', 'ref', 'key', 'type', 'n',
  'place', 'hand', 'target', 'when', 'from', 'to', 'loc', 'change', 'new',
  // what the edition declares about its own writing: how a passage is written
  // (rend), what an image is (url, facs), why a reading is uncertain (reason),
  // how much is missing (unit, extent), the medium of a hand
  'rend', 'url', 'facs', 'reason', 'unit', 'extent', 'medium', 'corresp',
  // a canonical reference (cRef/target on a ref) says which locus a pointer
  // aligns to (a CTS urn, a Keil citation): it must survive, or the edition
  // loses the alignment it declared
  'subtype', 'function', 'style', 'rendition', 'cRef'];

/**
 * Default theme. Visual language after Emmanuela Carbé's "Risposte dei Savi"
 * site (white ground, hairlines, Venetian red accent, mono structural labels)
 * fused with the VeDPH Summer School 2026 stylesheet (humanist serif reading
 * text × markup monospace, rubricated sigla, apparatus grammar). Fonts are
 * declared as stacks: EB Garamond and IBM Plex Mono load when self-hosted by
 * the edition repo (path B ships the woff2), with quiet fallbacks otherwise.
 */
export const structuralCSS = `
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:var(--ground);color:var(--ink);font-family:var(--serif);
  font-size:18px;line-height:1.55;-webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;font-feature-settings:"kern","liga","onum","pnum"}
a{color:var(--link);text-decoration:none}
a:hover{text-decoration:underline;text-underline-offset:2px}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

header.torchio{max-width:var(--measure);margin:0 auto;padding:26px 20px 14px;
  border-bottom:1px solid var(--hair)}
header.torchio h1{margin:0;font-family:var(--serif);font-size:23px;font-weight:600;letter-spacing:.01em}
header.torchio .sub{margin:6px 0 0;color:var(--soft);font-family:var(--mono);
  font-size:11.5px;letter-spacing:.06em;text-transform:uppercase}

main.torchio{max-width:var(--measure);margin:0 auto;padding:10px 20px 0}

.t-teiHeader{display:none}
body.show-header .t-teiHeader{display:block;border:1px solid var(--hair);
  border-radius:2px;padding:14px 16px;font-size:.85em;color:var(--soft)}

.t-head{font-weight:600;margin:1.3em 0 .4em}
.t-p,.t-ab{margin:.65em 0}
.t-lg{margin:.8em 0 .8em 1.6em}
.t-l{display:block;position:relative}
.t-lg{padding-left:3em}
.t-l.ln5::before{content:attr(data-n);position:absolute;left:-3em;top:.35em;
  font-family:var(--mono);font-size:10px;color:var(--soft);user-select:none}
.t-sp{margin:.65em 0}
.t-speaker{font-family:var(--mono);font-size:.72em;letter-spacing:.1em;
  text-transform:uppercase;color:var(--soft);display:inline-block;margin-right:.5em}
.t-stage{font-style:italic;color:var(--soft)}
.t-opener,.t-closer{color:var(--soft);margin:.65em 0}
.t-salute,.t-dateline,.t-signed{font-style:italic}

.t-persName,.t-placeName,.t-orgName{border-bottom:1px dotted var(--accent-soft)}
.t-foreign,.t-hi,.t-emph,.t-title{font-style:italic}
.t-quote{margin:.8em 0 .8em 1.4em;color:var(--soft)}

/* the class carries the behaviour: anything the ODD declares a member of
   model.pPart.transcriptional is struck through like del, named or not */
.s-3-editoriale>[data-el="del"],.s-3-editoriale.t-del,.t-del{text-decoration:line-through;color:var(--soft)}
.t-metamark{color:var(--soft);font-size:.78em;cursor:help;border-bottom:1px dotted var(--hair)}
.t-add{vertical-align:super;font-size:.82em}
.t-unclear{background:#F5F4EF}
.t-sign{color:var(--soft)}
.t-gap{color:var(--soft);font-family:var(--mono);font-size:.85em}
.t-abbr{border-bottom:1px dotted var(--faint)}

.t-pb{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.08em;
  color:var(--accent);vertical-align:super;margin:0 .18em;user-select:none}

.t-note{font-size:.85em;color:var(--soft);border-left:2px solid var(--hair);
  padding-left:.7em;margin:.5em 0}
.t-note-mark{color:var(--faint);font-size:.55em;vertical-align:super;user-select:none}
/* an apparatus entry in running prose is part of the sentence: it holds a
   note, so the HTML element must be a div (a span may not contain one), but
   it reads inline. Its note is either placed in a margin (absolute) or
   collapsed to its mark, so it never breaks the line either */
.t-app{display:inline}
.t-teiHeader .t-note-mark,.header-full .t-note-mark,.t-app .t-note-mark{display:none}
.t-app .t-note{display:none}
@media(min-width:1180px){.t-app .t-note{display:block}}
.t-note-mark:hover + .t-note,.t-note:hover{border-left-color:var(--accent);color:var(--ink)}
.note-hi{background:rgba(176,30,40,.13);border-radius:2px;transition:background .15s}
.t-note.note-hi{color:var(--ink)}
body.notes-off .t-note{display:none}
body.notes-off .t-note-mark{opacity:.25}
@media(min-width:1180px){
  .t-note{float:right;clear:right;width:14rem;margin:.1em -16.5rem .6em 1em;
    font-size:.78em;line-height:1.4;border-left:0;padding-left:0}
  .header-full .t-note,.t-teiHeader .t-note{float:none;width:auto;margin:.5em 0;
    border-left:2px solid var(--hair);padding-left:.7em}
  .t-note.placed{font-size:.78em;line-height:1.4}
}

.t-app.app-has-lem .t-rdg{display:none}
/* an app without a lem privileges nothing: the first reading stands in the
   text (the others are in the apparatus), never all of them concatenated */
.t-app.app-no-lem>[data-el="rdg"]~[data-el="rdg"],
.t-app.app-no-lem>[data-el="rdgGrp"]~[data-el="rdgGrp"]{display:none}
/* an app that points to the text (double-end-point, location-referenced)
   carries no text of its own: the passage is already in the base text */
.t-app.app-pointing{display:none}
.t-lem{border-bottom:1px dotted var(--accent-soft)}
.t-app[data-type="lac"] [data-el="lem"]{font-family:var(--mono);font-size:.62em;
  font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--soft);
  border-bottom:none;margin-right:.5em;vertical-align:.08em}
.t-app:hover .t-lem,.t-lem:hover{background:color-mix(in srgb,var(--accent) 7%,transparent)}

footer.torchio{max-width:var(--measure);margin:44px auto 0;padding:16px 20px 36px;
  border-top:1px solid var(--hair);color:var(--soft);
  font-family:var(--mono);font-size:11px;letter-spacing:.05em}
footer.torchio .press{color:var(--accent)}
.skip{position:absolute;left:-9999px;top:0;background:var(--accent);color:#fff;
  padding:8px 14px;font-family:var(--mono);font-size:11px;z-index:100}
.skip:focus{left:0}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

/** Back-compat: the default theme plus the shared structure. */
export const baseCSS = themeCSS('savi') + structuralCSS;

/** Wrap a rendered tree in a complete standalone page. */
export function pressPage(model, { title } = {}) {
  const T = i18n(resolveLang(null, model));
  const t = title || model.meta.title || 'Untitled edition';
  const body = model.documents.map((d) => renderBase(d.tree)).join('\n');
  const resp = (model.meta.responsibility || [])
    .map((r) => r.name).filter(Boolean).join(' · ');
  let hasChoice = false;
  let hasApparatus = model.apparatus.length > 0;
  for (const doc of model.documents) {
    for (const n of walkModel(doc.tree)) {
      if (n.element === 'choice') hasChoice = true;
      if (hasChoice && hasApparatus) break;
    }
  }
  return `<!DOCTYPE html>
<html${(model.meta.languages && model.meta.languages[0]) ? ` lang="${escapeHTML(model.meta.languages[0])}"` : ''}>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHTML(t)}</title>
<style>${baseCSS}
${interactCSS}</style>
</head>
<body>
<header class="torchio">
<h1>${escapeHTML(t)}</h1>
<p class="sub">${T.dse}${resp ? ' · ' + escapeHTML(resp) : ''}</p>
</header>
${toolbarHTML({ hasChoice, hasApparatus, t: T })}
<a class="skip" href="#main">${T.skip}</a>
<main id="main" class="torchio">
${body}
</main>
<footer class="torchio">${T.publishedWith} <span class="press">Torchio</span> v0 · TEI ${escapeHTML(model.generator.tei.split('.').slice(0, 2).join('.'))}</footer>
<script>${buildInteractJS(T)}</script>
</body>
</html>`;
}

/** Sanity guarantee: the rendered page contains every character of the model's text. */
export function textIsComplete(model) {
  for (const doc of model.documents) {
    for (const n of walkModel(doc.tree)) {
      for (const c of n.children) {
        if (typeof c === 'string' && c.trim()) {
          // every text chunk must survive rendering (escaped)
          if (!renderBase(doc.tree).includes(escapeHTML(c))) return false;
        }
      }
    }
  }
  return true;
}
