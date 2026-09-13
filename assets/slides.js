/* ─────────────────────────────────────────────────────────────────────────
   slides.js — sfoglia la pagina una sezione alla volta.

   Niente viene nascosto o riorganizzato: le "slide" sono le sezioni che il
   documento ha gia', e la pagina continua a scorrere normalmente. Questo
   file aggiunge solo i comandi: frecce a schermo, frecce da tastiera, una
   barra di avanzamento, e tiene aggiornato l'hash nell'URL.
   ───────────────────────────────────────────────────────────────────────── */
(function(){
  "use strict";
  /* l'altezza della barra si legge dal DOM: se il CSS la cambia, lo script segue */
  var navEl = document.querySelector('.nav');
  var NAV_H = (navEl && navEl.offsetHeight) || 48;
  window.addEventListener('resize', function(){ NAV_H = (navEl && navEl.offsetHeight) || NAV_H; }, {passive:true});
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
  /* quanto di una sezione puo' restare fuori schermo senza contare come
     "pagina in piu'": un margine, una riga, la barra di Approfondisci. Sotto
     questa soglia la freccia passa direttamente alla sezione successiva,
     invece di scorrere di pochi pixel e chiedere un secondo clic. */
  function tol(){ return Math.min(160, Math.round((window.innerHeight - NAV_H) * 0.2)); }
  /* l'hash segue la sezione; se il browser lo vieta (file://), si va avanti lo stesso */
  function setHash(id){
    try{ if(history.replaceState) history.replaceState(null, '', id ? '#' + id : location.pathname + location.search); }catch(e){}
  }
  function scrollToY(y){ heading(y); window.scrollTo({top:Math.max(0,y), behavior: reduce ? 'auto' : 'smooth'}); }

  /* indicatore "parte 2 di 3" quando la sezione non sta in una schermata */
  /* scrive nel DOM solo quando qualcosa cambia: questa funzione gira a ogni
     fotogramma di scorrimento e ogni scrittura costa un ricalcolo di stile */
  var lastPg = '', lastPrev = null, lastNext = null;
  function updatePage(){
    var r = slides[current].getBoundingClientRect();
    var avail = window.innerHeight - NAV_H;
    var pages = Math.max(1, Math.ceil((r.height - tol()) / avail));
    var pd = current===0 && r.top >= NAV_H - tol();
    var nd = current===slides.length-1 && window.innerHeight + window.pageYOffset >= document.documentElement.scrollHeight - 2;
    if(pd !== lastPrev){ prev.disabled = pd; lastPrev = pd; }
    if(nd !== lastNext){ next.disabled = nd; lastNext = nd; }
    var txt = '';
    if(pages >= 2){
      var page = Math.min(pages, Math.max(1, Math.floor((NAV_H - r.top) / avail + 0.5) + 1));
      txt = 'parte ' + page + ' di ' + pages;
    }
    if(txt !== lastPg){ lastPg = txt; pg.textContent = txt; pg.hidden = !txt; }
  }

  function goTo(i){
    i = Math.max(0, Math.min(slides.length-1, i));
    var s = slides[i];
    var y = s.getBoundingClientRect().top + window.pageYOffset - NAV_H;
    heading(y);
    window.scrollTo({top:y, behavior: reduce ? 'auto' : 'smooth'});
    setHash(s.id);
    paint(i);
  }
  function paint(i){
    current = i;
    cur.textContent = i+1;
    ttl.textContent = titleOf(slides[i]);
    bar.style.transform = 'scaleX(' + (i/(slides.length-1)) + ')';
    slides.forEach(function(s,k){ if(k===i) s.setAttribute('aria-current','true'); else s.removeAttribute('aria-current'); });
    markLink(i);
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
    setHash(slides[i].id);
    paint(i);
  }
  function step(dir){
    var r = slides[current].getBoundingClientRect();
    if(dir > 0){
      if(r.bottom > window.innerHeight + tol()){
        var yMax = r.bottom + window.pageYOffset - window.innerHeight;
        scrollToY(Math.min(window.pageYOffset + pageH(), yMax));
      } else if(current < slides.length-1){
        goTo(current+1);
      } else {
        /* ultima sezione gia' finita: mostra il piede e basta */
        scrollToY(document.documentElement.scrollHeight);
      }
    } else {
      if(r.top < NAV_H - tol()){
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

  /* ── barra in alto sul telefono ──
     Il menu a tendina con le voci; la barra sparisce scorrendo in giu' e
     torna scorrendo in su o quando la navigazione e' programmatica (frecce,
     voci del menu), cosi' la sezione atterra sempre sotto una barra visibile. */
  var mobileMq = window.matchMedia ? window.matchMedia('(max-width:640px)') : null;
  var menuBtn = document.getElementById('menu-toggle');
  var links = navEl ? navEl.querySelectorAll('.nav-links a') : [];
  var lastY = window.pageYOffset;
  /* dichiara la destinazione di uno scorrimento programmatico: l'arrivo non
     conta come "scorrere in giu'" e la barra resta visibile */
  function heading(y){ lastY = Math.max(0, y); showNav(); }
  function isMobile(){ return !!(mobileMq && mobileMq.matches); }
  function showNav(){ if(navEl && navEl.classList.contains('nav-hidden')) navEl.classList.remove('nav-hidden'); }
  function setMenu(open){
    if(!navEl || !menuBtn || navEl.classList.contains('is-open') === open) return;
    navEl.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
  }
  if(menuBtn){
    menuBtn.addEventListener('click', function(){ setMenu(!navEl.classList.contains('is-open')); });
    Array.prototype.forEach.call(links, function(a){
      a.addEventListener('click', function(){
        setMenu(false);
        var t = a.hash && document.getElementById(a.hash.slice(1));
        heading(t ? t.getBoundingClientRect().top + window.pageYOffset - NAV_H : 0);
      });
    });
    document.addEventListener('click', function(e){ if(navEl.classList.contains('is-open') && !navEl.contains(e.target)) setMenu(false); });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape' && navEl.classList.contains('is-open')){ setMenu(false); menuBtn.focus(); } });
  }
  function navOnScroll(){
    if(!navEl || !isMobile()){ showNav(); lastY = window.pageYOffset; return; }
    var y = window.pageYOffset, dy = y - lastY;
    if(y < 16 || dy < -6){ showNav(); }
    else if(dy > 6 && y > 80 && !navEl.classList.contains('nav-hidden')){ navEl.classList.add('nav-hidden'); setMenu(false); }
    lastY = y;
  }
  /* la voce del menu della sezione corrente resta evidenziata */
  function markLink(i){
    var id = slides[i] && slides[i].id;
    Array.prototype.forEach.call(links, function(a){
      if(a.hash === '#' + id) a.setAttribute('aria-current','true'); else a.removeAttribute('aria-current');
    });
  }

  /* sul telefono la pillola sparisce mentre si scorre e torna da fermi */
  var hideT = null;
  window.addEventListener('scroll', function(){
    navOnScroll();
    if(!ticking){ ticking = true; requestAnimationFrame(function(){ detect(); ticking = false; }); }
    if(!box.classList.contains('is-scrolling')) box.classList.add('is-scrolling');
    clearTimeout(hideT); hideT = setTimeout(function(){ box.classList.remove('is-scrolling'); }, 500);
  }, {passive:true});

  /* sottotitoli dei grafici: sul telefono la coda si apre con «Come leggerlo» */
  if(window.matchMedia && window.matchMedia('(max-width:640px)').matches){
    Array.prototype.forEach.call(document.querySelectorAll('.fig-sub .fs-more'), function(m){
      var p = m.parentNode;
      var b = document.createElement('button'); b.type='button'; b.className='fs-btn';
      b.textContent='Come leggerlo'; b.setAttribute('aria-expanded','false');
      b.addEventListener('click', function(){ var o = p.classList.toggle('is-open'); b.setAttribute('aria-expanded', String(o)); });
      p.appendChild(b);
    });
  }

  /* ── tastiera ──
     ← → PagSu PagGiu Home Fine sfogliano sempre. ↑ ↓ e spazio scorrono
     dentro una sezione piu' alta dello schermo e passano alla successiva
     solo quando quella corrente e' finita: cosi' non si salta nulla. */
  function typing(e){
    var t = e.target, n = t && t.tagName;
    return n==='INPUT' || n==='TEXTAREA' || n==='SELECT' || (t && t.isContentEditable);
  }
  function slideEnd(){ return slides[current].getBoundingClientRect().bottom <= window.innerHeight + tol(); }
  function slideStart(){ return slides[current].getBoundingClientRect().top >= NAV_H - tol(); }

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
