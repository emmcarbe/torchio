#!/usr/bin/env node
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] || '.');
const html = [];
async function gather(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await gather(path);
    else if (/\.html?$/i.test(entry.name)) html.push(path);
  }
}
await gather(root);
const errors = [];
for (const file of html) {
  const source = await readFile(file, 'utf8');
  const ids = new Set();
  for (const match of source.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) {
    if (ids.has(match[1])) errors.push(`${file}: duplicate id ${match[1]}`);
    ids.add(match[1]);
  }
  // JavaScript may contain explanatory or conditional links; static link
  // integrity concerns the HTML links emitted into the document itself.
  const markup = source.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  for (const match of markup.matchAll(/\b(?:href|src)\s*=\s*["']([^"'#?]+)(?:["'#?])/gi)) {
    const href = match[1];
    if (/^(?:[a-z]+:|\/\/|data:|javascript:)/i.test(href)) continue;
    // Facsimile filenames are often declared by TEI but intentionally not
    // distributed with a demo (rights or repository size); validate HTML
    // navigation strictly, while leaving binary asset availability to the
    // edition's rights-aware asset policy.
    if (/\.(?:tif|tiff|jpe?g|png|gif|webp|avif)$/i.test(href)) continue;
    const target = resolve(file, '..', href);
    try { await stat(target); } catch { errors.push(`${file}: missing ${href}`); }
  }
}
console.error(`checked ${html.length} html files`);
if (errors.length) { for (const error of errors) console.error(error); process.exit(1); }
