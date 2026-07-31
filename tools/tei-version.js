#!/usr/bin/env node
/**
 * Which release of the Guidelines this repository was built from, and which
 * one the TEI Consortium publishes today. Two lines on stdout:
 *
 *   local=4.12.0
 *   remote=4.13.0
 *
 * Used by .github/workflows/tei-watch.yml, and runnable by hand, which is the
 * point: a check that only exists inside a workflow is a check nobody can try.
 *
 *   node tools/tei-version.js
 *   node tools/tei-version.js --local-only   (no network)
 */
import { readFile } from 'node:fs/promises';

const versionIn = (s) => {
  const m = String(s || '').match(/(\d+\.\d+(?:\.\d+)?)/);
  return m ? m[1] : '';
};

const local = versionIn(JSON.parse(
  await readFile(new URL('../data/p5-classes.json', import.meta.url), 'utf-8')).version);
console.log(`local=${local || 'unknown'}`);

if (process.argv.includes('--local-only')) process.exit(0);

let remote = '';
try {
  const res = await fetch('https://api.github.com/repos/TEIC/TEI/releases/latest', {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'torchio-tei-watch' },
    signal: AbortSignal.timeout(20000),
  });
  if (res.ok) remote = versionIn((await res.json()).tag_name);
} catch (err) {
  // a release check that fails must not fail the build: it reports nothing
  console.error(`tei-watch: could not reach the TEI Consortium (${err.message})`);
}
console.log(`remote=${remote}`);
