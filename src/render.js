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

export const escapeHTML = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderBase(node) {
  if (node.element === 'lb') return `<br id="${escapeHTML(node.id)}"/>`;
  if (node.element === 'pb') {
    const n = node.atts.n ? escapeHTML(node.atts.n) : '';
    return `<span id="${escapeHTML(node.id)}" class="t-pb" role="separator" title="page break">${n ? `[${n}]` : ''}</span>`;
  }
  if (node.element === 'note') {
    // anchor marker in the text, tied to the floated margin note
    const inner = node.children.map((c) => typeof c === 'string' ? escapeHTML(c) : renderBase(c)).join('');
    let nd = '';
    for (const a of DATA_ATTS) {
      if (node.atts[a] != null) nd += ` data-${a}="${escapeHTML(node.atts[a])}"`;
    }
    return `<span class="t-note-mark" aria-hidden="true">°</span>`
      + `<div id="${escapeHTML(node.id)}" class="t-note s-${node.section}" data-el="note"${nd}>${inner}</div>`;
  }
  const tag = BLOCKS.has(node.element) ? 'div' : 'span';
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
  for (const child of node.children) {
    inner += typeof child === 'string' ? escapeHTML(child) : renderBase(child);
  }
  return `<${tag}${id} class="${cls}"${data}>${inner}</${tag}>`;
}

/** Attributes surfaced as data-* for the interactive pieces (readable, safe). */
const DATA_ATTS = ['wit', 'ref', 'key', 'type', 'n', 'place', 'hand', 'target', 'when'];

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
.t-supplied::before{content:'[';color:var(--faint)}
.t-supplied::after{content:']';color:var(--faint)}
.t-gap::before{content:'[…]';color:var(--faint);font-family:var(--mono);font-size:.85em}
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
.note-hi{background:rgba(176,30,40,.08)}
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

.t-app .t-rdg{display:none}
.t-lem{border-bottom:1px dotted var(--accent-soft)}
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
