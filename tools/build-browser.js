#!/usr/bin/env node
/**
 * Build path A: the press in the browser, one self-contained index.html.
 *
 * No bundler and no dependencies: the engine modules are concatenated in
 * dependency order with import/export lines stripped (the suite proves the
 * result presses the Specimen byte-identically to the modular engine).
 * Base data (P5 classes, sections) and the Leaflet assets are embedded, so
 * the file works offline and from file:// — only map tiles need network.
 *
 * Usage: node tools/build-browser.js [output.html]
 * Default output: docs/press/index.html
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(ROOT, 'docs', 'press', 'index.html');

// ---------------------------------------------------------------- engine

/** Topologically sort src modules by their relative imports (Kahn). */
async function sortedModules() {
  const dir = join(ROOT, 'src');
  const names = (await readdir(dir)).filter((n) => n.endsWith('.js')).sort();
  const src = new Map();
  const deps = new Map();
  for (const n of names) {
    const text = await readFile(join(dir, n), 'utf-8');
    src.set(n, text);
    const d = [];
    for (const m of text.matchAll(/^import\s+.*?from\s+'\.\/([\w-]+\.js)';/gm)) d.push(m[1]);
    deps.set(n, d);
  }
  const order = [];
  const done = new Set();
  const visit = (n, trail) => {
    if (done.has(n)) return;
    if (trail.has(n)) throw new Error(`import cycle: ${[...trail, n].join(' -> ')}`);
    trail.add(n);
    for (const d of deps.get(n) || []) visit(d, trail);
    trail.delete(n);
    done.add(n);
    order.push(n);
  };
  for (const n of names) visit(n, new Set());
  return order.map((n) => ({ name: n, text: src.get(n) }));
}

/** Strip import lines and export keywords: one flat script, shared scope. */
function flatten(mod) {
  return mod.text
    .replace(/^import\s+.*$/gm, '')
    .replace(/^export\s+(async\s+function|function|const|let|var)/gm, '$1')
    // import.meta is a syntax error in a classic script; it only serves
    // loadBaseData, the Node-only path, never called in the browser
    .replace(/import\.meta\.url/g, 'globalThis.__torchioModuleURL')
    .trim();
}

/** A closing script tag inside JS strings would end the HTML script element. */
function scriptSafe(js) {
  return js.replace(/<\/script/g, '<\\/script');
}

const modules = await sortedModules();
const engine = modules
  .map((m) => `// ---- src/${m.name} ----\n${flatten(m)}`)
  .join('\n\n');

// ---------------------------------------------------------------- data

const p5 = await readFile(join(ROOT, 'data', 'p5-classes.json'), 'utf-8');
const sections = await readFile(join(ROOT, 'data', 'sections.json'), 'utf-8');

async function b64(rel) {
  return (await readFile(join(ROOT, rel))).toString('base64');
}
const leaflet = {
  'assets/leaflet/leaflet.js': await b64('data-assets/leaflet/leaflet.js'),
  'assets/leaflet/leaflet.css': await b64('data-assets/leaflet/leaflet.css'),
  'assets/leaflet/images/marker-icon.png': await b64('data-assets/leaflet/images/marker-icon.png'),
  'assets/leaflet/images/marker-icon-2x.png': await b64('data-assets/leaflet/images/marker-icon-2x.png'),
  'assets/leaflet/images/marker-shadow.png': await b64('data-assets/leaflet/images/marker-shadow.png'),
  'assets/leaflet/images/layers.png': await b64('data-assets/leaflet/images/layers.png'),
  'assets/leaflet/images/layers-2x.png': await b64('data-assets/leaflet/images/layers-2x.png'),
};

const lockup = (await readFile(join(ROOT, 'docs', 'torchio-lockup.svg'), 'utf-8'))
  .replace(/<\?xml[^?]*\?>\s*/, '');

// ---------------------------------------------------------------- harness

const harness = await readFile(join(ROOT, 'tools', 'press-page.js'), 'utf-8');

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Torchio · the press</title>
<style>
body{background:#fff;color:#1B1B1B;font-family:"EB Garamond",Palatino,Georgia,serif;
  max-width:52rem;margin:2.5rem auto;padding:0 1.25rem;line-height:1.55;font-size:18px}
