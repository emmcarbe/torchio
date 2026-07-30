/**
 * Multi-page pressing: an edition is a site, not a page.
 *
 * v0 pages, derived from the model (markup-driven, as ever):
 *   index.html    — "About this edition": title, responsibility, licence,
 *                   witnesses, revision history. The teiHeader as a page,
 *                   not as a secret.
 *   text.html     — the reading text with the interactive pieces
 *   indices.html  — people / places / orgs with occurrences, linked into
 *                   the text (only when the registries are populated)
 *
 * This is the seed of the composition layer (Separation 3): pages are slots;
 * the manifest will later let the editor add, remove and rename them.
 */

import { walkModel, textOfModel } from './model.js';
import { renderBase, structuralCSS, escapeHTML } from './render.js';
import { interactCSS, buildInteractJS, toolbarHTML } from './interact.js';
import { normalizeManifest } from './manifest.js';
import { buildExports } from './exports.js';
import { i18n, resolveLang } from './i18n.js';
import { themeCSS } from './themes.js';
import { WORLD } from './world-data.js';

const HEADER_LABELS = {
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
function headerLabelCSS() {
  let css = '';
  for (const [el, label] of Object.entries(HEADER_LABELS)) {
    css += `.header-full div[data-el="${el}"]::before{content:"${label}"}\n`;
  }
  for (const el of HEADER_SILENT) {
    css += `.header-full div[data-el="${el}"]::before{content:none}\n`;
  }
  return css;
}

function chrome({ title, sub, active, pages, body, script = '', bodyClass = '', t, lang, theme, parent }) {
  const nav = (parent ? `<a href="${escapeHTML(parent.href)}" class="up">${escapeHTML(parent.label)}</a>` : '')
    + pages
    .map(([file, label]) =>
      `<a href="${file}"${file === active ? ' class="on"' : ''}>${escapeHTML(label)}</a>`)
    .join('');
  return `<!DOCTYPE html>
<html lang="${lang || ''}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
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
.prevnext{display:flex;justify-content:space-between;gap:1em;margin:1.2em 0;
  font-family:var(--mono);font-size:11px}
ol.toc{columns:2;column-gap:2.5em;padding-left:1.4em;margin:1em 0}
ol.toc li{margin:.3em 0;break-inside:avoid}
</style>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<a class="skip" href="#main">${t.skip}</a>
<header class="torchio">
<div class="tt"><h1>${escapeHTML(title)}</h1>${sub ? `<p class="sub">${escapeHTML(sub)}</p>` : ''}</div>
<nav class="torchio-nav">${nav}</nav>
</header>
${body}
<footer class="torchio">${t.publishedWith} <span class="press">Torchio</span> v0</footer>
${script ? `<script>${script}</script>` : ''}
</body>
</html>`;
}

const registerJS = `
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

function docFileName(id, taken) {
  let base = 'doc-' + String(id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (base === 'doc-') base = 'doc';
  let name = base, i = 2;
  while (taken.has(name)) name = base + '-' + i++;
  taken.add(name);
  return name;
}

function chunkLabel(div, i, T) {
  const sub = (div.atts.subtype || div.atts.type || '').toLowerCase();
  const n = div.atts.n;
  const head = div.children.find((c) => typeof c !== 'string' && c.element === 'head');
  if (sub === 'book' && n) return `${T.bookLabel} ${n}`;
  if (head) {
    let t = '';
    for (const c of head.children) if (typeof c === 'string') t += c;
    t = t.replace(/\s+/g, ' ').trim();
    if (t) return t.slice(0, 60);
  }
  if (n) return `${T.sectionOne} ${n}`;
  return `${T.sectionOne} ${i + 1}`;
}

export function pressSite(model, { title, manifest: rawManifest, sourceXML, extraPages = [] } = {}) {
  const manifest = normalizeManifest(rawManifest || {});
  const lang = resolveLang(manifest.lang, model);
  const T = i18n(lang);
  const theme = manifest.theme || 'savi';
  const parent = manifest.parent;
  const isCollection = model.documents.length > 1;
  // single document: front and back matter get their own pages
  let frontNode = null, backNode = null, bodyNode = null, chunks = null;
  if (!isCollection && model.documents[0]) {
    const textNode = model.documents[0].tree.children.find(
      (c) => typeof c !== 'string' && c.element === 'text');
    if (textNode) {
      frontNode = textNode.children.find((c) => typeof c !== 'string' && c.element === 'front') || null;
      backNode = textNode.children.find((c) => typeof c !== 'string' && c.element === 'back') || null;
      bodyNode = textNode.children.find((c) => typeof c !== 'string' && c.element === 'body') || null;
    }
    // the markup's own partition: when the body holds several structural
    // divisions and real bulk, each division gets its page (C15)
    if (bodyNode) {
      let container = bodyNode;
      for (;;) {
        const divs = container.children.filter((c) => typeof c !== 'string' && /^div\d?$/.test(c.element));
        if (divs.length === 1 && container.children.filter((c) => typeof c !== 'string').length === 1) {
          container = divs[0];
          continue;
        }
        if (divs.length >= 2 && textOfModel(bodyNode).length > 40000) chunks = divs;
        break;
      }
    }
  }
  const taken = new Set();
  const docFiles = new Map(model.documents.map((d) => [d.id, docFileName(d.id, taken) + '.html']));
  const t = manifest.title || title || model.meta.title || 'Untitled edition';
  const resp = (model.meta.responsibility || []).map((r) => r.name).filter(Boolean).join(' · ');
  const reg = model.registries;
  const hasOcc = (entries) => entries.some((e) => e.occurrences && e.occurrences.length);
  const hasIndices = hasOcc(reg.people) || hasOcc(reg.places) || hasOcc(reg.orgs);
  const geoPlaces = reg.places.filter((p) => p.geo);
  const hasMap = geoPlaces.length > 0;
  const exports_ = manifest.exports ? buildExports(model, { sourceXML }) : {};
  const hasData = Object.keys(exports_).length > 0;

  // The markup decides existence; the manifest decides presence, order, labels.
  const DEFAULT = [
    ['index', T.edition],
    ...(frontNode ? [['front', T.front]] : []),
    ['text', T.text],
    ...(backNode ? [['back', T.back]] : []),
    ...(hasIndices ? [['indices', T.indices]] : []),
    ...(hasMap ? [['map', T.map]] : []),
    ...(hasData ? [['data', T.data]] : []),
    ...extraPages.map((e) => [e.id, e.label]),
  ];
  const EXISTS = { index: true, front: !!frontNode, text: true, back: !!backNode,
    indices: hasIndices, map: hasMap, data: hasData };
  for (const e of extraPages) EXISTS[e.id] = true;
  let pageList = DEFAULT;
  if (manifest.pages) {
    pageList = manifest.pages
      .filter((p) => EXISTS[p.id])
      .map((p) => [p.id, p.label || DEFAULT.find(([id]) => id === p.id)?.[1] || p.id]);
    if (!pageList.some(([id]) => id === 'text')) pageList.push(['text', T.text]);
  }
  const pages = pageList.map(([id, label]) => [`${id}.html`, label]);
  const wanted = new Set(pageList.map(([id]) => id));

  const out = {};

  // which page contains a given node id (for occurrence links)
  const idPage = new Map();
  if (isCollection) {
    for (const d of model.documents) {
      const file = docFiles.get(d.id);
      for (const n of walkModel(d.tree)) idPage.set(n.id, file);
    }
  } else {
    if (frontNode && wanted.has('front')) for (const n of walkModel(frontNode)) idPage.set(n.id, 'front.html');
    if (backNode && wanted.has('back')) for (const n of walkModel(backNode)) idPage.set(n.id, 'back.html');
  }
  const pageFor = (id) => idPage.get(id) || 'text.html';

  /* ---- index.html: the header as a page ---- */
  if (wanted.has('index')) {
  let about = '<main id="main" class="torchio about"><dl>';
  if (model.meta.edition) {
    const e = model.meta.edition;
    about += `<dt>${T.edition}</dt><dd>${escapeHTML(e.text || e.n)}${e.text && e.n ? ` (${escapeHTML(e.n)})` : ''}</dd>`;
  }
  if (resp) about += `<dt>${T.responsibility}</dt><dd>${escapeHTML(resp)}</dd>`;
  if (model.meta.licence) {
    const l = model.meta.licence;
    about += `<dt>${T.licence}</dt><dd>${l.target ? `<a href="${escapeHTML(l.target)}">${escapeHTML(l.text || l.target)}</a>` : escapeHTML(l.text || '')}</dd>`;
  }
  if (reg.witnesses.length) {
    about += `<dt>${T.witnesses}</dt><dd><table class="wit-table">`;
    for (const w of reg.witnesses) {
      about += `<tr><td class="sigla">${escapeHTML(w.id)}</td><td>${escapeHTML(w.label)}</td></tr>`;
    }
    about += `</table></dd>`;
  }
  if (model.apparatus.length) {
    about += `<dt>${T.apparatusRegisters}</dt><dd>${model.apparatus
      .map((a) => `${escapeHTML(a.type)} (${a.entries.length} ${T.entries})`).join(' · ')}</dd>`;
  }
  if (model.meta.revisions) {
    // long histories scroll inside a bounded window instead of taking the page
    const box = model.meta.revisions.length > 10 ? ' class="scrollbox"' : '';
    about += `<dt>${T.revisions}</dt><dd${box}><table class="wit-table">`;
    for (const r of model.meta.revisions) {
      about += `<tr><td class="sigla">${escapeHTML(r.when || '')}</td><td>${escapeHTML(r.what)}</td></tr>`;
    }
    about += `</table></dd>`;
  }
  about += `<dt>${T.generator}</dt><dd class="occ">Torchio v0 · TEI ${escapeHTML(model.generator.tei.split('.').slice(0, 2).join('.'))}</dd>`;
  about += '</dl>';
  // curation above, completeness here: the WHOLE header, auto-labelled from
  // data-el — new metadata appear with zero interface work
  const headerTree = model.corpusHeaderTree
    || (model.documents[0] && [...walkModel(model.documents[0].tree)].find((n) => n.element === 'teiHeader'));
  if (headerTree) {
    about += `<h2 class="sec">${T.fullHeader}</h2><p class="occ">${T.fullHeaderNote}</p>`
      + `<div class="header-full">${renderBase(headerTree)}</div>`;
  }
  about += '</main>';
  out['index.html'] = chrome({ title: t, sub: manifest.subtitle || T.dse, active: 'index.html', pages, body: about, t: T, lang, theme, parent, parent });
  }

  /* ---- text.html: everything but the header ---- */
  let hasChoice = false;
  if (manifest.pieces.choice !== false) {
    for (const doc of model.documents) {
      for (const n of walkModel(doc.tree)) if (n.element === 'choice') { hasChoice = true; break; }
    }
  }
  const hasApparatus = model.apparatus.length > 0 && manifest.pieces.apparatus !== false;
  let hasNotes = false;
  for (const doc of model.documents) {
    for (const n of walkModel(doc.tree)) {
      if (n.element === 'note') { hasNotes = true; break; }
    }
    if (hasNotes) break;
  }
  let text = '';
  for (const doc of model.documents) {
    for (const child of doc.tree.children) {
      if (typeof child === 'string') continue;
      text += renderBase(child); // teiHeader included: hidden, toggled by the toolbar
    }
  }
  const offClasses = [
    manifest.pieces.apparatus === false ? 'app-off' : '',
    manifest.pieces.entities === false ? 'ent-off' : '',
  ].filter(Boolean).join(' ');

  if (!isCollection && chunks) {
    const frontOnOwnPage = !!frontNode && wanted.has('front');
    const backOnOwnPage = !!backNode && wanted.has('back');
    const header = model.documents[0].tree.children.find((c) => typeof c !== 'string' && c.element === 'teiHeader');
    const files = chunks.map((d, i) => `text-${d.atts.n && /^[\w.-]+$/.test(d.atts.n) ? d.atts.n : i + 1}.html`);
    // contents page
    let toc = `<main id="main" class="torchio"><ol class="toc">`;
    chunks.forEach((d, i) => { toc += `<li><a href="${files[i]}">${escapeHTML(chunkLabel(d, i, T))}</a></li>`; });
    toc += '</ol>';
    if (!frontOnOwnPage && frontNode) toc = `<main id="main" class="torchio">${renderBase(frontNode)}` + '<ol class="toc">' + chunks.map((d, i) => `<li><a href="${files[i]}">${escapeHTML(chunkLabel(d, i, T))}</a></li>`).join('') + '</ol>';
    if (!backOnOwnPage && backNode) toc += renderBase(backNode);
    toc += '</main>';
    out['text.html'] = chrome({
      title: t, sub: `${chunks.length} ${T.sectionsN}`, active: 'text.html', pages,
      body: toc, t: T, lang, theme, parent,
    });
    chunks.forEach((d, i) => {
      for (const n of walkModel(d)) idPage.set(n.id, files[i]);
    });
    chunks.forEach((d, i) => {
      const nav = `<nav class="prevnext" aria-label="${T.contents}">`
        + (i > 0 ? `<a href="${files[i - 1]}">${T.prev}</a>` : '<span></span>')
        + `<a href="text.html">${T.contents}</a>`
        + (i < chunks.length - 1 ? `<a href="${files[i + 1]}">${T.next}</a>` : '<span></span>')
        + `</nav>`;
      out[files[i]] = chrome({
        title: `${escapeHTML(chunkLabel(d, i, T))} · ${t}`, sub: t, active: 'text.html', pages, bodyClass: offClasses,
        body: `${toolbarHTML({ hasChoice, hasApparatus, hasNotes, t: T })}<main id="main" class="torchio">${nav}${header ? renderBase(header) : ''}${renderBase(d)}${nav}</main>`,
        script: buildInteractJS(T), t: T, lang, theme, parent,
      });
    });
    if (frontOnOwnPage) {
      out['front.html'] = chrome({
        title: t, sub: T.front.toLowerCase(), active: 'front.html', pages, bodyClass: offClasses,
        body: `<main id="main" class="torchio">${renderBase(frontNode)}</main>`,
        script: buildInteractJS(T), t: T, lang, theme, parent,
      });
    }
    if (backOnOwnPage) {
      out['back.html'] = chrome({
        title: t, sub: T.back.toLowerCase(), active: 'back.html', pages, bodyClass: offClasses,
        body: `<main id="main" class="torchio">${renderBase(backNode)}</main>`,
        script: buildInteractJS(T), t: T, lang, theme, parent,
      });
    }
  } else if (!isCollection) {
    // reading page: the body (and the hidden header for the toggle);
    // front and back matter live on their own pages
    const frontOnOwnPage = !!frontNode && wanted.has('front');
    const backOnOwnPage = !!backNode && wanted.has('back');
    let reading = '';
    for (const child of model.documents[0].tree.children) {
      if (typeof child === 'string') continue;
      if (child.element === 'teiHeader') { reading += renderBase(child); continue; }
      if (child.element === 'text') {
        for (const c of child.children) {
          if (typeof c === 'string') continue;
          // never lost: front/back render here unless they have their own page
          if (c.element === 'front' && frontOnOwnPage) continue;
          if (c.element === 'back' && backOnOwnPage) continue;
          reading += renderBase(c);
        }
      } else {
        reading += renderBase(child);
      }
    }
    out['text.html'] = chrome({
      title: t, sub: resp, active: 'text.html', pages, bodyClass: offClasses,
      body: `${toolbarHTML({ hasChoice, hasApparatus, hasNotes, t: T })}<main id="main" class="torchio">${reading}</main>`,
      script: buildInteractJS(T), t: T, lang, theme, parent,
    });
    if (frontOnOwnPage) {
      out['front.html'] = chrome({
        title: t, sub: T.front.toLowerCase(), active: 'front.html', pages, bodyClass: offClasses,
        body: `<main id="main" class="torchio">${renderBase(frontNode)}</main>`,
        script: buildInteractJS(T), t: T, lang, theme, parent,
      });
    }
    if (backOnOwnPage) {
      out['back.html'] = chrome({
        title: t, sub: T.back.toLowerCase(), active: 'back.html', pages, bodyClass: offClasses,
        body: `<main id="main" class="torchio">${renderBase(backNode)}</main>`,
        script: buildInteractJS(T), t: T, lang, theme, parent,
      });
    }
  } else {
    // the register: columns exist only if the markup populates them
    const cards = model.documents.map((d) => d.card || { id: d.id });
    const has = {
      date: cards.some((c) => c.date),
      from: cards.some((c) => c.from && c.from.length),
      to: cards.some((c) => c.to && c.to.length),
      author: cards.some((c) => c.author),
      place: cards.some((c) => c.place),
      idno: cards.some((c) => c.idno),
    };
    const cols = [
      ...(has.date ? [['date', T.dateCol]] : []),
      ['title', T.titleCol],
      ...(has.from ? [['from', T.fromCol]] : []),
      ...(has.to ? [['to', T.toCol]] : []),
      ...(!has.from && has.author ? [['author', T.authorCol]] : []),
      ...(has.place ? [['place', T.placeCol]] : []),
      ...(has.idno ? [['idno', T.idnoCol]] : []),
    ];
    let reg = `<main id="main" class="torchio" style="max-width:64rem">`
      + `<input class="reg-filter" type="search" placeholder="${T.filter}" aria-label="${T.filter}">`
      + `<span class="reg-count">${cards.length} / ${cards.length}</span>`
      + `<table class="reg-table idx-table"><thead><tr>`
      + cols.map(([, label]) => `<th scope="col">${escapeHTML(label)}</th>`).join('')
      + `</tr></thead><tbody>`;
    for (const d of model.documents) {
      const c = d.card || {};
      const cells = cols.map(([key]) => {
        if (key === 'title') {
          return `<td><a href="${docFiles.get(d.id)}">${escapeHTML(c.title || d.id)}</a></td>`;
        }
        if (key === 'date') {
          return `<td class="occ" data-k="${escapeHTML(c.date?.when || '9999')}">${escapeHTML(c.date?.text || c.date?.when || '')}</td>`;
        }
        const v = key === 'from' || key === 'to' ? (c[key] || []).join('; ') : (c[key] || '');
        return `<td>${escapeHTML(String(v))}</td>`;
      }).join('');
      const search = [c.title, c.date?.text, c.date?.when, ...(c.from || []), ...(c.to || []), c.author, c.place, c.idno]
        .filter(Boolean).join(' ').toLowerCase();
      reg += `<tr data-search="${escapeHTML(search)}">${cells}</tr>`;
    }
    reg += '</tbody></table></main>';
    out['text.html'] = chrome({
      title: t, sub: `${model.documents.length} ${T.documentsN}`, active: 'text.html',
      pages, body: reg, script: registerJS, t: T, lang, theme, parent,
    });

    // one page per document, with register navigation
    for (let i = 0; i < model.documents.length; i++) {
      const d = model.documents[i];
      const c = d.card || {};
      let docText = '';
      for (const child of d.tree.children) {
        if (typeof child === 'string') continue;
        docText += renderBase(child); // header included: hidden, toggleable
      }
      const prev = i > 0 ? model.documents[i - 1] : null;
      const next = i < model.documents.length - 1 ? model.documents[i + 1] : null;
      const nav = `<nav class="prevnext" aria-label="${T.register}">`
        + (prev ? `<a href="${docFiles.get(prev.id)}">${T.prev}</a>` : '<span></span>')
        + `<a href="text.html">${T.register}</a>`
        + (next ? `<a href="${docFiles.get(next.id)}">${T.next}</a>` : '<span></span>')
        + `</nav>`;
      out[docFiles.get(d.id)] = chrome({
        title: c.title || d.id, sub: t, active: 'text.html', pages, bodyClass: offClasses,
        body: `${toolbarHTML({ hasChoice, hasApparatus, hasNotes, t: T })}<main id="main" class="torchio">${nav}${docText}${nav}</main>`,
        script: buildInteractJS(T), t: T, lang, theme, parent,
      });
    }
  }

  /* ---- indices.html: the registries as pages ---- */
  if (hasIndices && wanted.has('indices')) {
    let idx = '<main id="main" class="torchio">';
    const sections = [[T.people, reg.people], [T.places, reg.places], [T.orgs, reg.orgs]];
    for (const [label, entries] of sections) {
      if (!hasOcc(entries)) continue; // an authority list without resolved
                                      // occurrences stays in the data exports
      idx += `<h2 class="sec">${label}</h2><table class="idx-table">`;
      for (const e of [...entries].sort((a, b) => a.label.localeCompare(b.label))) {
        const occ = e.occurrences.slice(0, 12)
          .map((id, i) => `<a href="${pageFor(id)}#${escapeHTML(id)}">${i + 1}</a>`).join('');
        idx += `<tr><td>${escapeHTML(e.label)}</td><td class="occ">${e.occurrences.length} occ. ${occ}</td></tr>`;
      }
      idx += '</table>';
    }
    idx += '</main>';
    out['indices.html'] = chrome({ title: t, sub: T.indices.toLowerCase(), active: 'indices.html', pages, body: idx, t: T, lang, theme, parent, parent });
  }

  /* ---- data.html: the edition as downloadable data ---- */
  if (hasData && wanted.has('data')) {
    const DESCR = {
      'data/model.json': T.descrModel,
      'data/entities.csv': T.descrEntities,
      'data/apparatus.csv': T.descrApparatus,
      'data/source.xml': T.descrSource,
    };
    let dataPage = '<main id="main" class="torchio"><table class="idx-table">';
    for (const [path, content] of Object.entries(exports_)) {
      const kb = new TextEncoder().encode(content).length / 1024;
      dataPage += `<tr><td class="sigla"><a href="${path}">${escapeHTML(path.replace('data/', ''))}</a></td>`
        + `<td>${escapeHTML(DESCR[path] || '')}</td>`
        + `<td class="occ">${kb < 1024 ? kb.toFixed(1) + ' KB' : (kb / 1024).toFixed(1) + ' MB'}</td></tr>`;
    }
    dataPage += `</table><p class="occ">${T.reuse}</p></main>`;
    out['data.html'] = chrome({ title: t, sub: T.data.toLowerCase(), active: 'data.html', pages, body: dataPage, t: T, lang, theme, parent, parent });
    Object.assign(out, exports_);
  }

  /* ---- map.html: places with coordinates, dependency-free SVG ---- */
  if (hasMap && wanted.has('map')) {
    const lats = geoPlaces.map((p) => p.geo.lat);
    const lons = geoPlaces.map((p) => p.geo.lon);
    const pad = 1.5;
    const minLat = Math.min(...lats) - pad, maxLat = Math.max(...lats) + pad;
    const minLon = Math.min(...lons) - pad, maxLon = Math.max(...lons) + pad;
    const W = 720, H = 440;
    const px = (lon) => ((lon - minLon) / (maxLon - minLon)) * (W - 40) + 20;
    const py = (lat) => H - (((lat - minLat) / (maxLat - minLat)) * (H - 40) + 20);
    const showLabels = geoPlaces.length <= 25;
    let dots = '';
    for (const pl of geoPlaces) {
      const x = px(pl.geo.lon).toFixed(1), y = py(pl.geo.lat).toFixed(1);
      const unconfirmed = pl.geoSource === 'geonames';
      dots += unconfirmed
        ? `<circle cx="${x}" cy="${y}" r="4" fill="none" stroke="var(--accent)" stroke-width="1.5"><title>${escapeHTML(pl.label)}</title></circle>`
        : `<circle cx="${x}" cy="${y}" r="4" fill="var(--accent)"><title>${escapeHTML(pl.label)}</title></circle>`;
      if (showLabels) {
        dots += `<text x="${(+x + 7).toFixed(1)}" y="${(+y + 3).toFixed(1)}" font-size="11" fill="var(--soft)" font-family="var(--mono)">${escapeHTML(pl.label)}</text>`;
      }
    }
    let land = '';
    for (const ring of WORLD) {
      let minx = 999, maxx = -999, miny = 999, maxy = -999;
      for (const [x, y] of ring) {
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
      if (maxx < minLon || minx > maxLon || maxy < minLat || miny > maxLat) continue;
      land += 'M' + ring.map(([x, y]) => `${px(x).toFixed(1)} ${py(y).toFixed(1)}`).join('L') + 'Z';
    }
    const landPath = land
      ? `<path d="${land}" fill="var(--hair)" fill-opacity=".45" stroke="var(--faint)" stroke-width="1" fill-rule="evenodd"/>`
      : '';
    let grid = '';
    for (let lon = Math.ceil(minLon); lon <= maxLon; lon++) grid += `<line x1="${px(lon)}" y1="0" x2="${px(lon)}" y2="${H}" stroke="var(--hair)" stroke-width="1"/>`;
    for (let lat = Math.ceil(minLat); lat <= maxLat; lat++) grid += `<line x1="0" y1="${py(lat)}" x2="${W}" y2="${py(lat)}" stroke="var(--hair)" stroke-width="1"/>`;
    const markers = geoPlaces.map((pl) => ({
      lat: pl.geo.lat, lon: pl.geo.lon,
      label: pl.label, unconfirmed: pl.geoSource === 'geonames',
    }));
    const leafletInit = `
var map=L.map('map',{scrollWheelZoom:false});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
var pts=${JSON.stringify(markers)};
var group=[];
pts.forEach(function(p){
  var m=L.circleMarker([p.lat,p.lon],{radius:7,color:'#B01E28',weight:2,
    fillColor:'#B01E28',fillOpacity:p.unconfirmed?0:0.9}).addTo(map);
  m.bindPopup(p.label+(p.unconfirmed?' <span style="color:#888">(?)</span>':''));
  group.push(m);
});
var lats=pts.map(function(p){return p.lat}),lons=pts.map(function(p){return p.lon});
var cLat=(Math.min.apply(null,lats)+Math.max.apply(null,lats))/2;
var cLon=(Math.min.apply(null,lons)+Math.max.apply(null,lons))/2;
var spanLat=Math.max(Math.max.apply(null,lats)-Math.min.apply(null,lats),0.05)*1.5;
var spanLon=Math.max(Math.max.apply(null,lons)-Math.min.apply(null,lons),0.05)*1.5;
function fit(){
  var s=map.getSize();
  if(!s.x||!s.y){setTimeout(fit,100);return;}
  var z=Math.floor(Math.min(
    Math.log2(s.x/256*360/spanLon),
    Math.log2(s.y/256*170/spanLat)));
  map.setView([cLat,cLon],Math.max(2,Math.min(12,z)));
}
fit();
window.addEventListener('resize',function(){map.invalidateSize();fit();});
`;
    let mapBody = `<main id="main" class="torchio" style="max-width:64rem">`
      + `<link rel="stylesheet" href="assets/leaflet/leaflet.css">`
      + `<div id="map" style="height:26rem;border:1px solid var(--hair);border-radius:2px" role="region" aria-label="${T.mapAria}"></div>`
      + `<script src="assets/leaflet/leaflet.js"></script><script>${leafletInit}</script>`
      + `<noscript><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${T.mapAria}" style="width:100%;height:auto;border:1px solid var(--hair);border-radius:2px;background:var(--paper)">${landPath}${grid}${dots}</svg></noscript>`
      + `<p class="occ">${T.mapNote}</p><table class="idx-table">`;
    for (const pl of [...geoPlaces].sort((a, b) => a.label.localeCompare(b.label))) {
      mapBody += `<tr><td>${escapeHTML(pl.label)}${pl.geoSource === 'geonames' ? ' <span class="occ">?</span>' : ''}</td>`
        + `<td class="occ">${pl.geo.lat.toFixed(4)}, ${pl.geo.lon.toFixed(4)}</td>`
        + `<td class="occ"><a href="https://www.openstreetmap.org/?mlat=${pl.geo.lat}&amp;mlon=${pl.geo.lon}#map=12/${pl.geo.lat}/${pl.geo.lon}">OSM</a></td></tr>`;
    }
    mapBody += '</table></main>';
    out['map.html'] = chrome({ title: t, sub: T.map.toLowerCase(), active: 'map.html', pages, body: mapBody, t: T, lang, theme, parent, parent });
  }

  /* ---- the editor's simple pages ---- */
  for (const e of extraPages) {
    if (!wanted.has(e.id)) continue;
    out[`${e.id}.html`] = chrome({
      title: t, sub: e.label.toLowerCase(), active: `${e.id}.html`, pages,
      body: `<main id="main" class="torchio">${e.html}</main>`, t: T, lang, theme, parent,
    });
  }

  return out;
}
