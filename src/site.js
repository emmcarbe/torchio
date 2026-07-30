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
import { renderBase, structuralCSS, escapeHTML, safeURL } from './render.js';
import { interactCSS, buildInteractJS, toolbarHTML } from './interact.js';
import { normalizeManifest } from './manifest.js';
import { buildExports } from './exports.js';
import { i18n, resolveLang } from './i18n.js';
import { themeCSS } from './themes.js';
import { WORLD } from './world-data.js';
import { chrome, jsonForScript, registerJS } from './page-shell.js';
import { pressMapPage } from './map-page.js';
import { pressLemmaPage } from './lemma-page.js';
import { pressRegister } from './register-page.js';

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
  // the edition's tradition may name things its own way (principle 1)
  const T = { ...i18n(lang), ...manifest.labels };
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
  // no lemmas, no page: forms alone are never passed off as an index of lemmas
  const hasLemmas = !!(model.lemmas && model.lemmas.entries.length);
  const exports_ = manifest.exports
    ? buildExports(model, { sourceXML, only: manifest.exports === true ? null : manifest.exports })
    : {};
  const hasData = Object.keys(exports_).length > 0;

  // front and back matter name themselves when the markup gives them a
  // heading; the fallback is neutral (front can be a title page, a preface,
  // a dedication, a cast list: never presume a genre)
  const sectionLabel = (node, fallback) => {
    if (!node) return fallback;
    const divs = node.children.filter((c) => typeof c !== 'string' && /^div\d?$/.test(c.element));
    const one = divs.length === 1 ? divs[0] : node;
    const head = one.children.find((c) => typeof c !== 'string' && c.element === 'head');
    if (head) {
      const label = textOfModel(head).trim().replace(/\s+/g, ' ');
      if (label && label.length <= 40) return label;
    }
    return fallback;
  };
  const frontLabel = sectionLabel(frontNode, T.front);
  const backLabel = sectionLabel(backNode, T.back);

  // a document whose body is entries of bare app elements IS an apparatus:
  // it renders as a variant map (C41) and lives under its own page
  const isApparatusDoc = (doc) => {
    const tn = doc.tree.children.find((c) => typeof c !== 'string' && c.element === 'text');
    const bd = tn && tn.children.find((c) => typeof c !== 'string' && c.element === 'body');
    if (!bd) return false;
    let hasAb = false, ok = true;
    const WRAP = new Set(['TEI', 'text', 'body', 'ab']);
    const chk = (nd) => {
      for (const c of nd.children) {
        if (!ok) return;
        if (typeof c === 'string') { if (c.trim()) ok = false; continue; }
        if (c.element === 'app') continue;
        if (WRAP.has(c.element)) { if (c.element === 'ab') hasAb = true; chk(c); continue; }
        ok = false;
      }
    };
    chk(bd);
    return ok && hasAb;
  };
  const hasAppDocs = isCollection && model.documents.some(isApparatusDoc);

  // The markup decides existence; the manifest decides presence, order, labels.
  const DEFAULT = [
    ['index', model.collection ? T.archive : T.edition],
    ...(frontNode ? [['front', frontLabel]] : []),
    ['text', isCollection ? T.texts : T.text],
    ...(hasAppDocs ? [['apparatus', T.apparatus]] : []),
    ...(backNode ? [['back', backLabel]] : []),
    ...(hasIndices ? [['indices', T.indices]] : []),
    ...(hasLemmas ? [['lemmas', T.lemmas]] : []),
    ...(hasMap ? [['map', T.map]] : []),
    ...(hasData ? [['data', T.data]] : []),
    ...extraPages.map((e) => [e.id, e.label]),
  ];
  const EXISTS = { index: true, front: !!frontNode, text: true, apparatus: hasAppDocs, back: !!backNode,
    indices: hasIndices, lemmas: hasLemmas, map: hasMap, data: hasData };
  for (const e of extraPages) EXISTS[e.id] = true;
  let pageList = DEFAULT;
  if (manifest.pages) {
    pageList = manifest.pages
      .filter((p) => EXISTS[p.id])
      .map((p) => [p.id, p.label || DEFAULT.find(([id]) => id === p.id)?.[1] || p.id]);
    if (!pageList.some(([id]) => id === 'text')) pageList.push(['text', isCollection ? T.texts : T.text]);
  }
  const pages = pageList.map(([id, label]) => [`${id}.html`, label]);
  const wanted = new Set(pageList.map(([id]) => id));

  const out = {};

  // canonical entities (manifest "align"): the same key, derived from @n,
  // identifies one passage across the documents of a collection
  let alignKey = null, appsByKey = null;
  if (manifest.align && isCollection) {
    const stripRe = manifest.align.strip ? new RegExp(manifest.align.strip) : null;
    const suffRe = manifest.align.stripSuffix ? new RegExp(manifest.align.stripSuffix) : null;
    alignKey = (n) => {
      let k = String(n);
      if (stripRe) k = k.replace(stripRe, '');
      if (suffRe) k = k.replace(suffRe, '');
      return k;
    };
    const alignEls = new Set(manifest.align.elements);
    const alignMap = {};
    for (const d of model.documents) {
      const file = docFiles.get(d.id);
      for (const nd of walkModel(d.tree)) {
        if (!alignEls.has(nd.element) || nd.atts.n == null) continue;
        const k = alignKey(nd.atts.n);
        if (!k) continue;
        if (!alignMap[k]) alignMap[k] = {};
        if (!alignMap[k][d.id]) alignMap[k][d.id] = `${file}#${nd.id}`;
      }
    }
    out['alignment.json'] = JSON.stringify(alignMap);
    appsByKey = new Map();
    for (const reg of model.apparatus) {
      if (reg.type === 'lac') continue;
      for (const e of reg.entries) {
        if (!e.n) continue;
        const k = alignKey(e.n);
        if (!k) continue;
        if (!appsByKey.has(k)) appsByKey.set(k, []);
        appsByKey.get(k).push(e);
      }
    }
  }

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
  // an archive (loose collection) presents the project, never a document's
  // header: count, span, languages, licence policy — the ALIM/ELA/BibIt shape
  if (model.collection) {
    about += `<dt>${T.register}</dt><dd><a href="text.html">${model.collection.count} ${T.documentsN}</a></dd>`;
    if (model.collection.years) {
      const [a, b] = model.collection.years;
      about += `<dt>${T.yearsLabel}</dt><dd>${a === b ? a : `${a}-${b}`}</dd>`;
    }
    if (model.meta.languages && model.meta.languages.length) {
      about += `<dt>${T.languagesLabel}</dt><dd>${model.meta.languages.map(escapeHTML).join(' · ')}</dd>`;
    }
    if (model.tokens && model.tokens.length) {
      about += `<dt>${T.tokensWord}</dt><dd>${model.tokens.length}</dd>`;
    }
    if (model.collection.contributors && model.collection.contributors.length) {
      const isOrcid = (s) => /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(s);
      about += `<dt>${T.contributorsLabel}</dt><dd>` + model.collection.contributors
        .map((c) => (isOrcid(c.ref)
          ? `<a href="https://orcid.org/${escapeHTML(c.ref)}">${escapeHTML(c.ref)}</a>`
          : escapeHTML(c.ref))
          + ` <span class="occ">${c.count} ${T.interventionsWord}</span>`)
        .join(' · ') + '</dd>';
    }
    if (model.collection.licenceVaries) {
      about += `<dt>${T.licence}</dt><dd>${T.licenceVariesNote}</dd>`;
    }
  }
  if (model.meta.edition) {
    const e = model.meta.edition;
    about += `<dt>${T.edition}</dt><dd>${escapeHTML(e.text || e.n)}${e.text && e.n ? ` (${escapeHTML(e.n)})` : ''}</dd>`;
  }
  if (resp) about += `<dt>${T.responsibility}</dt><dd>${escapeHTML(resp)}</dd>`;
  if (model.meta.licence) {
    const l = model.meta.licence;
    const lt = safeURL(l.target);
    about += `<dt>${T.licence}</dt><dd>${lt ? `<a href="${escapeHTML(lt)}">${escapeHTML(l.text || lt)}</a>` : escapeHTML(l.text || l.target || '')}</dd>`;
  }
  if (reg.witnesses.length) {
    about += `<dt>${T.witnesses}</dt><dd><table class="wit-table">`;
    for (const w of reg.witnesses) {
      const wtext = escapeHTML(w.full || w.label)
        .replace(/(https?:\/\/[^\s<]*[^\s<.,;)])/g, '<a href="$1">$1</a>');
      about += `<tr><td class="sigla">${escapeHTML(w.id)}</td><td>${wtext}</td></tr>`;
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
  // data-el — new metadata appear with zero interface work. In an archive
  // no single header speaks for the whole: each document carries its own
  // (the file card on its page), and the home shows none.
  const headerTree = model.corpusHeaderTree
    || (model.collection ? null
      : model.documents[0] && [...walkModel(model.documents[0].tree)].find((n) => n.element === 'teiHeader'));
  if (headerTree) {
    about += `<h2 class="sec">${T.fullHeader}</h2><p class="occ">${T.fullHeaderNote}</p>`
      + `<div class="header-full">${renderBase(headerTree)}</div>`;
  }
  about += '</main>';
  out['index.html'] = chrome({ title: t, sub: manifest.subtitle || (model.collection ? T.dsa : T.dse), active: 'index.html', pages, body: about, t: T, lang, theme, parent, parent });
  }

  /* ---- text.html: everything but the header ---- */
  let hasChoice = false;
  if (manifest.pieces.choice !== false) {
    for (const doc of model.documents) {
      // am/ex mark the two levels even without a choice wrapper (C26)
      for (const n of walkModel(doc.tree)) if (n.element === 'choice' || n.element === 'am' || n.element === 'ex') { hasChoice = true; break; }
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

    // standoff notes follow their targets: a note whose @target lives in
    // another section is pressed on that section's page, where the margin
    // machinery can pair it with its passage; a section left with nothing
    // but a heading of relocated notes never becomes a reading page (the
    // Romualdo "Adnotationes" case: endnotes are apparatus, not a chapter)
    const idsOf = chunks.map((d) => {
      const s = new Set();
      for (const n of walkModel(d)) { s.add(n.id); if (n.atts['xml:id']) s.add(n.atts['xml:id']); }
      return s;
    });
    const movedNotes = new Set();
    const notesFor = chunks.map(() => []);
    chunks.forEach((d, from) => {
      for (const n of walkModel(d)) {
        if (n.element !== 'note' || !n.atts.target) continue;
        const tid = n.atts.target.split(/\s+/)[0].replace(/^#/, '');
        if (!tid || idsOf[from].has(tid)) continue;
        const to = idsOf.findIndex((s) => s.has(tid));
        if (to >= 0) { notesFor[to].push(n); movedNotes.add(n.id); }
      }
    });
    const pruneMoved = (node) => ({
      ...node,
      children: node.children
        .filter((c) => typeof c === 'string' || !movedNotes.has(c.id))
        .map((c) => (typeof c === 'string' ? c : pruneMoved(c))),
    });
    const pruned = chunks.map(pruneMoved);
    // a chunk is empty when, past its own heading, no text remains
    const keep = pruned.map((d) => {
      const head = [...walkModel(d)].find((n) => n.element === 'head');
      const total = textOfModel(d).trim().length;
      return total > (head ? textOfModel(head).trim().length : 0);
    });
    chunks = pruned.filter((_, i) => keep[i]);
    const keptNotes = notesFor.filter((_, i) => keep[i]);

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
      const relocated = keptNotes[i].length
        ? `<section class="standoff-notes">${keptNotes[i].map((n) => renderBase(n)).join('')}</section>`
        : '';
      out[files[i]] = chrome({
        title: `${escapeHTML(chunkLabel(d, i, T))} · ${t}`, sub: t, active: 'text.html', pages, bodyClass: offClasses,
        body: `${toolbarHTML({ hasChoice, hasApparatus, hasNotes, t: T })}<main id="main" class="torchio">${nav}${header ? renderBase(header) : ''}${renderBase(d)}${relocated}${nav}</main>`,
        script: buildInteractJS(T), t: T, lang, theme, parent,
      });
    });
    if (frontOnOwnPage) {
      out['front.html'] = chrome({
        title: t, sub: frontLabel.toLowerCase(), active: 'front.html', pages, bodyClass: offClasses,
        body: `<main id="main" class="torchio">${renderBase(frontNode)}</main>`,
        script: buildInteractJS(T), t: T, lang, theme, parent,
      });
    }
    if (backOnOwnPage) {
      out['back.html'] = chrome({
        title: t, sub: backLabel.toLowerCase(), active: 'back.html', pages, bodyClass: offClasses,
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
        title: t, sub: frontLabel.toLowerCase(), active: 'front.html', pages, bodyClass: offClasses,
        body: `<main id="main" class="torchio">${renderBase(frontNode)}</main>`,
        script: buildInteractJS(T), t: T, lang, theme, parent,
      });
    }
    if (backOnOwnPage) {
      out['back.html'] = chrome({
        title: t, sub: backLabel.toLowerCase(), active: 'back.html', pages, bodyClass: offClasses,
        body: `<main id="main" class="torchio">${renderBase(backNode)}</main>`,
        script: buildInteractJS(T), t: T, lang, theme, parent,
      });
    }
  } else {
    const { reg, appDocs, textDocs, apparatusPage } = pressRegister({
      model, docFiles, isApparatusDoc, manifest, t, T, lang, theme, parent, pages, wanted });
    if (apparatusPage) out['apparatus.html'] = apparatusPage;

    out['text.html'] = chrome({
      title: t, sub: `${model.documents.length} ${T.documentsN}`, active: 'text.html',
      pages, body: reg, script: registerJS, t: T, lang, theme, parent,
    });

    // one page per document, with register navigation
    for (let i = 0; i < model.documents.length; i++) {
      const d = model.documents[i];
      const c = d.card || {};
      const isAppDoc = isApparatusDoc(d);
      // the classical convention for long lemmata: first words, dots, last words
      const abbrev = (txt, head = 4, tail = 3, max = 12) => {
        const w = txt.split(/\s+/).filter(Boolean);
        return w.length > max ? `${w.slice(0, head).join(' ')} … ${w.slice(-tail).join(' ')}` : txt;
      };
      const cleanText = (nd) => {
        let outT = '';
        for (const ch of nd.children) {
          if (typeof ch === 'string') { outT += ch; continue; }
          if (ch.element === 'wit' || ch.element === 'witDetail') continue;
          outT += cleanText(ch);
        }
        return outT;
      };
      const vmapHTML = () => {
        let v = '';
        const textNode = d.tree.children.find((c) => typeof c !== 'string' && c.element === 'text');
        const body = textNode.children.find((c) => typeof c !== 'string' && c.element === 'body');
        for (const ab of [...walkModel(body)].filter((nd) => nd.element === 'ab')) {
          const key = alignKey && ab.atts.n ? alignKey(ab.atts.n) : (ab.atts.n || '');
          v += `<section class="vmap" id="${escapeHTML(ab.id)}"${key ? ` data-ent="${escapeHTML(key)}"` : ''}>`;
          v += `<h2 class="vmap-n">${escapeHTML(key || '·')}</h2>`;
          for (const app of ab.children) {
            if (typeof app === 'string') continue;
            const lem = app.children.find((c) => typeof c !== 'string' && c.element === 'lem');
            const rdgs = app.children.filter((c) => typeof c !== 'string' && c.element === 'rdg');
            const isLac = (app.atts.type || '') === 'lac';
            v += `<div class="vmap-app${isLac ? ' vmap-lac' : ''}" id="${escapeHTML(app.id)}">`;
            if (!isLac) v += `<span class="vmap-lem">${escapeHTML(abbrev(lem ? cleanText(lem).trim() : ''))}</span>`;
            const edited = manifest.align && manifest.align.apparatusUnder
              ? String(manifest.align.apparatusUnder).replace(/^ms-/, '') : null;
            for (const r of rdgs) {
              const wits = (r.atts.wit || '').split(/\s+/).filter(Boolean).map((w) => w.replace(/^#/, ''));
              const isEdited = edited && wits.includes(edited);
              const rt = cleanText(r).trim();
              const shown = isEdited ? wits.filter((w) => w !== edited) : wits;
              v += `<div class="vmap-rdg${isEdited ? ' vmap-edited' : ''}">`
                + `${isLac ? `<span class="vmap-lem">${escapeHTML(T.lacking)}</span>` : escapeHTML(rt || '(om.)')}`
                + `${isEdited ? ` <span class="vmap-mark">${escapeHTML(T.editedText)}</span>` : ''}`
                + ` <span class="vmap-wit">${shown.map((w) => `<span class="bw" data-sig="${escapeHTML(w)}">${escapeHTML(w)}</span>`).join(' ')}</span>`
                + `${shown.length ? ` <span class="vmap-count">(${shown.length})</span>` : ''}</div>`;
            }
            v += `</div>`;
          }
          v += `</section>`;
        }
        return v;
      };

      // the classical apparatus band: derived under the document the
      // manifest names (align.apparatusUnder), verse by verse
      const bandHooks = (alignKey && appsByKey && manifest.align.apparatusUnder === d.id) ? {
        after: (nd) => {
          if (nd.atts == null || nd.atts.n == null || nd.element === 'app') return '';
          if (!manifest.align.elements.includes(nd.element)) return '';
          const apps = appsByKey.get(alignKey(nd.atts.n));
          if (!apps) return '';
          const entries = [];
          for (const a of [...apps].sort((x, y) => Number(x.from || 0) - Number(y.from || 0))) {
            // the edited text is not one witness among the others: its own
            // siglum is not a variant of itself (C52)
            const self = manifest.align.apparatusUnder
              ? String(manifest.align.apparatusUnder).replace(/^ms-/, '') : null;
            const others = a.readings
              .filter((r) => !r.isLemma && r.text.trim() !== (a.lemma || '').trim())
              .map((r) => ({ ...r, witnesses: self ? r.witnesses.filter((w) => w !== self) : r.witnesses }))
              .filter((r) => r.witnesses.length);
            if (!others.length) continue;
            const lemNorm = (a.lemma || '').toLowerCase()
              .replace(/[^\p{L}\p{N}]/gu, '').replace(/[\p{Lm}\p{M}]/gu, '').slice(0, 16);
            entries.push(`<span class="band-e"${a.from ? ` data-from="${escapeHTML(a.from)}" data-to="${escapeHTML(a.to || a.from)}" data-check="${escapeHTML(lemNorm)}"` : ''}><span class="band-lem">${escapeHTML(abbrev(a.lemma || ''))}</span>] `
              + others.map((r) => `${escapeHTML(abbrev(r.text.trim(), 8, 4, 20) || '(om.)')} <span class="band-wit">`
                + r.witnesses.map((w) => `<span class="bw" data-sig="${escapeHTML(w)}">${escapeHTML(w)}</span>`).join(' ')
                + `</span>`).join('; ')
              + `</span>`);
          }
          if (!entries.length) return '';
          return `<div class="app-band" data-ent="${escapeHTML(alignKey(nd.atts.n))}">${entries.join(' <span class="band-sep">·</span> ')}</div>`;
        },
      } : null;
      let docText = '';
      if (isAppDoc) {
        const header = d.tree.children.find((c) => typeof c !== 'string' && c.element === 'teiHeader');
        docText = (header ? renderBase(header) : '') + vmapHTML();
      } else {
        for (const child of d.tree.children) {
          if (typeof child === 'string') continue;
          docText += renderBase(child, bandHooks); // header included: hidden, toggleable
        }
      }
      const prev = i > 0 ? model.documents[i - 1] : null;
      const next = i < model.documents.length - 1 ? model.documents[i + 1] : null;
      const nav = `<nav class="prevnext" aria-label="${T.register}">`
        + (prev ? `<a href="${docFiles.get(prev.id)}">${T.prev}</a>` : '<span></span>')
        + `<a href="text.html">${T.register}</a>`
        + (next ? `<a href="${docFiles.get(next.id)}">${T.next}</a>` : '<span></span>')
        + `</nav>`;
      const alignCfg = (alignKey && manifest.align)
        ? `window.TORCHIO_ALIGN=${jsonForScript({
            strip: manifest.align.strip || null,
            suffix: manifest.align.stripSuffix || null,
            apps: model.documents.filter((x) => isApparatusDoc(x)).map((x) => x.id),
          })};`
        : '';
      out[docFiles.get(d.id)] = chrome({
        title: c.title || d.id, sub: t, active: isAppDoc ? 'apparatus.html' : 'text.html', pages, bodyClass: offClasses,
        body: `${toolbarHTML({ hasChoice, hasApparatus, hasNotes, t: T })}<main id="main" class="torchio">${nav}${docText}${nav}</main>`,
        script: alignCfg + buildInteractJS(T), t: T, lang, theme, parent,
      });
    }
  }

  /* ---- indices.html: the registries as pages ---- */
  if (hasIndices && wanted.has('indices')) {
    let idx = '<main id="main" class="torchio">';
    const sections = [[T.people, reg.people], [T.places, reg.places], [T.orgs, reg.orgs]];
    // long indices open with an index of the indices: one line of anchors
    // (index of names, of places...) with the count of each
    const shown = sections.filter(([, entries]) => hasOcc(entries));
    const totalEntries = shown.reduce((s, [, entries]) => s + entries.length, 0);
    if (shown.length > 1 && totalEntries > 30) {
      idx += '<nav class="idx-toc" aria-label="' + T.indices + '">'
        + shown.map(([label, entries], i) =>
          `<a href="#idx-${i}">${escapeHTML(label)}</a> <span class="reg-count">${entries.length}</span>`)
          .join(' · ')
        + '</nav>';
    }
    let secIdx = -1;
    for (const [label, entries] of sections) {
      if (!hasOcc(entries)) continue; // an authority list without resolved
                                      // occurrences stays in the data exports
      secIdx++;
      idx += `<h2 class="sec" id="idx-${secIdx}">${label}</h2><table class="idx-table">`;
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

  /* ---- lemmas.html: concordances and frequencies, only where lemmas exist ---- */
  if (hasLemmas && wanted.has('lemmas')) {
    out['lemmas.html'] = pressLemmaPage({ model, pageFor, t, T, lang, theme, parent, pages });
  }

  /* ---- data.html: the edition as downloadable data ---- */
  if (hasData && wanted.has('data')) {
    const DESCR = {
      'data/model.json': T.descrModel,
      'data/entities.csv': T.descrEntities,
      'data/apparatus.csv': T.descrApparatus,
      'data/lemmas.csv': T.descrLemmas,
      'data/tokens.csv': T.descrTokens,
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

  /* ---- map.html: places with coordinates ---- */
  if (hasMap && wanted.has('map')) {
    out['map.html'] = pressMapPage({ geoPlaces, pageFor, t, T, lang, theme, parent, pages });
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
