/**
 * Minimal Markdown for the editor's simple pages: headings, paragraphs,
 * emphasis (both * and _), links, images, lists, blockquotes, tables, fenced
 * code, horizontal rules, inline code. Prose, not an application, but enough
 * that pasting a real Markdown file renders as written. Input is escaped
 * first; the only HTML that comes out is the HTML we make.
 */

import { escapeHTML, safeURL } from './render.js';

const okURL = (href) => {
  const u = safeURL(href);
  return u && /^(https?:|\/|#|\.)/.test(u) ? escapeHTML(u) : null;
};

// A self-contained edition cannot fetch an external image: only a path that
// travels with the edition (a relative path into its own folder) is drawn.
// An external image URL becomes a link instead, never a silent load.
const localImg = (href) => {
  if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(href) || /^[a-z][a-z0-9+.-]*:/i.test(href)) return null;
  const u = safeURL(href);
  return u && !u.startsWith('/') ? escapeHTML(u) : null;
};

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`)
    // images before links: ![alt](url), but only local images are drawn
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, href) => {
      const local = localImg(href);
      if (local) return `<img src="${local}" alt="${alt}" loading="lazy">`;
      const u = okURL(href);
      return u ? `<a href="${u}">${alt || u}</a>` : m;
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, href) => {
      const u = okURL(href);
      return u ? `<a href="${u}">${text}</a>` : m;
    })
    // strong before emphasis; both asterisk and underscore
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // underscore emphasis only at word boundaries, so snake_case is left alone
    .replace(/(^|[^\w*`])_([^_]+)_(?![\w])/g, '$1<em>$2</em>');
}

export function markdown(src) {
  const lines = escapeHTML(src.replace(/\r\n/g, '\n')).split('\n');
  const out = [];
  let list = null; // 'ul' | 'ol'
  let para = [];
  let table = null; // rows of cells
  let code = null;  // collected lines while inside a ``` fence

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
    // fenced code: everything between ``` lines is literal (already escaped)
    if (code !== null) {
      if (/^\s*```/.test(raw)) { out.push(`<pre class="md-code"><code>${code.join('\n')}</code></pre>`); code = null; }
      else code.push(raw);
      continue;
    }
    if (/^\s*```/.test(raw)) { flushPara(); flushList(); flushTable(); code = []; continue; }

    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); flushList(); flushTable(); continue; }

    const tr = line.match(/^\|(.+)\|$/);
    if (tr) {
      flushPara(); flushList();
      table = table || [];
      table.push(tr[1].split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim()));
      continue;
    }
    flushTable();

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const ul = line.match(/^[-*]\s+(.*)$/);
    const ol = line.match(/^\d+\.\s+(.*)$/);
    const bq = line.match(/^>\s?(.*)$/);
    const hr = /^([-*_])\1{2,}$/.test(line.replace(/\s+/g, ''));
    if (h) {
      flushPara(); flushList();
      const lvl = Math.min(h[1].length + 1, 6);
      out.push(`<h${lvl} class="sec">${inline(h[2])}</h${lvl}>`);
    } else if (hr) {
      flushPara(); flushList();
      out.push('<hr>');
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
  if (code !== null) out.push(`<pre class="md-code"><code>${code.join('\n')}</code></pre>`);
  flushPara(); flushList(); flushTable();
  return out.join('\n');
}
