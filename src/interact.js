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
.t-choice{cursor:pointer}
body.app-off .t-lem{border-bottom:none;cursor:inherit}
[data-ref],[data-key]{cursor:pointer}

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
.torchio-pop .notebody{font-size:14px;line-height:1.5}

/* a verse followed by its apparatus band opens the scheme on click */
body.has-band [data-el="l"]{cursor:pointer}
body.has-align [data-el="l"]{cursor:pointer}
.wv{border-bottom:1px dotted var(--accent-soft);cursor:pointer}
body.app-off .wv{border-bottom:none;cursor:inherit}
body.app-off.has-band [data-el="l"]{cursor:inherit}
.torchio-pop .popband{font-size:14px;max-height:18rem;overflow-y:auto}
.torchio-pop .popband .band-e{display:block;margin:.35em 0}
.torchio-pop .popband .band-lem{font-style:italic}
.torchio-pop .popband .bw{color:var(--accent);cursor:pointer}
.torchio-pop .popband .bw:hover{text-decoration:underline}

/* dense notes: marks only, notes open on click */
body.notes-dense main.torchio .t-note{display:none!important}
body.notes-dense .t-note-mark{color:var(--accent);cursor:pointer;font-size:.85em;font-weight:700;line-height:0;padding:.3em .3em;margin:-.3em -.1em}
body.notes-dense [data-notepop]{cursor:pointer}
body.notes-dense.notes-off .t-note-mark{cursor:default}

/* transcription levels: reading is the default */
.t-choice .t-orig,.t-choice .t-abbr,.t-choice .t-sic{display:none}
body.mode-dipl .t-choice .t-orig,body.mode-dipl .t-choice .t-abbr,body.mode-dipl .t-choice .t-sic{display:inline}
body.mode-dipl .t-choice .t-reg,body.mode-dipl .t-choice .t-expan,body.mode-dipl .t-choice .t-corr{display:none}
body.mode-read .t-del{display:none}
body.mode-read .t-am{display:none}
body.mode-dipl .t-ex{display:none}
body.mode-read .t-lb br{display:none}
body.mode-read .t-lb::after{content:" "}
body.mode-read .t-lb[data-break="no"]::after{content:none}
body.mode-read .t-add{vertical-align:baseline;font-size:inherit}
`;

export function buildInteractJS(t) {
  return `
