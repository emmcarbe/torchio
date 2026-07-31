/**
 * The page shell: what every pressed page has in common, whatever it holds.
 * Chrome (head, navigation, header, footer), the labels that name the parts
 * of a TEI header, the safe serialization of data into a script block, and
 * the small program that filters and sorts a register.
 *
 * Split out of site.js: the pressing of an edition is one story, the frame
 * every page sits in is another.
 */

import { escapeHTML, safeURL, structuralCSS } from './render.js';
import { interactCSS } from './interact.js';
import { themeCSS } from './themes.js';

export const HEADER_LABELS = {
  teiHeader: 'TEI Header', fileDesc: 'File Description', titleStmt: 'Title',
  editionStmt: 'Edition', extent: 'Extent', publicationStmt: 'Publication',
  seriesStmt: 'Series', notesStmt: 'Notes', sourceDesc: 'Source',
  respStmt: 'Responsibility', availability: 'Availability', licence: 'Licence',
  listWit: 'Witnesses', witness: 'Witness', msDesc: 'Manuscript',
  msIdentifier: 'Identifier', msContents: 'Contents',
  physDesc: 'Physical Description', history: 'History',
  encodingDesc: 'Encoding', projectDesc: 'Project',
  editorialDecl: 'Editorial Practice', samplingDecl: 'Sampling',
  refsDecl: 'Reference System', classDecl: 'Classification Scheme',
  listPrefixDef: 'Prefixes', profileDesc: 'Profile', creation: 'Creation',
  langUsage: 'Languages', textClass: 'Classification',
  correspDesc: 'Correspondence', handNotes: 'Hands',
  revisionDesc: 'Revision History', listChange: 'Changes',
  biblFull: 'Bibliographic Record', appInfo: 'Application',
};
const HEADER_SILENT = ['p', 'ab', 'list', 'item', 'table', 'row', 'cell',
  'lg', 'l', 'head', 'note', 'bibl', 'address', 'addrLine', 'change'];
export function headerLabelCSS() {
  let css = '';
  for (const [el, label] of Object.entries(HEADER_LABELS)) {
    css += `.header-full div[data-el="${el}"]::before{content:"${label}"}\n`;
  }
  for (const el of HEADER_SILENT) {
    css += `.header-full div[data-el="${el}"]::before{content:none}\n`;
  }
  return css;
}

/** JSON safe inside a <script> block: a `</script>` in editorial text
 *  would otherwise close the block, and U+2028/9 break the parse. */
export function jsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/** The colophon of an impression: which press, which state of it, when.
 *  Two impressions of the same XML can then be collated, and what differs
 *  is attributable. */
let COLOPHON = null;
export function setColophon(text) { COLOPHON = text; }
function colophon() { return COLOPHON || 'v0.1.0'; }

export const RTL_UI = new Set(['ar', 'he', 'fa', 'ur', 'syr', 'arc', 'sam', 'dv', 'ps', 'yi', 'ku', 'ckb']);
let TEXT_LANG = null;
export function setTextLang(l) { TEXT_LANG = l || null; }

let EDITION_VERSION = null;
export function setEditionVersion(v) { EDITION_VERSION = v || null; }

