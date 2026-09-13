/* ─────────────────────────────────────────────────────────────────────────
   slides.js — sfoglia la pagina una sezione alla volta.

   Niente viene nascosto o riorganizzato: le "slide" sono le sezioni che il
   documento ha gia', e la pagina continua a scorrere normalmente. Questo
   file aggiunge solo i comandi: frecce a schermo, frecce da tastiera, una
   barra di avanzamento, e tiene aggiornato l'hash nell'URL.
   ───────────────────────────────────────────────────────────────────────── */
(function(){
  "use strict";
  var NAV_H = 46;
  var slides = Array.prototype.slice.call(document.querySelectorAll('.hero, main > section, .wrap > section'));
  if(slides.length < 2) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function titleOf(s){
    var h = s.querySelector('h1, h2');
    return h ? h.textContent.replace(/\s+/g,' ').trim() : '';
  }

  /* ── comandi a schermo ── */
  var bar = document.createElement('div'); bar.className='progress'; bar.setAttribute('aria-hidden','true');
  var box = document.createElement('div'); box.className='deck-nav'; box.setAttribute('role','group'); box.setAttribute('aria-label','Sfoglia le sezioni');
  box.innerHTML =
    '<button type="button" data-go="-1" aria-label="Sezione precedente" title="Precedente (←)">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
    '<span class="deck-pos" aria-live="polite"><span data-cur>1</span> / ' + slides.length + '</span>' +
    '<button type="button" data-go="1" aria-label="Sezione successiva" title="Successiva (→)">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
    '<span class="deck-title" data-title></span><span class="deck-page" data-page hidden></span>' +
    '<span class="deck-hint">← → tastiera</span>';
  document.body.appendChild(bar);
  document.body.appendChild(box);

  var prev = box.querySelector('[data-go="-1"]'), next = box.querySelector('[data-go="1"]');
  var cur  = box.querySelector('[data-cur]'),    ttl  = box.querySelector('[data-title]');
  var pg   = box.querySelector('[data-page]');
  var current = 0, ticking = false;

  /* quanto e' alta una "schermata" dentro una sezione: la finestra meno la
     barra di navigazione, con un piccolo margine di sovrapposizione cosi'
     l'ultima riga di prima resta visibile e il lettore non perde il filo */
  function pageH(){ return Math.max(200, window.innerHeight - NAV_H - 40); }
  function scrollToY(y){ window.scrollTo({top:Math.max(0,y), behavior: reduce ? 'auto' : 'smooth'}); }

  /* indicatore "parte 2 di 3" quando la sezione non sta in una schermata */
  function updatePage(){
    var r = slides[current].getBoundingClientRect();
    var avail = window.innerHeight - NAV_H;
    var pages = Math.max(1, Math.ceil((r.height - 8) / avail));
    prev.disabled = current===0 && r.top >= NAV_H - 4;
    next.disabled = current===slides.length-1 && r.bottom <= window.innerHeight + 4;
    if(pages < 2){ pg.hidden = true; return; }
    var page = Math.min(pages, Math.max(1, Math.floor((NAV_H - r.top) / avail + 0.5) + 1));
    pg.textContent = 'parte ' + page + ' di ' + pages;
    pg.hidden = false;
  }

  function goTo(i){
    i = Math.max(0, Math.min(slides.length-1, i));
    var s = slides[i];
    var y = s.getBoundingClientRect().top + window.pageYOffset - NAV_H;
    window.scrollTo({top:y, behavior: reduce ? 'auto' : 'smooth'});
    if(history.replaceState) history.replaceState(null, '', s.id ? '#' + s.id : location.pathname + location.search);
    paint(i);
  }
  function paint(i){
    current = i;
    cur.textContent = i+1;
    ttl.textContent = titleOf(slides[i]);
    bar.style.width = (i/(slides.length-1)*100) + '%';
    slides.forEach(function(s,k){ if(k===i) s.setAttribute('aria-current','true'); else s.removeAttribute('aria-current'); });
    updatePage();
  }

  /* avanti: prima si finisce la sezione, una schermata alla volta; solo
     quando e' tutta vista si passa alla successiva. Cosi' niente resta
     saltato. Indietro: simmetrico, fino all'inizio della sezione. */
  /* indietro da inizio sezione: si atterra sulla FINE della precedente,
     come voltando pagina all'indietro in un libro */
  function goToEnd(i){
    i = Math.max(0, i);
    var r = slides[i].getBoundingClientRect();
    var top = r.top + window.pageYOffset - NAV_H;
    var end = r.bottom + window.pageYOffset - window.innerHeight;
    scrollToY(Math.max(top, end));
    if(history.replaceState) history.replaceState(null, '', slides[i].id ? '#' + slides[i].id : location.pathname + location.search);
    paint(i);
  }
  function step(dir){
    var r = slides[current].getBoundingClientRect();
    if(dir > 0){
      if(r.bottom > window.innerHeight + 4){
        var yMax = r.bottom + window.pageYOffset - window.innerHeight;
        scrollToY(Math.min(window.pageYOffset + pageH(), yMax));
      } else if(current < slides.length-1){
        goTo(current+1);
      } else {
        /* ultima sezione gia' finita: mostra il piede e basta */
        scrollToY(document.documentElement.scrollHeight);
      }
    } else {
      if(r.top < NAV_H - 4){
        var yMin = r.top + window.pageYOffset - NAV_H;
        scrollToY(Math.max(window.pageYOffset - pageH(), yMin));
      } else if(current > 0){
        goToEnd(current-1);
      }
    }
    updatePage();
    setTimeout(updatePage, reduce ? 0 : 450);
  }
  /* la slide corrente e' quella il cui inizio e' piu' vicino al bordo alto
     (sotto la barra di navigazione), scegliendo fra quelle gia' cominciate */
  function detect(){
    var best = 0, line = NAV_H + 8;
    for(var k=0;k<slides.length;k++){
      if(slides[k].getBoundingClientRect().top <= line + 1) best = k;
    }
    /* in fondo alla pagina l'ultima slide puo' non arrivare mai al bordo alto */
    if(window.innerHeight + window.pageYOffset >= document.documentElement.scrollHeight - 2) best = slides.length-1;
    if(best !== current) paint(best); else updatePage();
  }

  prev.addEventListener('click', function(){ step(-1); });
  next.addEventListener('click', function(){ step(1); });

  window.addEventListener('scroll', function(){
    if(ticking) return; ticking = true;
    requestAnimationFrame(function(){ detect(); ticking = false; });
  }, {passive:true});

  /* ── tastiera ──
     ← → PagSu PagGiu Home Fine sfogliano sempre. ↑ ↓ e spazio scorrono
     dentro una sezione piu' alta dello schermo e passano alla successiva
     solo quando quella corrente e' finita: cosi' non si salta nulla. */
  function typing(e){
    var t = e.target, n = t && t.tagName;
    return n==='INPUT' || n==='TEXTAREA' || n==='SELECT' || (t && t.isContentEditable);
  }
  function slideEnd(){ return slides[current].getBoundingClientRect().bottom <= window.innerHeight + 4; }
  function slideStart(){ return slides[current].getBoundingClientRect().top >= NAV_H - 4; }

  document.addEventListener('keydown', function(e){
    if(e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || typing(e)) return;
    switch(e.key){
      case 'ArrowRight': case 'PageDown': e.preventDefault(); step(1); break;
      case 'ArrowLeft':  case 'PageUp':   e.preventDefault(); step(-1); break;
      case 'Home': e.preventDefault(); goTo(0); break;
      case 'End':  e.preventDefault(); goTo(slides.length-1); break;
      case 'ArrowDown': case ' ':
        if(e.key===' ' && e.shiftKey){ e.preventDefault(); step(-1); break; }
        if(e.key===' '){ e.preventDefault(); step(1); break; }
        if(slideEnd()){ e.preventDefault(); goTo(current+1); }
        break;
      case 'ArrowUp':
        if(slideStart()){ e.preventDefault(); goTo(current-1); }
        break;
    }
  });

  /* ── tocco: uno scorrimento orizzontale deciso cambia slide ── */
  var tx=null, ty=null;
  document.addEventListener('touchstart', function(e){ if(e.touches.length===1){ tx=e.touches[0].clientX; ty=e.touches[0].clientY; } }, {passive:true});
  document.addEventListener('touchend', function(e){
    if(tx===null) return;
    var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    tx = ty = null;
    if(Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)*2){
      var inScroller = e.target && e.target.closest && e.target.closest('.scroller, .t-wrap, .nav-in');
      if(!inScroller) step(dx<0 ? 1 : -1);
    }
  }, {passive:true});

  /* stato iniziale: dall'hash se c'e', altrimenti da dove siamo */
  var h = location.hash && document.getElementById(location.hash.slice(1));
  var start = h ? slides.indexOf(h) : -1;
  if(start >= 0) paint(start); else { paint(0); detect(); }
})();
