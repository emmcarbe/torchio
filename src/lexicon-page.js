/**
 * The lexicon page: the raw lexical layer of the text. The editor (or the
 * reader) chooses what to see (frequencies, concordance, cloud), searches,
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
  views = { freq: true, conc: true, cloud: true } }) {
  const L = model.lexicon;
  const multi = (L.languages || []).length > 1;
  const chosen = ['freq', 'conc', 'cloud'].filter((v) => views[v]);
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
    + `<input class="lx-search" type="search" placeholder="${T.lexSearch}" aria-label="${T.lexSearch}">`
    + langFilter + stopSel
    + `<label class="lx-ctl"><input type="checkbox" class="lx-hidestop"> ${T.lexHideStop}</label>`
    + (chosen.length > 1 ? `<span class="lx-views" role="group">`
      + (views.freq ? `<button data-view="freq"${first === 'freq' ? ' class="active"' : ''}>${T.lexFrequencies}</button>` : '')
      + (views.conc ? `<button data-view="conc"${first === 'conc' ? ' class="active"' : ''}>${T.lexConcordance}</button>` : '')
      + (views.cloud ? `<button data-view="cloud"${first === 'cloud' ? ' class="active"' : ''}>${T.lexCloud}</button>` : '')
      + `</span>` : '') + `</div>`
    + (views.freq ? `<section class="lx-view lx-freq"${first === 'freq' ? '' : ' hidden'}><table class="lx-table"><thead><tr>`
    + `<th>${T.lexWord}</th>${multi ? `<th>${T.lexLang}</th>` : ''}`
    + `<th class="lx-num">${T.lexAbs}</th><th class="lx-num">${T.lexRel}</th>`
    + `<th class="lx-num">${T.lexStopCol}</th></tr></thead><tbody></tbody></table></section>` : '')
    + (views.conc ? `<section class="lx-view lx-conc"${first === 'conc' ? '' : ' hidden'}><p class="occ">${T.lexPick}</p><div class="lx-conc-out"></div></section>` : '')
    + (views.cloud ? `<section class="lx-view lx-cloud"${first === 'cloud' ? '' : ' hidden'}></section>` : '')
    + `</main>`;

  const conc = {};
  for (const [form, occ] of Object.entries(L.concordance)) {
    conc[form] = occ.map((o) => ({ b: o.before, k: o.form, a: o.after, href: `${pageFor(o.anchor)}#${o.anchor}` }));
  }

  const script = `
(function(){
  var FREQ=${jsonForScript(L.frequencies)};
  var CONC=${jsonForScript(conc)};
  var STOP=${jsonForScript(STOPWORDS)};
  var MULTI=${multi ? 'true' : 'false'};
  var main=document.querySelector('main.lexicon');
  var tbody=main.querySelector('.lx-freq tbody');
  var cloud=main.querySelector('.lx-cloud');
  var search=main.querySelector('.lx-search');
  var langsel=main.querySelector('.lx-langsel');
  var stopsel=main.querySelector('.lx-stopsel');
  var hidestop=main.querySelector('.lx-hidestop');
  var manual={}; // words the reader flipped by hand: form -> true(stop)/false(kept)
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function isStop(f){
    if(f.form in manual)return manual[f.form];
    var list=STOP[stopsel.value]; if(!list)return false;
    return list.indexOf(f.form)>-1;
  }
  function visible(f){
    var q=search.value.trim().toLowerCase();
    if(q&&f.form.indexOf(q)===-1)return false;
    if(langsel&&langsel.value&&f.lang!==langsel.value)return false;
    if(hidestop.checked&&isStop(f))return false;
    return true;
  }
  function render(){
    var rows=FREQ.filter(visible);
    if(tbody)tbody.innerHTML=rows.slice(0,1500).map(function(f){
      return '<tr data-form="'+esc(f.form)+'"'+(isStop(f)?' class="is-stop"':'')+'>'
        +'<td class="lx-w">'+esc(f.form)+'</td>'
        +(MULTI?'<td class="lx-lang">'+esc(f.lang||'')+'</td>':'')
        +'<td class="lx-num">'+f.count+'</td>'
        +'<td class="lx-num lx-rel">'+f.rel.toFixed(3)+'\\u2030</td>'
        +'<td class="lx-num"><button class="lx-flip" title="'+(isStop(f)?'\\u2212':'+')+'">'+(isStop(f)?'\\u25CF':'\\u25CB')+'</button></td>'
        +'</tr>';
    }).join('');
    var content=rows.filter(function(f){return !isStop(f);});
    var top=content.slice(0,90);
    var cmax=top.length?top[0].count:1, cmin=top.length?top[top.length-1].count:1;
    var span=(Math.log(cmax)-Math.log(cmin))||1;
    if(cloud)cloud.innerHTML=top.map(function(f){
      var sz=14+Math.round((Math.log(f.count)-Math.log(cmin))/span*34);
      return '<span class="lx-cloud-w" data-form="'+esc(f.form)+'" style="font-size:'+sz+'px" title="'+f.count+' ('+f.rel.toFixed(2)+'\\u2030)">'+esc(f.form)+'</span>';
    }).join(' ');
  }
  function show(v){
    main.querySelectorAll('.lx-view').forEach(function(s){s.hidden=!s.classList.contains('lx-'+v);});
    main.querySelectorAll('.lx-views button').forEach(function(b){b.classList.toggle('active',b.dataset.view===v);});
  }
  main.querySelectorAll('.lx-views button').forEach(function(b){b.addEventListener('click',function(){show(b.dataset.view);});});
  function concord(form){
    var out=main.querySelector('.lx-conc-out');
    if(!out)return;
    var occ=CONC[form.toLowerCase()]||[];
    out.innerHTML=occ.length?'<table class="lx-kwic"><tbody>'+occ.map(function(o){
      return '<tr><td class="lx-b">'+esc(o.b)+'</td><td class="lx-k"><a href="'+o.href+'">'+esc(o.k)+'</a></td><td class="lx-a">'+esc(o.a)+'</td></tr>';
    }).join('')+'</tbody></table>':'<p class="occ">\\u2014</p>';
  }
  main.addEventListener('click',function(e){
    var flip=e.target.closest('.lx-flip');
    if(flip){var row=flip.closest('[data-form]');var form=row.getAttribute('data-form');
      var f=FREQ.find(function(x){return x.form===form;});manual[form]=!isStop(f);render();e.stopPropagation();return;}
    var w=e.target.closest('[data-form]');
    if(w){search.value=w.getAttribute('data-form');concord(w.getAttribute('data-form'));if(main.querySelector('.lx-conc'))show('conc');}
  });
  var timer;
  search.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(function(){render();var q=search.value.trim().toLowerCase();if(q&&CONC[q])concord(q);},120);});
  if(langsel)langsel.addEventListener('change',render);
  stopsel.addEventListener('change',render);
  hidestop.addEventListener('change',render);
  render();
})();`;

  return chrome({ title: t, sub: T.lexicon.toLowerCase(), active: 'lexicon.html', pages,
    body, script, t: T, lang, theme, parent });
}
