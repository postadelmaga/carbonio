/* ─────────────────────────────────────────────────────────────────────────
   live.js — legge da NOAA GML l'ultimo dato di Mauna Loa e aggiorna la pagina.

   Principio: un valore che arriva dalla rete non deve MAI poter peggiorare
   la pagina. I numeri incorporati in charts.js e nell'HTML sono gia' corretti
   e gia' disegnati quando questo file parte; se il fetch fallisce, se il
   formato cambia, o se il valore e' implausibile, non si tocca niente e si
   dichiara la data del dato di riserva.

   NOAA serve questi file con Access-Control-Allow-Origin: *, quindi non
   serve alcun proxy: il browser li legge direttamente.
   ───────────────────────────────────────────────────────────────────────── */
(function(){
  "use strict";

  var BASE   = 'https://gml.noaa.gov/webdata/ccgg/trends/co2/';
  var BAKED  = '12 settembre 2026';
  var TIMEOUT= 7000;
  var PREIND = 280;          /* ppm, riferimento preindustriale */

  var box  = document.getElementById('live');
  var note = document.getElementById('live-note');
  if(!box || !note) return;
  if(!window.fetch || !window.Promise){ fallback('Il browser non supporta l’aggiornamento automatico.'); return; }

  /* ogni valore ha copie altrove nella pagina (la sintesi finale): si
     aggiornano insieme all'originale tramite data-from="id" */
  function $(id){
    var e=document.getElementById(id);
    if(!e) return {set textContent(v){}};
    return {set textContent(v){
      e.textContent=v;
      var c=document.querySelectorAll('[data-from="'+id+'"]');
      for(var i=0;i<c.length;i++) c[i].textContent=v;
    }};
  }
  function fmt(n,d){ return n.toFixed(d).replace('.', ','); }

  function fallback(why){
    box.setAttribute('data-state','baked');
    note.textContent = 'Lettura in diretta non riuscita: mostro i valori salvati il ' + BAKED +
                       '. ' + (why || '');
  }

  /* da qui in poi il JavaScript c'e' e sta girando: solo ora ha senso
     promettere una lettura in diretta */
  note.textContent = 'Leggo l’ultimo dato da NOAA, l’agenzia meteo-oceanica statunitense…';

  function get(file){
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = ctl && setTimeout(function(){ ctl.abort(); }, TIMEOUT);
    return fetch(BASE + file, ctl ? {signal:ctl.signal} : undefined)
      .then(function(r){
        if(timer) clearTimeout(timer);
        if(!r.ok) throw new Error(file + ': HTTP ' + r.status);
        return r.text();
      });
  }

  /* le righe di commento iniziano con # ; le colonne sono separate da spazi */
  function rows(txt){
    var out=[], lines=txt.split('\n');
    for(var i=0;i<lines.length;i++){
      var l=lines[i].trim();
      if(!l || l.charAt(0)==='#') continue;
      var p=l.split(/\s+/).map(Number);
      if(p.length && !isNaN(p[0])) out.push(p);
    }
    return out;
  }

  Promise.all([ get('co2_annmean_mlo.txt'), get('co2_gr_mlo.txt') ])
    .then(function(res){

      var annual=[], gr=[];
      rows(res[0]).forEach(function(p){
        /* anno, media, incertezza */
        if(p.length>=2 && p[0]>1900 && p[0]<2200 && p[1]>250 && p[1]<1000) annual.push([p[0],p[1]]);
      });
      rows(res[1]).forEach(function(p){
        if(p.length>=2 && p[0]>1900 && p[0]<2200 && p[1]>-5 && p[1]<15) gr.push([p[0],p[1]]);
      });

      /* ── controlli di sanita': meglio il dato di riserva che uno sbagliato ── */
      var baked = window.Carbonio && window.Carbonio.bakedAnnual;
      if(!baked) throw new Error('charts.js non ha esposto i dati di riserva');
      var bLast = baked[baked.length-1];

      if(annual.length < 60)            throw new Error('serie troppo corta (' + annual.length + ' punti)');
      if(!gr.length)                    throw new Error('tassi di crescita non leggibili');

      var last = annual[annual.length-1];
      /* la concentrazione non scende e non fa salti assurdi: se il valore letto
         non sta fra quello incorporato -1 e +12 ppm, qualcosa non va nel file */
      if(last[1] < bLast[1] - 1 || last[1] > bLast[1] + 12){
        throw new Error('valore implausibile: ' + last[1] + ' ppm contro ' + bLast[1] + ' incorporato');
      }
      if(last[0] < bLast[0]){
        throw new Error('dato più vecchio di quello incorporato');
      }
      for(var i=1;i<annual.length;i++){
        if(annual[i][0] !== annual[i-1][0] + 1) throw new Error('serie con buchi negli anni');
      }

      var lastGr = null;
      for(var g=0; g<gr.length; g++){ if(gr[g][0]===last[0]) lastGr = gr[g][1]; }

      /* ── la serie mensile vera, se si riesce ad averla ──
         E' un di piu': senza, la curva usa la stagionalita' ricostruita. */
      return get('co2_mm_mlo.txt').then(function(txt){
        var m=[];
        rows(txt).forEach(function(p){
          /* anno, mese, data decimale, media mensile, destagionalizzata */
          if(p.length>=4 && p[2]>1950 && p[2]<2200 && p[3]>250 && p[3]<1000) m.push([p[2],p[3],(p.length>=5 && p[4]>250 && p[4]<1000) ? p[4] : NaN]);
        });
        return {annual:annual, last:last, gr:lastGr, grAll:gr, monthly:(m.length>600 ? m : null)};
      }).catch(function(){
        return {annual:annual, last:last, gr:lastGr, grAll:gr, monthly:null};
      });
    })
    .then(function(d){
      if(window.Carbonio && window.Carbonio.drawIce) window.Carbonio.drawIce(d.annual);
      if(window.Carbonio && window.Carbonio.drawKeeling){
        window.Carbonio.drawKeeling(d.annual, d.monthly);
      }
      /* lo zoom sugli ultimi anni: la serie mensile vera se c'e', altrimenti
         quella incorporata; i tassi di crescita letti ora in ogni caso */
      if(window.Carbonio && window.Carbonio.drawRecent){
        window.Carbonio.drawRecent(d.monthly, d.grAll);
      }

      $('live-mean').textContent = fmt(d.last[1], 2);
      $('live-year').textContent = d.last[0];
      $('live-pre').textContent  = '+' + Math.round((d.last[1]/PREIND - 1) * 100);
      if(d.gr !== null && d.gr !== undefined){
        $('live-gr').textContent = '+' + fmt(d.gr, 2);
      }

      box.setAttribute('data-state','live');
      note.textContent = 'Letti ora da NOAA (Global Monitoring Laboratory): media annua ' +
        d.last[0] + ', serie aggiornata alla pubblicazione più recente' +
        (d.monthly ? ', curva disegnata sulle medie mensili misurate.' : '.');
    })
    .catch(function(err){
      fallback('Lettura non riuscita: ' + (err && err.message ? err.message : 'errore di rete') + '.');
    });
})();

