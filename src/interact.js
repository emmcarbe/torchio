/**
 * The first intelligent pieces, as reader-side enhancements over the base
 * rendering. Everything is derived from the DOM the base renderer produced
 * (elements, sections, data-* attributes): no duplicated model, no server,
 * no dependencies. If JavaScript is off, the base rendering stands untouched:
 * rung 1 is never conditional.
 *
 * Pieces in v0:
 *   - apparatus: the lemma pops its readings with witness sigla
 *   - entities: names pop a card with reference and occurrence count
 *   - transcription levels: reading / diplomatic toggle (choice pairs, del/add)
 */

export const interactCSS = `
.torchio-bar{position:sticky;top:0;z-index:40;background:var(--ground);
  border-bottom:1px solid var(--hair);font-family:var(--mono)}
.torchio-bar .inner{max-width:var(--measure);margin:0 auto;padding:8px 20px;
  display:flex;flex-wrap:wrap;gap:10px 22px;align-items:center}
.torchio-bar .modes{display:inline-flex;border:1px solid var(--hair);
  border-radius:2px;overflow:hidden}
.torchio-bar button{font-family:var(--mono);font-size:10px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--soft);background:none;border:none;
  cursor:pointer;padding:6px 14px}
.torchio-bar .modes button.active{background:var(--accent);color:#fff}
.torchio-bar .sw.off{text-decoration:line-through;opacity:.6}

.t-lem{cursor:pointer}
body.app-off .t-lem{border-bottom:none;cursor:inherit}
[data-ref]{cursor:pointer}

.torchio-pop{position:absolute;z-index:60;max-width:22rem;background:var(--paper);
  border:1px solid var(--hair);border-radius:2px;padding:12px 14px;
  box-shadow:0 12px 28px -18px rgba(27,27,27,.45);font-size:15px;line-height:1.45}
.torchio-pop .k{font-family:var(--mono);font-size:9.5px;font-weight:600;
  letter-spacing:.14em;text-transform:uppercase;color:var(--soft);display:block;
  margin-bottom:6px}
.torchio-pop .rdgline{display:flex;gap:10px;align-items:baseline;padding:3px 0}
.torchio-pop .sig{font-family:var(--mono);font-size:11px;font-weight:600;
  color:var(--accent);min-width:2.2em}
.torchio-pop .is-lem{border-bottom:1px solid var(--hair)}
.torchio-pop .meta{font-family:var(--mono);font-size:10.5px;color:var(--soft);margin-top:8px}

/* transcription levels: reading is the default */
.t-choice .t-orig,.t-choice .t-abbr,.t-choice .t-sic{display:none}
body.mode-dipl .t-choice .t-orig,body.mode-dipl .t-choice .t-abbr,body.mode-dipl .t-choice .t-sic{display:inline}
body.mode-dipl .t-choice .t-reg,body.mode-dipl .t-choice .t-expan,body.mode-dipl .t-choice .t-corr{display:none}
body.mode-read .t-del{display:none}
body.mode-read .t-add{vertical-align:baseline;font-size:inherit}
`;

