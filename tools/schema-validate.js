#!/usr/bin/env node
/**
 * External schema gate. libxml2's xmllint is deliberately used here rather
 * than reimplementing Relax NG or Schematron in JavaScript.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);

export async function validateFiles(files, { rng = null, schematron = null } = {}) {
  if (!rng && !schematron) return { results: [], errors: [] };
  try { await access(resolve(rng || schematron)); }
  catch { return { results: [], errors: [`schema not found: ${rng || schematron}`] }; }
  const results = [];
  for (const file of files) {
    for (const [kind, schema, flag] of [['RNG', rng, '--relaxng'], ['Schematron', schematron, '--schematron']]) {
      if (!schema) continue;
      try {
        await run('xmllint', ['--noout', '--xinclude', flag, resolve(schema), resolve(file)]);
        results.push({ file, kind, valid: true, detail: '' });
      } catch (err) {
        results.push({ file, kind, valid: false,
          detail: String(err.stderr || err.stdout || err.message || err).trim() });
      }
    }
  }
  return { results, errors: results.filter((r) => !r.valid) };
}

async function gather(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const file = join(dir, entry.name);
    if (entry.isDirectory()) await gather(file, out);
    else if (/\.(xml|tei)$/i.test(entry.name)) out.push(file);
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = process.argv.find((a) => !a.startsWith('--') && a !== process.argv[0] && a !== process.argv[1]);
  const rngArg = process.argv.find((a) => a.startsWith('--rng='));
  const schArg = process.argv.find((a) => a.startsWith('--schematron='));
  if (!input || (!rngArg && !schArg)) {
    console.error('usage: node tools/schema-validate.js [--rng=file.rng] [--schematron=file.sch] <tei-file-or-directory>');
    process.exit(2);
  }
  const files = (await stat(input)).isDirectory() ? await gather(input) : [input];
  const report = await validateFiles(files, {
    rng: rngArg?.slice(6), schematron: schArg?.slice(13),
  });
  for (const row of report.results) console.error(`${row.valid ? 'valid' : 'INVALID'} ${row.kind} ${row.file}${row.detail ? `\n${row.detail}` : ''}`);
  if (report.errors.length) process.exit(1);
}