(function(){
  var body=document.body; body.classList.add('mode-read');
  if(document.querySelector('.app-band'))body.classList.add('has-band');
  if(window.TORCHIO_ALIGN)body.classList.add('has-align');
  /* words covered by an apparatus entry become triggers: the reader clicks
     the word and sees its variants (positions from the declared @from/@to) */
  function wireWords(){
    document.querySelectorAll('.app-band').forEach(function(band){
      try{
      var l=band.previousElementSibling;
      if(!l||l.getAttribute('data-el')!=='l')return;
      if(l.querySelector('.wv'))return;
      var entries=[].slice.call(band.querySelectorAll('.band-e[data-from]'));
      if(!entries.length)return;
      var map={};
      entries.forEach(function(e){
        var f=parseInt(e.getAttribute('data-from'),10), t=parseInt(e.getAttribute('data-to'),10);
        for(var w=Math.ceil(f/2); w<=Math.floor(t/2); w++){ if(map[w]==null)map[w]=e; }
      });
      var walker=document.createTreeWalker(l,NodeFilter.SHOW_TEXT,null);
      var nodes=[]; while(walker.nextNode())nodes.push(walker.currentNode);
      /* pass 1: tokens (standalone punctuation is not a token) */
      var toks=[]; var idx=0, carry=false;
      nodes.forEach(function(tn){
        var v=tn.nodeValue;
        if(!/\\S/.test(v)){ if(/\\s/.test(v))carry=false; return; }
        var parts=v.split(/(\\s+)/);
        var continuing=carry&&!/^\\s/.test(v);
        parts.forEach(function(pt){
          if(!pt)return;
          if(/^\\s+$/.test(pt)){continuing=false;toks.push({sp:true,node:tn,text:pt,i:idx});return;}
          var punct=!/[\\p{L}\\p{N}]/u.test(pt);
          if(continuing){continuing=false;toks.push({node:tn,text:pt,i:idx,cont:true});return;}
          if(punct){toks.push({node:tn,text:pt,i:idx,punct:true});return;}
          idx++;
          toks.push({node:tn,text:pt,i:idx});
        });
        carry=!/\\s$/.test(v);
      });
      function norm(x){return x.toLowerCase().replace(/[^\\p{L}\\p{N}]/gu,'').replace(/[\\p{Lm}\\p{M}]/gu,'');}
      function subseq(a,b){var i=0;for(var j=0;j<b.length&&i<a.length;j++){if(b[j]===a[i])i++;}return i===a.length;}
      /* pass 2: the declared positions give the anchor, the declared lemma
         corrects it: among nearby offsets the one that matches best wins */
      var claim={};
      function rangeText(a,b){
        return norm(toks.filter(function(tk){return !tk.sp&&!tk.punct&&tk.i>=a&&tk.i<=b;})
          .map(function(tk){return tk.text;}).join(''));
      }
      function matchScore(chk,got){
        var i=0,j=0;
        for(; j<got.length&&i<chk.length; j++){ if(got[j]===chk[i])i++; }
        return i===chk.length ? (j-chk.length) : -1;
      }
      entries.forEach(function(e){
        var f=parseInt(e.getAttribute('data-from'),10), t=parseInt(e.getAttribute('data-to'),10);
        var a=Math.ceil(f/2), b=Math.floor(t/2);
        var chk=e.getAttribute('data-check')||'';
        var best=null;
        [0,-1,1,-2,2,-3,3].forEach(function(off){
          if(a+off<1)return;
          var got=rangeText(a+off,b+off);
          if(!got)return;
          var sc=chk?matchScore(chk,got.slice(0,chk.length+24)):0;
          if(sc<0)return;
          if(best===null||sc<best.sc)best={off:off,sc:sc};
        });
        if(!best)return;
        for(var w=a+best.off;w<=b+best.off;w++){ if(claim[w]==null)claim[w]=e; }
      });
      /* pass 3: wrap, spaces inside one site keep the line running */
      var byNode=new Map();
      toks.forEach(function(tk){ if(!byNode.has(tk.node))byNode.set(tk.node,[]); byNode.get(tk.node).push(tk); });
      byNode.forEach(function(list,tn){
        var frag=document.createDocumentFragment(); var wrapped=false;
        list.forEach(function(tk){
          var e=null;
          if(tk.sp){ if(claim[tk.i]&&claim[tk.i]===claim[tk.i+1])e=claim[tk.i]; }
          else if(!tk.punct){ e=claim[tk.i]; }
          if(!e){frag.appendChild(document.createTextNode(tk.text));return;}
          var sp=document.createElement('span');
          sp.className='wv';sp.textContent=tk.text;sp._be=e;
          frag.appendChild(sp);wrapped=true;
        });
        tn.parentNode.replaceChild(frag,tn);
      });
      }catch(e){/* one bad band must not silence the rest */}
    });
  }
  if(document.readyState==='complete')wireWords();
  else window.addEventListener('load',wireWords);
  var pop=null, lastTrigger=null;
  function closePop(){
    clearZone();
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
  /* the zone of text a note refers to: declared targets first, then the
     word or block just before its mark */
  var hiZone=[];
  function clearZone(){hiZone.forEach(function(e){e.classList.remove('note-hi');});hiZone=[];}
  function zoneOf(n){
    var app=n.closest('.t-app');
    if(app)return [app];
    var t=n.dataset.target;
    if(t){
      var els=t.split(/\s+/).map(function(x){return document.getElementById(x.replace(/^#/,''));}).filter(Boolean);
      if(els.length)return els;
    }
    var m=n.previousElementSibling;
    if(m&&m.classList&&m.classList.contains('t-note-mark')){
      var prev=m.previousElementSibling;
      if(prev&&prev.nodeType===1&&!prev.classList.contains('t-note')&&(prev.textContent||'').length<400)return [prev];
      var par=m.parentElement;
      if(par&&par!==document.body&&(par.textContent||'').length<400)return [par];
    }
    return [];
  }
  function showZone(n){clearZone();zoneOf(n).forEach(function(e){e.classList.add('note-hi');hiZone.push(e);});}
  document.querySelectorAll('.t-app [data-el="lem"]').forEach(function(el){
    makeTrigger(el,'${t.appEntry}: '+el.textContent.trim());
  });
  document.querySelectorAll('[data-ref],[data-key]').forEach(function(el){
    if(el.classList.contains('ent-ext'))return; /* external links stay links */
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
  var ALIGNMAP=null;
  function withAlign(cb){
    if(ALIGNMAP){cb(ALIGNMAP);return;}
    try{
      fetch('alignment.json').then(function(r){return r.ok?r.json():null;})
        .then(function(j){if(j){ALIGNMAP=j;cb(j);}})['catch'](function(){});
    }catch(e){}
  }
  function sigla(w){return (w||'').split(/\\s+/).filter(Boolean).map(function(x){return x.replace(/^#/,'');}).join(' ');}

  document.addEventListener('click',function(ev){
    var bw=ev.target.closest&&ev.target.closest('.bw');
    if(bw){
      var bandk=bw.closest('[data-ent]');
      var sig=bw.getAttribute('data-sig');
      if(bandk&&sig){
        withAlign(function(map){
          var row=map[bandk.getAttribute('data-ent')]||{};
          var tgt=row[sig]||row['ms-'+sig]||row['wit-'+sig];
          if(!tgt)return;
          var file=tgt.split('#')[0], id=tgt.split('#')[1];
          /* the witness's passage in a small window: the reader stays put */
          try{
            fetch(file).then(function(r){return r.ok?r.text():null;}).then(function(html){
              if(!html){location.href=tgt;return;}
              var doc=new DOMParser().parseFromString(html,'text/html');
              var el=doc.getElementById(id);
              var txt='';
              if(el){
                var cl=el.cloneNode(true);
                cl.querySelectorAll('[data-el="abbr"],[data-el="orig"],[data-el="sic"],[data-el="am"],.t-note,.t-note-mark,.app-band').forEach(function(x){x.remove();});
                txt=cl.textContent.replace(/\s+/g,' ').trim();
              }
              openPop('<span class="k">'+esc(sig)+'</span>'
                +'<div class="notebody">'+(txt?esc(txt):'…')+'</div>'
                +'<div class="meta"><a href="'+tgt+'">${t.openPage}</a></div>',bw);
            })['catch'](function(){location.href=tgt;});
          }catch(e){location.href=tgt;}
        });
        ev.stopPropagation();return;
      }
    }
    if(pop&&pop.contains(ev.target))return;
    var app=ev.target.closest&&ev.target.closest('.t-app');
    if(app&&!body.classList.contains('app-off')){
      var rows='';
      app.querySelectorAll('[data-el="lem"],[data-el="rdg"]').forEach(function(r){
        var rr=r.cloneNode(true);
        rr.querySelectorAll('[data-el="wit"],[data-el="witDetail"]').forEach(function(x){x.remove();});
        var auth=sigla(r.dataset.wit)
          ||(r.dataset.source?sigla(r.dataset.source):'')
          ||(r.dataset.resp?sigla(r.dataset.resp):'')
          ||(r.dataset.el==='lem'?'lem.':'—');
        rows+='<div class="rdgline"><span class="sig">'+esc(auth)+'</span>'
          +'<span class="'+(r.dataset.el==='lem'?'is-lem':'')+'">'+esc(rr.textContent.trim()||'(om.)')+'</span>'
          +((r.dataset.type||r.dataset.cert)?'<span class="meta">'+esc([r.dataset.type,r.dataset.cert&&('cert. '+r.dataset.cert)].filter(Boolean).join(' · '))+'</span>':'')+'</div>';
      });
      var extra='';
      app.querySelectorAll('.t-note').forEach(function(nn){
        extra+='<div class="meta">'+esc(nn.textContent.replace(/\s+/g,' ').trim())+'</div>';
      });
      openPop('<span class="k">${t.apparatus.toLowerCase()}'+(app.dataset.type?' · '+esc(app.dataset.type):'')+'</span>'+rows+extra,app);
      ev.stopPropagation();return;
    }
    var ch=ev.target.closest&&ev.target.closest('.t-choice');
    if(ch&&!ch.closest('.t-app')){
      var kinds={abbr:'${t.diplomatic}',orig:'${t.diplomatic}',sic:'${t.diplomatic}',expan:'${t.reading}',reg:'${t.reading}',corr:'${t.reading}'};
      var rows='';
      [].slice.call(ch.children).forEach(function(c){
        var k=c.dataset&&c.dataset.el; if(!kinds[k])return;
        rows+='<div class="rdgline"><span class="sig">'+esc(k)+'</span>'
          +'<span>'+esc(c.textContent.trim())+'</span>'
          +'<span class="meta">'+esc(kinds[k].toLowerCase())+'</span></div>';
      });
      if(rows){openPop(rows,ch);ev.stopPropagation();return;}
    }
    var ent=ev.target.closest&&ev.target.closest('[data-ref],[data-key]');
    if(ent&&!ent.classList.contains('ent-ext')&&!body.classList.contains('ent-off')
       &&/^(persName|placeName|orgName|rs|name)$/.test(ent.dataset.el||'')){
      /* the normalized name leads the card: @key IS the canonical form */
      var ref=ent.dataset.ref||'';var key=ent.dataset.key||'';
      var sel=ref?('[data-ref="'+CSS.escape(ref)+'"]'):('[data-key="'+CSS.escape(key)+'"]');
      var all=document.querySelectorAll(sel);
      var head=key||ent.textContent.trim();
      var meta=[];
      if(key&&ent.textContent.trim()!==key)meta.push(esc(ent.textContent.trim()));
      if(ref)meta.push(esc(ref));
      meta.push(all.length+' '+(all.length===1?'${t.occurrenceOne}':'${t.occurrenceMany}'));
      openPop('<span class="k">'+esc(ent.dataset.el)+'</span>'
        +'<div>'+esc(head)+'</div>'
        +'<div class="meta">'+meta.join(' · ')+'</div>',ent);
      ev.stopPropagation();return;
    }
    var wv=ev.target.closest&&ev.target.closest('.wv');
    if(wv&&wv._be&&!body.classList.contains('app-off')){
      var wband=wv._be.closest('.app-band');
      openPop('<span class="k">'+'${t.apparatus}'.toLowerCase()+'</span>'
        +'<div class="popband" data-ent="'+((wband&&wband.getAttribute('data-ent'))||'')+'">'+wv._be.outerHTML+'</div>',wv);
      ev.stopPropagation();return;
    }
    var npFirst=ev.target.closest&&ev.target.closest('[data-notepop]');
    if(npFirst){
      var nnF=document.querySelector('.t-note[data-npi="'+npFirst.getAttribute('data-notepop')+'"]');
      if(nnF&&!body.classList.contains('notes-off')){
        openPop('<span class="k">'+'${t.notes}'.toLowerCase()+'</span><div class="notebody">'+nnF.innerHTML+'</div>',npFirst);
        showZone(nnF);
        ev.stopPropagation();return;
      }
    }
    var lw=ev.target.closest&&ev.target.closest('[data-el="l"]');
    if(lw&&window.TORCHIO_ALIGN&&lw.getAttribute('data-n')
       &&!(lw.nextElementSibling&&lw.nextElementSibling.classList&&lw.nextElementSibling.classList.contains('app-band'))){
      var CFG=window.TORCHIO_ALIGN;
      var key=String(lw.getAttribute('data-n'));
      try{ if(CFG.strip)key=key.replace(new RegExp(CFG.strip),''); if(CFG.suffix)key=key.replace(new RegExp(CFG.suffix),''); }catch(e){}
      withAlign(function(map){
        var row=map[key]; if(!row)return;
        var tgt=null;
        (CFG.apps||[]).some(function(a){ if(row[a]){tgt=row[a];return true;} return false; });
        if(!tgt)return;
        var file=tgt.split('#')[0], id=tgt.split('#')[1];
        fetch(file).then(function(r){return r.ok?r.text():null;}).then(function(html){
          if(!html)return;
          var doc=new DOMParser().parseFromString(html,'text/html');
          var el=doc.getElementById(id);
          var sec=el&&el.closest?el.closest('.vmap')||el:el;
          if(!sec)return;
          openPop('<span class="k">'+'${t.apparatus}'.toLowerCase()+'</span>'
            +'<div class="popband" data-ent="'+esc(key)+'">'+sec.innerHTML+'</div>'
            +'<div class="meta"><a href="'+tgt+'">${t.openPage}</a></div>',lw);
        })['catch'](function(){});
      });
      ev.stopPropagation();return;
    }
    var lv=ev.target.closest&&ev.target.closest('[data-el="l"]');
    if(lv&&lv.nextElementSibling&&lv.nextElementSibling.classList
       &&lv.nextElementSibling.classList.contains('app-band')){
      var bd=lv.nextElementSibling;
      openPop('<span class="k">'+'${t.apparatus}'.toLowerCase()+'</span>'
        +'<div class="popband" data-ent="'+(bd.getAttribute('data-ent')||'')+'">'+bd.innerHTML+'</div>',lv);
      ev.stopPropagation();return;
    }
    var np=ev.target.closest&&ev.target.closest('[data-notepop]');
    if(np&&!body.classList.contains('notes-off')){
      var nn=document.querySelector('.t-note[data-npi="'+np.getAttribute('data-notepop')+'"]');
      if(nn){
        openPop('<span class="k">'+'${t.notes}'.toLowerCase()+'</span><div class="notebody">'+nn.innerHTML+'</div>',np);
        showZone(nn);
        ev.stopPropagation();return;
      }
    }
    closePop();
  });
  /* margin notes: position each note beside its anchor (data-target for
     standoff notes, the preceding mark otherwise), stack on collision,
     and draw a faint leader to the exact point */
  function leaders(){
    var old=document.getElementById('note-leaders'); if(old)old.remove();
    var main=document.querySelector('main.torchio'); if(!main)return;
    var notes=[].slice.call(document.querySelectorAll('main.torchio .t-note'))
      .filter(function(n){return !n.closest('.header-full')&&!n.closest('.t-teiHeader');});
    function anchorOf(n){
      var app=n.closest('.t-app');
      if(app){return {el:app.querySelector('[data-el="lem"]')||app,kind:'app'};}
      var t=n.dataset.target;
      if(t){
        var id=t.split(/\s+/)[0].replace(/^#/,'');
        var el=document.getElementById(id);
        if(el)return {el:el,kind:'target'};
      }
      var m=n.previousElementSibling;
      if(m&&m.classList&&m.classList.contains('t-note-mark'))return {el:m,kind:'mark'};
      return null;
    }

    /* economy rule: past this density the margin cannot carry the notes;
       they collapse to their marks and open on click, like the apparatus */
    var dense=notes.length>12;
    body.classList.toggle('notes-dense',dense);
    if(dense){
      notes.forEach(function(n,i){
        if(n.dataset.npi)return;
        n.dataset.npi=String(i);
        var res=anchorOf(n);
        if(res){res.el.setAttribute('data-notepop',String(i));
          res.el.removeAttribute('aria-hidden');makeTrigger(res.el,null);}
      });
    }
    if(window.innerWidth<1180||body.classList.contains('notes-off')||dense){
      notes.forEach(function(n){n.classList.remove('placed');n.style.cssText='';});
      return;
    }
    main.style.position='relative';
    var mr=main.getBoundingClientRect();
    var colLeft=main.clientWidth+26;
    var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.id='note-leaders';
    svg.style.cssText='position:absolute;left:0;top:0;width:1px;height:1px;pointer-events:none;overflow:visible;z-index:1';
    var lastBottom=0;
    var items=notes.map(function(n){
      var flowY=n.getBoundingClientRect().top-mr.top;
      var res=anchorOf(n);
      var a=res?res.el:null, kind=res?res.kind:null;
      var y=flowY;
      if(a){
        var r=a.getBoundingClientRect();
        var ay=(r.width||r.height)?r.top-mr.top:null;
        if(ay!==null&&(kind!=='mark'||ay<flowY-40)){y=ay;}
        else if(kind==='mark'){/* adjacent: keep flow position, no line */}
        else{a=null;}
      }
      return {n:n,a:a,kind:kind,y:y};
    });
    items.sort(function(p,q){return p.y-q.y;});
    items.forEach(function(it){
      var n=it.n;
      n.classList.add('placed');
      var top=Math.max(it.y,lastBottom+10);
      n.style.cssText='position:absolute;float:none;width:14rem;margin:0;left:'+colLeft+'px;top:'+top+'px;border-left:0;padding-left:0';
      lastBottom=top+n.offsetHeight;
      if(it.a){
        var ar=it.a.getBoundingClientRect();
        if(ar.width||ar.height){
          var x1=ar.right-mr.left+2, y1=ar.top-mr.top+ar.height*0.5;
          var x2=colLeft-8, y2=top+8;
          // a thread only when short and meaningful; never across the page
          if((it.kind==='app'||it.kind==='target')&&Math.abs(y2-y1)<160){
            var p=document.createElementNS('http://www.w3.org/2000/svg','path');
            p.setAttribute('d','M'+x1+' '+y1+' C '+(x1+24)+' '+y1+', '+(x2-24)+' '+y2+', '+x2+' '+y2);
            p.setAttribute('fill','none');
            p.setAttribute('stroke','var(--faint)');
            p.setAttribute('stroke-width','1');
            svg.appendChild(p);
          }
          // hover pairing in both directions
          (function(anchor,note){
            var els=null;
            function on(){if(!els)els=zoneOf(note);els.concat([anchor]).forEach(function(e){e.classList.add('note-hi');});note.classList.add('note-hi');}
            function off(){(els||[]).concat([anchor]).forEach(function(e){e.classList.remove('note-hi');});note.classList.remove('note-hi');}
            note.addEventListener('mouseenter',on);note.addEventListener('mouseleave',off);
            anchor.addEventListener('mouseenter',on);anchor.addEventListener('mouseleave',off);
            note.addEventListener('click',function(ev){on();if(els&&els[0])els[0].scrollIntoView({block:'nearest'});ev.stopPropagation();});
          })(it.a,n);
        }
      }
    });
    if(items.length){main.style.minHeight=(lastBottom+32)+'px';}
    main.appendChild(svg);
  }
  if(document.readyState==='complete')leaders();
  else window.addEventListener('load',leaders);
  window.addEventListener('resize',leaders);

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
      if(b.dataset.sw==='notes'){body.classList.toggle('notes-off');b.classList.toggle('off');closePop();leaders();}
      if(b.dataset.sw)b.setAttribute('aria-pressed',String(!b.classList.contains('off')));
    });
  }
})();
`;
}

/** The sticky toolbar markup; controls appear only when the markup warrants them. */
export function toolbarHTML({ hasChoice, hasApparatus, hasNotes, t } = {}) {
  const modes = hasChoice
    ? `<span class="modes" role="group" aria-label="${t.text}"><button data-mode="read" class="active" aria-pressed="true">${t.reading}</button><button data-mode="dipl" aria-pressed="false">${t.diplomatic}</button></span>`
    : '';
  const app = hasApparatus ? `<button class="sw" data-sw="app" aria-pressed="true">${t.apparatus}</button>` : '';
  const notes = hasNotes ? `<button class="sw" data-sw="notes" aria-pressed="true">${t.notes}</button>` : '';
  return `<div class="torchio-bar"><div class="inner">${modes}${app}${notes}<button class="sw off" data-sw="header" aria-pressed="false">${t.aboutFile}</button></div></div>`;
}
