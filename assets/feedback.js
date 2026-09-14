/* ─────────────────────────────────────────────────────────────────────────
   feedback.js — le reazioni sotto ogni sezione e la bacheca.

   Due comportamenti in un file solo, perche' parlano con lo stesso servizio:
   sotto ogni sezione una riga con «ti e' servita?» e «e' chiara?», e nella
   pagina dedicata il modulo per scrivere e l'elenco dei messaggi approvati.

   Niente cookie: cosa hai gia' votato resta in localStorage, che e' tuo e non
   viaggia. Se il servizio non risponde, la riga delle reazioni sparisce e la
   pagina resta esattamente com'era: il feedback e' un di piu', non un pezzo
   necessario del documento.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  function T(s) { var d = window.I18N; return (d && d[s]) || s; }

  var API = window.BACHECA_API || '/api';
  var LINGUA = document.documentElement.getAttribute('data-lingua') || 'it';

  function letto(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function scrivi(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function invia(percorso, dati) {
    return fetch(API + percorso, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dati)
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, dati: j }; }); });
  }

  /* ── reazioni sotto ogni sezione ───────────────────────────────────── */
  /* Le etichette passano da T() qui, dove il build le trova ed estrae, non al
     momento dell'uso: le emoji restano com'e', un pollice e' un pollice. */
  function gruppi() {
    return [
      { domanda: T('Ti è servita?'), bottoni: [
          { tipo: 'su',      etichetta: '👍',          titolo: T('Sì, mi è servita') },
          { tipo: 'giu',     etichetta: '👎',          titolo: T('No, non mi è servita') } ] },
      { domanda: T('È chiara?'),     bottoni: [
          { tipo: 'chiaro',  etichetta: T('Sì'),       titolo: T('Sì, è chiara') },
          { tipo: 'confuso', etichetta: T('Poco'),     titolo: T('No, poco chiara') } ] }
    ];
  }

  function riga(sezione, conteggi) {
    var box = document.createElement('div');
    box.className = 'reaz';
    box.setAttribute('data-sez', sezione);
    gruppi().forEach(function (g) {
      var gr = document.createElement('span');
      gr.className = 'reaz-g';
      var d = document.createElement('span');
      d.className = 'reaz-d';
      d.textContent = g.domanda;
      gr.appendChild(d);
      g.bottoni.forEach(function (b) {
        var t = document.createElement('button');
        t.type = 'button';
        t.className = 'reaz-b reaz-' + b.tipo;
        t.setAttribute('data-tipo', b.tipo);
        t.title = b.titolo;
        t.setAttribute('aria-label', b.titolo);
        t.innerHTML = '<span class="reaz-e">' + b.etichetta + '</span><span class="reaz-n"></span>';
        gr.appendChild(t);
      });
      box.appendChild(gr);
    });
    var g = document.createElement('span');
    g.className = 'reaz-grazie';
    g.setAttribute('role', 'status');
    box.appendChild(g);
    aggiorna(box, conteggi);
    return box;
  }

  function aggiorna(box, conteggi) {
    conteggi = conteggi || {};
    var sez = box.getAttribute('data-sez');
    var scelto = letto('reaz:' + sez) || '';
    Array.prototype.forEach.call(box.querySelectorAll('.reaz-b'), function (b) {
      var tipo = b.getAttribute('data-tipo');
      var n = conteggi[tipo] || 0;
      b.querySelector('.reaz-n').textContent = n ? n : '';
      if (scelto.split(',').indexOf(tipo) >= 0) b.classList.add('is-scelto');
    });
  }

  function attacca(conteggi) {
    var sezioni = document.querySelectorAll('.wrap > section[id]');
    Array.prototype.forEach.call(sezioni, function (s) {
      var box = riga(s.id, conteggi[s.id]);
      s.appendChild(box);
      box.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('.reaz-b');
        if (!b || b.disabled) return;
        var tipo = b.getAttribute('data-tipo');
        var gruppo = b.parentNode;
        Array.prototype.forEach.call(gruppo.querySelectorAll('.reaz-b'), function (x) { x.disabled = true; });
        invia('/reazione', { sezione: s.id, tipo: tipo }).then(function (r) {
          if (!r.ok) return;
          var prima = letto('reaz:' + s.id);
          scrivi('reaz:' + s.id, prima ? prima + ',' + tipo : tipo);
          aggiorna(box, r.dati.reazioni);
          b.classList.add('is-scelto');
          box.querySelector('.reaz-grazie').textContent = T('grazie');
        }).catch(function () {});
      });
    });
  }

  /* ── la bacheca ────────────────────────────────────────────────────── */
  function quando(ts, lingua) {
    var d = new Date(ts * 1000);
    try { return d.toLocaleDateString(lingua === 'zh' ? 'zh-CN' : lingua, { year: 'numeric', month: 'long', day: 'numeric' }); }
    catch (e) { return d.toISOString().slice(0, 10); }
  }

  function disegnaMessaggi(lista, messaggi) {
    lista.innerHTML = '';
    if (!messaggi.length) {
      var p = document.createElement('p');
      p.className = 'bac-vuoto';
      p.textContent = T('Ancora nessun messaggio pubblicato. Il primo può essere il tuo.');
      lista.appendChild(p);
      return;
    }
    messaggi.forEach(function (m) {
      var li = document.createElement('li');
      li.className = 'bac-m';
      var testa = document.createElement('p');
      testa.className = 'bac-testa';
      testa.innerHTML = '<b>' + (m.nome ? escapa(m.nome) : T('anonimo')) + '</b><span>' +
                        quando(m.ts, LINGUA) + (m.lingua && m.lingua !== LINGUA ? ' · ' + m.lingua : '') + '</span>';
      var corpo = document.createElement('p');
      corpo.className = 'bac-testo';
      corpo.textContent = m.testo;
      li.appendChild(testa); li.appendChild(corpo);
      if (m.risposta) {
        var r = document.createElement('p');
        r.className = 'bac-risposta';
        r.innerHTML = '<span>' + T('risposta') + '</span>' + escapa(m.risposta);
        li.appendChild(r);
      }
      lista.appendChild(li);
    });
  }

  function escapa(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function bacheca(messaggi) {
    var lista = document.getElementById('bac-lista');
    if (lista) disegnaMessaggi(lista, messaggi);
    var modulo = document.getElementById('bac-modulo');
    if (!modulo) return;
    modulo.addEventListener('submit', function (e) {
      e.preventDefault();
      var testo = modulo.testo.value.trim();
      var esito = document.getElementById('bac-esito');
      if (testo.length < 5) { esito.textContent = T('Scrivi qualcosa di più lungo.'); return; }
      var bottone = modulo.querySelector('button[type=submit]');
      bottone.disabled = true;
      esito.textContent = T('Invio…');
      invia('/messaggio', {
        testo: testo,
        nome: modulo.nome.value.trim(),
        lingua: LINGUA,
        trappola: modulo.sito.value
      }).then(function (r) {
        if (r.ok) {
          modulo.reset();
          esito.textContent = T('Ricevuto. Comparirà qui dopo una lettura: la bacheca è moderata, non per censura ma per tenere fuori lo spam.');
        } else {
          esito.textContent = r.dati && r.dati.errore === 'troppi messaggi'
            ? T('Hai già scritto tre messaggi oggi. Torna domani.')
            : T('Non è andata. Riprova fra poco.');
        }
        bottone.disabled = false;
      }).catch(function () {
        esito.textContent = T('Non è andata. Riprova fra poco.');
        bottone.disabled = false;
      });
    });
  }

  /* ── avvio ─────────────────────────────────────────────────────────── */
  fetch(API + '/stato', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (document.querySelector('.wrap > section[id]')) attacca(d.reazioni || {});
      bacheca(d.messaggi || []);
    })
    .catch(function () { bacheca([]); });
})();