export function chrome({ title, sub, active, pages, body, script = '', bodyClass = '', t, lang, theme, parent }) {
  const parentHref = parent ? safeURL(parent.href) : null;
  const nav = (parentHref ? `<a href="${escapeHTML(parentHref)}" class="up">${escapeHTML(parent.label)}</a>` : '')
    + pages
    .map(([file, label]) =>
      `<a href="${file}"${file === active ? ' class="on"' : ''}>${escapeHTML(label)}</a>`)
    .join('');
  return `<!DOCTYPE html>
<html${(TEXT_LANG || lang) ? ` lang="${escapeHTML(TEXT_LANG || lang)}"` : ''}${TEXT_LANG && RTL_UI.has(String(TEXT_LANG).split('-')[0].toLowerCase()) ? ' dir="rtl"' : ''}>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHTML(title)}</title>
<style>${themeCSS(theme)}${structuralCSS}
${interactCSS}
.torchio-nav{display:flex;gap:22px;margin-left:auto}
.torchio-nav a{font-family:var(--mono);font-size:11.5px;letter-spacing:.06em;
  color:var(--soft);text-transform:uppercase}
.torchio-nav a.on{color:var(--accent)}
.torchio-nav a.up{color:var(--accent-soft)}
.torchio-nav a:hover{color:var(--ink);text-decoration:none}
header.torchio{display:flex;flex-wrap:wrap;gap:10px 20px;align-items:baseline}
header.torchio .tt{min-width:14rem}
.about dt{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.14em;
  text-transform:uppercase;color:var(--soft);margin-top:1.2em}
.about dd{margin:0.3em 0 0}
.about dd.scrollbox{max-height:18rem;overflow-y:auto;border:1px solid var(--hair);
  border-radius:2px;padding:0 12px;margin-top:.5em}
.wit-table,.idx-table{width:100%;border-collapse:collapse;margin:.6em 0}
.wit-table th{text-align:left;font-family:var(--mono);font-size:10px;font-weight:600;
  letter-spacing:.12em;text-transform:uppercase;color:var(--soft);
  padding:6px 10px 6px 0;border-bottom:1px solid var(--hair)}
.md-table td:first-child{font-size:1.05em;white-space:nowrap}
.wit-table td,.idx-table td{padding:6px 10px 6px 0;border-bottom:1px solid var(--hair);
  vertical-align:baseline}
.agree-bar{display:inline-block;height:7px;background:var(--accent-soft);border-radius:2px;min-width:2px}
.sigla{font-family:var(--mono);font-size:12px;font-weight:600;color:var(--accent);
  white-space:nowrap}
.occ{font-family:var(--mono);font-size:10.5px;color:var(--soft)}
.occ a{color:var(--accent);margin-right:.5em}
h2.sec{font-size:20px;font-weight:600;margin:1.6em 0 .4em}
.skip{position:absolute;left:-9999px;top:0;background:var(--accent);color:#fff;
  padding:8px 14px;font-family:var(--mono);font-size:11px;z-index:100}
.skip:focus{left:0}
.header-full .t-teiHeader{display:block;border:0;padding:0;color:var(--ink);font-size:1em}
.header-full div[data-el]::before{content:attr(data-el);display:block;
  font-family:var(--mono);font-size:9px;font-weight:600;letter-spacing:.12em;
  text-transform:uppercase;color:var(--soft);margin:.9em 0 .1em}
.header-full{border:1px solid var(--hair);border-radius:2px;padding:6px 16px 14px;
  font-size:.92em;overflow-x:auto}
.header-full span[data-el]+span[data-el],.t-teiHeader span[data-el]+span[data-el]{margin-left:.3em}
${headerLabelCSS()}
.reg-filter{font-family:var(--mono);font-size:12px;padding:6px 10px;
  border:1px solid var(--hair);border-radius:2px;background:var(--paper);
  color:var(--ink);margin:.4em 0;width:14rem;max-width:100%}
.reg-table th{font-family:var(--mono);font-size:10px;font-weight:600;
  letter-spacing:.12em;text-transform:uppercase;color:var(--soft);text-align:left;
  padding:6px 10px 6px 0;border-bottom:2px solid var(--hair);cursor:pointer}
.reg-table th[aria-sort="ascending"]::after{content:" \\2191"}
.reg-table th[aria-sort="descending"]::after{content:" \\2193"}
.reg-count{font-family:var(--mono);font-size:10.5px;color:var(--soft);margin-left:.8em}
.vmap{margin:1.4em 0;padding-top:.4em;border-top:1px solid var(--hair)}
.vmap-n{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.1em;
  color:var(--accent);margin:0 0 .3em}
.vmap-app{margin:.5em 0 .8em}
.vmap-lem{font-style:italic}
.vmap-rdg{font-size:.88em;margin:.15em 0 .15em 1.4em;color:var(--ink)}
.vmap-wit{color:var(--soft)}
.vmap .bw{color:var(--accent);cursor:pointer}
.vmap .bw:hover{text-decoration:underline}
.vmap-count{font-family:var(--mono);font-size:10px;color:var(--soft)}
.vmap-lac .vmap-rdg{color:var(--soft)}
.vmap-edited{color:var(--ink)}
.vmap-mark{font-family:var(--mono);font-size:9.5px;font-weight:600;letter-spacing:.1em;
  text-transform:uppercase;color:var(--accent)}
/* the band is data: the popups read it, the page does not show it */
.app-band{display:none}
.app-band .band-lem{font-style:italic;color:var(--ink)}
.app-band .bw{color:var(--accent);cursor:pointer}
.app-band .bw:hover{text-decoration:underline}
.app-band .band-sep{color:var(--faint)}
:target{background:rgba(176,30,40,.10);border-radius:2px}
.prevnext{display:flex;justify-content:space-between;gap:1em;margin:1.2em 0;
  font-family:var(--mono);font-size:11px}
ol.toc{columns:2;column-gap:2.5em;padding-left:1.4em;margin:1em 0}
.idx-search{font-family:var(--mono);font-size:13px;padding:7px 11px;border:1px solid var(--hair);
  border-radius:2px;background:var(--paper);color:var(--ink);min-width:16rem;margin:.6em 0 .2em}
.alpha{font-family:var(--mono);font-size:11px;letter-spacing:.12em;margin:.3em 0 .6em}
.alpha a{color:var(--accent);text-decoration:none;padding:0 .18em}
.alpha a:hover{text-decoration:underline}
.idx-up{font-size:.7em;color:var(--soft);text-decoration:none;margin-left:.5em}
.idx-up:hover{color:var(--accent)}
.totop{position:fixed;right:22px;bottom:22px;width:34px;height:34px;line-height:32px;text-align:center;
  border:1px solid var(--hair);border-radius:2px;background:var(--paper);color:var(--accent);
  text-decoration:none;font-size:16px}
.totop:hover{border-color:var(--accent)}
.t-line{display:block}
.t-zone{display:block;margin:0 0 .2em}
.t-surface{display:block;margin:1.6em 0;padding:1.2em 1.4em;border:1px solid var(--hair);border-radius:2px}
.t-surface .t-surface{border:none;margin:0;padding:0}
.lx-bar-top{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;margin:1em 0;
  padding-bottom:.8em;border-bottom:1px solid var(--hair)}
.lx-search{font-family:var(--mono);font-size:13px;padding:7px 11px;border:1px solid var(--hair);
  border-radius:2px;background:var(--paper);color:var(--ink);min-width:14rem}
.lx-ctl{font-family:var(--mono);font-size:11px;color:var(--soft);display:inline-flex;gap:.4em;align-items:center}
.lx-ctl select{font-family:var(--mono);font-size:12px;padding:4px 6px;border:1px solid var(--hair);
  border-radius:2px;background:var(--paper);color:var(--ink)}
.lx-views{margin-left:auto;display:inline-flex;border:1px solid var(--hair);border-radius:2px;overflow:hidden}
.lx-views button{font-family:var(--mono);font-size:10px;letter-spacing:.09em;text-transform:uppercase;
  color:var(--soft);background:none;border:none;cursor:pointer;padding:7px 13px}
.lx-views button.active{background:var(--accent);color:#fff}
.lx-table{width:100%;border-collapse:collapse}
.lx-table th{text-align:left;font-family:var(--mono);font-size:9.5px;font-weight:600;letter-spacing:.1em;
  text-transform:uppercase;color:var(--soft);padding:6px 10px 6px 0;border-bottom:1px solid var(--hair)}
.lx-table td{padding:4px 10px 4px 0;border-bottom:1px solid var(--faint)}
.lx-table .lx-num{text-align:right;font-family:var(--mono);font-size:12px;white-space:nowrap}
.lx-table .lx-w{cursor:pointer}
.lx-table .lx-rel{color:var(--soft)}
.lx-table tr.is-stop .lx-w{color:var(--soft)}
.lx-lang{font-family:var(--mono);font-size:10px;color:var(--soft)}
.lx-flip{font-size:11px;line-height:1;color:var(--accent);background:none;border:none;cursor:pointer;padding:2px 4px}
.lx-cloud{line-height:1.9;padding:1em 0}
.lx-cloud-w{cursor:pointer;margin:0 .18em;color:var(--ink);transition:opacity .1s}
.lx-cloud-w:hover{color:var(--accent)}
.lx-kwic{width:100%;border-collapse:collapse;font-size:14px}
.lx-kwic td{padding:3px 8px;vertical-align:baseline}
.lx-kwic .lx-b{text-align:right;color:var(--soft);width:42%}
.lx-kwic .lx-k{text-align:center;font-weight:600;color:var(--accent);white-space:nowrap}
.lx-kwic .lx-k a{color:inherit}
.lx-kwic .lx-a{color:var(--soft);width:42%}
.lx-kwic tr:hover td{background:rgba(176,30,40,.04)}
ol.toc li{margin:.3em 0;break-inside:avoid}
.idx-toc{font-family:var(--mono);font-size:12px;margin:.6em 0 1.2em;
  padding-bottom:.8em;border-bottom:1px solid var(--hair)}
.idx-toc a{color:var(--accent)}
.standoff-notes .t-note-mark{display:none}
.lem-note{font-family:var(--mono);font-size:11px;color:var(--soft);margin:.8em 0}
details.lemma{border-bottom:1px solid var(--hair);padding:.45em 0}
details.lemma summary{cursor:pointer;list-style-position:outside}
.lem-forms{color:var(--soft);font-size:.9em}
.kwic{margin:.5em 0 .3em}
.kwic td{border-bottom:0;padding:2px 8px 2px 0}
.kwic .kb{text-align:right;color:var(--soft);width:40%}
.kwic .kf{white-space:nowrap;text-align:center}
.kwic .kf a{font-weight:600}
.kwic .ka{color:var(--soft);width:40%}
</style>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<a class="skip" href="#main">${t.skip}</a>
<header class="torchio">
<div class="tt"><h1>${escapeHTML(title)}</h1>${sub ? `<p class="sub">${escapeHTML(sub)}</p>` : ''}</div>
<nav class="torchio-nav">${nav}</nav>
</header>
${body}
<footer class="torchio">${EDITION_VERSION ? `${t.version || 'version'} ${escapeHTML(EDITION_VERSION)} · ` : ''}${t.publishedWith} <span class="press">Torchio</span> ${escapeHTML(colophon())}</footer>
${script ? `<script>${script}</script>` : ''}
</body>
</html>`;
}

