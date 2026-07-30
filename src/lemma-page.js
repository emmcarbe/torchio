/**
 * The lemma page: concordances and frequencies, where an edition has lemmas.
 * Forms are what every written tradition has; grouping them under a lemma is
 * a decision the edition declares (principle 11), so this page exists only
 * when that decision has been made, and it says where each grouping comes
 * from.
 *
 * Split out of site.js, byte for byte.
 */

import { escapeHTML } from './render.js';
import { chrome } from './page-shell.js';

export function pressLemmaPage({ model, pageFor, t, T, lang, theme, parent, pages }) {
    const L = model.lemmas;
    const KWIC_MAX = 30;
    const prov = [];
    if (L.provenance.markup) prov.push(`${L.provenance.markup} ${T.lemmaFromMarkup}`);
    if (L.provenance.file) {
      prov.push(`${L.provenance.file} ${T.lemmaFromFile}${L.generator ? ` (${escapeHTML(L.generator)})` : ''}`);
    }
    const pendingN = L.pending.suggested + L.pending.review;
    // a multilingual edition (xml:lang in the markup) declares its coverage
    // per language and groups the index accordingly
    const langsWithTokens = (L.languages || []).filter((s) => s.tokens > 0);
    const multilingual = langsWithTokens.length > 1;
    const coverage = multilingual
      ? langsWithTokens.map((s) => `${s.lang || '?'}: ${s.lemmatized}/${s.tokens}`).join(' · ')
      : `${L.lemmatized} / ${L.tokens}`;
    let lem = '<main id="main" class="torchio">'
      + `<p class="lem-note">${T.lemmaCoverage}: ${coverage} ${T.tokensWord} · ${prov.join(' · ')}`
      + (pendingN ? ` · ${pendingN} ${T.lemmaPending}` : '') + '</p>'
      + `<input class="reg-filter lem-filter" type="search" placeholder="${T.filter}"`
      + ` aria-label="${T.filter}"> <span class="reg-count">${L.entries.length}</span>`;
    let currentLang = null;
    for (const e of L.entries) {
      if (multilingual && e.lang !== currentLang) {
        currentLang = e.lang;
        lem += `<h2 class="sec">${escapeHTML(e.lang || '?')}</h2>`;
      }
      const forms = e.forms.map(([f, n]) => `${escapeHTML(f)} (${n})`).join(', ');
      const search = escapeHTML((e.lemma + ' ' + e.forms.map(([f]) => f).join(' ')).toLowerCase());
      lem += `<details class="lemma" data-search="${search}">`
        + `<summary><b>${escapeHTML(e.lemma)}</b> <span class="reg-count">${e.count}</span>`
        + ` <span class="lem-forms">${forms}</span></summary>`
        + '<table class="wit-table kwic">';
      for (const o of e.occurrences.slice(0, KWIC_MAX)) {
        lem += `<tr><td class="kb">${escapeHTML(o.before)}</td>`
          + `<td class="kf"><a href="${pageFor(o.anchor)}#${escapeHTML(o.anchor)}">${escapeHTML(o.form)}</a></td>`
          + `<td class="ka">${escapeHTML(o.after)}</td></tr>`;
      }
      lem += '</table>';
      if (e.occurrences.length > KWIC_MAX) {
        lem += `<p class="lem-note">${e.occurrences.length - KWIC_MAX} ${T.moreOccurrences}</p>`;
      }
      lem += '</details>';
    }
    lem += '</main>';
    const lemmaJS = `
(function(){
  var input=document.querySelector('.lem-filter');
  var items=[].slice.call(document.querySelectorAll('details.lemma'));
  var count=document.querySelector('.reg-count');
  if(!input)return;
  input.addEventListener('input',function(){
    var q=input.value.toLowerCase();var n=0;
    items.forEach(function(d){var hit=!q||d.getAttribute('data-search').indexOf(q)>-1;
      d.style.display=hit?'':'none';if(hit)n++;});
    if(count)count.textContent=n;
  });
})();`;
    return chrome({ title: t, sub: T.lemmas.toLowerCase(), active: 'lemmas.html', pages, body: lem, script: lemmaJS, t: T, lang, theme, parent });
}
