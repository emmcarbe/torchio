/**
 * Minimal Markdown for the editor's simple pages: headings, paragraphs,
 * emphasis, links, lists, blockquotes, inline code. Nothing more on purpose:
 * a simple page is prose, not an application. Input is escaped first; the
 * only HTML that comes out is the HTML we make.
 */

import { escapeHTML, safeURL } from './render.js';

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, href) => {
      const u = safeURL(href);
      return u && /^(https?:|\/|#|\.)/.test(u) ? `<a href="${escapeHTML(u)}">${text}</a>` : m;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

export function markdown(src) {
  const lines = escapeHTML(src.replace(/\r\n/g, '\n')).split('\n');
  const out = [];
  let list = null; // 'ul' | 'ol'
  let para = [];
  let table = null; // rows of cells

  const flushPara = () => {
    if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
  };
  const flushList = () => {
    if (list) { out.push(`</${list}>`); list = null; }
  };
  const flushTable = () => {
    if (!table) return;
    let head = null, body = table;
    if (table.length > 1 && table[1].every((c) => /^:?-{3,}:?$/.test(c))) {
      head = table[0]; body = table.slice(2);
    }
    let html = '<table class="wit-table md-table">';
    if (head) html += '<thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead>';
    html += '<tbody>' + body.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
    out.push(html);
    table = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const ul = line.match(/^[-*]\s+(.*)$/);
    const ol = line.match(/^\d+\.\s+(.*)$/);
    const bq = line.match(/^>\s?(.*)$/);
    if (!line.trim()) { flushPara(); flushList(); flushTable(); continue; }
    const tr = line.match(/^\|(.+)\|$/);
    if (tr) {
      flushPara(); flushList();
      table = table || [];
      table.push(tr[1].split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim()));
      continue;
    }
    flushTable();
    if (h) {
      flushPara(); flushList();
      out.push(`<h${h[1].length + 1} class="sec">${inline(h[2])}</h${h[1].length + 1}>`);
    } else if (ul || ol) {
      flushPara();
      const kind = ul ? 'ul' : 'ol';
      if (list !== kind) { flushList(); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline((ul || ol)[1])}</li>`);
    } else if (bq) {
      flushPara(); flushList();
      out.push(`<blockquote>${inline(bq[1])}</blockquote>`);
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara(); flushList(); flushTable();
  return out.join('\n');
}