export const registerJS = `
(function(){
  var input=document.querySelector('.reg-filter');
  var rows=[].slice.call(document.querySelectorAll('.reg-table tbody tr'));
  var count=document.querySelector('.reg-count');
  if(input){input.addEventListener('input',function(){
    var q=input.value.toLowerCase();var n=0;
    rows.forEach(function(r){var hit=!q||r.getAttribute('data-search').indexOf(q)>-1;
      r.style.display=hit?'':'none';if(hit)n++;});
    if(count)count.textContent=n+' / '+rows.length;
  });}
  document.querySelectorAll('.reg-table th').forEach(function(th,idx){
    th.addEventListener('click',function(){
      var tbody=th.closest('table').querySelector('tbody');
      var dir=th.getAttribute('aria-sort')==='ascending'?-1:1;
      document.querySelectorAll('.reg-table th').forEach(function(x){x.removeAttribute('aria-sort');});
      th.setAttribute('aria-sort',dir===1?'ascending':'descending');
      var rs=[].slice.call(tbody.querySelectorAll('tr'));
      rs.sort(function(a,b){
        var ka=a.children[idx].getAttribute('data-k')||a.children[idx].textContent;
        var kb=b.children[idx].getAttribute('data-k')||b.children[idx].textContent;
        return dir*ka.localeCompare(kb,undefined,{numeric:true});
      });
      rs.forEach(function(r){tbody.appendChild(r);});
    });
  });
})();
`;
