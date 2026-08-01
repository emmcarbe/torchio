#!/usr/bin/env node
/**
 * The harvester: fetches the TEI sources of the contrast corpus, so that the
 * measurement can be taken. It never redistributes them.
 *
 * What is published is the DATASET of results (corpus-results.csv), not the
 * editions: each stays under its own rights, at its own address. The files
 * land in data-local/corpus/<id>/, which the repository ignores.
 *
 * Input:  corpus-sources.csv  (id, source_kind, source_url, discovered_by,
 *         discovered_on) — where each edition's XML actually lives, since the
 *         catalogue records only the edition's home page.
 * Output: data-local/corpus/<id>/ plus data-local/corpus/harvest.json (what
 *         was fetched, when, how much, and what failed).
 *
 *   node tools/harvest.js [--only=12,34] [--delay=2000]
 *
 * Manners: one request at a time, a declared user agent, a pause between
 * hosts, and no attempt to work around anything that says no. An edition that
 * cannot be fetched politely is recorded as not fetched, which is itself a
 * result: it measures how reachable the field's sources are.
 */
import { readFile, writeFile, mkdir, stat, readdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const UA = 'torchio-harvester/0.2 (+https://github.com/emmcarbe/torchio; scholarly corpus measurement; contact via repository)';
const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'data-local', 'corpus');

const opt = (n, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : d;
};
const only = opt('only', null);
const delay = Number(opt('delay', 2000));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseCSV(text) {
  const rows = [];
  let cur = '', row = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift().map((h) => h.trim());
  return rows.filter((r) => r.some((c) => c.trim()))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}

async function fetchOnce(url, binary = false) {
  const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
}

/** A repository: a shallow clone, the way the platform expects to be asked
 *  (the API refuses anonymous archive downloads). One revision, no history. */
async function fromRepo(url, dir) {
  const clean = url.replace(/\/$/, '').replace(/\.git$/, '');
  await new Promise((res, rej) => {
    const p = spawn('git', ['clone', '--depth', '1', '--quiet', clean + '.git', dir],
      { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => code === 0 ? res() : rej(new Error(err.trim().slice(0, 120) || `git exit ${code}`)));
    p.on('error', rej);
  });
  let files = 0, bytes = 0;
  const walk = async (d, depth = 0) => {
    if (depth > 8) return;
    for (const e of await readdir(d, { withFileTypes: true })) {
      if (e.name === '.git') continue;
      const p2 = join(d, e.name);
      if (e.isDirectory()) await walk(p2, depth + 1);
      else { files++; bytes += (await stat(p2)).size; }
    }
  };
  await walk(dir);
  return { kind: 'repository', files, bytes, note: clean, license: null };
}

/** Zenodo: the deposit's files, through the public API. */
async function fromZenodo(url, dir) {
  const m = url.match(/zenodo\.org\/(?:record|records|doi\/10\.5281\/zenodo\.)([0-9]+)/i)
    || url.match(/10\.5281\/zenodo\.([0-9]+)/i);
  if (!m) throw new Error('no zenodo record id in url');
  const rec = JSON.parse(await fetchOnce(`https://zenodo.org/api/records/${m[1]}`));
  let n = 0, bytes = 0;
  for (const f of (rec.files || [])) {
    if (!/\.(xml|tei|odd|rng|zip|tar\.gz)$/i.test(f.key)) continue;
    const b = await fetchOnce(f.links.self, true);
    await writeFile(join(dir, f.key.replace(/[/\\]/g, '_')), b);
    n++; bytes += b.length;
    await sleep(delay);
  }
  return { kind: 'zenodo', files: n, bytes,
    note: `record ${m[1]}`, license: rec.metadata?.license?.id || null };
}

/** A direct link to one file, or to an archive. */
async function fromDirect(url, dir) {
  const bytes = await fetchOnce(url, true);
  const name = (url.split('/').pop() || 'source').split('?')[0] || 'source.xml';
  await writeFile(join(dir, name.replace(/[^\w.-]/g, '_')), bytes);
  return { kind: 'direct', files: 1, bytes: bytes.length, note: url, license: null };
}

const HANDLERS = { github: fromRepo, gitlab: fromRepo, zenodo: fromZenodo, direct: fromDirect };

async function main() {
  const sources = parseCSV(await readFile(join(ROOT, 'corpus-sources.csv'), 'utf-8'));
  const wanted = only ? new Set(only.split(',').map((s) => s.trim())) : null;
  await mkdir(OUT, { recursive: true });

  const log = [];
  for (const s of sources) {
    if (wanted && !wanted.has(s.id)) continue;
    const entry = { id: s.id, name: s.edition_name || '', source_kind: s.source_kind,
      source_url: s.source_url, fetched: false, files: 0, bytes: 0, note: '', error: null,
      fetched_on: new Date().toISOString().slice(0, 10) };
    if (!s.source_url || s.source_kind === 'none') {
      entry.error = 'no source location found';
      log.push(entry); continue;
    }
    const dir = join(OUT, s.id);
    try {
      if (s.source_kind === 'github' || s.source_kind === 'gitlab') { try { await rm(dir, { recursive: true, force: true }); } catch {} }
      else await mkdir(dir, { recursive: true });
      const h = HANDLERS[s.source_kind];
      if (!h) throw new Error(`unknown source kind: ${s.source_kind}`);
      const r = await h(s.source_url, dir);
      Object.assign(entry, { fetched: true, files: r.files, bytes: r.bytes,
        note: r.note, declared_license: r.license });
      console.error(`ok   ${s.id} ${s.edition_name || ''} (${r.files} files, ${(r.bytes / 1024).toFixed(0)} KB)`);
    } catch (err) {
      entry.error = err.message;
      console.error(`skip ${s.id} ${s.edition_name || ''}: ${err.message}`);
    }
    log.push(entry);
    await sleep(delay);
  }

  await writeFile(join(OUT, 'harvest.json'), JSON.stringify({
    harvested_on: new Date().toISOString(),
    harvester: 'tools/harvest.js',
    note: 'The fetched sources are NOT redistributed: each edition stays under its own rights, at its own address. Only the results dataset is published.',
    entries: log,
  }, null, 1) + '\n');
  const ok = log.filter((e) => e.fetched).length;
  console.error(`\nharvested ${ok} of ${log.length} · data-local/corpus/harvest.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