h2{font-size:20px;font-weight:600;margin:2.2rem 0 .4rem}
a{color:#B01E28;text-decoration:none}
a:hover{text-decoration:underline}
.lockup{max-width:420px;width:100%;height:auto;margin:0 0 1.4rem;display:block}
.upnav{margin:0 0 1rem}
.upnav a{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11.5px;
  letter-spacing:.06em;text-transform:uppercase;color:#6A6A66}
.upnav a:hover{color:#B01E28}
.note{font-size:14px;color:#6A6A66}
.drop{border:1px solid #E5E2D9;padding:2.2rem 1.5rem;text-align:center;margin:1.5rem 0;background:#fff}
.drop.over{border-color:#B01E28}
.drop p{margin:.4rem 0}
button{font:inherit;font-size:16px;padding:.45em 1.1em;border:1px solid #1B1B1B;
  background:#fff;color:#1B1B1B;cursor:pointer}
button:hover{border-color:#B01E28;color:#B01E28}
button:focus-visible,.drop:focus-within{outline:2px solid #B01E28;outline-offset:2px}
#report,#composebox,#previewbox{border-top:1px solid #E5E2D9;margin-top:2rem;padding-top:1rem}
#report dl{display:grid;grid-template-columns:max-content 1fr;gap:.15rem 1.2rem;margin:.8rem 0}
#report dt{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;
  letter-spacing:.08em;text-transform:uppercase;color:#1B1B1B;padding-top:.25em}
#report dd{margin:0}
.warn{color:#B01E28}
input,select,textarea{accent-color:#B01E28}
input[type=text],textarea,select{font:inherit;font-size:16px;color:#1B1B1B;
  border:1px solid #E5E2D9;background:#fff;padding:.3em .5em;max-width:100%}
input[type=text]:focus,textarea:focus,select:focus{outline:2px solid #B01E28;outline-offset:1px}
textarea{width:100%;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:14px}
fieldset{border:1px solid #E5E2D9;margin:1.2rem 0;padding:.8rem 1rem}
legend{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;
  letter-spacing:.08em;text-transform:uppercase;padding:0 .4em}
.frow{display:flex;align-items:baseline;gap:.8rem;margin:.5rem 0;flex-wrap:wrap}
.frow>label:first-child{min-width:7.5rem}
.frow input[type=text]{flex:1;min-width:12rem}
.pagerow>label{min-width:9rem}
.pageoff{min-width:9rem;color:#6A6A66}
#pageeditor{border:1px solid #E5E2D9;padding:.8rem 1rem;margin:1rem 0}
#pages{margin:.8rem 0}
#pageselect{font:inherit;font-size:16px;padding:.25em;max-width:100%}
iframe{width:100%;height:60vh;border:1px solid #E5E2D9;background:#fff;margin-top:.6rem}
[hidden]{display:none !important}
</style>
</head>
<body>
<nav class="upnav"><a href="../">&#8249; Home</a></nav>
<a href="../" aria-label="Torchio: home of the demos">
${lockup.replace('<svg ', '<svg class="lockup" role="img" aria-label="Torchio" ')}
</a>
<p>The press, in the browser. Choose the files of a TEI P5 edition and it is
pressed into a static site, here, on your machine: nothing is uploaded
anywhere (only the map tiles come from OpenStreetMap, when a map exists).
The same result, from the command line, is described in
<a href="https://github.com/emmcarbe/torchio/blob/main/USAGE.md">USAGE.md</a>.</p>
<div class="drop" id="drop">
<p><strong>Drop files here</strong>, or</p>
<p><button id="pick" type="button">choose files</button></p>
<p class="note">One or more TEI XML files: several files form a collection.
If the edition has an ODD, add it to the selection: it is recognized
automatically. Title, language, theme and pages are decided in the panel
that appears next.</p>
<input type="file" id="fileinput" multiple
  accept=".xml,.tei,.odd,.json,.md,.markdown,.html" hidden>
</div>
<section id="report" hidden aria-live="polite"></section>
<section id="composebox" hidden></section>
<section id="previewbox" hidden>
<h2>Preview</h2>
<div id="pages">
<label for="pageselect">Page:</label>
<select id="pageselect"></select>
<button id="download" type="button">Download the site (.zip)</button>
</div>
<iframe id="preview" title="Preview of the pressed edition" sandbox="allow-scripts"></iframe>
</section>
<section id="github">
<h2>Put the edition online, on GitHub</h2>
<p class="note">The edition is the repository: the archive you just
downloaded is a complete website, and GitHub hosts it for free. No
command line involved.</p>
<ol>
<li>Create a free account at <a href="https://github.com">github.com</a>,
then choose <strong>New repository</strong> (the + sign, top right). Name
it after your edition, keep it public, press <strong>Create
repository</strong>.</li>
<li>Unzip the downloaded archive. On the new repository's page choose
<strong>uploading an existing file</strong>, drag all the unzipped files
in, press <strong>Commit changes</strong>.</li>
<li>In the repository, open <strong>Settings &gt; Pages</strong>, and under
Branch choose <code>main</code>, then <strong>Save</strong>. After a minute
or two the edition is online at
<code>https://<em>yourname</em>.github.io/<em>repository</em>/</code>.</li>
<li>For a new version: record what changed in the TEI header
(<code>editionStmt</code> for the version, <code>revisionDesc</code> for
the changes: the edition page shows both), press again here, upload the
new files the same way. GitHub keeps every previous version.</li>
</ol>
</section>
<p class="note" id="foot">Torchio is
<a href="https://github.com/emmcarbe/torchio">an experiment in static digital
scholarly editions</a>. This page is generated from the same engine that runs
the command line: <code>tools/build-browser.js</code>.</p>
<script>
'use strict';
/* ==== torchio engine (generated, do not edit) ==== */
${scriptSafe(engine)}

// ---- embedded base data and assets ----
const TORCHIO_BASE_DATA = { p5: ${scriptSafe(p5.trim())}, sections: ${scriptSafe(sections.trim())} };
const TORCHIO_LEAFLET_B64 = ${JSON.stringify(leaflet)};
/* ==== torchio harness ==== */
${scriptSafe(harness)}
</script>
</body>
</html>
`;

await mkdir(dirname(out), { recursive: true });
await writeFile(out, page);
console.error(`built: ${out} (${(page.length / 1024).toFixed(0)} KB, ${modules.length} modules)`);
