/**
 * The browser harness of path A. Not a module: this file is inlined by
 * tools/build-browser.js after the engine, in the same script scope, and
 * mirrors tools/press.js step by step (parse, xinclude, ODD, class map,
 * model, manifest, reconciliation, extra pages, site, exports).
 *
 * The composition manifest is written BY the interface: the user takes
 * decisions in the panel (title, language, theme, pages, pieces, simple
 * pages in Markdown) and the page generates torchio.json, shipping it in
 * the archive next to the pressed site. Nobody has to know what a
 * manifest is in order to compose an edition.
 *
 * Everything happens in the page: no upload, no server, no dependencies.
 */

/* global parseXML, inTEINamespace, resolveIncludes, parseODD, isODD,
   buildClassMap, buildModel, pressSite, analyze, applyReconciliation,
   attachLemmas, markdown, buildZip, i18n, resolveLang,
   TORCHIO_BASE_DATA, TORCHIO_LEAFLET_B64 */

(function () {
  const drop = document.getElementById('drop');
  const input = document.getElementById('fileinput');
  const pick = document.getElementById('pick');
  const report = document.getElementById('report');
  const composeBox = document.getElementById('composebox');
  const previewBox = document.getElementById('previewbox');
  const pageSelect = document.getElementById('pageselect');
  const iframe = document.getElementById('preview');
  const downloadBtn = document.getElementById('download');

  // everything the last pressing established
  let S = null;
  // S = { model, analysis, sourceXML, notes, unresolved, odd, oddInfo,
  //       droppedManifest, droppedExtra, slug, ui, files }

  pick.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { if (input.files.length) press(input.files); });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    if (e.dataTransfer.files.length) press(e.dataTransfer.files);
  });

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fail(message) {
    report.hidden = false;
    composeBox.hidden = true;
    previewBox.hidden = true;
    report.innerHTML = '<h2>Not pressed</h2><p class="warn">' + esc(message) + '</p>';
  }

  async function press(fileList) {
    try {
      await doPress(fileList);
    } catch (err) {
      fail(err && err.message ? err.message : String(err));
    }
  }

  async function doPress(fileList) {
    const texts = new Map();
    for (const f of fileList) texts.set(f.name, await f.text());

    const notes = [];

    const xmlNames = [...texts.keys()].filter((n) => /\.(xml|tei|odd)$/i.test(n)).sort();
    if (!xmlNames.length) throw new Error('No XML file among the chosen files.');

    // xinclude: hrefs are looked up among the chosen files, by path then by name
    const byBase = new Map();
    for (const n of texts.keys()) byBase.set(n.split('/').pop(), n);
    const loadText = async (href) => {
      const clean = href.split('#')[0];
      const hit = texts.get(clean) || texts.get(byBase.get(clean.split('/').pop()));
      if (hit === undefined) throw new Error('not among the chosen files');
      return hit;
    };

    // parse everything, set the ODD apart (the ODD travels next to the TEI
    // and is recognized on its own: a schemaSpec is a schema, not a text)
    const parsed = [];
    let odd = null;
    let oddInfo = null;
    for (const n of xmlNames) {
      try {
        const root = parseXML(texts.get(n));
        if (isODD(root)) {
          if (odd) { notes.push('A second ODD was ignored: ' + n); continue; }
          odd = parseODD(root);
          oddInfo = { file: n, custom: odd.customElements.length, deleted: odd.deletedElements.size };
        } else {
          parsed.push({ id: n.replace(/\.(xml|tei)$/i, ''), name: n, root });
        }
      } catch (err) {
        notes.push('Skipped ' + n + ': ' + err.message);
      }
    }
    if (!parsed.length) throw new Error('No TEI document among the chosen files (an ODD alone is a schema, not an edition).');

    const included = new Set();
    let unresolved = [];
    for (const p of parsed) {
      const r = await resolveIncludes(p.root, async (href) => {
        const t = await loadText(href);
        included.add(href.split('#')[0].split('/').pop());
        return t;
      });
      unresolved.push(...r.unresolved);
    }

    let roots;
    if (parsed.length === 1) {
      if (!inTEINamespace(parsed[0].root)) {
        notes.push('The root element is not in the TEI namespace; pressed anyway (nothing is invisible).');
      }
      roots = [parsed[0].root];
    } else {
      roots = parsed
        .filter((p) => inTEINamespace(p.root))
        .filter((p) => !included.has(p.name))
        .map((p) => ({ id: p.id, root: p.root }));
      if (!roots.length) throw new Error('No TEI document among the chosen files.');
      if (roots.length === 1) roots = [roots[0].root];
    }

    const map = buildClassMap(odd, TORCHIO_BASE_DATA);
    const model = buildModel(roots.length === 1 && !roots[0].root ? roots[0] : roots, map);

    // a manifest that travelled along seeds the panel; the panel owns it from here
    let droppedManifest = null;
    if (texts.has('torchio.json')) {
      try { droppedManifest = JSON.parse(texts.get('torchio.json')); }
      catch (err) { notes.push('torchio.json ignored: ' + err.message); }
    }
    if (texts.has('reconcile.json')) {
      try {
        applyReconciliation(model, JSON.parse(texts.get('reconcile.json')).entities);
        notes.push('reconcile.json applied.');
      } catch (err) { notes.push('reconcile.json ignored: ' + err.message); }
    }

    // lemmas: from the markup (w/@lemma), or from a reviewed lemmas.json
    let lemmasJson = null;
    if (texts.has('lemmas.json')) {
      try { lemmasJson = JSON.parse(texts.get('lemmas.json')); }
      catch (err) { notes.push('lemmas.json ignored: ' + err.message); }
    }
    attachLemmas(model, lemmasJson);

    // extra pages declared by a dropped manifest, resolved among the files
    const droppedExtra = [];
    if (droppedManifest && Array.isArray(droppedManifest.extra)) {
      for (const e of droppedManifest.extra) {
        if (!e || !e.id || !e.file) continue;
        const raw = texts.get(e.file) || texts.get(byBase.get(e.file.split('/').pop()));
        if (raw === undefined) {
          notes.push('Extra page skipped (' + e.file + '): not among the chosen files.');
          continue;
        }
        droppedExtra.push({
          id: e.id,
          label: e.label || e.id,
          md: e.file.endsWith('.html') ? null : raw,
          html: e.file.endsWith('.html') ? raw : markdown(raw),
        });
      }
    }

    const analysis = analyze(roots.map((r) => r.root || r), map);
    const teiNames = parsed.map((p) => p.name);

    S = {
      model,
      analysis,
      sourceXML: teiNames.length === 1 ? texts.get(teiNames[0]) : null,
      notes,
      unresolved,
      oddInfo,
      droppedManifest,
      slug: teiNames[0].replace(/\.(xml|tei)$/i, '').split('/').pop() || 'edition',
      ui: seedUI(model, droppedManifest, droppedExtra),
      files: null,
    };

    compose();
    renderPanel();
  }

  // ---- the composition state: what the panel edits, torchio.json records ----

  function seedUI(model, raw, droppedExtra) {
    raw = raw || {};
    const ui = {
      title: typeof raw.title === 'string' ? raw.title : '',
      subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : '',
      lang: raw.lang === 'it' || raw.lang === 'en' ? raw.lang : '',
      theme: typeof raw.theme === 'string' ? raw.theme : '',
      exports: raw.exports !== false,
      pieces: {
        apparatus: !(raw.pieces && raw.pieces.apparatus === false),
        entities: !(raw.pieces && raw.pieces.entities === false),
        choice: !(raw.pieces && raw.pieces.choice === false),
        map: !(raw.pieces && raw.pieces.map === false),
        lemmas: !(raw.pieces && raw.pieces.lemmas === false),
      },
      genre: typeof raw.genre === 'string' ? raw.genre : '',
      // pages: id -> {on, label}; filled after the first pressing, when the
      // derived pages are known
      pages: null,
      pagesFromManifest: Array.isArray(raw.pages) ? raw.pages : null,
      extra: droppedExtra.map((e) => ({ id: e.id, label: e.label, md: e.md, html: e.html })),
      // register columns: null = derived by the engine; an array = chosen
      registerColumns: (raw.register && Array.isArray(raw.register.columns))
        ? raw.register.columns.slice() : null,
    };
    return ui;
  }

  /** Which card fields the headers actually populate (collections only). */
  function availableColumns() {
    const docs = S.model.documents || [];
    if (docs.length < 2) return [];
    const cards = docs.map((d) => d.card || {});
    const hasIt = {
      author: cards.some((c) => c.author),
      title: true,
      date: cards.some((c) => c.date),
      from: cards.some((c) => c.from && c.from.length),
      to: cards.some((c) => c.to && c.to.length),
      place: cards.some((c) => c.place),
      idno: cards.some((c) => c.idno),
    };
    return ['author', 'title', 'date', 'from', 'to', 'place', 'idno'].filter((k) => hasIt[k]);
  }

  /** The manifest the interface writes: only what deviates, never noise. */
  function buildManifest() {
    const ui = S.ui;
    const m = {};
    if (ui.title.trim()) m.title = ui.title.trim();
    if (ui.subtitle.trim()) m.subtitle = ui.subtitle.trim();
    if (ui.lang) m.lang = ui.lang;
    if (ui.theme) m.theme = ui.theme;
    if (ui.genre) m.genre = ui.genre;
    const off = {};
    for (const k of ['apparatus', 'entities', 'choice', 'map', 'lemmas']) {
      if (ui.pieces[k] === false) off[k] = false;
    }
    if (Object.keys(off).length) m.pieces = off;
    if (ui.extra.length) {
      m.extra = ui.extra.map((e) => ({ id: e.id, label: e.label, file: 'pages/' + e.id + '.md' }));
    }
    if (ui.pages) {
      const ids = Object.keys(ui.pages);
      const deviates = ids.some((id) => !ui.pages[id].on || ui.pages[id].label);
      if (deviates) {
        m.pages = ids
          .filter((id) => ui.pages[id].on)
          .map((id) => (ui.pages[id].label ? { id, label: ui.pages[id].label } : id));
      }
    }
    if (ui.registerColumns) m.register = { columns: ui.registerColumns };
    if (!ui.exports) m.exports = false;
    return m;
  }

  /** Press the site with the current panel state. */
  function compose() {
    const extraPages = S.ui.extra.map((e) => ({
      id: e.id,
      label: e.label,
      html: e.html !== null && e.md === null ? e.html : markdown(e.md || ''),
    }));
    const manifest = buildManifest();
    S.files = pressSite(S.model, { manifest, sourceXML: S.sourceXML, extraPages });

    // first pressing: learn which pages the markup activates, seed the page list
    if (!S.ui.pages) {
      const ids = Object.keys(S.files)
        .filter((n) => n.endsWith('.html') && !n.startsWith('doc-'))
        .map((n) => n.replace(/\.html$/, ''));
      S.ui.pages = {};
      const fromManifest = new Map();
      if (S.ui.pagesFromManifest) {
        for (const p of S.ui.pagesFromManifest) {
          const id = typeof p === 'string' ? p : p && p.id;
          if (id) fromManifest.set(id, (typeof p === 'object' && p.label) || '');
        }
      }
      for (const id of ids) {
        S.ui.pages[id] = S.ui.pagesFromManifest
          ? { on: fromManifest.has(id), label: fromManifest.get(id) || '' }
          : { on: true, label: '' };
      }
      for (const e of S.ui.extra) {
        if (!(e.id in S.ui.pages)) S.ui.pages[e.id] = { on: true, label: '' };
      }
      // re-press once if the dropped manifest already deviated
      if (S.ui.pagesFromManifest) { S.ui.pagesFromManifest = null; compose(); return; }
      S.ui.pagesFromManifest = null;
    }

    renderReport();
    renderPreview();
  }

  // ---- the report ----

  function renderReport() {
    const regs = Object.entries(S.model.registries || {})
      .filter(([, v]) => v.length)
      .map(([k, v]) => k + ': ' + v.length)
      .join(' · ');
    const rows = [
      ['title', S.model.meta.title || '(none)'],
      ['documents', String(S.model.documents ? S.model.documents.length : 1)],
      ['elements', S.analysis.distinctElements + ' distinct'],
      ['fallbacks', S.analysis.fallback.length ? S.analysis.fallback.join(', ') : 'none'],
      ['odd', S.oddInfo
        ? S.oddInfo.file + ': ' + S.oddInfo.custom + ' custom elements, ' + S.oddInfo.deleted + ' deleted'
        : 'none: read against the whole of P5 (tei_all)'],
      ['registries', regs || 'none'],
      ['lemmas', S.model.lemmas
        ? S.model.lemmas.entries.length + ' lemmas, '
          + S.model.lemmas.lemmatized + '/' + S.model.lemmas.tokens + ' tokens'
        : 'none (from w/@lemma or a reviewed lemmas.json; the page appears only then)'],
      ['pages', Object.keys(S.files).filter((n) => n.endsWith('.html')).length
        + ' html, ' + Object.keys(S.files).length + ' files in total'],
    ];
    let html = '<h2>Pressed</h2><dl>'
      + rows.map(([k, v]) => '<dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd>').join('')
      + '</dl>';
    for (const u of S.unresolved) {
      html += '<p class="warn">xinclude unresolved: ' + esc(u.href) + ' (' + esc(u.reason) + ')</p>';
    }
    for (const n of S.notes) html += '<p class="note">' + esc(n) + '</p>';
    report.innerHTML = html;
    report.hidden = false;
  }

  // ---- the composition panel: decisions here, torchio.json written by us ----

  function pageDefaultLabel(id) {
    const lang = S.ui.lang || resolveLang(null, S.model);
    const T = i18n(lang);
    const known = {
      index: T.edition, front: T.front, text: T.text, back: T.back,
      indices: T.indices, lemmas: T.lemmas, map: T.map, data: T.data,
    };
    if (known[id]) return known[id];
    const extra = S.ui.extra.find((e) => e.id === id);
    return extra ? extra.label : id;
  }

  function renderPanel() {
    const ui = S.ui;
    let html = '<h2>Composition</h2>'
      + '<p class="note">Decisions taken here are written to a small file, '
      + '<code>torchio.json</code>, shipped inside the archive: keep it next '
      + 'to your XML and every future pressing repeats them.</p>'
      + (S.model.documents && S.model.documents.length > 1
        ? '<p class="note">A collection borrows the title of its first document '
          + 'until you give it one of its own, below.</p>'
        : '')
      + '<div class="frow"><label for="c-title">Title</label>'
      + '<input id="c-title" type="text" value="' + esc(ui.title) + '" placeholder="'
      + esc(S.model.meta.title || '') + '"></div>'
      + '<div class="frow"><label for="c-subtitle">Subtitle</label>'
      + '<input id="c-subtitle" type="text" value="' + esc(ui.subtitle) + '"></div>'
      + '<div class="frow"><label for="c-lang">Language</label><select id="c-lang">'
      + '<option value=""' + (ui.lang === '' ? ' selected' : '') + '>from the edition</option>'
      + '<option value="it"' + (ui.lang === 'it' ? ' selected' : '') + '>italiano</option>'
      + '<option value="en"' + (ui.lang === 'en' ? ' selected' : '') + '>English</option>'
      + '</select></div>'
      + '<div class="frow"><label for="c-theme">Theme</label><select id="c-theme">'
      + ['', 'savi', 'pergamena', 'moderno'].map((t) =>
        '<option value="' + t + '"' + (ui.theme === t ? ' selected' : '') + '>'
        + (t || 'savi (default)') + '</option>').join('')
      + '</select></div>';

    // pages the markup did not activate: shown off, with their source named
    // (the markup decides existence; the panel decides presence)
    const DERIVED_FROM = {
      front: 'appears when the TEI has front matter',
      back: 'appears when the TEI has back matter',
      indices: 'appears when a registry entry is referenced from the text',
      lemmas: 'An index of words appears when your edition says, for each word, the dictionary form '
        + 'it belongs to. If your files do not say it, you can add a file of forms you have checked '
        + 'yourself (lemmas.json) by dropping it in with the others. Not every tradition groups words '
        + 'under a dictionary form, and an edition that does not is not missing anything.',
      map: 'A map appears when your places have coordinates. If your files already give them, '
        + 'there is nothing to do. If they do not, you can add a file of coordinates you have '
        + 'checked yourself (reconcile.json) by dropping it in with the others: the map is drawn '
        + 'from what you confirmed, and nobody is looked up while your edition is being read.',
    };

    html += '<fieldset><legend>What this edition is</legend>'
      + '<div class="frow"><label>Kind</label><select id="c-genre">'
      + '<option value="">from the markup</option>'
      + '<option value="edition">critical edition</option>'
      + '<option value="archive">archive of many texts</option>'
      + '<option value="correspondence">correspondence</option>'
      + '<option value="tradition">tradition of witnesses</option>'
      + '</select></div>'
      + '<p class="note">A <b>critical edition</b> presses one text with its apparatus and its witnesses. '
      + 'An <b>archive</b> presses many texts as a register with author and date, each with its own page. '
      + 'A <b>correspondence</b> is an archive whose register wears sender, recipient and date. '
      + 'A <b>tradition</b> presses the witnesses side by side, with the apparatus apart. '
      + 'Left to the markup, the shape is derived from what the files declare.</p>'
      + '</fieldset>';
    html += '<fieldset><legend>Pages</legend>';
    // the section pages of a long text are the divisions the markup declares:
    // shown as one summary line, not one checkbox each
    const chunkIds = Object.keys(ui.pages).filter((id) => /^text-/.test(id));
    for (const id of Object.keys(ui.pages)) {
      if (/^text-/.test(id)) continue;
      const p = ui.pages[id];
      html += '<div class="frow pagerow" draggable="true" data-row="' + esc(id) + '">'
        + '<span class="grip" aria-hidden="true">\u2261</span>'
        + '<label><input type="checkbox" data-page="' + esc(id) + '"'
        + (p.on ? ' checked' : '') + '> ' + esc(id) + '</label>'
        + '<input type="text" data-pagelabel="' + esc(id) + '" value="' + esc(p.label)
        + '" placeholder="' + esc(pageDefaultLabel(id)) + '" aria-label="Label of the page '
        + esc(id) + '">'
        + (ui.extra.some((e) => e.id === id)
          ? ' <button type="button" data-editpage="' + esc(id) + '">edit</button>'
            + ' <button type="button" data-removepage="' + esc(id) + '">remove</button>'
          : '')
        + '</div>';
    }
    for (const id of Object.keys(DERIVED_FROM)) {
      if (!(id in ui.pages)) {
        html += '<div class="frow pagerow"><span class="pageoff">' + esc(id)
          + ' (' + esc(pageDefaultLabel(id)) + ')</span>'
          + '<span class="note">' + esc(DERIVED_FROM[id]) + '</span></div>';
      }
    }
    if (chunkIds.length) {
      html += '<div class="frow pagerow"><label>'
        + esc(chunkIds[0]) + ' \u2026 ' + esc(chunkIds[chunkIds.length - 1])
        + '</label><span class="note">' + chunkIds.length
        + ' section pages, one per division the markup declares. They follow the text page'
        + ' and take their names from it.</span></div>';
    }
    html += '<p><button type="button" id="c-addpage">Add a simple page</button> '
      + '<span class="note">your own prose (an introduction, credits, a bibliography), '
      + 'written in Markdown, part of the site navigation</span></p>'
      + '</fieldset>';

    // the register's columns, for collections: chosen among the fields the
    // headers populate; the engine's default follows the majority (a
    // correspondence reads from-to, an archive of works author-title-year)
    const avail = availableColumns();
    if (avail.length) {
      const cards = S.model.documents.map((d) => d.card || {});
      const corr = cards.filter((c) => c.from && c.from.length).length
        > cards.filter((c) => c.author).length;
      const engineDefault = (corr
        ? ['date', 'title', 'from', 'to', 'place', 'idno']
        : ['author', 'title', 'date', 'place', 'idno']).filter((k) => avail.includes(k));
      const current = ui.registerColumns || engineDefault;
      html += '<fieldset><legend>Register columns</legend>';
      for (const k of avail) {
        html += '<label><input type="checkbox" data-regcol="' + esc(k) + '"'
          + (current.includes(k) ? ' checked' : '') + (k === 'title' ? ' disabled' : '')
          + '> ' + esc(k) + '</label> ';
      }
      html += '<p class="note">Fields come from each document’s teiHeader; '
        + 'the title stays: it is the way into the documents.</p></fieldset>';
    }

    html += '<fieldset><legend>Pieces and data</legend>'
      + '<label><input type="checkbox" id="c-apparatus"' + (ui.pieces.apparatus ? ' checked' : '')
      + '> apparatus popups</label> '
      + '<label><input type="checkbox" id="c-entities"' + (ui.pieces.entities ? ' checked' : '')
      + '> entity cards</label> '
      + '<label><input type="checkbox" id="c-map"' + (ui.pieces.map ? ' checked' : '')
      + '> map, where places carry coordinates</label> '
      + '<label><input type="checkbox" id="c-lemmas"' + (ui.pieces.lemmas ? ' checked' : '')
      + '> lemma index, where the edition declares lemmas</label> '
      + '<label><input type="checkbox" id="c-choice"' + (ui.pieces.choice ? ' checked' : '')
      + '> reading/diplomatic toggle</label> '
      + '<label><input type="checkbox" id="c-exports"' + (ui.exports ? ' checked' : '')
      + '> data files (model, CSV, source)</label>'
      + '<p class="note">Switching a piece off disables its interactive layer, '
      + 'never the base rendering: nothing becomes invisible.</p>'
      + '</fieldset>';

    // the simple-page editor, hidden until needed
    html += '<div id="pageeditor" hidden>'
      + '<h3 id="pe-title">New page</h3>'
      + '<div class="frow"><label for="pe-label">Title of the page</label>'
      + '<input id="pe-label" type="text"></div>'
      + '<div class="frow"><label for="pe-md">Text (Markdown)</label>'
      + '<textarea id="pe-md" rows="10" placeholder="# Heading&#10;&#10;Plain paragraphs, *emphasis*, [links](https://…), lists."></textarea></div>'
      + '<p><button type="button" id="pe-save">Save the page</button> '
      + '<button type="button" id="pe-cancel">Cancel</button></p>'
      + '</div>';

    composeBox.innerHTML = html;
    composeBox.hidden = false;
    wirePanel();
  }

  let recomposeTimer = null;
  function recompose() {
    clearTimeout(recomposeTimer);
    recomposeTimer = setTimeout(() => { compose(); }, 250);
  }

  function wirePanel() {
    const ui = S.ui;
    const bind = (id, fn) => {
      const el = document.getElementById(id);
      el.addEventListener('input', () => { fn(el); recompose(); });
    };
    bind('c-title', (el) => { ui.title = el.value; });
    bind('c-subtitle', (el) => { ui.subtitle = el.value; });
    bind('c-lang', (el) => { ui.lang = el.value; renderPanelSoon(); });
    bind('c-theme', (el) => { ui.theme = el.value; });
    bind('c-apparatus', (el) => { ui.pieces.apparatus = el.checked; });
    bind('c-map', (el) => { ui.pieces.map = el.checked; });
    bind('c-lemmas', (el) => { ui.pieces.lemmas = el.checked; });
    bind('c-genre', (el) => { ui.genre = el.value; });
    // the order of the pages is the order of the menu: it is dragged here
    // and travels in the manifest, so the site keeps it
    let dragged = null;
    for (const row of composeBox.querySelectorAll('.pagerow[data-row]')) {
      row.addEventListener('dragstart', () => { dragged = row; row.classList.add('dragging'); });
      row.addEventListener('dragend', () => { row.classList.remove('dragging'); dragged = null; });
      row.addEventListener('dragover', (ev) => { ev.preventDefault(); row.classList.add('over'); });
      row.addEventListener('dragleave', () => row.classList.remove('over'));
      row.addEventListener('drop', (ev) => {
        ev.preventDefault(); row.classList.remove('over');
        if (!dragged || dragged === row) return;
        const ids = [...composeBox.querySelectorAll('.pagerow[data-row]')].map((r) => r.dataset.row);
        const from = ids.indexOf(dragged.dataset.row), to = ids.indexOf(row.dataset.row);
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        const reordered = {};
        for (const id of ids) reordered[id] = S.ui.pages[id];
        for (const id of Object.keys(S.ui.pages)) if (!(id in reordered)) reordered[id] = S.ui.pages[id];
        S.ui.pages = reordered;
        renderPanel();
      });
    }
    bind('c-entities', (el) => { ui.pieces.entities = el.checked; });
    bind('c-choice', (el) => { ui.pieces.choice = el.checked; });
    bind('c-exports', (el) => { ui.exports = el.checked; });

    for (const box of composeBox.querySelectorAll('[data-page]')) {
      box.addEventListener('input', () => {
        ui.pages[box.dataset.page].on = box.checked;
        recompose();
      });
    }
    for (const field of composeBox.querySelectorAll('[data-pagelabel]')) {
      field.addEventListener('input', () => {
        ui.pages[field.dataset.pagelabel].label = field.value;
        recompose();
      });
    }
    for (const box of composeBox.querySelectorAll('[data-regcol]')) {
      box.addEventListener('input', () => {
        const order = ['author', 'title', 'date', 'from', 'to', 'place', 'idno'];
        const chosen = [...composeBox.querySelectorAll('[data-regcol]')]
          .filter((b) => b.checked || b.dataset.regcol === 'title')
          .map((b) => b.dataset.regcol);
        ui.registerColumns = order.filter((k) => chosen.includes(k));
        recompose();
      });
    }
    for (const btn of composeBox.querySelectorAll('[data-removepage]')) {
      btn.addEventListener('click', () => {
        const id = btn.dataset.removepage;
        ui.extra = ui.extra.filter((e) => e.id !== id);
        delete ui.pages[id];
        renderPanel();
        recompose();
      });
    }
    for (const btn of composeBox.querySelectorAll('[data-editpage]')) {
      btn.addEventListener('click', () => openPageEditor(btn.dataset.editpage));
    }
    document.getElementById('c-addpage').addEventListener('click', () => openPageEditor(null));
    document.getElementById('pe-save').addEventListener('click', savePage);
    document.getElementById('pe-cancel').addEventListener('click', () => {
      document.getElementById('pageeditor').hidden = true;
    });
  }

  let panelTimer = null;
  function renderPanelSoon() {
    // language change refreshes the default page labels shown as placeholders
    clearTimeout(panelTimer);
    panelTimer = setTimeout(renderPanel, 400);
  }

  let editingPage = null;
  function openPageEditor(id) {
    editingPage = id;
    const editor = document.getElementById('pageeditor');
    const existing = id ? S.ui.extra.find((e) => e.id === id) : null;
    document.getElementById('pe-title').textContent = existing ? 'Edit the page' : 'New page';
    document.getElementById('pe-label').value = existing ? existing.label : '';
    document.getElementById('pe-md').value = existing ? (existing.md || '') : '';
    editor.hidden = false;
    document.getElementById('pe-label').focus();
  }

  function slugify(label) {
    const s = label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/^[0-9-]+/, '');
    return s || 'page';
  }

  function savePage() {
    const label = document.getElementById('pe-label').value.trim();
    const md = document.getElementById('pe-md').value;
    if (!label) { document.getElementById('pe-label').focus(); return; }
    if (editingPage) {
      const e = S.ui.extra.find((x) => x.id === editingPage);
      e.label = label;
      e.md = md;
      e.html = null;
    } else {
      let id = slugify(label);
      const taken = new Set([...Object.keys(S.ui.pages), 'index', 'front', 'text', 'back', 'indices', 'map', 'data']);
      let n = 2;
      while (taken.has(id)) id = slugify(label) + '-' + n++;
      S.ui.extra.push({ id, label, md, html: null });
      S.ui.pages[id] = { on: true, label: '' };
    }
    document.getElementById('pageeditor').hidden = true;
    renderPanel();
    recompose();
  }

  // ---- preview: one page at a time, internal links switch the page ----

  const NAV_SNIPPET = '<script>document.addEventListener("click",function(e){'
    + 'var a=e.target.closest("a");if(!a)return;'
    + 'var h=a.getAttribute("href");if(!h)return;'
    + 'if(/^[a-z][a-z0-9+.-]*:/i.test(h)||h.charAt(0)==="#")return;'
    + 'e.preventDefault();parent.postMessage({torchioNav:h},"*");});'
    + '<\/script>';

  function blobURL(name, type) {
    const bin = atob(TORCHIO_LEAFLET_B64[name]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type }));
  }

  function previewHTML(name) {
    let html = S.files[name];
    if (name === 'map.html') {
      // the archive carries the real assets; the preview needs live URLs
      html = html
        .replace('href="assets/leaflet/leaflet.css"',
          'href="' + blobURL('assets/leaflet/leaflet.css', 'text/css') + '"')
        .replace('src="assets/leaflet/leaflet.js"',
          'src="' + blobURL('assets/leaflet/leaflet.js', 'text/javascript') + '"');
    }
    return html.replace('</body>', NAV_SNIPPET + '</body>');
  }

  function showPage(name, fragment) {
    if (!S || !(name in S.files)) return;
    pageSelect.value = name;
    iframe.srcdoc = previewHTML(name);
    if (fragment) {
      iframe.addEventListener('load', function once() {
        iframe.removeEventListener('load', once);
        try { iframe.contentWindow.location.hash = fragment; } catch (e) { /* opaque */ }
      });
    }
  }

  window.addEventListener('message', (e) => {
    // only the preview frame may steer this page
    if (!iframe || e.source !== iframe.contentWindow) return;
    if (!e.data || typeof e.data.torchioNav !== 'string' || !S || !S.files) return;
    const [page, fragment] = String(e.data.torchioNav).split('#');
    showPage(page || pageSelect.value, fragment ? '#' + fragment : '');
  });

  function renderPreview() {
    const current = pageSelect.value;
    const pages = Object.keys(S.files).filter((n) => n.endsWith('.html'));
    pageSelect.innerHTML = pages
      .map((n) => '<option value="' + esc(n) + '">' + esc(n) + '</option>')
      .join('');
    previewBox.hidden = false;
    const keep = pages.includes(current) ? current
      : pages.includes('index.html') ? 'index.html' : pages[0];
    showPage(keep, '');
  }

  pageSelect.addEventListener('change', () => showPage(pageSelect.value, ''));

  // ---- download: the pressed site, its manifest and its pages, one archive ----

  downloadBtn.addEventListener('click', () => {
    if (!S || !S.files) return;
    const entries = {};
    for (const [name, content] of Object.entries(S.files)) entries[name] = content;
    const manifest = buildManifest();
    if (Object.keys(manifest).length) {
      entries['torchio.json'] = JSON.stringify(manifest, null, 2) + '\n';
    }
    for (const e of S.ui.extra) {
      if (e.md !== null) entries['pages/' + e.id + '.md'] = e.md;
    }
    if ('map.html' in S.files) {
      for (const [name, b64] of Object.entries(TORCHIO_LEAFLET_B64)) {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        entries[name] = bytes;
      }
    }
    const zip = buildZip(entries);
    const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = S.slug + '.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  });
})();