/* ─────────────────────────────────────────────────────────────────────────
   Secondo blocco, indipendente dal primo: temperatura, altri gas serra e
   budget residuo. Se NOAA risponde per la CO2 ma non per la temperatura (o
   viceversa) l'altro pezzo non ne risente.
   ───────────────────────────────────────────────────────────────────────── */
(function(){
  "use strict";

  /* NCEI rifiuta con 404 un anno finale nel futuro, quindi l'intervallo deve
     finire sull'anno corrente. Se l'orologio del client e' avanti (o l'anno e'
     appena cambiato e la serie non e' ancora pubblicata) si ripiega su quello
     prima. */
  function nceiUrl(year){
    return 'https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/' +
           'global/time-series/globe/land_ocean/12/12/1850-' + year + '/data.json';
  }
  var GML  = 'https://gml.noaa.gov/webdata/ccgg/trends/';
  var BAKED= '12 settembre 2026';
  var TIMEOUT = 7000;

  /* GCB 2025: 170 GtCO2 restanti contati dall'inizio del 2026, 42,2 GtCO2/anno nel 2025 */
  var BUD0 = 170, RATE = 42.2, BUD_FROM = Date.UTC(2026,0,1);

  /* NCEI pubblica sulla base 1901-2000; l'obiettivo di Parigi si riferisce
     alla media 1850-1900. Lo scarto viene ricalcolato dalla serie letta,
     cosi' non resta appeso a una costante che invecchia. */
  function offset(v){
    var s=0,n=0;
    for(var y=1850;y<=1900;y++){ if(v[y]!==undefined){ s+=v[y]; n++; } }
    return n>40 ? s/n : -0.169;
  }

  var box  = document.getElementById('live-t');
  var note = document.getElementById('lt-note');
  if(!box || !note) return;
  /* ogni valore ha copie altrove nella pagina (la sintesi finale): si
     aggiornano insieme all'originale tramite data-from="id" */
  function $(id){
    var e=document.getElementById(id);
    if(!e) return {set textContent(v){}};
    return {set textContent(v){
      e.textContent=v;
      var c=document.querySelectorAll('[data-from="'+id+'"]');
      for(var i=0;i<c.length;i++) c[i].textContent=v;
    }};
  }
  function fmt(n,d){ return n.toFixed(d).replace('.', ','); }

  /* ── il budget e' una sottrazione, non una lettura: si aggiorna da solo ── */
  (function budget(){
    var yrs = (Date.now() - BUD_FROM) / (365.25*24*3600*1000);
    var left = BUD0 - yrs*RATE;
    if(left > 0){
      $('lt-bud').textContent = String(Math.round(left));
      $('lt-yrs').textContent = fmt(left/RATE, 1);
    } else {
      $('lt-bud').textContent = '0';
      $('lt-yrs').textContent = '0';
    }
  })();

  if(!window.fetch || !window.Promise) return;
  note.textContent = 'Leggo temperatura e gas serra da NOAA…';

  function get(url){
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = ctl && setTimeout(function(){ ctl.abort(); }, TIMEOUT);
    return fetch(url, ctl ? {signal:ctl.signal} : undefined).then(function(r){
      if(timer) clearTimeout(timer);
      if(!r.ok) throw new Error('HTTP ' + r.status);
      return r;
    });
  }
  function annmean(txt){
    var out={}, lines=txt.split('\n');
    for(var i=0;i<lines.length;i++){
      var l=lines[i].trim();
      if(!l || l.charAt(0)==='#') continue;
      var p=l.split(/\s+/).map(Number);
      if(p.length>=2 && p[0]>1900 && p[0]<2200 && p[1]>0) out[p[0]]=p[1];
    }
    return out;
  }
  function latest(o){
    var k=Object.keys(o).map(Number).sort(function(a,b){return a-b;});
    return k.length ? [k[k.length-1], o[k[k.length-1]]] : null;
  }

  var done = [];

  var thisYear = new Date().getFullYear();
  var pTemp = get(nceiUrl(thisYear))
    .catch(function(){ return get(nceiUrl(thisYear-1)); })
    .then(function(r){ return r.json(); }).then(function(j){
    var raw=j && j.data; if(!raw) throw new Error('formato NCEI inatteso');
    var v={};
    for(var k in raw){
      var y=Number(k), dep=raw[k] && Number(raw[k].departure);
      if(y>1800 && y<2200 && !isNaN(dep) && dep>-5 && dep<10) v[y]=dep;
    }
    var years=Object.keys(v).map(Number).sort(function(a,b){return a-b;});
    if(years.length < 150) throw new Error('serie temperatura troppo corta');

    var off=offset(v);
    var series=[], i;
    for(i=0;i<years.length;i++) series.push([years[i], Math.round((v[years[i]]-off)*100)/100]);

    var baked = window.Carbonio && window.Carbonio.bakedTemp;
    var last  = series[series.length-1];
    if(baked){
      var bl = baked[baked.length-1];
      if(last[0] < bl[0]) throw new Error('temperatura piu vecchia di quella incorporata');
      if(last[1] < bl[1] - 0.6 || last[1] > bl[1] + 0.6) throw new Error('anomalia implausibile: ' + last[1]);
    }

    if(window.Carbonio && window.Carbonio.drawTemp) window.Carbonio.drawTemp(series);
    if(window.Carbonio && window.Carbonio.drawRecent) window.Carbonio.drawRecent(null, null, series);
    $('lt-last').textContent = (last[1]>=0?'+':'') + fmt(last[1],2);
    $('lt-year').textContent = last[0];
    var dec=0,n=0;
    for(i=series.length-1;i>=0 && n<10;i--,n++) dec+=series[i][1];
    $('lt-dec').textContent = (dec/n>=0?'+':'') + fmt(dec/n,2);
    done.push('temperatura');
  });

  var pGas = Promise.all([
    get(GML+'ch4/ch4_annmean_gl.txt').then(function(r){return r.text();}),
    get(GML+'n2o/n2o_annmean_gl.txt').then(function(r){return r.text();}),
    get(GML+'co2/co2_annmean_gl.txt').then(function(r){return r.text();})
  ]).then(function(t){
    var ch4=latest(annmean(t[0])), n2o=latest(annmean(t[1])), co2=latest(annmean(t[2]));
    if(ch4 && ch4[1]>1500 && ch4[1]<3000) $('g-ch4').textContent = String(Math.round(ch4[1]));
    if(n2o && n2o[1]>250  && n2o[1]<500)  $('g-n2o').textContent = fmt(n2o[1],1);
    if(co2 && co2[1]>350  && co2[1]<700)  $('g-co2').textContent = fmt(co2[1],1);
    done.push('gas serra');
  });

  Promise.all([pTemp.catch(function(e){return e;}), pGas.catch(function(e){return e;})])
    .then(function(){
      if(done.length===2){
        box.setAttribute('data-state','live');
        note.textContent = 'Letti ora da NOAA: temperatura dal centro NCEI, gas serra dal laboratorio GML. ' +
          'Il budget residuo è una sottrazione dal valore del Global Carbon Budget 2025, non una misura.';
      } else if(done.length===1){
        /* meta' fresco e meta' di riserva: non e' onesto accendere il verde */
        box.setAttribute('data-state','partial');
        note.textContent = 'Letto in diretta: ' + done[0] + '. Per il resto mostro i valori ' +
          'salvati il ' + BAKED + '.';
      } else {
        box.setAttribute('data-state','baked');
        note.textContent = 'Lettura in diretta non riuscita: mostro i valori salvati il ' + BAKED + '.';
      }
    });
})();
