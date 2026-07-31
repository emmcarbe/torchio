/**
 * The register of a collection: one row per document, and a column only
 * where the markup fills it. A correspondence shows sender and recipient,
 * an archive shows author and date, a tradition shows its witnesses: the
 * shape comes from the cards, not from a template.
 *
 * Split out of site.js, byte for byte.
 */

import { escapeHTML } from './render.js';
import { chrome } from './page-shell.js';

export function pressRegister({ model, docFiles, isApparatusDoc, manifest, t, T, lang, theme, parent, pages, wanted }) {
  const out = {};
    // the register: columns exist only if the markup populates them
    const cards = model.documents.map((d) => d.card || { id: d.id });
    const has = {
      date: cards.some((c) => c.date),
      from: cards.some((c) => c.from && c.from.length),
      to: cards.some((c) => c.to && c.to.length),
      author: cards.some((c) => c.author),
      place: cards.some((c) => c.place),
      idno: cards.some((c) => c.idno),
    };
    // two shapes of register, decided by the majority of the markup: a
    // correspondence reads from-to-date, an archive of works reads
    // author-title-year; the manifest chooses otherwise when it wants
    const COL_LABELS = {
      date: T.dateCol, title: T.titleCol, from: T.fromCol, to: T.toCol,
      author: T.authorCol, place: T.placeCol, idno: T.idnoCol,
    };
    const corr = cards.filter((c) => c.from && c.from.length).length
      > cards.filter((c) => c.author).length;
    let colKeys = corr
      ? ['date', 'title', 'from', 'to', 'place', 'idno']
      : ['author', 'title', 'date', 'place', 'idno'];
    if (manifest.register && manifest.register.columns && manifest.register.columns.length) {
      colKeys = manifest.register.columns;
      // the title column is the way into the documents: it always stays
      if (!colKeys.includes('title')) colKeys = ['title', ...colKeys];
    }
    const cols = colKeys
      .filter((k) => k === 'title' || has[k])
      .map((k) => [k, COL_LABELS[k]]);
    let reg = `<main id="main" class="torchio" style="max-width:64rem">`
      + `<input class="reg-filter" type="search" placeholder="${T.filter}" aria-label="${T.filter}"/>`
      + `<span class="reg-count">${model.documents.filter((d) => !isApparatusDoc(d)).length} ${T.documentsN}</span>`
      + `<table class="reg-table idx-table"><thead><tr>`
      + cols.map(([, label]) => `<th scope="col">${escapeHTML(label)}</th>`).join('')
      + `</tr></thead><tbody>`;
    const textDocs = model.documents.filter((d) => !isApparatusDoc(d));
    const appDocs = model.documents.filter((d) => isApparatusDoc(d));
    for (const d of textDocs) {
      const c = d.card || {};
      const cells = cols.map(([key]) => {
        if (key === 'title') {
          return `<td><a href="${docFiles.get(d.id)}">${escapeHTML(c.title || d.id)}</a></td>`;
        }
        if (key === 'date') {
          return `<td class="occ" data-k="${escapeHTML(c.date?.when || '9999')}">${escapeHTML(c.date?.text || c.date?.when || '')}</td>`;
        }
        const v = key === 'from' || key === 'to' ? (c[key] || []).join('; ') : (c[key] || '');
        return `<td>${escapeHTML(String(v))}</td>`;
      }).join('');
      const search = [c.title, c.date?.text, c.date?.when, ...(c.from || []), ...(c.to || []), c.author, c.place, c.idno]
        .filter(Boolean).join(' ').toLowerCase();
      reg += `<tr data-search="${escapeHTML(search)}">${cells}</tr>`;
    }
    reg += '</tbody></table></main>';
    if (appDocs.length && wanted.has('apparatus')) {
      let ap = `<main id="main" class="torchio"><table class="wit-table">`;
      for (const d of appDocs) {
        ap += `<tr><td><a href="${docFiles.get(d.id)}">${escapeHTML((d.card && d.card.title) || d.id)}</a></td></tr>`;
      }
      ap += '</table></main>';
      out.apparatusPage = chrome({
        title: t, sub: T.apparatus.toLowerCase(), active: 'apparatus.html', pages,
        body: ap, t: T, lang, theme, parent,
      });
    }
  return { reg, appDocs, textDocs, apparatusPage: out.apparatusPage };
}