export function buildInteractJS(t) {
  return `
(function(){
  var body=document.body; body.classList.add('mode-read');
  var pop=null, lastTrigger=null;
  function closePop(){
    if(pop){pop.remove();pop=null;}
    if(lastTrigger){lastTrigger.setAttribute('aria-expanded','false');
      if(document.activeElement===document.body)lastTrigger.focus();
      lastTrigger=null;}
  }
  function openPop(html,near){
    closePop();
    pop=document.createElement('div');pop.className='torchio-pop';pop.innerHTML=html;
    pop.setAttribute('role','dialog');pop.tabIndex=-1;
    document.body.appendChild(pop);
    var r=near.getBoundingClientRect();
    var x=Math.min(r.left+window.scrollX, window.scrollX+document.documentElement.clientWidth-pop.offsetWidth-16);
    pop.style.left=Math.max(16,x)+'px';
    pop.style.top=(r.bottom+window.scrollY+6)+'px';
    lastTrigger=near;near.setAttribute('aria-expanded','true');
    pop.focus();
  }
  /* keyboard access: every trigger is focusable and reacts to Enter/Space */
  function makeTrigger(el,label){
    el.setAttribute('tabindex','0');el.setAttribute('role','button');
    el.setAttribute('aria-haspopup','dialog');el.setAttribute('aria-expanded','false');
    if(label)el.setAttribute('aria-label',label);
  }
  document.querySelectorAll('.t-app [data-el="lem"]').forEach(function(el){
    makeTrigger(el,'${t.appEntry}: '+el.textContent.trim());
  });
  document.querySelectorAll('[data-ref]').forEach(function(el){
    if(/^(persName|placeName|orgName|rs|name)$/.test(el.dataset.el||''))
      makeTrigger(el,null);
  });
  document.addEventListener('keydown',function(ev){
    if((ev.key==='Enter'||ev.key===' ')&&ev.target.getAttribute&&ev.target.getAttribute('role')==='button'
       &&!ev.target.closest('.torchio-bar')){
      ev.preventDefault();ev.target.click();
    }
  });
  function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function sigla(w){return (w||'').split(/\\s+/).filter(Boolean).map(function(x){return x.replace(/^#/,'');}).join(' ');}

  document.addEventListener('click',function(ev){
    if(pop&&pop.contains(ev.target))return;
    var app=ev.target.closest&&ev.target.closest('.t-app');
    if(app&&!body.classList.contains('app-off')){
      var rows='';
      app.querySelectorAll('[data-el="lem"],[data-el="rdg"]').forEach(function(r){
        rows+='<div class="rdgline"><span class="sig">'+esc(sigla(r.dataset.wit)||(r.dataset.el==='lem'?'lem.':'—'))+'</span>'
          +'<span class="'+(r.dataset.el==='lem'?'is-lem':'')+'">'+esc(r.textContent.trim()||'(om.)')+'</span>'
          +(r.dataset.type?'<span class="meta">'+esc(r.dataset.type)+'</span>':'')+'</div>';
      });
      openPop('<span class="k">${t.apparatus.toLowerCase()}'+(app.dataset.type?' · '+esc(app.dataset.type):'')+'</span>'+rows,app);
      ev.stopPropagation();return;
    }
    var ent=ev.target.closest&&ev.target.closest('[data-ref]');
    if(ent&&!body.classList.contains('ent-off')&&/^(persName|placeName|orgName|rs|name)$/.test(ent.dataset.el||'')){
      var ref=ent.dataset.ref;
      var all=document.querySelectorAll('[data-ref="'+CSS.escape(ref)+'"]');
      openPop('<span class="k">'+esc(ent.dataset.el)+'</span>'
        +'<div>'+esc(ent.textContent.trim())+'</div>'
        +'<div class="meta">'+esc(ref)+' · '+all.length+' '+(all.length===1?'${t.occurrenceOne}':'${t.occurrenceMany}')+'</div>',ent);
      ev.stopPropagation();return;
    }
    closePop();
  });
  document.addEventListener('keydown',function(ev){if(ev.key==='Escape')closePop();});

  var bar=document.querySelector('.torchio-bar');
  if(bar){
    bar.addEventListener('click',function(ev){
      var b=ev.target.closest('button'); if(!b)return;
      if(b.dataset.mode){
        body.classList.toggle('mode-dipl',b.dataset.mode==='dipl');
        body.classList.toggle('mode-read',b.dataset.mode==='read');
        bar.querySelectorAll('[data-mode]').forEach(function(x){x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});
      }
      if(b.dataset.sw==='app'){body.classList.toggle('app-off');b.classList.toggle('off');closePop();}
      if(b.dataset.sw==='header'){body.classList.toggle('show-header');b.classList.toggle('off');}
      if(b.dataset.sw)b.setAttribute('aria-pressed',String(!b.classList.contains('off')));
    });
  }
})();
`;
}

/** The sticky toolbar markup; controls appear only when the markup warrants them. */
export function toolbarHTML({ hasChoice, hasApparatus, t } = {}) {
  const modes = hasChoice
    ? `<span class="modes" role="group" aria-label="${t.text}"><button data-mode="read" class="active" aria-pressed="true">${t.reading}</button><button data-mode="dipl" aria-pressed="false">${t.diplomatic}</button></span>`
    : '';
  const app = hasApparatus ? `<button class="sw" data-sw="app" aria-pressed="true">${t.apparatus}</button>` : '';
  return `<div class="torchio-bar"><div class="inner">${modes}${app}<button class="sw off" data-sw="header" aria-pressed="false">${t.aboutFile}</button></div></div>`;
}
