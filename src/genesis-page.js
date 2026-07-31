/**
 * The genetic apparatus: the page where the primary dimension is time, not
 * the witness. Campaigns of correction as the edition declares them, in the
 * order it declares them, each with the writing operations attributed to it,
 * and every operation linked to the place in the text where it happened.
 *
 * The tradition this answers to is Contini's and Isella's: an apparatus of
 * strata, not of variants between copies.
 */

import { escapeHTML } from './render.js';
import { chrome } from './page-shell.js';

export function pressGenesisPage({ model, pageFor, t, T, lang, theme, parent, pages }) {
  const G = model.genetic;
  let g = `<main id="main" class="torchio"><p class="occ">${T.genesisNote}</p>`;
  for (const s of G.strata) {
    const ops = G.operations.filter((o) => o.layer === s.id || (s.hand && o.hand === s.id));
    if (!ops.length) continue;
    g += `<section class="stratum"><h2 class="sec">${escapeHTML(s.label || s.id)}`
      + `${s.when ? ` <span class="occ">${escapeHTML(s.when)}</span>` : ''}`
      + `${s.hand ? ` <span class="occ">${escapeHTML(T.hand)}</span>` : ''}</h2>`
      + `<table class="wit-table">`;
    for (const o of ops) {
      g += `<tr><td class="sigla">${escapeHTML(o.element)}${o.place ? ` ${escapeHTML(o.place)}` : ''}</td>`
        + `<td><a href="${pageFor(o.id)}#${escapeHTML(o.id)}">${escapeHTML(o.text || '\u2014')}</a></td></tr>`;
    }
    g += `</table></section>`;
  }
  g += '</main>';
  return chrome({ title: t, sub: T.genesis.toLowerCase(), active: 'genesis.html', pages,
    body: g, t: T, lang, theme, parent });
}
