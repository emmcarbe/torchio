/**
 * The base renderer — the guarantee made visible.
 *
 * Renders any model tree to HTML with nothing lost: every element becomes a
 * block or inline container tagged with its TEI element and behaviour section.
 * No intelligence here: intelligence belongs to the pieces (plugins). This is
 * rung 1 of the four-rung ladder: whatever happens, this renders.
 */

import { walkModel } from './model.js';
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
]);

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
    && (BLOCKS.has(c.element) || c.element === 'note' || c.element === 'list' || c.element === 'table'));
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
      return BLOCKS.has(el) ? 'div' : 'span';
  }
}

export const escapeHTML = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** A URL that comes from the edition may point out, never run code:
 *  relative paths, fragments, http(s) and mailto survive; anything else
 *  (javascript:, data:, unknown schemes) is refused. */
export function safeURL(value) {
  const v = String(value == null ? '' : value).trim();
  if (!v) return null;
  if (/^[#/.]/.test(v)) return v;                       // fragment or relative
  if (/^(https?:|mailto:)/i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null;      // any other scheme
  return v;                                             // bare relative name
}

export function renderBase(node, hooks) {
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
    const inner = node.children.map((c) => typeof c === 'string' ? escapeHTML(c) : renderBase(c, hooks)).join('');
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
      + ` title="${escapeHTML((node.atts.reason || 'gap') + (node.atts.quantity ? `, ${node.atts.quantity}` : ''))}">[…]</span>`;
  }
  const tag = htmlTagFor(node);
  let cls = `t-${node.element} s-${node.section}`;
  // verse numbering: mark every fifth line so the theme can show its number
  if (node.element === 'l' && /^\d+$/.test(node.atts.n || '') && Number(node.atts.n) % 5 === 0) {
    cls += ' ln5';
  }
  const id = ` id="${escapeHTML(node.id)}"`;
  let data = ` data-el="${escapeHTML(node.element)}"`;
  for (const a of DATA_ATTS) {
    if (node.atts[a] != null) data += ` data-${a}="${escapeHTML(node.atts[a])}"`;
  }
  let inner = '';
  let prevApp = null;
  for (const child of node.children) {
    if (typeof child !== 'string' && child.element === 'app'
        && prevApp && Number(child.atts.from) > Number(prevApp.atts.to)) {
      // segment apparatus (C27): disjoint declared token ranges imply a
      // separator between adjacent app elements
      inner += ' ';
    }
    inner += typeof child === 'string' ? escapeHTML(child) : renderBase(child, hooks);
    prevApp = (typeof child !== 'string' && child.element === 'app') ? child : null;
  }
  const after = hooks && hooks.after ? hooks.after(node) : '';
  // a mention whose @ref is an external authority URI (VIAF, Wikidata,
  // GeoNames...) is a real link: it opens in its own tab, markup decides
  if (tag === 'span' && MENTION_ELEMENTS.has(node.element)
      && /^https?:\/\//.test(node.atts.ref || '')) {
    return `<a${id} class="${cls} ent-ext" href="${escapeHTML(node.atts.ref)}"`
      + ` target="_blank" rel="noopener"${data}>${inner}</a>${after}`;
  }
  if (node.element === 'supplied') {
    return `<${tag}${id} class="${cls}"${data}>`
      + `<span class="t-sign">[</span>${inner}<span class="t-sign">]</span></${tag}>${after}`;
  }
  return `<${tag}${id} class="${cls}"${data}>${inner}</${tag}>${after}`;
}

/** Entity mentions that may carry an authority reference. */
const MENTION_ELEMENTS = new Set(['persName', 'placeName', 'orgName', 'name',
  'settlement', 'geogName', 'institution', 'repository', 'author', 'rs']);

/** Attributes surfaced as data-* for the interactive pieces (readable, safe). */
const DATA_ATTS = ['wit', 'source', 'resp', 'cert', 'ref', 'key', 'type', 'n',
  'place', 'hand', 'target', 'when'];

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

.t-del{text-decoration:line-through;color:var(--soft)}
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

.t-app:has([data-el="lem"]) .t-rdg{display:none}
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
<html lang="${(model.meta.languages && model.meta.languages[0]) || ''}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
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
