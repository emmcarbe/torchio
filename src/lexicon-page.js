/**
 * The lexicon page: the raw lexical layer of the text. The editor (or the
 * reader) chooses what to see (frequencies, concordance), searches,
 * filters by language, and decides which stopword list applies and which
 * single words count as stopwords. Nothing is imposed: not every tradition
 * has stopwords, and when no language is declared none is applied until one
 * is chosen here.
 *
 * Computed at press time, drawn without a library: the page survives its own
 * scripts and outlives any server, unlike a hosted analysis tool.
 */

import { escapeHTML } from './render.js';
import { chrome, jsonForScript } from './page-shell.js';
import { STOPWORDS, STOPWORD_NAMES } from './lemmas.js';

export function pressLexiconPage({ model, pageFor, t, T, lang, theme, parent, pages,
  active = 'lexicon.html', subnav = '', views = { freq: true, conc: true } }) {
  const L = model.lexicon;
  const multi = (L.languages || []).length > 1;
  const chosen = ['freq', 'conc'].filter((v) => views[v]);
  const first = chosen[0] || 'freq';

  const langFilter = multi
    ? `<label class="lx-ctl">${T.lexLanguage} <select class="lx-langsel"><option value="">${T.lexAllLangs}</option>`
      + L.languages.map((l) => `<option value="${escapeHTML(l)}">${escapeHTML(l)}</option>`).join('')
      + `</select></label>`
    : '';
  // which stopword list to apply, defaulting to the edition's own language
  const stopChoices = Object.keys(STOPWORDS);
  const defaultStop = L.languages.find((l) => STOPWORDS[l]) || '';
  const stopSel = `<label class="lx-ctl">${T.lexStoplist} <select class="lx-stopsel">`
    + `<option value="">${T.lexStopNone}</option>`
    + stopChoices.map((l) => `<option value="${escapeHTML(l)}"${l === defaultStop ? ' selected' : ''}>${escapeHTML(STOPWORD_NAMES[l] || l)}</option>`).join('')
    + `</select></label>`;

  const body = `<main id="main" class="torchio lexicon">`
    + `<p class="occ"><b>${L.total}</b> ${T.lexTokens} · <b>${L.distinct}</b> ${T.lexForms} · `
    + `${T.lexTTR} <b>${L.ttr}</b></p>`
    + `<div class="lx-bar-top">`
    + `<input class="lx-search" type="search" placeholder="${T.lexSearch}" aria-label="${T.lexSearch}"/>`
    + langFilter + stopSel
    + `<label class="lx-ctl"><input type="checkbox" class="lx-hidestop"/> ${T.lexHideStop}</label>`
    + (chosen.length > 1 ? `<span class="lx-views" role="group">`
      + (views.freq ? `<button data-view="freq"${first === 'freq' ? ' class="active"' : ''}>${T.lexFrequencies}</button>` : '')
      + (views.conc ? `<button data-view="conc"${first === 'conc' ? ' class="active"' : ''}>${T.lexConcordance}</button>` : '')
      + `</span>` : '') + `</div>`
    + (views.freq ? `<section class="lx-view lx-freq"${first === 'freq' ? '' : ' hidden'}><table class="lx-table"><thead><tr>`
    + `<th class="lx-sort" data-sort="form">${T.lexWord} <span class="lx-arr"></span></th>${multi ? `<th>${T.lexLang}</th>` : ''}`
    + `<th class="lx-num lx-sort" data-sort="count">${T.lexAbs} <span class="lx-arr"></span></th>`
    + `<th class="lx-num lx-sort" data-sort="rel">${T.lexRel} <span class="lx-arr"></span></th>`
    + `<th class="lx-num">${T.lexStopCol}</th></tr></thead><tbody>${
      // the rows live in the markup: a page whose content exists only inside a
      // script is a page that says nothing when the script does not run, and
      // this one is the lexicon of an edition, not an application
      L.frequencies.slice(0, 1500).map((f) => `<tr data-form="${escapeHTML(f.form)}"`
        + `${f.lang ? ` data-lang="${escapeHTML(f.lang)}"` : ''}${f.stop ? ' class="is-stop"' : ''}>`
        + `<td class="lx-w">${escapeHTML(f.form)}</td>`
        + (multi ? `<td class="lx-lang">${escapeHTML(f.lang || '')}</td>` : '')
        + `<td class="lx-num">${f.count}</td>`
        + `<td class="lx-num lx-rel">${f.rel.toFixed(3)}\u2030</td>`
        + `<td class="lx-num"><button class="lx-flip">${f.stop ? '\u25CF' : '\u25CB'}</button></td>`
        + `</tr>`).join('')
    }</tbody></table>${L.frequencies.length > 1500
      ? `<p class="occ">${L.frequencies.length - 1500} ${T.lexMoreForms || 'more forms in the data export'}</p>` : ''}</section>` : '')
    + (views.conc ? `<section class="lx-view lx-conc"${first === 'conc' ? '' : ' hidden'}>`
      + `<nav class="lx-alpha alpha" aria-label="A-Z"></nav><div class="lx-conc-out"></div></section>` : '')
    + `</main>`;

  // the concordance is computed in the browser over the WHOLE token stream, so
  // every form is findable — a hapax as much as a frequent word — and the text
  // is never cut to a top-N. To keep it compact the stream is dictionary-coded:
  // each token is [formIndex, hrefIndex, docIndex], and forms, hrefs (anchors
  // deduplicated, since many tokens share a line) and docs are listed once
  const formIdx = new Map(); const formList = [];
  const hrefIdx = new Map(); const hrefs = [];
  const docIdx = new Map();
  const stream = (model.tokens || []).map((tok) => {
    let fi = formIdx.get(tok.form);
    if (fi === undefined) { fi = formList.length; formList.push(tok.form); formIdx.set(tok.form, fi); }
    let hi = hrefIdx.get(tok.anchor);
    if (hi === undefined) { hi = hrefs.length; hrefs.push(`${pageFor(tok.anchor)}#${tok.anchor}`); hrefIdx.set(tok.anchor, hi); }
    let di = docIdx.get(tok.docId);
    if (di === undefined) { di = docIdx.size; docIdx.set(tok.docId, di); }
    return [fi, hi, di];
  });

  const script = `
(function(){
  var FREQ=${jsonForScript(L.frequencies)};
  var STREAM=${jsonForScript(stream)};
  var FORMS=${jsonForScript(formList)};
  var HREFS=${jsonForScript(hrefs)};
  var STOP=${jsonForScript(STOPWORDS)};
  var MULTI=${multi ? 'true' : 'false'};
  var KWIC=6, MAXROWS=300;
  var main=document.querySelector('main.lexicon');
  var tbody=main.querySelector('.lx-freq tbody');
  var search=main.querySelector('.lx-search');
  var langsel=main.querySelector('.lx-langsel');
  var stopsel=main.querySelector('.lx-stopsel');
  var hidestop=main.querySelector('.lx-hidestop');
  var manual={}; // words the reader flipped by hand: form -> true(stop)/false(kept)
  var sortKey='count', sortDir=-1; // default: most frequent first
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function isStop(f){
    if(f.form in manual)return manual[f.form];
    var list=STOP[stopsel.value]; if(!list)return false;
    return list.indexOf(f.form)>-1;
  }
  function visible(f){
    var q=search.value.trim().toLowerCase();
    if(q&&f.form.toLowerCase().indexOf(q)===-1)return false;
    if(langsel&&langsel.value&&f.lang!==langsel.value)return false;
    if(hidestop.checked&&isStop(f))return false;
    return true;
  }
  function sortRows(rows){return rows.slice().sort(function(a,b){
    if(sortKey==='form'){var x=a.form.toLowerCase(),y=b.form.toLowerCase();return x<y?-sortDir:x>y?sortDir:0;}
    return (a[sortKey]-b[sortKey])*sortDir||a.form.localeCompare(b.form);
  });}
  function arrows(){main.querySelectorAll('.lx-sort').forEach(function(th){
    var k=th.getAttribute('data-sort');
    th.querySelector('.lx-arr').textContent=k===sortKey?(sortDir<0?'\\u25BC':'\\u25B2'):'';
    th.classList.toggle('on',k===sortKey);
  });}
  function render(){
    var rows=sortRows(FREQ.filter(visible));
    if(tbody)tbody.innerHTML=rows.slice(0,1500).map(function(f){
      return '<tr data-form="'+esc(f.form)+'"'+(isStop(f)?' class="is-stop"':'')+'>'
        +'<td class="lx-w">'+esc(f.form)+'</td>'
        +(MULTI?'<td class="lx-lang">'+esc(f.lang||'')+'</td>':'')
        +'<td class="lx-num">'+f.count+'</td>'
        +'<td class="lx-num lx-rel">'+f.rel.toFixed(3)+'\\u2030</td>'
        +'<td class="lx-num"><button class="lx-flip" title="'+(isStop(f)?'\\u2212':'+')+'">'+(isStop(f)?'\\u25CF':'\\u25CB')+'</button></td>'
        +'</tr>';
    }).join('');
    arrows();
  }
  // the concordance over the WHOLE stream: every form, every occurrence, the
  // before/after taken from the adjacent tokens of the same document
  function kwic(word){
    var w=word.toLowerCase(), rows=[], total=0;
    for(var i=0;i<STREAM.length;i++){
      if(FORMS[STREAM[i][0]].toLowerCase()!==w)continue;
      total++;
      if(rows.length>=MAXROWS)continue;
      var d=STREAM[i][2],b=[],a=[];
      for(var j=i-1;j>=0&&b.length<KWIC&&STREAM[j][2]===d;j--)b.unshift(FORMS[STREAM[j][0]]);
      for(var k=i+1;k<STREAM.length&&a.length<KWIC&&STREAM[k][2]===d;k++)a.push(FORMS[STREAM[k][0]]);
      rows.push({b:b.join(' '),k:FORMS[STREAM[i][0]],a:a.join(' '),href:HREFS[STREAM[i][1]]});
    }
    return {rows:rows,total:total};
  }
  function concord(form){
    var out=main.querySelector('.lx-conc-out'); if(!out)return;
    var r=kwic(form);
    if(!r.total){out.innerHTML='<p class="occ">'+esc(form)+' \\u2014</p>';return;}
    var head='<p class="occ"><b>'+esc(form)+'</b> \\u00b7 '+r.total
      +(r.total>r.rows.length?' ('+r.rows.length+' shown)':'')+'</p>';
    out.innerHTML=head+'<table class="lx-kwic"><tbody>'+r.rows.map(function(o){
      return '<tr><td class="lx-b">'+esc(o.b)+'</td><td class="lx-k"><a href="'+o.href+'">'+esc(o.k)+'</a></td><td class="lx-a">'+esc(o.a)+'</td></tr>';
    }).join('')+'</tbody></table>';
  }
  function show(v){
    main.querySelectorAll('.lx-view').forEach(function(s){s.hidden=!s.classList.contains('lx-'+v);});
    main.querySelectorAll('.lx-views button').forEach(function(b){b.classList.toggle('active',b.dataset.view===v);});
  }
  main.querySelectorAll('.lx-views button').forEach(function(b){b.addEventListener('click',function(){show(b.dataset.view);});});
  main.querySelectorAll('.lx-sort').forEach(function(th){th.addEventListener('click',function(){
    var k=th.getAttribute('data-sort');
    if(k===sortKey)sortDir=-sortDir; else {sortKey=k;sortDir=(k==='form')?1:-1;}
    render();
  });});
  main.addEventListener('click',function(e){
    var flip=e.target.closest('.lx-flip');
    if(flip){var row=flip.closest('[data-form]');var form=row.getAttribute('data-form');
      var f=FREQ.find(function(x){return x.form===form;});manual[form]=!isStop(f);render();e.stopPropagation();return;}
    var w=e.target.closest('[data-form]');
    if(w){concord(w.getAttribute('data-form'));if(main.querySelector('.lx-conc'))show('conc');}
  });
  // a red alphabet in the concordance: pick a letter, see the first form under it
  var alpha=main.querySelector('.lx-alpha');
  if(alpha){
    var firstOf={};
    FREQ.forEach(function(f){var L=(f.form[0]||'').toUpperCase();if(L&&!(L in firstOf))firstOf[L]=f.form;});
    alpha.innerHTML=Object.keys(firstOf).sort().map(function(L){return '<a href="#" data-letter="'+esc(L)+'">'+esc(L)+'</a>';}).join('');
    alpha.addEventListener('click',function(e){var a=e.target.closest('[data-letter]');if(a){e.preventDefault();concord(firstOf[a.getAttribute('data-letter')]);}});
  }
  var timer;
  search.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(function(){render();var q=search.value.trim().toLowerCase();if(q)concord(q);},150);});
  if(langsel)langsel.addEventListener('change',render);
  stopsel.addEventListener('change',render);
  hidestop.addEventListener('change',render);
  render();
  // the concordance is not empty on arrival: the first content word is shown
  (function(){var f=FREQ.filter(function(x){return !isStop(x);})[0]||FREQ[0];if(f)concord(f.form);})();
})();`;

  return chrome({ title: t, sub: T.lexicon.toLowerCase(), active, subnav, pages,
    body, script, t: T, lang, theme, parent });
}
