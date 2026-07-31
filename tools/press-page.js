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
   attachLemmas, attachLexicon, collectTokens, normLang, conlluTypes, typesFromVotes, buildXLSX, readZip, reviewRows, applyReview,
   harvest, applyReconciliation, expandMentions, listBareOccurrences, markdown, buildZip, i18n, resolveLang,
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

  let lastFiles = [];
  let currentStep = 'edition'; // survives panel redraws: UDPipe must not send you back to page one
  let nlpLang = ''; // the editor's word on the language; empty = trust the markup
  let lemmaAuto = false; // accept machine lemmas without review (declared in the edition)
  async function doPress(fileList) {
    lastFiles = [...fileList].filter((f) => !/\.xlsx$/i.test(f.name));
    // the browser presses in memory: fine for composing and trying, but a
    // whole archive belongs in the repository that presses itself. Warn
    // rather than freeze, and let the editor go on if they mean to
    const xmlCount = [...fileList].filter((f) => /\.(xml|tei)$/i.test(f.name)).length;
    let totalBytes = 0;
    for (const f of fileList) totalBytes += f.size || 0;
    if ((xmlCount > 200 || totalBytes > 60 * 1024 * 1024)
      && !window.__torchioBig) {
      window.__torchioBig = true;
      const big = xmlCount > 200 ? xmlCount + ' files' : Math.round(totalBytes / 1048576) + ' MB';
      if (!confirm('This is a large edition (' + big + '). The press works entirely in this '
        + 'browser tab, in memory: past a certain size the tab can run out of memory and stop. '
        + 'For composing and trying, load a part of the edition here; press the whole from the '
        + 'repository that presses itself (see USAGE). Try to press all of it anyway?')) {
        window.__torchioBig = false;
        throw new Error('Pressing cancelled: load a smaller part here, or press the whole edition from its repository.');
      }
    }
    const texts = new Map();
    let reviewSheet = null;
    for (const f of fileList) {
      // a reviewed lemma sheet comes back as .xlsx: read it here, so the
      // editor never touches the JSON
      if (/\.xlsx$/i.test(f.name)) { reviewSheet = new Uint8Array(await f.arrayBuffer()); continue; }
      texts.set(f.name, await f.text());
    }

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
    // the reviewed spreadsheet becomes the lemma decisions, merged over any
    // lemmas.json already present
    if (reviewSheet) {
      try {
        const parts = readZip(reviewSheet);
        // Excel resaves in its own dialect (sharedStrings, numeric cells):
        // the reader understands both ours and Excel's, and finds the data
        // sheet by its header wherever the spreadsheet put it
        const rows = reviewRows(parts, ['form', 'label', 'key']);
        const head = (rows.shift() || []).map((c) => String(c).trim());
        if (head.indexOf('label') >= 0 && head.indexOf('type') >= 0) {
          // the names sheet: what the editor confirmed becomes the registries
          const iL = head.indexOf('label'), iT = head.indexOf('type'), iK = head.indexOf('kind'),
            iS = head.indexOf('status'), iLa = head.indexOf('lat'),
            iLo = head.indexOf('lon'), iA = head.indexOf('authority'), iO = head.indexOf('occId');
          const entities = { person: {}, place: {}, org: {} };
          const confirmedOcc = new Map(); // occId -> the editor's type
          const sheetLabels = new Map(); // label -> {type,label}: the exact proposal set
          const nk = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
          const parseAuth = (rec, v) => {
            for (const part of String(v).split(/[\s;]+/)) {
              const m = part.match(/^(wikidata|viaf|gnd|isil):(.+)$/i);
              if (m) rec[m[1].toLowerCase()] = m[2];
              else if (/^Q\d+$/i.test(part)) rec.wikidata = part;
              else if (/^\d+$/.test(part)) rec.viaf = part;
            }
          };
          for (const r of rows) {
            const type = r[iT], label = r[iL], status = iS >= 0 ? (r[iS] || 'suggested') : 'suggested';
            if (!label) continue;
            const kind = iK >= 0 ? r[iK] : 'marked';
            if (!sheetLabels.has(label)) sheetLabels.set(label, { type: type || '', label });
            if (kind === 'unmarked' || kind === 'candidate') {
              // an occurrence judged in place: confirmed here means "yes, and
              // it is a person / place / org", the type from this very row
              if (status === 'confirmed' && iO >= 0 && r[iO] && entities[type]) {
                confirmedOcc.set(r[iO], type);
                // a confirmed candidate needs its entity to exist
                if (!entities[type][nk(label)]) {
                  entities[type][nk(label)] = { label, status: 'confirmed', source: 'editor' };
                }
              }
              continue;
            }
            if (!entities[type]) continue;
            const rec = { label, status, source: 'editor' };
            const lat = Number(r[iLa]), lon = Number(r[iLo]);
            if (Number.isFinite(lat) && Number.isFinite(lon)) { rec.lat = lat; rec.lon = lon; }
            if (iA >= 0 && r[iA]) parseAuth(rec, r[iA]);
            entities[type][nk(label)] = rec;
          }
          applyReconciliation(model, entities);
          const grown = confirmedOcc.size
            ? expandMentions(model, confirmedOcc, { labels: [...sheetLabels.values()] }) : 0;
          const kept = Object.values(entities).reduce((n, o) =>
            n + Object.values(o).filter((r) => r.status === 'confirmed').length, 0);
          notes.push('Reviewed names sheet applied (' + kept + ' entities, ' + grown + ' further occurrences confirmed).');
        } else {
          const iF = head.indexOf('form'), iLa = head.indexOf('lang'),
            iLe = head.indexOf('lemma'), iS = head.indexOf('status');
          const reviewed = rows.filter((r) => r[iF]).map((r) => ({
            form: r[iF], lang: iLa >= 0 ? r[iLa] : undefined,
            lemma: r[iLe], status: iS >= 0 ? r[iS] : undefined,
          }));
          const base = lemmasJson || { types: reviewed.map((r) => ({ form: r.form, lang: r.lang, lemma: r.lemma, status: 'suggested' })) };
          lemmasJson = applyReview(base, reviewed);
          notes.push('Reviewed lemma sheet applied (' + reviewed.length + ' forms).');
        }
      } catch (err) { notes.push('The review sheet could not be read: ' + err.message); }
    }
    attachLemmas(model, lemmasJson);
    attachLexicon(model);

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

    // machine lemmas accepted without review: the editor chose speed, the
    // edition says so (they stay "suggested", and the page marks them)
    const prevLemmaTypes = S && S.lemmaTypes;
    if (!lemmasJson && !reviewSheet && lemmaAuto && prevLemmaTypes) {
      attachLemmas(model, { generator: 'UDPipe (accepted without review)', types: prevLemmaTypes });
      notes.push('Machine lemmas accepted without review, as chosen: ' + prevLemmaTypes.length
        + ' forms, recorded as suggestions.');
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
      lemmaTypes: prevLemmaTypes || null,
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
        persons: !(raw.pieces && raw.pieces.persons === false),
        places: !(raw.pieces && raw.pieces.places === false),
        orgs: !(raw.pieces && raw.pieces.orgs === false),
        lexicon: !!(raw.pieces && raw.pieces.lexicon === true),
        lexStats: !!(raw.pieces && (raw.pieces.lexStats === true || raw.pieces.lexicon === true)),
        lexFreq: !!(raw.pieces && (raw.pieces.lexFreq === true || raw.pieces.lexicon === true)),
        lexConc: !!(raw.pieces && (raw.pieces.lexConc === true || raw.pieces.lexicon === true)),
        lexCloud: !!(raw.pieces && (raw.pieces.lexCloud === true || raw.pieces.lexicon === true)),
      },
      genre: typeof raw.genre === 'string' ? raw.genre : '',
      apparatusKind: raw.apparatusKind === 'critical' || raw.apparatusKind === 'genetic' ? raw.apparatusKind : '',
      version: typeof raw.version === 'string' ? raw.version
        : (raw.version != null ? String(raw.version) : ''),
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
  // the lemma adapter, in the browser: it proposes, the editor disposes.
  // The one thing that leaves the machine is the text sent to UDPipe, and it
  // is said plainly before it happens
  const UDPIPE = 'https://lindat.mff.cuni.cz/services/udpipe/api/process';
  const UDMODEL = { la: 'latin-ittb-ud-2.12-230717', it: 'italian-isdt-ud-2.12-230717',
    en: 'english-ewt-ud-2.12-230717', de: 'german-hdt-ud-2.12-230717',
    fr: 'french-gsd-ud-2.12-230717', grc: 'ancient_greek-perseus-ud-2.12-230717' };
  const UDNAMES = { la: 'Latin', it: 'italiano', en: 'English', de: 'Deutsch',
    fr: 'fran\u00e7ais', grc: 'ancient Greek' };
  // the editor's word beats the markup: an edition without xml:lang (or with
  // the wrong one) can still be analyzed in the language its editor names
  function nlpGroups(tokens) {
    if (nlpLang) return new Map([[nlpLang, tokens.map((t) => t.form)]]);
    const byLang = new Map();
    for (const t of tokens) {
      const l = normLang(t.lang) || 'la';
      if (!byLang.has(l)) byLang.set(l, []);
      byLang.get(l).push(t.form);
    }
    return byLang;
  }

  async function lemmatize() {
    const btn = document.getElementById('c-lemmatize');
    const tokens = collectTokens(S.model);
    if (!tokens.length) { alert('This edition has no running words to lemmatize.'); return; }
    const byLang = nlpGroups(tokens);
    const langs = [...byLang.keys()].filter((l) => UDMODEL[l]);
    if (!langs.length) {
      alert('No language service matches (' + [...byLang.keys()].join(', ')
        + '). Choose the language of the text above, or add a reviewed lemmas.json by hand.');
      return;
    }
    if (!confirm('The text of this edition (' + tokens.length + ' words, '
      + langs.join(' and ') + ') will be sent to UDPipe, at lindat.mff.cuni.cz, to propose the '
      + 'dictionary forms. Nothing is decided automatically: you review every proposal. Proceed?')) return;
    btn.disabled = true; btn.textContent = 'asking UDPipe…';
    try {
      const votes = new Map();
      const forms = new Set();
      for (const l of langs) {
        const text = byLang.get(l).join(' ');
        for (let i = 0; i < text.length; i += 40000) {
          const body = new URLSearchParams({ model: UDMODEL[l], tokenizer: '', tagger: '',
            data: text.slice(i, i + 40000) });
          const res = await fetch(UDPIPE, { method: 'POST', body });
          if (!res.ok) throw new Error('UDPipe HTTP ' + res.status);
          const conllu = (await res.json()).result || '';
          const v = conlluTypes(conllu);
          for (const [form, m] of v) {
            forms.add(form);
            const g = votes.get(form) || new Map(); votes.set(form, g);
            for (const [lem, n] of m) g.set(lem, (g.get(lem) || 0) + n);
          }
        }
      }
      S.lemmaTypes = typesFromVotes(votes, forms, langs.length === 1 ? langs[0] : null);
      renderPanel();
    } catch (err) {
      alert('The lemma service could not be reached: ' + err.message);
      btn.disabled = false; btn.textContent = 'Suggest the dictionary forms';
    }
  }

  function downloadLemmaSheet() {
    const header = ['form', 'lang', 'pos', 'lemma', 'status', 'count', 'alternatives'];
    const rows = [...S.lemmaTypes]
      .sort((a, b) => (a.status === 'review' ? 0 : 1) - (b.status === 'review' ? 0 : 1)
        || (b.count || 0) - (a.count || 0) || a.form.localeCompare(b.form))
      .map((t) => [t.form, t.lang || '', t.pos || '', t.lemma, t.status || 'suggested',
        t.count == null ? '' : t.count, (t.alternatives || []).join('; ')]);
    const xlsx = buildXLSX(header, rows, {
      sheet: 'Lemmas', widths: [16, 6, 9, 16, 12, 8, 26],
      choices: { col: 4, options: ['confirmed', 'rejected', 'suggested'] },
      howto: [
        'WHAT THIS IS \u2014 every distinct word of your text, with the dictionary form a language service proposed.',
        '',
        'WHAT TO DO:',
        '1. Look at the "lemma" column. If the dictionary form is right, you can leave the row alone.',
        '2. If it is wrong, write the correct form over it: an edited lemma counts as confirmed.',
        '3. In the "status" column, pick: confirmed (it is right), rejected (this word must not be lemmatized).',
        '4. Rows marked "review" are the ones the service itself doubted (a homograph, e.g. porta NOUN / portare VERB): the "alternatives" column shows the options. Those deserve your eye first; they are at the top.',
        '5. Save the file, go back to the press, and drop it in the "Words" step (or together with your XML files).',
        '',
        'You do not have to finish: only confirmed and rejected rows count, everything else stays a suggestion.',
      ],
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([xlsx],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = (S.slug || 'edition') + '-lemmas.xlsx';
    a.click();
  }

  // the entity review: the names the markup declares, the bare occurrences
  // of those names, and (if asked) the candidates the grammar proposes. What
  // the editor confirms becomes the indices; a place with coordinates becomes
  // a point on the map
  function entityLabels() {
    const h = harvest(S.model);
    const out = [];
    const seen = new Set();
    for (const type of ['person', 'place', 'org']) {
      for (const e of h[type]) {
        if (seen.has(e.label)) continue;
        seen.add(e.label);
        out.push({ type, label: e.label, marked: (e.occurrences || []).length });
      }
    }
    for (const c of (S.nameCandidates || [])) {
      if (!seen.has(c)) { seen.add(c); out.push({ type: '', label: c, marked: 0 }); }
    }
    return out;
  }

  function downloadEntitySheet() {
    const labels = entityLabels();
    if (!labels.length) { alert('This edition names nothing to index. You can propose candidates from the grammar first.'); return; }
    const header = ['label', 'type', 'kind', 'status', 'context', 'lat', 'lon', 'authority', 'occId'];
    const rows = [];
    const sug = S.authoritySuggestions || new Map();
    // the entities the markup already declares: confirm them, with the
    // authority proposed by Wikidata where one was searched
    for (const w of labels) {
      if (!w.marked) continue;
      const a = sug.get(w.label);
      rows.push([w.label, w.type, 'marked', 'suggested',
        a ? (a.description || '') : '',
        a && a.lat != null ? a.lat : '', a && a.lon != null ? a.lon : '',
        a ? 'wikidata:' + a.qid + (a.viaf ? ' viaf:' + a.viaf : '') : '', '']);
    }
    // one row per bare occurrence, with its own context, so Roma the city and
    // Roma the surname are judged apart. Candidates arrive the same way, with
    // the type left for the editor to set
    for (const o of listBareOccurrences(S.model, { labels })) {
      rows.push([o.label, o.type, o.type ? 'unmarked' : 'candidate', 'suggested',
        o.before + '  [ ' + o.label + ' ]  ' + o.after, '', '', '', o.occId]);
    }
    const xlsx = buildXLSX(header, rows, {
      sheet: 'Names', widths: [18, 8, 10, 12, 52, 9, 9, 24, 1],
      choices: { col: 3, options: ['confirmed', 'rejected', 'suggested'] },
      choices2: { col: 1, options: ['person', 'place', 'org'] },
      howto: [
        'WHAT THIS IS \u2014 the names of your edition: persons, places, organisations.',
        '',
        'THE "kind" COLUMN TELLS YOU WHAT EACH ROW IS:',
        '\u2022 marked \u2014 a name your files already declare. Set status to confirmed to put it in the indices; for a place, fill lat and lon to put it on the map. If an authority is proposed (wikidata:Q\u2026), the "context" column describes who or what it is: keep it or delete it.',
        '\u2022 unmarked \u2014 one more occurrence of a declared name, found as plain text. The "context" column shows the passage: confirm only if, THERE, the name really is that person or place (Roma the city, not Roma a surname).',
        '\u2022 candidate \u2014 a proper noun the grammar found, not yet an entity. Read the context, choose its type (person / place / org) in the "type" column, and confirm; or ignore it.',
        '',
        'Then save, go back to the press, and drop this file in the "Names" step (or together with your XML files).',
        'Only confirmed rows enter the edition. Nothing is looked up while your edition is read.',
      ],
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([xlsx],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = (S.slug || 'edition') + '-names.xlsx';
    a.click();
  }

  // candidates from the grammar: the tagger marks proper nouns (PROPN), and
  // consecutive ones merge (Marco Polo). Works for any language UDPipe knows,
  // typed by nobody: the type is the editor's call, in the sheet
  async function findCandidates() {
    const btn = document.getElementById('c-candidates');
    const tokens = collectTokens(S.model);
    if (!tokens.length) { alert('This edition has no running words.'); return; }
    const byLang = nlpGroups(tokens);
    const langs = [...byLang.keys()].filter((l) => UDMODEL[l]);
    if (!langs.length) { alert('No language service matches. Choose the language of the text in the Words step.'); return; }
    if (!confirm('The text of this edition (' + tokens.length + ' words) will be sent to UDPipe, '
      + 'at lindat.mff.cuni.cz, to find the proper nouns. They come back untyped: you say '
      + 'which are persons, places or organisations, one occurrence at a time. Proceed?')) return;
    btn.disabled = true; btn.textContent = 'asking UDPipe\u2026';
    try {
      const known = new Set(entityLabels().map((w) => w.label.toLowerCase()));
      const found = new Map(); // label -> count
      for (const l of langs) {
        const text = byLang.get(l).join(' ');
        for (let i = 0; i < text.length; i += 40000) {
          const body = new URLSearchParams({ model: UDMODEL[l], tokenizer: '', tagger: '',
            data: text.slice(i, i + 40000) });
          const res = await fetch(UDPIPE, { method: 'POST', body });
          if (!res.ok) throw new Error('UDPipe HTTP ' + res.status);
          const conllu = (await res.json()).result || '';
          let run = [];
          const flush = () => {
            if (run.length) {
              const name = run.join(' ');
              if (name.length > 2 && !known.has(name.toLowerCase())) {
                found.set(name, (found.get(name) || 0) + 1);
              }
            }
            run = [];
          };
          for (const line of conllu.split('\n')) {
            if (!line || line.startsWith('#')) { flush(); continue; }
            const cols = line.split('\t');
            if (cols.length < 4 || cols[0].includes('-') || cols[0].includes('.')) continue;
            if (cols[3] === 'PROPN') run.push(cols[1]); else flush();
          }
          flush();
        }
      }
      S.nameCandidates = [...found.entries()]
        .sort((a, b) => b[1] - a[1]).slice(0, 300).map(([n]) => n);
      renderPanel();
      if (!S.nameCandidates.length) alert('The grammar found no unknown proper nouns.');
    } catch (err) {
      alert('The service could not be reached: ' + err.message);
      btn.disabled = false; btn.textContent = 'Propose candidates from the grammar';
    }
  }

  // the authorities: each declared name is searched on Wikidata, and the
  // editor sees the candidate identifier with its one-line description in the
  // sheet. A suggestion, like every other: nothing is written unconfirmed
  async function searchAuthorities() {
    const btn = document.getElementById('c-authorities');
    const labels = entityLabels().filter((w) => w.marked);
    if (!labels.length) { alert('No marked names to search. The authorities attach to declared entities.'); return; }
    const capped = labels.slice(0, 40);
    if (!confirm(capped.length + ' names of this edition will be sent to wikidata.org to look for '
      + 'their public identifiers (Wikidata, VIAF) and, for places, coordinates. You confirm '
      + 'each one in the sheet. Proceed?')) return;
    btn.disabled = true; btn.textContent = 'asking Wikidata\u2026';
    try {
      const lang = (S.model.meta.languages && S.model.meta.languages[0]) || 'en';
      const sug = new Map();
      for (const w of capped) {
        const u = 'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&origin=*'
          + '&limit=1&language=' + encodeURIComponent(lang) + '&uselang=' + encodeURIComponent(lang)
          + '&search=' + encodeURIComponent(w.label);
        const res = await fetch(u);
        if (!res.ok) continue;
        const hit = ((await res.json()).search || [])[0];
        if (hit) sug.set(w.label, { qid: hit.id, description: hit.description || '', type: w.type });
      }
      // one batch for the claims: VIAF (P214) and coordinates (P625)
      const qids = [...sug.values()].map((a) => a.qid);
      for (let i = 0; i < qids.length; i += 50) {
        const u = 'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*'
          + '&props=claims&ids=' + qids.slice(i, i + 50).join('|');
        const res = await fetch(u);
        if (!res.ok) continue;
        const ents = (await res.json()).entities || {};
        for (const a of sug.values()) {
          const claims = (ents[a.qid] || {}).claims || {};
          const first = (pid) => claims[pid] && claims[pid][0] && claims[pid][0].mainsnak
            && claims[pid][0].mainsnak.datavalue && claims[pid][0].mainsnak.datavalue.value;
          const viaf = first('P214');
          if (viaf) a.viaf = viaf;
          const geo = first('P625');
          if (geo && a.type === 'place') { a.lat = Math.round(geo.latitude * 1e4) / 1e4; a.lon = Math.round(geo.longitude * 1e4) / 1e4; }
        }
      }
      S.authoritySuggestions = sug;
      btn.disabled = false; btn.textContent = 'Search the authorities (Wikidata)';
      alert(sug.size + ' of ' + capped.length + ' names found an authority candidate. '
        + 'Download the names sheet: each proposal is there, with its description, to confirm or reject.');
    } catch (err) {
      alert('Wikidata could not be reached: ' + err.message);
      btn.disabled = false; btn.textContent = 'Search the authorities (Wikidata)';
    }
  }

  function buildManifest() {
    const ui = S.ui;
    const m = {};
    if (ui.title.trim()) m.title = ui.title.trim();
    if (ui.subtitle.trim()) m.subtitle = ui.subtitle.trim();
    if (ui.lang) m.lang = ui.lang;
    if (ui.theme) m.theme = ui.theme;
    if (ui.genre) m.genre = ui.genre;
    if (ui.version) m.version = ui.version;
    if (ui.apparatusKind) m.apparatusKind = ui.apparatusKind;
    const off = {};
    for (const k of ['apparatus', 'entities', 'choice', 'map', 'lemmas', 'persons', 'places', 'orgs']) {
      if (ui.pieces[k] === false) off[k] = false;
    }
    for (const k of ['lexStats', 'lexFreq', 'lexConc', 'lexCloud']) {
      if (ui.pieces[k]) off[k] = true; // off by default, so record when on
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
    // the menu comes last: pages are arranged once the editor knows what the
    // edition contains (map, indices, lexicon), not before
    const STEPS = [['edition', 'Edition'], ['pieces', 'Pieces'],
      ['words', 'Words'], ['names', 'Names'], ['pages', 'Menu and pages']];
    let html = '<h2>Composition</h2>'
      + '<nav class="stepnav">' + STEPS.map(([id, label], i) =>
        '<button type="button" data-goto="' + id + '"' + (i === 0 ? ' class="on"' : '') + '>'
        + (i + 1) + '. ' + label + '</button>').join('') + '</nav>'
      + '<p class="note">Decisions taken here are written to a small file, '
      + '<code>torchio.json</code>, shipped inside the archive: keep it next '
      + 'to your XML and every future pressing repeats them.</p>'
      + (S.model.documents && S.model.documents.length > 1
        ? '<p class="note">A collection borrows the title of its first document '
          + 'until you give it one of its own, below.</p>'
        : '')
      + '<fieldset data-step="edition"><legend>Edition</legend>'
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
      + '</select></div>'
      + '<div class="frow"><label for="c-version">Version</label>'
      + '<input id="c-version" type="text" value="' + esc(ui.version || '') + '" '
      + 'placeholder="e.g. 1, 1.2, second edition" style="max-width:16rem"></div>'
      + '<p class="note">The version of the edition, yours to set: raise it when you press again '
      + 'after correcting. It is stamped in the colophon of every page, so two impressions can be '
      + 'told apart and collated.</p>'
      + '</fieldset>';

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

    html += '<fieldset data-step="edition"><legend>What this edition is</legend>'
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
    html += '<fieldset data-step="pages"><legend>Pages</legend>';
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
      html += '<fieldset data-step="pages"><legend>Register columns</legend>';
      for (const k of avail) {
        html += '<label><input type="checkbox" data-regcol="' + esc(k) + '"'
          + (current.includes(k) ? ' checked' : '') + (k === 'title' ? ' disabled' : '')
          + '> ' + esc(k) + '</label> ';
      }
      html += '<p class="note">Fields come from each document’s teiHeader; '
        + 'the title stays: it is the way into the documents.</p></fieldset>';
    }

    // 1. the interactive layers of the text, each explained where it is chosen
    html += '<fieldset data-step="pieces"><legend>Pieces</legend>'
      + '<p class="note">Switching a piece off disables its interactive layer, '
      + 'never the base rendering: nothing becomes invisible.</p>'
      + '<div class="piece-block"><label><input type="checkbox" id="c-apparatus"' + (ui.pieces.apparatus ? ' checked' : '')
      + '> <b>apparatus</b></label>'
      + '<span class="note">If your files record variant readings (app, rdg, lem), every word that varies '
      + 'becomes clickable: a small window shows what each witness reads. Off: the text stays, the windows go.</span>'
      + '<div class="frow"><label for="c-appkind">kind of apparatus</label><select id="c-appkind">'
      + '<option value=""' + (!ui.apparatusKind ? ' selected' : '') + '>from the markup</option>'
      + '<option value="critical"' + (ui.apparatusKind === 'critical' ? ' selected' : '') + '>critical: variants between witnesses</option>'
      + '<option value="genetic"' + (ui.apparatusKind === 'genetic' ? ' selected' : '') + '>genetic: the strata of one manuscript in time</option>'
      + '</select></div>'
      + '<span class="note">Declaring it names it for the reader on the edition page; a genetic edition '
      + 'also gets its Genesis page and hand colours when the markup records them (listChange, handNote).</span></div>'
      + '<div class="piece-block"><label><input type="checkbox" id="c-entities"' + (ui.pieces.entities ? ' checked' : '')
      + '> <b>entity cards</b></label>'
      + '<span class="note">If your files mark names (persName, placeName, orgName), each becomes clickable: '
      + 'a card says who or what it is, lists its occurrences, links its identifiers. The indices are the same '
      + 'names in one page; you choose them in the Names step.</span></div>'
      + '<div class="piece-block"><label><input type="checkbox" id="c-choice"' + (ui.pieces.choice ? ' checked' : '')
      + '> <b>reading / diplomatic toggle</b></label>'
      + '<span class="note">If your files encode both the abbreviated and the expanded form (choice, am/ex, '
      + 'orig/reg), the reader can switch between the diplomatic text and the reading text.</span></div>'
      + '<div class="piece-block"><label><input type="checkbox" id="c-exports"' + (ui.exports ? ' checked' : '')
      + '> <b>data files</b></label>'
      + '<span class="note">The edition ships its own data for anyone to reuse: the model (JSON), the '
      + 'registers (CSV), and your XML sources in data/source. The edition is the repository.</span></div>'
      + '</fieldset>';

    // 2. words: lemmas and the lexicon, with their own review round trip
    const langOpts = '<option value=""' + (!nlpLang ? ' selected' : '') + '>from the markup (xml:lang)</option>'
      + Object.keys(UDMODEL).map((l) => '<option value="' + l + '"' + (nlpLang === l ? ' selected' : '') + '>'
        + (UDNAMES[l] || l) + '</option>').join('');
    html += '<fieldset class="flow" data-step="words"><legend>Words: lemmas and lexicon</legend>'
      + '<p class="note"><b>What you can add here.</b> An index of dictionary forms (every word of the '
      + 'text grouped under its lemma: porta, porte \u2192 porta, with concordances), and the lexicon '
      + 'pages. If your files already declare the lemmas (w/@lemma), the index appears by itself and '
      + 'there is nothing to do. If not, follow the numbered path below.</p>'
      + '<label><input type="checkbox" id="c-lemmas"' + (ui.pieces.lemmas ? ' checked' : '')
      + '> index of dictionary forms</label> '
      + '<label><input type="checkbox" id="c-lexstats"' + (ui.pieces.lexStats ? ' checked' : '')
      + '> statistics on the edition page (words, forms, type-token ratio)</label> '
      + '<label><input type="checkbox" id="c-lexfreq"' + (ui.pieces.lexFreq ? ' checked' : '')
      + '> word frequencies</label> '
      + '<label><input type="checkbox" id="c-lexconc"' + (ui.pieces.lexConc ? ' checked' : '')
      + '> concordance</label> '
      + '<label><input type="checkbox" id="c-lexcloud"' + (ui.pieces.lexCloud ? ' checked' : '')
      + '> word cloud</label>'
      + '<div class="piece-block"><b>1 \u00b7 Say the language of the text.</b>'
      + '<div class="frow"><label for="c-nlplang">language</label>'
      + '<select id="c-nlplang">' + langOpts + '</select></div>'
      + '<span class="note">If your files declare it (xml:lang) you can leave "from the markup". '
      + 'If they do not, or declare it wrong, your word wins: the analysis runs in the language '
      + 'you choose here.</span></div>'
      + '<div class="piece-block"><b>2 \u00b7 Ask the language service.</b><br>'
      + '<button type="button" id="c-lemmatize">Suggest the dictionary forms</button>'
      + '<span class="note">This is linguistic analysis (NLP), done by UDPipe at the Charles '
      + 'University in Prague: <b>the text of your edition is sent to that service.</b> The pipeline '
      + 'is: the text is split into words, each word is tagged with its part of speech, and only '
      + 'then a dictionary form is proposed (the lemma depends on the part of speech: porta the '
      + 'noun \u2192 porta, porta the verb \u2192 portare). Nothing is decided here.</span></div>'
      + '<div class="piece-block"><b>3 \u00b7 Decide what to trust.</b>'
      + (S.lemmaTypes ? '<br><button type="button" id="c-lemma-sheet">Download the review sheet ('
        + S.lemmaTypes.length + ' forms)</button>'
        + '<span class="note">The file opens on a READ ME FIRST sheet that walks you through it. '
        + 'Correct, confirm or reject, save, and drop the file below.</span>' : '')
      + '<label style="display:block;margin-top:.5em"><input type="checkbox" id="c-lemma-auto"'
      + (lemmaAuto ? ' checked' : '') + '> or proceed without review: use the proposals as they are. '
      + 'The edition will say so (every form stays marked as a machine suggestion)</label></div>'
      + '<div class="dropmini" id="drop-lemmas"><span class="note">4 \u00b7 Drop the corrected sheet '
      + 'here (or with the files).</span></div>'
      + '</fieldset>';

    // 3. names: the indices and the map, with their own review round trip
    const markedCount = entityLabels().filter((w) => w.marked).length;
    html += '<fieldset class="flow" data-step="names"><legend>Names: indices and map</legend>'
      + (markedCount
        ? '<p class="note">Your markup already declares <b>' + markedCount + '</b> named '
          + 'entities. You can confirm them, look for the unmarked occurrences of the same names, '
          + 'and search their public identifiers.</p>'
        : '<p class="note">Your markup declares no named entities. You can still have indices and '
          + 'a map: ask the grammar to propose candidates, then say which are persons, places or '
          + 'organisations, one occurrence at a time.</p>')
      + '<label><input type="checkbox" id="c-persons"' + (ui.pieces.persons ? ' checked' : '')
      + '> index of persons</label> '
      + '<label><input type="checkbox" id="c-places"' + (ui.pieces.places ? ' checked' : '')
      + '> index of places</label> '
      + '<label><input type="checkbox" id="c-orgs"' + (ui.pieces.orgs ? ' checked' : '')
      + '> index of organisations</label> '
      + '<label><input type="checkbox" id="c-map"' + (ui.pieces.map ? ' checked' : '')
      + '> map, where places carry coordinates</label>'
      + '<p><button type="button" id="c-candidates">Propose candidates from the grammar</button>'
      + '<span class="note">The proper nouns of your text, found by the same language service as '
      + 'the lemmas (UDPipe: <b>the text is sent to that service</b>). They come back untyped: '
      + 'you decide what each one is.'
      + (S.nameCandidates ? ' <b>' + S.nameCandidates.length + ' candidates found.</b>' : '')
      + '</span></p>'
      + (markedCount
        ? '<p><button type="button" id="c-authorities">Search the authorities (Wikidata)</button>'
          + '<span class="note">Each declared name is looked up on wikidata.org (<b>the names are '
          + 'sent there</b>): the sheet then proposes its public identifier, a one-line description '
          + 'to judge it by, and coordinates for places. You confirm or reject each one.'
          + (S.authoritySuggestions ? ' <b>' + S.authoritySuggestions.size + ' proposals ready.</b>' : '')
          + '</span></p>'
        : '')
      + '<p><button type="button" id="c-entities-sheet">Download the names sheet</button>'
      + '<span class="note">Everything above lands in one spreadsheet: the declared names, the '
      + 'unmarked occurrences with their context, the candidates, the authority proposals. Confirm, '
      + 'set the types, fill coordinates, save.</span></p>'
      + '<div class="dropmini" id="drop-names"><span class="note">Drop the corrected names sheet here '
      + '(or with the files).</span></div>'
      + '</fieldset>';

    html += '<div class="stepmove"><button type="button" class="step-back">\u2039 back</button>'
      + '<button type="button" class="step-fwd">next \u203a</button></div>';

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
    // one step at a time: the nav shows the group, the rest is hidden
    const order = STEPS.map(([id]) => id);
    let stepAt = 0;
    const showStep = (id) => {
      stepAt = Math.max(0, order.indexOf(id));
      currentStep = order[stepAt];
      composeBox.querySelectorAll('fieldset[data-step]').forEach((fs) => {
        fs.style.display = fs.getAttribute('data-step') === id ? '' : 'none';
      });
      composeBox.querySelectorAll('.stepnav button').forEach((b) => {
        b.classList.toggle('on', b.getAttribute('data-goto') === id);
      });
      const back = composeBox.querySelector('.step-back'), fwd = composeBox.querySelector('.step-fwd');
      if (back) back.disabled = stepAt === 0;
      if (fwd) {
        // on the last step the way forward IS the download: nobody should
        // have to guess that the button lives further down the page
        const last = stepAt === order.length - 1;
        fwd.disabled = false;
        fwd.textContent = last ? 'Download the pressed edition \u2913' : 'next \u203a';
        fwd.classList.toggle('step-download', last);
      }
    };
    composeBox.querySelectorAll('.stepnav button').forEach((b) => {
      b.addEventListener('click', () => showStep(b.getAttribute('data-goto')));
    });
    const backBtn = composeBox.querySelector('.step-back'), fwdBtn = composeBox.querySelector('.step-fwd');
    if (backBtn) backBtn.addEventListener('click', () => showStep(order[Math.max(0, stepAt - 1)]));
    if (fwdBtn) fwdBtn.addEventListener('click', () => {
      if (stepAt === order.length - 1) { downloadBtn.click(); return; }
      showStep(order[Math.min(order.length - 1, stepAt + 1)]);
    });
    showStep(order.includes(currentStep) ? currentStep : 'edition');
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
    bind('c-persons', (el) => { ui.pieces.persons = el.checked; });
    bind('c-places', (el) => { ui.pieces.places = el.checked; });
    bind('c-orgs', (el) => { ui.pieces.orgs = el.checked; });
    bind('c-lexstats', (el) => { ui.pieces.lexStats = el.checked; });
    bind('c-lexfreq', (el) => { ui.pieces.lexFreq = el.checked; });
    bind('c-lexconc', (el) => { ui.pieces.lexConc = el.checked; });
    bind('c-lexcloud', (el) => { ui.pieces.lexCloud = el.checked; });
    bind('c-lemmas', (el) => { ui.pieces.lemmas = el.checked; });
    bind('c-genre', (el) => { ui.genre = el.value; });
    bind('c-version', (el) => { ui.version = el.value.trim(); });
    bind('c-appkind', (el) => { ui.apparatusKind = el.value; });
    bind('c-nlplang', (el) => { nlpLang = el.value; });
    bind('c-lemma-auto', (el) => {
      lemmaAuto = el.checked;
      if (lemmaAuto && S.lemmaTypes && lastFiles.length) press(lastFiles);
    });
    const lemBtn = document.getElementById('c-lemmatize');
    if (lemBtn) lemBtn.addEventListener('click', lemmatize);
    const sheetBtn = document.getElementById('c-lemma-sheet');
    if (sheetBtn) sheetBtn.addEventListener('click', downloadLemmaSheet);
    const entBtn = document.getElementById('c-entities-sheet');
    if (entBtn) entBtn.addEventListener('click', downloadEntitySheet);
    const candBtn = document.getElementById('c-candidates');
    if (candBtn) candBtn.addEventListener('click', findCandidates);
    const authBtn = document.getElementById('c-authorities');
    if (authBtn) authBtn.addEventListener('click', searchAuthorities);
    // each review has its own dropzone: drop the corrected sheet, it is
    // pressed together with the files already loaded
    for (const id of ['drop-lemmas', 'drop-names']) {
      const zone = document.getElementById(id);
      if (!zone) continue;
      zone.addEventListener('dragover', (ev) => { ev.preventDefault(); zone.classList.add('over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('over'));
      zone.addEventListener('drop', (ev) => {
        ev.preventDefault(); zone.classList.remove('over');
        if (ev.dataTransfer.files.length) press([...lastFiles, ...ev.dataTransfer.files]);
      });
    }
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
