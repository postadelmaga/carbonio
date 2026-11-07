/* ─────────────────────────────────────────────────────────────────────────
   chat.js — la chat dei lettori, solo sulla pagina principale.

   Un bottone in basso a sinistra apre un pannello. I messaggi compaiono
   subito per tutti (server/bacheca.py, /api/chat); chiunque puo' segnalarne
   uno, e due segnalazioni da persone diverse lo sospendono finche' la
   moderazione non decide. Regole e informativa: /privacy.html.

   Tutto il testo che arriva dal server entra nella pagina con textContent:
   niente HTML, e i collegamenti restano testo da copiare.

   Il bottone compare solo quando sulla pagina ci sono almeno due persone
   insieme: a ogni giro la pagina manda un codice casuale (nuovo a ogni
   caricamento), che il server tiene solo in memoria per meno di un minuto e
   conta per impronta, non per scheda.

   Si interroga il server ogni 4 secondi a pannello aperto e pagina visibile,
   ogni 20 secondi a pannello chiuso (presenze e pallino dei messaggi nuovi),
   mai a pagina nascosta. Se il servizio non risponde il bottone non compare.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  function T(s) { var d = window.I18N; return (d && d[s]) || s; }

  var API = window.BACHECA_API || '/api';
  var MAX = 500;
  var VELOCE = 4000, LENTO = 20000;
  var CODICE = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

  function letto(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function scrivi(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var stato = { ultimo: 0, visto: +(letto('chat-visto') || 0), aperto: false, timer: 0, miei: {}, ids: {} };
  try { stato.miei = JSON.parse(sessionStorage.getItem('chat-miei') || '{}'); } catch (e) {}

  function el(tag, cls, testo) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (testo != null) e.textContent = testo;
    return e;
  }

  /* ── struttura ──────────────────────────────────────────────────────── */
  var bottone = el('button', 'chat-btn');
  bottone.type = 'button';
  bottone.setAttribute('aria-expanded', 'false');
  bottone.setAttribute('aria-controls', 'chat-pan');
  bottone.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  bottone.appendChild(el('span', 'chat-btn-t', T('Chat')));
  var pallino = el('span', 'chat-dot');
  pallino.hidden = true;
  bottone.appendChild(pallino);

  var pan = el('div', 'chat-pan');
  pan.setAttribute('role', 'dialog');
  pan.id = 'chat-pan';
  pan.hidden = true;
  pan.setAttribute('aria-label', T('Chat dei lettori'));

  var testa = el('header', 'chat-testa');
  var tit = el('div', 'chat-tit');
  tit.appendChild(el('h2', null, T('Chat dei lettori')));
  var quanti = el('span', 'chat-quanti');
  tit.appendChild(quanti);
  testa.appendChild(tit);
  var chiudi = el('button', 'chat-x', '×');
  chiudi.type = 'button';
  chiudi.setAttribute('aria-label', T('Chiudi la chat'));
  testa.appendChild(chiudi);
  pan.appendChild(testa);

  var regole = el('p', 'chat-regole');
  regole.appendChild(document.createTextNode(T('Messaggi pubblici, visibili subito, cancellati dopo 30 giorni. Niente insulti, dati personali, spam o contenuti illegali: ogni messaggio si può segnalare.') + ' '));
  var link = el('a', 'ref', T('Regole e privacy'));
  // la pagina delle regole nella lingua della pagina (l'inglese sta alla radice)
  var LINGUA = document.documentElement.getAttribute('data-lingua') || 'en';
  link.href = LINGUA === 'en' ? '/privacy.html' : '/' + LINGUA + '/privacy.html';
  regole.appendChild(link);
  pan.appendChild(regole);

  var lista = el('ol', 'chat-lista');
  lista.setAttribute('aria-live', 'polite');
  pan.appendChild(lista);

  var modulo = el('form', 'chat-mod');
  modulo.noValidate = true;
  var nome = el('input', 'chat-nome');
  nome.type = 'text'; nome.maxLength = 40; nome.autocomplete = 'nickname';
  nome.placeholder = T('Nome (facoltativo)');
  nome.setAttribute('aria-label', T('Nome (facoltativo)'));
  nome.value = letto('chat-nome') || '';
  var testo = el('textarea', 'chat-testo');
  testo.rows = 2; testo.maxLength = MAX;
  testo.placeholder = T('Scrivi un messaggio…');
  testo.setAttribute('aria-label', T('Scrivi un messaggio…'));
  var trappola = el('input', 'chat-trappola');
  trappola.type = 'text'; trappola.tabIndex = -1; trappola.autocomplete = 'off';
  trappola.setAttribute('aria-hidden', 'true');
  var invia = el('button', 'chat-invia', T('Invia'));
  invia.type = 'submit';
  var esito = el('p', 'chat-esito');
  esito.setAttribute('role', 'status');
  modulo.appendChild(nome);
  modulo.appendChild(testo);
  modulo.appendChild(trappola);
  modulo.appendChild(invia);
  modulo.appendChild(esito);
  pan.appendChild(modulo);

  /* ── messaggi ───────────────────────────────────────────────────────── */
  function ora(ts) {
    var d = new Date(ts * 1000), oggi = new Date();
    var hh = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    if (d.toDateString() === oggi.toDateString()) return hh;
    return d.toLocaleDateString(document.documentElement.lang || 'it', { day: 'numeric', month: 'short' }) + ' ' + hh;
  }

  function riga(m) {
    var li = el('li', 'chat-m' + (stato.miei[m.id] ? ' chat-mio' : ''));
    li.setAttribute('data-id', m.id);
    var chi = el('div', 'chat-chi');
    chi.appendChild(el('b', null, m.nome || T('ospite')));
    chi.appendChild(el('span', 'chat-sigla', m.sigla));
    chi.appendChild(el('time', 'chat-ora', ora(m.ts)));
    if (!stato.miei[m.id]) {
      var s = el('button', 'chat-segnala', '⚑');
      s.type = 'button';
      s.title = T('Segnala questo messaggio');
      s.setAttribute('aria-label', T('Segnala questo messaggio'));
      s.addEventListener('click', function () { segnala(li, m.id); });
      chi.appendChild(s);
    }
    li.appendChild(chi);
    li.appendChild(el('p', 'chat-t', m.testo));
    return li;
  }

  function vuoto() {
    var v = lista.querySelector('.chat-vuoto');
    if (!lista.querySelector('.chat-m')) {
      if (!v) lista.appendChild(el('li', 'chat-vuoto', T('Ancora nessun messaggio. Comincia tu.')));
    } else if (v) v.remove();
  }

  function ricevi(d) {
    var giu = lista.scrollHeight - lista.scrollTop - lista.clientHeight < 40;
    (d.nascosti || []).forEach(function (id) {
      var x = lista.querySelector('[data-id="' + id + '"]');
      if (x) x.remove();
    });
    (d.messaggi || []).forEach(function (m) {
      if (stato.ids[m.id]) return;
      stato.ids[m.id] = 1;
      lista.appendChild(riga(m));
      if (m.id > stato.ultimo) stato.ultimo = m.id;
    });
    // al massimo 200 messaggi nella pagina
    var tutti = lista.querySelectorAll('.chat-m');
    for (var i = 0; i < tutti.length - 200; i++) tutti[i].remove();
    vuoto();
    if (stato.aperto) {
      if (giu) lista.scrollTop = lista.scrollHeight;
      segnaVisto();
    } else {
      pallino.hidden = !(d.ultimo > stato.visto && stato.visto > 0);
    }
  }

  function segnaVisto() {
    stato.visto = stato.ultimo;
    scrivi('chat-visto', String(stato.visto));
    pallino.hidden = true;
  }

  function chiedi() {
    clearTimeout(stato.timer);
    if (document.hidden) return Promise.resolve();
    return fetch(API + '/chat?dopo=' + stato.ultimo + '&s=' + CODICE, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw r.status; return r.json(); })
      .then(function (d) {
        // la chat c'e' solo se si e' almeno in due; a pannello aperto resta
        // aperta anche se l'altro se ne va, per non togliere la parola a meta'
        var n = d.presenti || 0;
        bottone.hidden = n < 2;
        quanti.textContent = n >= 2 ? T('{n} persone qui adesso').replace('{n}', n) : T('sei solo sulla pagina, per ora');
        // la prima volta: chi non ha mai aperto la chat non vede il pallino
        if (!stato.visto && !letto('chat-visto')) { stato.visto = d.ultimo || 0; scrivi('chat-visto', String(stato.visto)); }
        ricevi(d);
      })
      .catch(function () {})
      .then(function () { stato.timer = setTimeout(chiedi, stato.aperto ? VELOCE : LENTO); });
  }

  /* ── scrivere ───────────────────────────────────────────────────────── */
  var ERRORI = {
    lunghezza: T('Il messaggio è vuoto o troppo lungo.'),
    collegamenti: T('Al massimo due collegamenti per messaggio.'),
    piano: T('Piano: un messaggio ogni pochi secondi.'),
    troppi: T('Hai scritto molto: riprova più tardi.'),
    doppio: T('Hai appena mandato lo stesso messaggio.'),
    bloccato: T('Non puoi più scrivere in questa chat.')
  };

  modulo.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = testo.value.trim();
    if (!t) return;
    scrivi('chat-nome', nome.value.trim());
    invia.disabled = true;
    esito.textContent = '';
    fetch(API + '/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testo: t, nome: nome.value.trim(), trappola: trappola.value })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, d: j }; }); })
      .then(function (x) {
        if (x.ok) {
          if (x.d.id) { stato.miei[x.d.id] = 1; try { sessionStorage.setItem('chat-miei', JSON.stringify(stato.miei)); } catch (e) {} }
          testo.value = '';
          return chiedi().then(function () { lista.scrollTop = lista.scrollHeight; });
        }
        esito.textContent = ERRORI[x.d.errore] || T('Non è partito: riprova.');
      })
      .catch(function () { esito.textContent = T('Non è partito: riprova.'); })
      .then(function () { invia.disabled = false; testo.focus(); });
  });
  testo.addEventListener('keydown', function (e) {
    // Invio manda, Maiusc+Invio va a capo
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); modulo.requestSubmit ? modulo.requestSubmit() : invia.click(); }
  });

  /* ── segnalare ──────────────────────────────────────────────────────── */
  var MOTIVI = [
    ['insulti', T('Insulti o molestie')],
    ['odio', T('Odio o discriminazione')],
    ['spam', T('Spam o pubblicità')],
    ['personali', T('Dati personali di qualcuno')],
    ['illegale', T('Contenuto illegale')],
    ['altro', T('Altro')]
  ];

  function segnala(li, id) {
    if (li.querySelector('.chat-seg')) return;
    var f = el('form', 'chat-seg');
    f.noValidate = true;
    var sel = el('select');
    sel.setAttribute('aria-label', T('Perché lo segnali'));
    MOTIVI.forEach(function (m) { var o = el('option', null, m[1]); o.value = m[0]; sel.appendChild(o); });
    var nota = el('input'); nota.type = 'text'; nota.maxLength = 300; nota.placeholder = T('Dettagli (facoltativo)');
    nota.setAttribute('aria-label', T('Dettagli (facoltativo)'));
    var mail = el('input'); mail.type = 'email'; mail.maxLength = 120; mail.placeholder = T('La tua email, per sapere cosa si decide (facoltativa)');
    mail.setAttribute('aria-label', T('La tua email, per sapere cosa si decide (facoltativa)'));
    var ok = el('button', null, T('Segnala')); ok.type = 'submit';
    var no = el('button', 'chat-annulla', T('Annulla')); no.type = 'button';
    var es = el('span', 'chat-seg-es'); es.setAttribute('role', 'status');
    [sel, nota, mail, ok, no, es].forEach(function (x) { f.appendChild(x); });
    no.addEventListener('click', function () { f.remove(); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      ok.disabled = true;
      fetch(API + '/chat/segnala', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id, motivo: sel.value, nota: nota.value, email: mail.value })
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, d: j }; }); })
        .then(function (x) {
          if (x.ok) { f.textContent = ''; f.appendChild(el('span', 'chat-seg-es', T('Grazie: la segnalazione è arrivata alla moderazione.'))); setTimeout(function () { f.remove(); }, 4000); }
          else { es.textContent = x.d.errore === 'email' ? T('L\'email non sembra valida.') : T('Non è partita: riprova.'); ok.disabled = false; }
        })
        .catch(function () { es.textContent = T('Non è partita: riprova.'); ok.disabled = false; });
    });
    li.appendChild(f);
    sel.focus();
  }

  /* ── apri e chiudi ──────────────────────────────────────────────────── */
  function apri(si) {
    stato.aperto = si;
    pan.hidden = !si;
    bottone.setAttribute('aria-expanded', String(si));
    document.documentElement.classList.toggle('chat-aperta', si);
    if (si) {
      lista.scrollTop = lista.scrollHeight;
      segnaVisto();
      testo.focus();
    } else {
      bottone.focus();
    }
    chiedi();
  }
  bottone.addEventListener('click', function () { apri(!stato.aperto); });
  chiudi.addEventListener('click', function () { apri(false); });
  pan.addEventListener('keydown', function (e) { if (e.key === 'Escape') apri(false); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) chiedi(); });

  // la pagina si chiude: il server smette subito di contarla fra i presenti
  addEventListener('pagehide', function () {
    try { navigator.sendBeacon(API + '/chat/via', JSON.stringify({ s: CODICE })); } catch (e) {}
  });

  bottone.hidden = true;            // compare solo se il servizio risponde e si e' in due
  document.body.appendChild(bottone);
  document.body.appendChild(pan);
  chiedi();
})();
