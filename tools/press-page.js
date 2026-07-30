/**
 * The browser harness of path A. Not a module: this file is inlined by
 * tools/build-browser.js after the engine, in the same script scope, and
 * mirrors tools/press.js step by step (parse, xinclude, class map, model,
 * manifest, reconciliation, extra pages, site, exports).
 *
 * Everything happens in the page: no upload, no server, no dependencies.
 */

/* global parseXML, inTEINamespace, resolveIncludes, buildClassMap, buildModel,
   pressSite, analyze, applyReconciliation, markdown, buildZip,
   TORCHIO_BASE_DATA, TORCHIO_LEAFLET_B64 */

(function () {
  const drop = document.getElementById('drop');
  const input = document.getElementById('fileinput');
  const pick = document.getElementById('pick');
  const report = document.getElementById('report');
  const previewBox = document.getElementById('previewbox');
  const pageSelect = document.getElementById('pageselect');
  const iframe = document.getElementById('preview');
  const downloadBtn = document.getElementById('download');

  let pressed = null; // { files, hasMap, slug }

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
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fail(message) {
    report.hidden = false;
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
    // read everything the user handed over, by name
    const texts = new Map();
    for (const f of fileList) texts.set(f.name, await f.text());

    const notes = [];

    // the TEI documents: one file is an edition, several form a collection
    const xmlNames = [...texts.keys()]
      .filter((n) => /\.(xml|tei)$/i.test(n))
      .sort();
    if (!xmlNames.length) throw new Error('No XML file among the chosen files.');

    // xinclude: hrefs are looked up among the dropped files, by path then by name
    const byBase = new Map();
    for (const n of texts.keys()) byBase.set(n.split('/').pop(), n);
    const loadText = async (href) => {
      const clean = href.split('#')[0];
      const hit = texts.get(clean) || texts.get(byBase.get(clean.split('/').pop()));
      if (hit === undefined) throw new Error('not among the chosen files');
      return hit;
    };

    let roots = [];
    let unresolvedIncludes = [];
    const included = new Set(); // files consumed as xinclude targets
    if (xmlNames.length === 1) {
      const root = parseXML(texts.get(xmlNames[0]));
      if (!inTEINamespace(root)) {
        notes.push('The root element is not in the TEI namespace; pressed anyway (nothing is invisible).');
      }
      const r = await resolveIncludes(root, async (href) => {
        const t = await loadText(href);
        included.add(href.split('#')[0].split('/').pop());
        return t;
      });
      unresolvedIncludes = r.unresolved;
      roots = [root];
    } else {
      // several XML files: resolve includes first, then keep the TEI roots
      const parsed = [];
      for (const n of xmlNames) {
        try {
          const root = parseXML(texts.get(n));
          parsed.push({ id: n.replace(/\.(xml|tei)$/i, ''), name: n, root });
        } catch (err) {
          notes.push('Skipped ' + n + ': ' + err.message);
        }
      }
      for (const p of parsed) {
        const r = await resolveIncludes(p.root, async (href) => {
          const t = await loadText(href);
          included.add(href.split('#')[0].split('/').pop());
          return t;
        });
        unresolvedIncludes.push(...r.unresolved);
      }
      roots = parsed
        .filter((p) => inTEINamespace(p.root))
        .filter((p) => !included.has(p.name))
        .map((p) => ({ id: p.id, root: p.root }));
      if (!roots.length) throw new Error('No TEI document among the chosen files.');
      if (roots.length === 1) roots = [roots[0].root];
    }

    const map = buildClassMap(null, TORCHIO_BASE_DATA);
    const model = buildModel(roots.length === 1 && !roots[0].root ? roots[0] : roots, map);

    // the manifest and the editor's decisions, if they travelled along
    let manifest = null;
    if (texts.has('torchio.json')) {
      try { manifest = JSON.parse(texts.get('torchio.json')); }
      catch (err) { notes.push('torchio.json ignored: ' + err.message); }
    }
    if (texts.has('reconcile.json')) {
      try {
        applyReconciliation(model, JSON.parse(texts.get('reconcile.json')).entities);
        notes.push('reconcile.json applied.');
      } catch (err) { notes.push('reconcile.json ignored: ' + err.message); }
    }

    // the editor's simple pages, declared in the manifest
    const extraPages = [];
    if (manifest && Array.isArray(manifest.extra)) {
      for (const e of manifest.extra) {
        if (!e || !e.id || !e.file) continue;
        const raw = texts.get(e.file) || texts.get(byBase.get(e.file.split('/').pop()));
        if (raw === undefined) {
          notes.push('Extra page skipped (' + e.file + '): not among the chosen files.');
          continue;
        }
        extraPages.push({
          id: e.id,
          label: e.label || e.id,
          html: e.file.endsWith('.html') ? raw : markdown(raw),
        });
      }
    }

    const analysis = analyze(roots.map((r) => r.root || r), map);
    const sourceXML = xmlNames.length === 1 ? texts.get(xmlNames[0]) : null;
    const files = pressSite(model, { manifest, sourceXML, extraPages });
    const hasMap = 'map.html' in files;

    pressed = {
      files,
      hasMap,
      slug: xmlNames[0].replace(/\.(xml|tei)$/i, '').split('/').pop() || 'edition',
    };

    renderReport({ model, analysis, files, unresolvedIncludes, notes, manifest });
    renderPreview(files);
  }

  function renderReport({ model, analysis, files, unresolvedIncludes, notes, manifest }) {
    const regs = Object.entries(model.registries || {})
      .filter(([, v]) => v.length)
      .map(([k, v]) => k + ': ' + v.length)
      .join(' · ');
    const rows = [
      ['title', model.meta.title || '(none)'],
      ['documents', String(model.documents ? model.documents.length : 1)],
      ['elements', analysis.distinctElements + ' distinct'],
      ['fallbacks', analysis.fallback.length ? analysis.fallback.join(', ') : 'none'],
      ['registries', regs || 'none'],
      ['manifest', manifest ? 'torchio.json read' : 'none (everything derived)'],
      ['pages', Object.keys(files).filter((n) => n.endsWith('.html')).length
        + ' html, ' + Object.keys(files).length + ' files in total'],
    ];
    let html = '<h2>Pressed</h2><dl>'
      + rows.map(([k, v]) => '<dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd>').join('')
      + '</dl>';
    for (const u of unresolvedIncludes) {
      html += '<p class="warn">xinclude unresolved: ' + esc(u.href) + ' (' + esc(u.reason) + ')</p>';
    }
    for (const n of notes) html += '<p class="note">' + esc(n) + '</p>';
    report.innerHTML = html;
    report.hidden = false;
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
    let html = pressed.files[name];
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
    if (!(name in pressed.files)) return;
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
    if (!e.data || !e.data.torchioNav || !pressed) return;
    const [page, fragment] = String(e.data.torchioNav).split('#');
    showPage(page || pageSelect.value, fragment ? '#' + fragment : '');
  });

  function renderPreview(files) {
    const pages = Object.keys(files).filter((n) => n.endsWith('.html'));
    pageSelect.innerHTML = pages
      .map((n) => '<option value="' + esc(n) + '">' + esc(n) + '</option>')
      .join('');
    previewBox.hidden = false;
    showPage(pages.includes('index.html') ? 'index.html' : pages[0], '');
  }

  pageSelect.addEventListener('change', () => showPage(pageSelect.value, ''));

  // ---- download: the pressed site as one archive ----

  downloadBtn.addEventListener('click', () => {
    if (!pressed) return;
    const entries = {};
    for (const [name, content] of Object.entries(pressed.files)) entries[name] = content;
    if (pressed.hasMap) {
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
    a.download = pressed.slug + '.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  });
})();
