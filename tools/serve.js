#!/usr/bin/env node
/** Tiny static server for local demo previews. Usage: node tools/serve.js [dir] [port] */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';

const dir = process.argv[2] || 'docs';
const port = Number(process.argv[3] || 8123);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.json': 'application/json',
  '.csv': 'text/csv; charset=utf-8', '.xml': 'application/xml',
  '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(dir, path));
    if (!file.startsWith(normalize(dir))) throw new Error('forbidden');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(port, () => console.log(`serving ${dir} on http://localhost:${port}`));
