(function(){
  "use strict";
  /* i colori restano riferimenti CSS vivi: cosi il toggle del tema ridipinge
     anche gli SVG, che altrimenti conserverebbero l'esadecimale del primo paint */
  function tok(n){ return 'var(' + n + ')'; }

  var NS='http://www.w3.org/2000/svg';
  function el(n,a){
    var e=document.createElementNS(NS,n);
    for(var k in a){
      var v=String(a[k]);
      if((k==='fill'||k==='stroke') && v.indexOf('var(')===0){ e.style.setProperty(k,v); }
      else { e.setAttribute(k,a[k]); }
    }
    return e;
  }
  /* T(): la stessa pagina in quattro lingue senza quattro copie del codice.
     window.I18N lo scrive la versione tradotta; in italiano non c'è e la
     funzione restituisce la stringa così com'è. DEC è il separatore decimale,
     che cambia con la lingua (inglese e cinese usano il punto).
     Si chiama tr() e non T() perché T è già il margine superiore del primo
     grafico: una sola lettera e il grafico non si disegna più. */
  function tr(s){ var d=window.I18N; return (d && d[s]) || s; }
  var DEC = (window.I18N && window.I18N._dec) || ',';
  function it(n,d){ return n.toFixed(d===undefined?1:d).replace('.',DEC); }

  /* Sul telefono i grafici sono disegnati su 460 unita' invece di 880: piu'
     stretti e piu' alti, con etichette accorciate, cosi' entrano nello
     schermo senza scorrere e i testi restano leggibili. La scelta e' fatta
     al caricamento: alla rotazione il grafico resta com'e'. */
  var NARROW = !!(window.matchMedia && window.matchMedia('(max-width:640px)').matches);
  var CHART_W = NARROW ? 460 : 880;
  function fitBox(s,w,h){ if(s) s.setAttribute('viewBox','0 0 '+w+' '+h); }

  /* ════════════════════ dati di riserva ════════════════════
     Questi valori sono incorporati perche' la pagina deve restare corretta
     con JavaScript attivo ma rete assente, o se NOAA non risponde. live.js
     li sostituisce con la lettura in diretta quando ci riesce.
     Medie annue di Mauna Loa, NOAA GML, aggiornate al 12 settembre 2026. */
  var ANNUAL = [
    [1959,315.98],[1960,316.91],[1961,317.64],[1962,318.45],[1963,318.99],[1964,319.62],
    [1965,320.04],[1966,321.37],[1967,322.18],[1968,323.05],[1969,324.62],[1970,325.68],
    [1971,326.32],[1972,327.46],[1973,329.68],[1974,330.19],[1975,331.13],[1976,332.03],
    [1977,333.84],[1978,335.41],[1979,336.84],[1980,338.76],[1981,340.12],[1982,341.48],
    [1983,343.15],[1984,344.88],[1985,346.35],[1986,347.61],[1987,349.31],[1988,351.69],
    [1989,353.20],[1990,354.45],[1991,355.70],[1992,356.54],[1993,357.21],[1994,358.96],
    [1995,360.97],[1996,362.74],[1997,363.88],[1998,366.84],[1999,368.54],[2000,369.71],
    [2001,371.32],[2002,373.45],[2003,375.98],[2004,377.70],[2005,379.98],[2006,382.09],
    [2007,384.02],[2008,385.83],[2009,387.64],[2010,390.10],[2011,391.85],[2012,394.06],
    [2013,396.74],[2014,398.87],[2015,401.01],[2016,404.41],[2017,406.76],[2018,408.72],
    [2019,411.65],[2020,414.21],[2021,416.41],[2022,418.53],[2023,421.08],[2024,424.61],
    [2025,427.35]
  ];

  /* ════════════════════ curva di Keeling ════════════════════ */
  var svg = document.getElementById('keeling');
  var W=CHART_W,H=400, L=54, R=NARROW?96:118, T=22, B=44;
  var x0=L, x1=W-R, y0=T, y1=H-B;
  var yMin=305, yMax=435;
  var xMin=1959, xMax=2027.0;

  function X(yr){ return x0 + (yr-xMin)/(xMax-xMin)*(x1-x0); }
  function Y(v){ return y1 - (v-yMin)/(yMax-yMin)*(y1-y0); }

  /* monthly: se assente, la stagionalita' viene ricostruita dalle medie annue
     (va bene per la forma della curva, non per leggerci un singolo mese).
     live.js passa qui la serie mensile vera di NOAA quando riesce a leggerla. */
  function drawKeeling(annual, monthly){
    if(!svg) return;
    fitBox(svg,W,H);
    while(svg.firstChild) svg.removeChild(svg.firstChild);
    var frag=document.createDocumentFragment();
    var last=annual[annual.length-1];

    for(var v=310; v<=430; v+=20){
      frag.appendChild(el('line',{x1:x0,x2:x1,y1:Y(v),y2:Y(v),class:'grid-l'}));
      var t=el('text',{x:x0-10,y:Y(v)+4,class:'svg-lab','text-anchor':'end'});
      t.textContent=v; frag.appendChild(t);
    }
    var yu=el('text',{x:x0-10,y:Y(430)-16,class:'svg-unit','text-anchor':'end'});
    yu.textContent='ppm'; frag.appendChild(yu);

    frag.appendChild(el('line',{x1:x0,x2:x1,y1:y1,y2:y1,class:'axis-l'}));
    [1960,1970,1980,1990,2000,2010,2020].forEach(function(yr){
      frag.appendChild(el('line',{x1:X(yr),x2:X(yr),y1:y1,y2:y1+5,class:'axis-l'}));
      var t=el('text',{x:X(yr),y:y1+22,class:'svg-lab','text-anchor':'middle'});
      t.textContent=yr; frag.appendChild(t);
    });

    var mp=[];
    if(monthly && monthly.length>100){
      mp = monthly;
    } else {
      for(var i=0;i<annual.length;i++){
        var yr=annual[i][0], base=annual[i][1];
        var amp = 2.65 + 0.010*(yr-1959);
        for(var m=1;m<=12;m++){
          var frac=(m-0.5)/12;
          var interp = (i<annual.length-1)
            ? base + (annual[i+1][1]-base)*frac
            : base + 2.4*frac;
          mp.push([yr+frac, interp + amp*Math.cos(2*Math.PI*(m-5.2)/12)]);
        }
      }
    }
    var d='';
    for(var j=0;j<mp.length;j++){ d += (j?'L':'M') + X(mp[j][0]).toFixed(1) + ' ' + Y(mp[j][1]).toFixed(1); }
    frag.appendChild(el('path',{d:d,fill:'none',stroke:tok('--atmos'),'stroke-width':1,'stroke-opacity':.55,'stroke-linejoin':'round'}));

    var da='';
    for(var k=0;k<annual.length;k++){ da += (k?'L':'M') + X(annual[k][0]+0.5).toFixed(1) + ' ' + Y(annual[k][1]).toFixed(1); }
    frag.appendChild(el('path',{d:da,fill:'none',stroke:tok('--source'),'stroke-width':2.4,'stroke-linecap':'round','stroke-linejoin':'round'}));

    function at(yr){
      for(var i=0;i<annual.length;i++){ if(annual[i][0]===yr) return annual[i][1]; }
      return null;
    }
    var anchors=NARROW ? [[1960,'1960'],[1980,'1980'],[2000,'2000']] : [[1960,'1960'],[1980,'1980'],[2000,'2000'],[2020,'2020']];
    anchors.push([last[0], String(last[0])]);
    anchors.forEach(function(a){
      var val=at(a[0]); if(val===null) return;
      var px=X(a[0]+0.5), py=Y(val);
      frag.appendChild(el('circle',{cx:px,cy:py,r:5.5,fill:tok('--surface'),stroke:tok('--source'),'stroke-width':2.4}));
      /* sotto-destra: la curva sale verso destra, quindi li' non c'e' niente */
      var lastPt = a[0]===last[0];
      var tv=el('text',{x:px+12,y:lastPt?py-8:py+16,class:'svg-val','text-anchor':'start'});
      tv.textContent=Math.round(val); frag.appendChild(tv);
      var tl=el('text',{x:px+12,y:lastPt?py+8:py+31,class:'svg-unit','text-anchor':'start'});
      tl.textContent=a[1]; frag.appendChild(tl);
    });

    function rateNote(yr, txt, dy){
      var val=at(Math.round(yr)); if(val===null) return;
      var t1=el('text',{x:X(yr),y:Y(val)+dy,class:'svg-lab-b','text-anchor':'middle'});
      t1.style.fill=tok('--source'); t1.textContent=txt; frag.appendChild(t1);
    }
    if(NARROW){ rateNote(1969,'+'+it(0.9,1)+tr('/anno'),-36); rateNote(2005,'+'+it(2.4,1)+tr('/anno'),80); }
    else { rateNote(1968,'+'+it(0.9,1)+' '+tr('ppm/anno'),-20); rateNote(2012,'+'+it(2.4,1)+' '+tr('ppm/anno'),58); }

    frag.appendChild(el('line',{x1:X(last[0]+0.5),x2:X(last[0]+0.5),y1:Y(last[1]),y2:y1,
      stroke:tok('--source'),'stroke-width':1,'stroke-dasharray':'3 3','stroke-opacity':.6}));

    svg.appendChild(frag);
  }

  drawKeeling(ANNUAL, null);

  /* ════════════════════ bilancio globale ════════════════════
     Global Carbon Budget 2025, media 2015-2024, convertito da GtC con
     1 GtC = 3,664 GtCO2. Lo squilibrio e' una voce pubblicata, non un
     arrotondamento: fonti e pozzi sono misurati con metodi indipendenti. */
  var bs=document.getElementById('budget');
  if(bs){
    var BW=CHART_W;
    fitBox(bs,BW,340);
    var bx0=NARROW?16:30, bx1=BW-bx0;
    var barW=bx1-bx0;
    var topY=58, topH=42;
    var botY=190, botH=54;

    var FOSSIL=35.9, LUC=5.0;
    var total=40.9;
    var parts=[
      {k:'ocean',v:11.8,c:tok('--ocean'),lab:tr('Oceano'),     pct:'29%'},
      {k:'land', v:8.7, c:tok('--land'), lab:tr('Vegetazione'),pct:'21%'},
      {k:'atmos',v:20.4,c:tok('--atmos'),lab:tr('Atmosfera'),  pct:'50%'}
    ];
    /* Incertezze pubblicate dal Global Carbon Budget 2025, da GtC a GtCO2.
       Disegnarle e' il punto: il pozzo terrestre e' noto molto peggio dei
       fossili, e un rettangolo dal bordo netto lo nasconde. */
    var UNC={ocean:1.5, land:2.9, atmos:0.1};

    var bf=document.createDocumentFragment();

    var defs=el('defs',{});
    var pat=el('pattern',{id:'hatch',width:6,height:6,patternUnits:'userSpaceOnUse',patternTransform:'rotate(45)'});
    pat.appendChild(el('rect',{width:6,height:6,fill:tok('--source'),'fill-opacity':.22}));
    pat.appendChild(el('rect',{width:2.4,height:6,fill:tok('--source')}));
    defs.appendChild(pat); bf.appendChild(defs);

    var fossilW = barW*(FOSSIL/total), lucW = barW*(LUC/total);
    bf.appendChild(el('rect',{x:bx0,y:topY,width:fossilW-1,height:topH,fill:tok('--source'),rx:3}));
    bf.appendChild(el('rect',{x:bx0+fossilW+1,y:topY,width:lucW-1,height:topH,fill:'url(#hatch)',stroke:tok('--source'),'stroke-width':1,rx:3}));

    var th=el('text',{x:bx0,y:topY-24,class:'svg-lab-b'}); th.textContent=tr('EMESSO OGNI ANNO');
    th.setAttribute('letter-spacing','.08em'); bf.appendChild(th);
    var tt=el('text',{x:bx0,y:topY-6,class:'svg-val'}); tt.style.fontSize=NARROW?'15px':'17px';
    tt.textContent=NARROW?(it(40.9,1)+' GtCO₂ = '+it(5.3,1)+' ppm'):tr('40,9 GtCO₂, cioè 5,3 ppm se restassero tutte in aria'); bf.appendChild(tt);

    var f1=el('text',{x:bx0+12,y:topY+27,class:'svg-val'}); f1.style.fill=tok('--ink');
    f1.textContent=tr('Fossili e cemento')+'  '+it(FOSSIL,1); bf.appendChild(f1);
    var f2=el('text',{x:bx1,y:topY-6,class:'svg-val','text-anchor':'end'}); f2.style.fill=tok('--source');
    f2.textContent=tr('Uso del suolo')+'  '+it(LUC,1); bf.appendChild(f2);

    var acc=0;
    parts.forEach(function(p){
      var w=barW*(p.v/total);
      var sxA=bx0+acc, sxB=bx0+acc+w;
      var gap=6;
      var dxA=bx0+acc+ (acc>0?gap/2:0);
      var dxB=bx0+acc+w- (acc+w<barW?gap/2:0);
      var ty=topY+topH, by=botY;
      var mid=(ty+by)/2;
      var path='M'+sxA+' '+ty+
               ' C'+sxA+' '+mid+' '+dxA+' '+mid+' '+dxA+' '+by+
               ' L'+dxB+' '+by+
               ' C'+dxB+' '+mid+' '+sxB+' '+mid+' '+sxB+' '+ty+' Z';
      bf.appendChild(el('path',{d:path,fill:p.c,'fill-opacity':.16}));
      acc+=w;
    });

    acc=0;
    parts.forEach(function(p,idx){
      var w=barW*(p.v/total);
      var gap=6;
      var xA=bx0+acc+(idx>0?gap/2:0);
      var ww=w-(idx>0?gap/2:0)-(idx<parts.length-1?gap/2:0);
      bf.appendChild(el('rect',{x:xA,y:botY,width:ww,height:botH,fill:p.c,rx:3}));
      /* il blocco "non spiegato" e' troppo stretto per contenere il testo:
         la sua etichetta esce sopra il blocco invece che dentro */
      {
        var lb=el('text',{x:xA+11,y:botY+24,class:'svg-lab-b'}); if(NARROW) lb.style.fontSize='12px';
        lb.style.fill = p.k==='atmos' ? tok('--surface') : tok('--ink'); if(p.k==='atmos') lb.style.stroke='none';
        lb.textContent=p.lab; bf.appendChild(lb);
        var vv=el('text',{x:xA+11,y:botY+44,class:'svg-val'}); if(NARROW) vv.style.fontSize='12px';
        vv.style.fill = p.k==='atmos' ? tok('--surface') : tok('--ink'); if(p.k==='atmos') vv.style.stroke='none';
        vv.textContent=NARROW ? it(p.v)+' · '+p.pct : it(p.v)+' GtCO₂ · '+p.pct; bf.appendChild(vv);
      }
      /* baffo di incertezza: stessa scala x dei blocchi, cosi' la larghezza
         del baffo si confronta a occhio con la larghezza del blocco */
      var u=UNC[p.k];
      if(u){
        var uw=barW*(u/total), cx=xA+ww/2, uy=botY+botH+9;
        if(uw>=5){
          bf.appendChild(el('line',{x1:cx-uw,x2:cx+uw,y1:uy,y2:uy,
            stroke:tok('--ink-3'),'stroke-width':1.4}));
          bf.appendChild(el('line',{x1:cx-uw,x2:cx-uw,y1:uy-4,y2:uy+4,stroke:tok('--ink-3'),'stroke-width':1.4}));
          bf.appendChild(el('line',{x1:cx+uw,x2:cx+uw,y1:uy-4,y2:uy+4,stroke:tok('--ink-3'),'stroke-width':1.4}));
        }
        var ut=el('text',{x:cx,y:uy+18,class:'svg-unit','text-anchor':'middle'});
        ut.textContent='±'+it(u); bf.appendChild(ut);
      }
      acc+=w;
    });

    var ax=bx0+barW*((11.8+8.7)/total);
    var a1=el('text',{x:bx0,y:botY+botH+52,class:'svg-lab'});
    var assorbito = it(parts[0].v + parts[1].v, 1);
    a1.textContent=NARROW?tr('ASSORBITO')+' '+assorbito+' (50%)':tr('ASSORBITO')+' — '+assorbito+' GtCO₂ (50%)'; a1.setAttribute('letter-spacing','.06em'); bf.appendChild(a1);
    bf.appendChild(el('line',{x1:bx0,x2:ax-4,y1:botY+botH+62,y2:botY+botH+62,stroke:tok('--rule-strong'),'stroke-width':2}));

    var a2=el('text',{x:ax+8,y:botY+botH+52,class:'svg-lab'});
    a2.style.fill=tok('--source');
    var inAria = it(parts[2].v,1), inPpm = it(parts[2].v/7.78,1);
    a2.textContent=NARROW?tr('IN ARIA')+' '+inAria+' = '+inPpm+' ppm':tr('RESTA IN ARIA')+' — '+inAria+' GtCO₂ = '+inPpm+' '+tr('ppm all’anno'); a2.setAttribute('letter-spacing','.06em'); bf.appendChild(a2);
    bf.appendChild(el('line',{x1:ax+4,x2:bx1,y1:botY+botH+62,y2:botY+botH+62,stroke:tok('--source'),'stroke-width':2}));

    bs.appendChild(bf);
  }

  /* ════════════════════ due scale a confronto ════════════════════
     Tasso di crescita NOAA: Mauna Loa (una stazione) contro la media
     globale (stazioni marine remote). Nel 2023 e 2024 le due si invertono. */
  var ds=document.getElementById('duescale');
  if(ds){
    var SERIES=[
      {y:2021, mlo:2.35, glob:2.38},
      {y:2022, mlo:1.84, glob:2.24},
      {y:2023, mlo:3.32, glob:2.70},
      {y:2024, mlo:3.33, glob:3.76},
      {y:2025, mlo:2.23, glob:2.06}
    ];
    var DW=CHART_W, dx0=58, dx1=DW-20, dy0=34, dy1=250;
    fitBox(ds,DW,290);
    var dMax=4;
    function DY(v){ return dy1 - v/dMax*(dy1-dy0); }

    var df=document.createDocumentFragment();

    for(var gv=0; gv<=4; gv++){
      df.appendChild(el('line',{x1:dx0,x2:dx1,y1:DY(gv),y2:DY(gv),class:gv===0?'axis-l':'grid-l'}));
      var gt=el('text',{x:dx0-10,y:DY(gv)+4,class:'svg-lab','text-anchor':'end'});
      gt.textContent=gv; df.appendChild(gt);
    }
    var du=el('text',{x:dx0-10,y:DY(4)-14,class:'svg-unit','text-anchor':'end'});
    du.textContent='ppm'; df.appendChild(du);

    var slot=(dx1-dx0)/SERIES.length;
    var bw=Math.min(54,(slot-(NARROW?14:34))/2);
    SERIES.forEach(function(s,i){
      var cx=dx0+slot*(i+0.5);
      var xa=cx-bw-5, xb=cx+5;

      df.appendChild(el('rect',{x:xa,y:DY(s.mlo),width:bw,height:dy1-DY(s.mlo),fill:tok('--source'),rx:2}));
      df.appendChild(el('rect',{x:xb,y:DY(s.glob),width:bw,height:dy1-DY(s.glob),fill:tok('--atmos'),rx:2}));

      var v1=el('text',{x:xa+bw/2,y:DY(s.mlo)-7,class:'svg-val','text-anchor':'middle'});
      v1.textContent=it(s.mlo,2); df.appendChild(v1);
      var v2=el('text',{x:xb+bw/2,y:DY(s.glob)-7,class:'svg-val','text-anchor':'middle'});
      v2.textContent=it(s.glob,2); df.appendChild(v2);

      var yl=el('text',{x:cx,y:dy1+22,class:'svg-lab-b','text-anchor':'middle'});
      yl.textContent=s.y; df.appendChild(yl);
    });

    /* i due anni in cui le serie si invertono: e' il punto del grafico.
       La parentesi sta SOTTO la riga degli anni (dy1+22), non sopra, o
       finisce esattamente sulle etichette. */

    ds.appendChild(df);
  }


  /* ════════════════════ temperatura ════════════════════
     NOAAGlobalTemp, anomalia annua terre+oceani. NCEI la pubblica sulla base
     1901-2000; qui e' riportata alla media 1850-1900 (lo scarto, -0,169 °C,
     e' ricavato dalla serie stessa) perche' e' la base dell'obiettivo 1,5 °C. */
  var TEMP = [
    [1850,0.02],[1851,0.11],[1852,0.15],[1853,0.10],[1854,0.12],[1855,0.09],[1856,0.04],
    [1857,-0.02],[1858,0.03],[1859,0.10],[1860,-0.03],[1861,-0.08],[1862,-0.15],[1863,-0.08],
    [1864,-0.06],[1865,0.13],[1866,0.05],[1867,-0.04],[1868,0.04],[1869,0.09],[1870,-0.01],
    [1871,-0.00],[1872,0.01],[1873,-0.00],[1874,-0.06],[1875,-0.04],[1876,-0.06],[1877,0.25],
    [1878,0.27],[1879,-0.00],[1880,-0.02],[1881,0.07],[1882,-0.01],[1883,-0.01],[1884,-0.11],
    [1885,-0.06],[1886,-0.10],[1887,-0.18],[1888,0.04],[1889,0.11],[1890,-0.15],[1891,-0.07],
    [1892,-0.15],[1893,-0.16],[1894,-0.16],[1895,-0.06],[1896,0.04],[1897,0.05],[1898,-0.09],
    [1899,0.01],[1900,0.09],[1901,0.05],[1902,-0.05],[1903,-0.16],[1904,-0.22],[1905,-0.10],
    [1906,-0.01],[1907,-0.18],[1908,-0.22],[1909,-0.21],[1910,-0.18],[1911,-0.20],[1912,-0.13],
    [1913,-0.11],[1914,0.05],[1915,0.10],[1916,-0.12],[1917,-0.25],[1918,-0.16],[1919,-0.03],
    [1920,-0.01],[1921,0.02],[1922,-0.06],[1923,-0.05],[1924,-0.04],[1925,-0.02],[1926,0.10],
    [1927,-0.00],[1928,0.02],[1929,-0.13],[1930,0.07],[1931,0.12],[1932,0.06],[1933,-0.07],
    [1934,0.07],[1935,0.04],[1936,0.08],[1937,0.17],[1938,0.18],[1939,0.19],[1940,0.33],
    [1941,0.38],[1942,0.25],[1943,0.26],[1944,0.38],[1945,0.30],[1946,0.17],[1947,0.17],
    [1948,0.13],[1949,0.13],[1950,0.04],[1951,0.15],[1952,0.21],[1953,0.27],[1954,0.09],
    [1955,0.04],[1956,-0.00],[1957,0.23],[1958,0.26],[1959,0.25],[1960,0.16],[1961,0.25],
    [1962,0.21],[1963,0.23],[1964,-0.01],[1965,0.09],[1966,0.13],[1967,0.16],[1968,0.12],
    [1969,0.26],[1970,0.21],[1971,0.09],[1972,0.22],[1973,0.34],[1974,0.12],[1975,0.16],
    [1976,0.11],[1977,0.37],[1978,0.28],[1979,0.36],[1980,0.46],[1981,0.50],[1982,0.32],
    [1983,0.49],[1984,0.34],[1985,0.31],[1986,0.39],[1987,0.50],[1988,0.55],[1989,0.43],
    [1990,0.59],[1991,0.57],[1992,0.40],[1993,0.43],[1994,0.49],[1995,0.63],[1996,0.51],
    [1997,0.65],[1998,0.78],[1999,0.57],[2000,0.57],[2001,0.70],[2002,0.76],[2003,0.77],
    [2004,0.70],[2005,0.83],[2006,0.80],[2007,0.79],[2008,0.69],[2009,0.82],[2010,0.88],
    [2011,0.77],[2012,0.80],[2013,0.83],[2014,0.90],[2015,1.05],[2016,1.17],[2017,1.10],
    [2018,1.03],[2019,1.16],[2020,1.18],[2021,1.03],[2022,1.06],[2023,1.34],[2024,1.42],
    [2025,1.29]
  ];

  var ts=document.getElementById('temp');
  var TW=CHART_W, tx0=54, tx1=TW-(NARROW?84:110), ty0=26, ty1=314;
  var tMin=-0.4, tMax=1.7, txMin=1850, txMax=2028;
  function TX(y){ return tx0 + (y-txMin)/(txMax-txMin)*(tx1-tx0); }
  function TY(v){ return ty1 - (v-tMin)/(tMax-tMin)*(ty1-ty0); }

  function drawTemp(series){
    if(!ts) return;
    fitBox(ts,TW,342);
    while(ts.firstChild) ts.removeChild(ts.firstChild);
    var f=document.createDocumentFragment();
    var last=series[series.length-1];

    [0,0.5,1,1.5].forEach(function(v){
      f.appendChild(el('line',{x1:tx0,x2:tx1,y1:TY(v),y2:TY(v),class:v===0?'axis-l':'grid-l'}));
      var t=el('text',{x:tx0-10,y:TY(v)+4,class:'svg-lab','text-anchor':'end'});
      t.textContent=(v===0?'0':('+'+String(v).replace('.',',')));
      f.appendChild(t);
    });
    var tu=el('text',{x:tx0-10,y:TY(1.5)-16,class:'svg-unit','text-anchor':'end'});
    tu.textContent='°C'; f.appendChild(tu);

    [1900,1950,2000].forEach(function(y){
      f.appendChild(el('line',{x1:TX(y),x2:TX(y),y1:ty1,y2:ty1+5,class:'axis-l'}));
      var t=el('text',{x:TX(y),y:ty1+22,class:'svg-lab','text-anchor':'middle'});
      t.textContent=y; f.appendChild(t);
    });
    f.appendChild(el('line',{x1:tx0,x2:tx1,y1:ty1,y2:ty1,class:'axis-l'}));

    /* la soglia di Parigi: tratteggiata, etichettata fuori dal disegno a destra */
    f.appendChild(el('line',{x1:tx0,x2:tx1,y1:TY(1.5),y2:TY(1.5),
      stroke:tok('--heat'),'stroke-width':1.4,'stroke-dasharray':'5 4','stroke-opacity':.85}));
    /* etichetta a sinistra: a destra la curva ormai sfiora la soglia e i due
       testi si accavallerebbero */
    var sl=el('text',{x:tx0+8,y:TY(1.5)-7,class:'svg-val','text-anchor':'start'});
    sl.style.fill=tok('--heat');
    sl.textContent=it(1.5,1)+' °C — '+(NARROW?tr('il limite di Parigi'):tr('il limite dell’Accordo di Parigi')); f.appendChild(sl);

    var d='', fill='';
    for(var i=0;i<series.length;i++){
      var px=TX(series[i][0]).toFixed(1), py=TY(series[i][1]).toFixed(1);
      d += (i?'L':'M') + px + ' ' + py;
    }
    fill = d + 'L' + TX(last[0]).toFixed(1) + ' ' + TY(0).toFixed(1) +
               'L' + TX(series[0][0]).toFixed(1) + ' ' + TY(0).toFixed(1) + 'Z';
    f.appendChild(el('path',{d:fill,fill:tok('--heat'),'fill-opacity':.13,stroke:'none'}));
    f.appendChild(el('path',{d:d,fill:'none',stroke:tok('--heat'),'stroke-width':2.2,
      'stroke-linejoin':'round','stroke-linecap':'round'}));

    function at(y){ for(var i=0;i<series.length;i++){ if(series[i][0]===y) return series[i][1]; } return null; }
    [[2000,'2000'],[last[0],String(last[0])]].forEach(function(a){
      var v=at(a[0]); if(v===null) return;
      var px=TX(a[0]), py=TY(v);
      f.appendChild(el('circle',{cx:px,cy:py,r:5,fill:tok('--surface'),stroke:tok('--heat'),'stroke-width':2.2}));
      var lastA = a[0]===last[0];
      var tv=el('text',{x:px+11,y:lastA?py-7:py+17,class:'svg-val','text-anchor':'start'});
      tv.textContent=(v>=0?'+':'')+v.toFixed(2).replace('.',','); f.appendChild(tv);
      var tl=el('text',{x:px+11,y:lastA?py+8:py+32,class:'svg-unit','text-anchor':'start'});
      tl.textContent=a[1]; f.appendChild(tl);
    });

    ts.appendChild(f);
  }

  drawTemp(TEMP);


  /* ════════════════════ il controfattuale ════════════════════
     Dove sarebbe la concentrazione se i pozzi non avessero assorbito niente:
     tutte le emissioni cumulate dal 1959 (fossili + uso del suolo, Global
     Carbon Budget 2025) sommate al valore osservato di partenza, a 2,124 GtC
     per ppm. Il 2025 usa la proiezione GCB, gli altri anni i dati misurati.
     Lo spazio fra le due curve e' il lavoro dei pozzi. */
  var CF = [
    [1959,318.2],[1960,320.4],[1961,322.6],[1962,324.8],[1963,327.0],[1964,329.2],[1965,331.5],
    [1966,333.8],[1967,336.2],[1968,338.6],[1969,341.3],[1970,344.1],[1971,346.9],[1972,349.8],
    [1973,352.8],[1974,355.8],[1975,358.7],[1976,361.8],[1977,365.0],[1978,368.3],[1979,371.6],
    [1980,374.8],[1981,378.0],[1982,381.1],[1983,384.3],[1984,387.6],[1985,391.1],[1986,394.6],
    [1987,398.2],[1988,401.8],[1989,405.4],[1990,409.1],[1991,412.8],[1992,416.4],[1993,420.1],
    [1994,423.9],[1995,427.7],[1996,431.7],[1997,435.8],[1998,439.8],[1999,443.9],[2000,447.9],
    [2001,451.9],[2002,456.1],[2003,460.6],[2004,465.1],[2005,469.7],[2006,474.4],[2007,479.1],
    [2008,484.0],[2009,488.9],[2010,494.0],[2011,499.3],[2012,504.6],[2013,510.0],[2014,515.4],
    [2015,520.7],[2016,526.0],[2017,531.3],[2018,536.6],[2019,542.0],[2020,547.1],[2021,552.5],
    [2022,557.9],[2023,563.4],[2024,569.0],[2025,574.4]
  ];

  var cs=document.getElementById('controfattuale');
  if(cs){
    var CW=CHART_W, cx0=56, cx1=CW-(NARROW?100:124), cy0=28, cy1=286;
    fitBox(cs,CW,320);
    var cyMin=300, cyMax=615, cxMin=1959, cxMax=2027;
    function CX(y){ return cx0 + (y-cxMin)/(cxMax-cxMin)*(cx1-cx0); }
    function CY(v){ return cy1 - (v-cyMin)/(cyMax-cyMin)*(cy1-cy0); }

    var cf=document.createDocumentFragment();

    for(var gv=300; gv<=600; gv+=50){
      cf.appendChild(el('line',{x1:cx0,x2:cx1,y1:CY(gv),y2:CY(gv),class:'grid-l'}));
      var gt=el('text',{x:cx0-10,y:CY(gv)+4,class:'svg-lab','text-anchor':'end'});
      gt.textContent=gv; cf.appendChild(gt);
    }
    var cu=el('text',{x:cx0-10,y:cy0-10,class:'svg-unit','text-anchor':'end'});
    cu.textContent='ppm'; cf.appendChild(cu);
    cf.appendChild(el('line',{x1:cx0,x2:cx1,y1:cy1,y2:cy1,class:'axis-l'}));
    [1960,1980,2000,2020].forEach(function(y){
      cf.appendChild(el('line',{x1:CX(y),x2:CX(y),y1:cy1,y2:cy1+5,class:'axis-l'}));
      var t=el('text',{x:CX(y),y:cy1+22,class:'svg-lab','text-anchor':'middle'});
      t.textContent=y; cf.appendChild(t);
    });

    /* la banda fra le due curve: e' la CO2 che i pozzi hanno tolto dall'aria */
    var band='', i;
    for(i=0;i<CF.length;i++) band += (i?'L':'M')+CX(CF[i][0]).toFixed(1)+' '+CY(CF[i][1]).toFixed(1);
    for(i=ANNUAL.length-1;i>=0;i--){
      if(ANNUAL[i][0]<1959) continue;
      band += 'L'+CX(ANNUAL[i][0]).toFixed(1)+' '+CY(ANNUAL[i][1]).toFixed(1);
    }
    band+='Z';
    cf.appendChild(el('path',{d:band,fill:tok('--land'),'fill-opacity':.17,stroke:'none'}));

    var dc='';
    for(i=0;i<CF.length;i++) dc += (i?'L':'M')+CX(CF[i][0]).toFixed(1)+' '+CY(CF[i][1]).toFixed(1);
    cf.appendChild(el('path',{d:dc,fill:'none',stroke:tok('--atmos'),'stroke-width':2,
      'stroke-dasharray':'6 4','stroke-linejoin':'round'}));

    var dr='';
    for(i=0;i<ANNUAL.length;i++){
      if(ANNUAL[i][0]<1959) continue;
      dr += (dr?'L':'M')+CX(ANNUAL[i][0]).toFixed(1)+' '+CY(ANNUAL[i][1]).toFixed(1);
    }
    cf.appendChild(el('path',{d:dr,fill:'none',stroke:tok('--source'),'stroke-width':2.6,
      'stroke-linejoin':'round','stroke-linecap':'round'}));

    var lastCf=CF[CF.length-1], lastOb=ANNUAL[ANNUAL.length-1];
    function endLab(v,l1,l2,col){
      var px=CX(2025)+10, py=CY(v);
      var a=el('text',{x:px,y:py-3,class:'svg-val','text-anchor':'start'});
      a.style.fill=col; a.textContent=l1; cf.appendChild(a);
      var b=el('text',{x:px,y:py+12,class:'svg-unit','text-anchor':'start'});
      b.textContent=l2; cf.appendChild(b);
    }
    endLab(lastCf[1], Math.round(lastCf[1])+' ppm', tr('senza pozzi'), tok('--ink'));
    endLab(lastOb[1], Math.round(lastOb[1])+' ppm', tr('osservato'),   tok('--source'));

    /* freccia che misura il divario */
    var gYr=NARROW?2000:2012, gi=CF.length-(2025-gYr+1);
    var gx=CX(gYr), y1c=CY(CF[gi][1]), y2c=CY(ANNUAL[ANNUAL.length-(2025-gYr+1)][1]);
    cf.appendChild(el('line',{x1:gx,x2:gx,y1:y1c,y2:y2c,stroke:tok('--land'),'stroke-width':1.6}));
    cf.appendChild(el('line',{x1:gx-5,x2:gx+5,y1:y1c,y2:y1c,stroke:tok('--land'),'stroke-width':1.6}));
    cf.appendChild(el('line',{x1:gx-5,x2:gx+5,y1:y2c,y2:y2c,stroke:tok('--land'),'stroke-width':1.6}));
    var gl=el('text',{x:gx+11,y:y1c+(y2c-y1c)*(NARROW?0.3:0.38),class:'svg-lab-b','text-anchor':'start'});
    gl.style.fill=tok('--land'); gl.textContent=NARROW?tr('tolto dai pozzi'):tr('tolto da oceani e foreste'); cf.appendChild(gl);

    cs.appendChild(cf);
  }


  /* ════════════════════ gli ultimi dieci anni da vicino ════════════════════
     La stessa serie della curva di Keeling, ma zoomata sull'ultimo decennio:
     qui il singolo anno si vede. Sotto, sullo stesso asse, di quanto e'
     cresciuta la CO2 in ciascun anno (tasso di crescita NOAA: 1 gennaio ->
     31 dicembre sulla curva destagionalizzata). live.js ridisegna tutto coi
     dati letti in diretta. Riserva: medie mensili di Mauna Loa dal 2016,
     [data decimale, media mensile, destagionalizzata], NOAA GML. */
  var MONTHLY_RECENT = [
    [2016.0417,402.73,402.45],[2016.1250,404.25,403.40],[2016.2083,405.06,403.54],
    [2016.2917,407.60,404.77],[2016.3750,407.90,404.41],[2016.4583,406.99,404.59],
    [2016.5417,404.59,404.24],[2016.6250,402.45,404.41],[2016.7083,401.23,404.85],
    [2016.7917,401.79,405.23],[2016.8750,403.72,405.74],[2016.9583,404.64,405.33],
    [2017.0417,406.36,406.04],[2017.1250,406.66,405.80],[2017.2083,407.54,406.05],
    [2017.2917,409.22,406.37],[2017.3750,409.89,406.37],[2017.4583,409.08,406.68],
    [2017.5417,407.33,407.01],[2017.6250,405.32,407.31],[2017.7083,403.57,407.17],
    [2017.7917,403.82,407.23],[2017.8750,405.31,407.36],[2017.9583,407.00,407.71],
    [2018.0417,408.15,407.83],[2018.1250,408.52,407.61],[2018.2083,409.59,408.06],
    [2018.2917,410.45,407.65],[2018.3750,411.44,407.98],[2018.4583,410.99,408.60],
    [2018.5417,408.90,408.60],[2018.6250,407.16,409.17],[2018.7083,405.71,409.30],
    [2018.7917,406.19,409.56],[2018.8750,408.21,410.24],[2018.9583,409.27,409.99],
    [2019.0417,411.03,410.69],[2019.1250,411.96,410.97],[2019.2083,412.18,410.71],
    [2019.2917,413.54,410.92],[2019.3750,414.86,411.47],[2019.4583,414.15,411.74],
    [2019.5417,411.96,411.64],[2019.6250,410.17,412.10],[2019.7083,408.76,412.26],
    [2019.7917,408.74,412.09],[2019.8750,410.47,412.50],[2019.9583,411.97,412.71],
    [2020.0417,413.59,413.22],[2020.1250,414.32,413.41],[2020.2083,414.72,413.35],
    [2020.2917,416.42,413.92],[2020.3750,417.28,413.98],[2020.4583,416.58,414.16],
    [2020.5417,414.58,414.19],[2020.6250,412.75,414.60],[2020.7083,411.50,414.91],
    [2020.7917,411.49,414.79],[2020.8750,413.10,415.12],[2020.9583,414.23,414.91],
    [2021.0417,415.49,415.23],[2021.1250,416.72,415.80],[2021.2083,417.61,416.17],
    [2021.2917,419.01,416.58],[2021.3750,419.09,415.88],[2021.4583,418.93,416.48],
    [2021.5417,416.90,416.48],[2021.6250,414.42,416.27],[2021.7083,413.26,416.63],
    [2021.7917,413.90,417.14],[2021.8750,414.97,416.93],[2021.9583,416.67,417.37],
    [2022.0417,418.13,417.86],[2022.1250,419.24,418.32],[2022.2083,418.76,417.31],
    [2022.2917,420.19,417.67],[2022.3750,420.97,417.70],[2022.4583,420.94,418.47],
    [2022.5417,418.85,418.41],[2022.6250,417.15,419.03],[2022.7083,415.91,419.30],
    [2022.7917,415.74,418.97],[2022.8750,417.47,419.51],[2022.9583,418.99,419.79],
    [2023.0417,419.48,419.19],[2023.1250,420.31,419.36],[2023.2083,420.99,419.53],
    [2023.2917,423.35,420.84],[2023.3750,424.00,420.72],[2023.4583,423.68,421.24],
    [2023.5417,421.83,421.49],[2023.6250,419.68,421.64],[2023.7083,418.50,421.92],
    [2023.7917,418.82,422.04],[2023.8750,420.46,422.43],[2023.9583,421.86,422.59],
    [2024.0417,422.80,422.51],[2024.1250,424.55,423.60],[2024.2083,425.38,423.92],
    [2024.2917,426.51,424.00],[2024.3750,426.90,423.62],[2024.4583,426.91,424.47],
    [2024.5417,425.55,425.21],[2024.6250,422.99,424.95],[2024.7083,422.03,425.45],
    [2024.7917,422.38,425.60],[2024.8750,423.85,425.82],[2024.9583,425.40,426.13],
    [2025.0417,426.65,426.36],[2025.1250,427.09,426.14],[2025.2083,428.15,426.68],
    [2025.2917,429.64,427.13],[2025.3750,430.51,427.23],[2025.4583,429.61,427.17],
    [2025.5417,427.87,427.53],[2025.6250,425.48,427.44],[2025.7083,424.37,427.79],
    [2025.7917,424.87,428.09],[2025.8750,426.46,428.42],[2025.9583,427.49,428.22],
    [2026.0417,428.62,428.32],[2026.1250,429.35,428.40],[2026.2083,430.15,428.68],
    [2026.2917,431.12,428.61],[2026.3750,432.34,429.06],[2026.4583,431.43,428.99],
    [2026.5417,429.13,428.78],[2026.6250,427.55,429.51]
  ];
  var GR = [
    [2010,2.30],[2011,1.92],[2012,2.65],[2013,1.99],[2014,2.17],[2015,2.95],[2016,3.03],[2017,1.90],
    [2018,2.85],[2019,2.49],[2020,2.30],[2021,2.35],[2022,1.84],[2023,3.32],[2024,3.33],[2025,2.23]
  ];
  var MESI=tr('gen feb mar apr mag giu lug ago set ott nov dic').split(' ');

  var rs=document.getElementById('recente');
  var RW=CHART_W, rx0=54, rx1=RW-(NARROW?112:136);
  var pT0=22,  pT1=196;    /* pannello alto: concentrazione */
  var pB0=246, pB1=326;    /* pannello centrale: crescita annua */
  var pC0=376, pC1=466;    /* pannello basso: temperatura, in parallelo */

  /* i due blocchi di live.js arrivano in ordine qualsiasi: ognuno passa solo
     cio' che ha letto, il resto resta com'era */
  var rState={monthly:MONTHLY_RECENT, gr:GR, temp:null};
  function drawRecent(monthly, gr, temp){
    if(!rs) return;
    fitBox(rs,RW,496);
    if(monthly && monthly.length>=24) rState.monthly=monthly;
    if(gr && gr.length) rState.gr=gr;
    if(temp && temp.length) rState.temp=temp;
    monthly=rState.monthly; gr=rState.gr; temp=rState.temp||TEMP;
    while(rs.firstChild) rs.removeChild(rs.firstChild);
    var f=document.createDocumentFragment();

    var lastG=gr[gr.length-1][0];
    var xMin=lastG-9;
    var m=[], i;
    for(i=0;i<monthly.length;i++){ if(monthly[i][0]>=xMin) m.push(monthly[i]); }
    if(m.length<24){ m=MONTHLY_RECENT; }
    var lastM=m[m.length-1];
    var xMax=Math.max(lastM[0]+0.12, lastG+1);
    function RX(t){ return rx0 + (t-xMin)/(xMax-xMin)*(rx1-rx0); }

    var vMin=Infinity, vMax=-Infinity;
    for(i=0;i<m.length;i++){ if(m[i][1]<vMin) vMin=m[i][1]; if(m[i][1]>vMax) vMax=m[i][1]; }
    var yMin=Math.floor(vMin/5)*5-2, yMax=Math.ceil(vMax/5)*5+2;
    function TYr(v){ return pT1 - (v-yMin)/(yMax-yMin)*(pT1-pT0); }

    var bars=[]; var gMax=0, gSum=0;
    for(i=0;i<gr.length;i++){ if(gr[i][0]>=xMin && gr[i][0]<=lastG){ bars.push(gr[i]); gSum+=gr[i][1]; if(gr[i][1]>gMax) gMax=gr[i][1]; } }
    var bMax=Math.max(4, Math.ceil(gMax));
    var gMean=bars.length ? gSum/bars.length : 0;
    function BY(v){ return pB1 - v/bMax*(pB1-pB0); }

    /* griglia verticale comune ai due pannelli, un tratto per anno */
    var yr;
    for(yr=xMin; yr<=Math.floor(xMax); yr++){
      f.appendChild(el('line',{x1:RX(yr),x2:RX(yr),y1:pT0,y2:pC1,class:'grid-l'}));
      var cx = (yr+1<=xMax) ? RX(yr+0.5) : RX((yr+xMax)/2);
      if(xMax-yr>=0.45){
        var yl=el('text',{x:cx,y:pC1+22,class:yr<=lastG?'svg-lab-b':'svg-lab','text-anchor':'middle'});
        yl.textContent=NARROW ? '’'+String(yr).slice(2) : yr; f.appendChild(yl);
      }
    }

    /* ── pannello alto ── */
    for(var v=Math.ceil(yMin/10)*10; v<=yMax; v+=10){
      f.appendChild(el('line',{x1:rx0,x2:rx1,y1:TYr(v),y2:TYr(v),class:'grid-l'}));
      var t=el('text',{x:rx0-10,y:TYr(v)+4,class:'svg-lab','text-anchor':'end'});
      t.textContent=v; f.appendChild(t);
    }
    var u1=el('text',{x:rx0-10,y:pT0-8,class:'svg-unit','text-anchor':'end'}); u1.textContent='ppm'; f.appendChild(u1);
    var h1=el('text',{x:rx0,y:pT0-8,class:'svg-lab-b'}); h1.textContent=NARROW?tr('Mauna Loa, media mensile'):tr('Concentrazione, media mensile a Mauna Loa'); f.appendChild(h1);

    var d='', dt='', hasTrend=true;
    for(i=0;i<m.length;i++){
      d += (i?'L':'M') + RX(m[i][0]).toFixed(1) + ' ' + TYr(m[i][1]).toFixed(1);
      if(m[i].length>2 && !isNaN(m[i][2])) dt += (dt?'L':'M') + RX(m[i][0]).toFixed(1) + ' ' + TYr(m[i][2]).toFixed(1);
      else hasTrend=false;
    }
    f.appendChild(el('path',{d:d,fill:'none',stroke:tok('--atmos'),'stroke-width':1.3,'stroke-opacity':.75,'stroke-linejoin':'round'}));
    if(hasTrend && dt) f.appendChild(el('path',{d:dt,fill:'none',stroke:tok('--source'),'stroke-width':2.4,'stroke-linecap':'round','stroke-linejoin':'round'}));

    /* i punti delle medie annue, per agganciare questo grafico a quello lungo */
    for(i=0;i<ANNUAL.length;i++){
      var a=ANNUAL[i]; if(a[0]<xMin || a[0]>lastG) continue;
      f.appendChild(el('circle',{cx:RX(a[0]+0.5),cy:TYr(a[1]),r:3.2,fill:tok('--surface'),stroke:tok('--source'),'stroke-width':1.8}));
    }

    var px=RX(lastM[0]), py=TYr(lastM[1]);
    f.appendChild(el('circle',{cx:px,cy:py,r:5,fill:tok('--surface'),stroke:tok('--atmos'),'stroke-width':2.2}));
    var mIdx=Math.min(11,Math.max(0,Math.round((lastM[0]-Math.floor(lastM[0]))*12-0.5)));
    var l1=el('text',{x:rx1+12,y:py-4,class:'svg-val'}); l1.textContent=it(lastM[1],1)+' ppm'; f.appendChild(l1);
    var l2=el('text',{x:rx1+12,y:py+12,class:'svg-unit'}); l2.textContent=tr('ultimo mese'); f.appendChild(l2);
    var l2b=el('text',{x:rx1+12,y:py+26,class:'svg-unit'}); l2b.textContent=MESI[mIdx]+' '+Math.floor(lastM[0]); f.appendChild(l2b);

    /* ── pannello basso ── */
    for(var g=0; g<=bMax; g+=2){
      f.appendChild(el('line',{x1:rx0,x2:rx1,y1:BY(g),y2:BY(g),class:g===0?'axis-l':'grid-l'}));
      var gt=el('text',{x:rx0-10,y:BY(g)+4,class:'svg-lab','text-anchor':'end'}); gt.textContent=g; f.appendChild(gt);
    }
    var u2=el('text',{x:rx0-10,y:pB0-10,class:'svg-unit','text-anchor':'end'}); u2.textContent='ppm'; f.appendChild(u2);
    var h2=el('text',{x:rx0,y:pB0-10,class:'svg-lab-b'}); h2.textContent=NARROW?tr('Crescita in ciascun anno, ppm'):tr('Di quanto è cresciuta in ciascun anno, ppm per anno'); f.appendChild(h2);

    bars.forEach(function(b){
      var bp=NARROW?3:7, bx=RX(b[0])+bp, bw=RX(b[0]+1)-RX(b[0])-2*bp;
      var strong = b[1] > gMean;
      f.appendChild(el('rect',{x:bx,y:BY(b[1]),width:bw,height:pB1-BY(b[1]),fill:tok('--source'),'fill-opacity':strong?1:.55,rx:2}));
      var vt=el('text',{x:bx+bw/2,y:BY(b[1])+15,class:'svg-val','text-anchor':'middle'});
      vt.style.fontSize=NARROW?'11px':'12px'; vt.textContent=NARROW?it(b[1],1):'+'+it(b[1],2);
      vt.style.fill = strong ? tok('--surface') : tok('--ink'); vt.style.stroke='none';
      f.appendChild(vt);
    });

    f.appendChild(el('line',{x1:rx0,x2:rx1,y1:BY(gMean),y2:BY(gMean),stroke:tok('--ink-3'),'stroke-width':1,'stroke-dasharray':'4 3'}));
    var ml=el('text',{x:rx1+12,y:BY(gMean)-4,class:'svg-val'}); ml.textContent=it(gMean,2)+(NARROW?tr('/anno'):' '+tr('ppm/anno')); f.appendChild(ml);
    var ml2=el('text',{x:rx1+12,y:BY(gMean)+12,class:'svg-unit'}); ml2.textContent=tr('media')+' '+xMin+'–'+(NARROW?String(lastG).slice(2):lastG); f.appendChild(ml2);

    /* ── pannello basso: la temperatura, in parallelo ──
       Gli anni in cui la CO2 cresce di piu' sono gli anni caldi: El Nino
       secca i tropici e la vegetazione assorbe meno. Non e' la temperatura a
       produrre la CO2 in piu', e' lo stesso fenomeno che muove entrambe. */
    var tp=[];
    for(i=0;i<temp.length;i++){ if(temp[i][0]>=xMin && temp[i][0]<=lastG) tp.push(temp[i]); }
    if(tp.length>=3){
      var tMinV=Infinity, tMaxV=-Infinity;
      for(i=0;i<tp.length;i++){ if(tp[i][1]<tMinV) tMinV=tp[i][1]; if(tp[i][1]>tMaxV) tMaxV=tp[i][1]; }
      var cMin=Math.floor((tMinV-0.05)*5)/5, cMax=Math.max(1.6, Math.ceil((tMaxV+0.05)*5)/5);
      function CY(v){ return pC1 - (v-cMin)/(cMax-cMin)*(pC1-pC0); }
      for(var c=cMin; c<=cMax+1e-9; c+=0.2){
        var cc=Math.round(c*10)/10;
        f.appendChild(el('line',{x1:rx0,x2:rx1,y1:CY(cc),y2:CY(cc),class:'grid-l'}));
        var ct=el('text',{x:rx0-10,y:CY(cc)+4,class:'svg-lab','text-anchor':'end'}); ct.textContent=it(cc,1); f.appendChild(ct);
      }
      f.appendChild(el('line',{x1:rx0,x2:rx1,y1:pC1,y2:pC1,class:'axis-l'}));
      var u3=el('text',{x:rx0-10,y:pC0-10,class:'svg-unit','text-anchor':'end'}); u3.textContent='°C'; f.appendChild(u3);
      var h3=el('text',{x:rx0,y:pC0-10,class:'svg-lab-b'}); h3.textContent=NARROW?tr('Temperatura sul 1850–1900'):tr('Temperatura globale sul 1850–1900, media annua'); f.appendChild(h3);

      if(1.5>cMin && 1.5<cMax){
        f.appendChild(el('line',{x1:rx0,x2:rx1,y1:CY(1.5),y2:CY(1.5),stroke:tok('--heat'),'stroke-width':1.2,'stroke-dasharray':'5 4','stroke-opacity':.85}));
        var sl=el('text',{x:rx0+8,y:CY(1.5)-6,class:'svg-unit'}); sl.style.fill=tok('--heat'); sl.textContent=it(1.5,1)+' °C, '+(NARROW?tr('il limite di Parigi'):tr('il limite dell’Accordo di Parigi')); f.appendChild(sl);
      }
      var dT='';
      for(i=0;i<tp.length;i++){ dT += (i?'L':'M') + RX(tp[i][0]+0.5).toFixed(1) + ' ' + CY(tp[i][1]).toFixed(1); }
      f.appendChild(el('path',{d:dT,fill:'none',stroke:tok('--heat'),'stroke-width':2.2,'stroke-linejoin':'round','stroke-linecap':'round'}));
      tp.forEach(function(t){
        var hot = t[1] >= 1.3;
        f.appendChild(el('circle',{cx:RX(t[0]+0.5),cy:CY(t[1]),r:hot?5:3.6,fill:hot?tok('--heat'):tok('--surface'),stroke:tok('--heat'),'stroke-width':2}));
        if(hot || t[0]===xMin){
          /* gli anni caldi sotto il punto, fra i due segmenti che scendono;
             il primo anno a destra, dove non c'e' niente */
          var tv = hot
            ? el('text',{x:RX(t[0]+0.5),y:CY(t[1])+19,class:'svg-val','text-anchor':'middle'})
            : el('text',{x:RX(t[0]+0.5)+9,y:CY(t[1])+4,class:'svg-val','text-anchor':'start'});
          tv.style.fontSize=NARROW?'11px':'12px'; tv.textContent=NARROW?it(t[1],1):'+'+it(t[1],2); f.appendChild(tv);
        }
      });
      var tl=tp[tp.length-1];
      var l3=el('text',{x:rx1+12,y:CY(tl[1])-4,class:'svg-val'}); l3.textContent='+'+it(tl[1],2)+' °C'; f.appendChild(l3);
      var l4=el('text',{x:rx1+12,y:CY(tl[1])+12,class:'svg-unit'}); l4.textContent=tr('nel')+' '+tl[0]; f.appendChild(l4);
    }

    rs.appendChild(f);
  }
  drawRecent(MONTHLY_RECENT, GR, TEMP);


  /* ════════════════════ Kyoto ════════════════════
     Emissioni fossili mondiali (GCB 2025 via Our World in Data, lorde),
     1990-2024. La fascia e' il primo periodo di impegno del protocollo. */
  var KY=[22.73,23.21,22.52,22.75,22.97,23.52,24.23,24.38,24.30,24.84,25.51,25.69,26.27,27.65,28.61,29.60,30.59,31.50,32.05,31.51,33.32,34.48,34.95,35.28,35.47,35.40,35.39,35.97,36.73,37.09,35.16,36.87,37.53,38.09,38.60];
  var ks=document.getElementById('kyotochart');
  if(ks){
    var KW=CHART_W, kx0=54, kx1=KW-30, ky0=26, ky1=250;
    fitBox(ks,KW,300);
    var kMin=20, kMax=40, kyMin=1990, kyMax=2025;
    function KX(y){ return kx0 + (y-kyMin)/(kyMax-kyMin)*(kx1-kx0); }
    function KY_(v){ return ky1 - (v-kMin)/(kMax-kMin)*(ky1-ky0); }
    var kf=document.createDocumentFragment();
    kf.appendChild(el('rect',{x:KX(2008),y:ky0,width:KX(2013)-KX(2008),height:ky1-ky0,fill:tok('--source'),'fill-opacity':.10}));
    for(var kv=20; kv<=40; kv+=5){
      kf.appendChild(el('line',{x1:kx0,x2:kx1,y1:KY_(kv),y2:KY_(kv),class:kv===20?'axis-l':'grid-l'}));
      var kt=el('text',{x:kx0-10,y:KY_(kv)+4,class:'svg-lab','text-anchor':'end'}); kt.textContent=kv; kf.appendChild(kt);
    }
    var ku=el('text',{x:kx0-10,y:ky0-8,class:'svg-unit','text-anchor':'end'}); ku.textContent='GtCO₂'; kf.appendChild(ku);
    [1990,1995,2000,2005,2010,2015,2020].forEach(function(y){
      var t=el('text',{x:KX(y+0.5),y:ky1+22,class:'svg-lab','text-anchor':'middle'}); t.textContent=y; kf.appendChild(t);
    });
    var kd='', ka='';
    KY.forEach(function(v,i){
      var y=kyMin+i, xa=KX(y), xb=KX(y+1), yy=KY_(v);
      kd += (i?'L':'M')+xa.toFixed(1)+' '+yy.toFixed(1)+'L'+xb.toFixed(1)+' '+yy.toFixed(1);
    });
    ka = kd + 'L'+KX(kyMax).toFixed(1)+' '+ky1+'L'+kx0+' '+ky1+'Z';
    kf.appendChild(el('path',{d:ka,fill:tok('--source'),'fill-opacity':.12,stroke:'none'}));
    kf.appendChild(el('path',{d:kd,fill:'none',stroke:tok('--source'),'stroke-width':2.2,'stroke-linejoin':'round'}));
    var kw=el('text',{x:KX(2010.5),y:ky0+16,class:'svg-lab-b','text-anchor':'middle'}); kw.style.fill=tok('--source');
    kw.textContent=(NARROW?tr('impegno'):tr('periodo di impegno'))+' 2008–2012'; kf.appendChild(kw);
    [[1997,tr('firma')],[2005,tr('in vigore')],[2012,tr('fine 1° periodo')]].forEach(function(m){
      var v=KY[m[0]-kyMin], px=KX(m[0]+0.5), py=KY_(v);
      kf.appendChild(el('circle',{cx:px,cy:py,r:5,fill:tok('--surface'),stroke:tok('--source'),'stroke-width':2.2}));
      var left = NARROW && m[0]===2012;
      var t1=el('text',{x:left?px-10:px+10,y:left?py-24:py+17,class:'svg-val','text-anchor':left?'end':'start'}); t1.textContent=it(v,1); kf.appendChild(t1);
      var t2=el('text',{x:left?px-10:px+10,y:left?py-9:py+32,class:'svg-unit','text-anchor':left?'end':'start'}); t2.textContent=m[0]+' · '+m[1]; kf.appendChild(t2);
    });
    var lv=KY[KY.length-1], lx=KX(kyMax-0.5), ly=KY_(lv);
    kf.appendChild(el('circle',{cx:lx,cy:ly,r:5,fill:tok('--surface'),stroke:tok('--source'),'stroke-width':2.2}));
    var l1=el('text',{x:lx-10,y:ly-12,class:'svg-val','text-anchor':'end'}); l1.textContent=NARROW?it(lv,1):it(lv,1)+' '+tr('nel')+' 2024'; kf.appendChild(l1);
    var c20=el('text',{x:KX(2020.5),y:KY_(KY[30])+22,class:'svg-unit','text-anchor':'middle'}); c20.textContent='2020 · '+tr('pandemia'); kf.appendChild(c20);
    ks.appendChild(kf);
  }

  /* Aria antica, misurata nelle bolle delle carote antartiche: composito
     degli 800 mila anni di Bereiter et al. 2015, NOAA Paleoclimatology.
     La serie si ferma al 1958; da li in poi la pagina usa le medie annue
     di Mauna Loa, cosi la parte recente si aggiorna da sola. Punti ridotti
     da 1901 a 718 conservando massimi e minimi (1 px vale circa mille anni). */
  var ICE = [
    [-803719,207.3],[-803182,202.2],[-802060,207.5],[-801975,202.9],[-800922,198.7],[-794903,198.8],[-793737,204.6],[-793172,208.8],[-791903,218.4],
    [-791569,213.4],[-790081,224.7],[-789107,230.6],[-788003,235.5],[-786742,257.0],[-785854,266.0],[-785406,269.4],[-784613,264.4],[-783569,259.7],
    [-783084,255.8],[-782312,260.9],[-781249,255.0],[-779937,251.5],[-779613,257.2],[-778769,252.5],[-775732,247.3],[-773588,241.7],[-773009,238.4],
    [-771300,246.0],[-770225,239.7],[-769863,234.2],[-769071,229.6],[-767701,225.9],[-767111,221.6],[-765797,224.9],[-764859,230.6],[-763232,222.9],
    [-761152,214.0],[-758990,222.7],[-757612,226.9],[-757186,222.7],[-756412,218.3],[-755835,213.6],[-754901,209.4],[-753637,203.3],[-753165,199.1],
    [-751985,203.9],[-751539,195.4],[-749086,191.3],[-746387,187.5],[-739924,189.1],[-739380,184.8],[-736631,191.7],[-735710,204.5],[-734572,213.1],
    [-734157,217.2],[-732072,210.6],[-725948,210.1],[-722192,214.0],[-719740,219.0],[-718137,212.0],[-717337,200.8],[-716828,193.5],[-716005,189.9],
    [-715398,198.4],[-714636,210.5],[-713615,227.6],[-713166,223.1],[-712454,227.1],[-707960,230.5],[-707009,234.8],[-705361,238.8],[-703294,235.1],
    [-701060,230.6],[-699319,235.4],[-697915,239.7],[-691871,237.8],[-691624,243.7],[-691127,238.5],[-690368,243.6],[-690018,239.4],[-688525,235.8],
    [-688001,232.3],[-686860,227.6],[-685496,223.0],[-680790,219.1],[-679720,227.9],[-678678,233.1],[-677505,229.2],[-676792,220.1],[-675651,216.6],
    [-675202,220.0],[-673457,216.1],[-673078,211.7],[-672279,204.7],[-671746,201.1],[-670811,197.1],[-668346,191.5],[-667869,187.7],[-666966,180.7],
    [-665460,173.7],[-663887,180.5],[-662458,187.8],[-662370,192.6],[-658514,188.4],[-656814,184.1],[-655772,190.9],[-654183,200.3],[-652489,194.8],
    [-650759,186.8],[-648997,193.4],[-648398,189.2],[-647241,196.2],[-645305,191.8],[-643201,195.8],[-640907,191.6],[-635764,195.3],[-629576,200.5],
    [-627820,205.3],[-627190,199.5],[-625880,205.8],[-625019,215.7],[-624098,228.5],[-623448,235.0],[-621105,239.2],[-621001,243.9],[-617004,248.3],
    [-615660,252.6],[-611993,256.2],[-609651,259.7],[-606029,254.6],[-604676,248.5],[-603353,244.5],[-601999,239.1],[-599305,232.4],[-597268,226.0],
    [-596380,219.0],[-593486,232.9],[-592914,238.0],[-591611,233.2],[-590836,229.4],[-590433,225.7],[-589069,237.4],[-588539,243.6],[-588090,248.1],
    [-586329,238.8],[-585939,234.4],[-585222,226.0],[-582009,210.6],[-581624,206.7],[-580505,215.4],[-579978,219.4],[-579597,225.2],[-579169,230.3],
    [-578864,236.2],[-578452,243.8],[-577883,251.5],[-571526,249.2],[-566980,253.0],[-562774,247.6],[-561586,242.3],[-560706,234.1],[-559016,228.3],
    [-557366,234.5],[-556828,238.1],[-556205,245.6],[-555888,250.5],[-555707,244.0],[-555435,249.1],[-555249,243.0],[-554457,233.9],[-553892,226.7],
    [-551859,220.3],[-551296,226.3],[-551071,222.3],[-549431,215.2],[-548281,208.8],[-547770,202.5],[-545857,209.7],[-541895,203.6],[-539704,211.2],
    [-537564,206.4],[-535384,199.4],[-533745,190.5],[-533094,193.8],[-531982,200.0],[-531604,204.4],[-531038,211.4],[-530129,220.7],[-526567,224.7],
    [-524946,230.3],[-524157,233.7],[-521852,241.9],[-518872,245.5],[-513701,241.5],[-512083,238.2],[-511255,242.0],[-510414,235.2],[-507835,240.3],
    [-506991,237.0],[-502227,232.2],[-499134,228.2],[-496787,232.8],[-496016,236.5],[-490914,243.7],[-488545,249.3],[-488076,252.8],[-487770,240.9],
    [-486615,237.1],[-485898,231.3],[-481445,227.3],[-480631,223.4],[-478777,218.8],[-477826,231.3],[-477453,236.5],[-475000,232.8],[-473024,241.2],
    [-472142,245.6],[-470913,232.7],[-470313,229.2],[-469875,218.7],[-468776,206.5],[-463652,210.0],[-463315,205.2],[-462649,199.9],[-461577,194.4],
    [-460464,190.7],[-459336,195.5],[-458302,202.4],[-457262,208.3],[-456844,203.3],[-455795,199.1],[-455164,192.5],[-452914,198.4],[-451826,201.9],
    [-447621,208.1],[-446509,203.5],[-443382,199.1],[-437113,200.3],[-435535,207.5],[-431900,211.5],[-430229,227.2],[-429074,219.7],[-427228,242.5],
    [-426890,248.2],[-425991,252.1],[-425205,255.3],[-424672,265.4],[-424287,270.0],[-420583,266.4],[-418752,273.8],[-412261,264.9],[-411309,274.9],
    [-409398,283.5],[-407648,274.7],[-406869,284.5],[-404593,279.6],[-400910,275.7],[-400191,283.1],[-397976,277.1],[-392956,260.7],[-392054,273.6],
    [-391027,259.5],[-387460,245.8],[-384334,239.1],[-380981,227.0],[-373255,214.7],[-371508,199.9],[-366116,206.3],[-363240,201.2],[-360618,185.8],
    [-357060,193.0],[-353868,209.2],[-351225,216.2],[-349726,221.1],[-345595,211.9],[-344371,204.8],[-341974,200.7],[-340842,250.1],[-338785,234.2],
    [-338034,239.6],[-336264,255.7],[-335567,270.5],[-334918,278.6],[-334428,285.8],[-333758,278.1],[-333152,298.6],[-332594,288.4],[-332048,282.4],
    [-331550,273.1],[-329344,265.0],[-328103,275.1],[-327464,271.9],[-326137,266.1],[-323873,260.5],[-321433,257.2],[-319867,249.2],[-318966,255.8],
    [-317880,233.4],[-316903,245.2],[-315983,251.6],[-315200,272.6],[-314501,246.8],[-313708,257.1],[-312102,251.6],[-311393,241.9],[-309720,237.8],
    [-308826,233.2],[-308061,226.2],[-305513,244.8],[-304631,248.6],[-303150,240.7],[-301166,236.0],[-298166,231.0],[-297426,224.4],[-296755,217.1],
    [-294879,213.1],[-292505,206.7],[-289613,217.1],[-288914,220.4],[-288234,234.9],[-286336,231.0],[-284660,226.4],[-282485,231.3],[-280643,223.7],
    [-279451,215.3],[-278609,211.0],[-277669,204.5],[-275493,193.2],[-274308,198.4],[-273205,194.1],[-271216,190.4],[-270200,184.7],[-269086,198.8],
    [-267990,194.2],[-267046,187.2],[-265057,211.7],[-264184,199.9],[-262634,228.1],[-260867,214.6],[-260105,208.9],[-259344,205.7],[-258944,209.6],
    [-257447,203.9],[-254349,199.0],[-252637,195.4],[-250182,213.9],[-249441,200.2],[-247150,214.7],[-244920,219.4],[-244239,230.4],[-243614,236.7],
    [-243107,249.9],[-242172,263.7],[-241189,280.2],[-239905,263.2],[-239383,259.7],[-238240,252.8],[-237789,247.4],[-236475,239.1],[-235956,243.1],
    [-235442,247.4],[-234901,241.4],[-234476,252.1],[-234041,245.2],[-230906,241.6],[-230242,233.9],[-227622,224.5],[-226817,233.1],[-224900,215.7],
    [-224310,203.3],[-221179,208.8],[-219747,216.1],[-217118,240.5],[-216251,245.3],[-215745,251.1],[-214915,247.5],[-214356,242.6],[-212209,251.2],
    [-211380,243.4],[-210583,257.4],[-210129,239.5],[-209628,246.9],[-209108,252.0],[-208882,247.2],[-208225,243.9],[-207132,240.5],[-206872,230.0],
    [-206325,237.2],[-205673,231.4],[-204947,226.3],[-203995,232.2],[-203253,244.4],[-200794,239.1],[-199802,250.9],[-196988,242.6],[-195637,226.4],
    [-193850,220.0],[-193176,226.5],[-191124,218.0],[-189304,231.4],[-186487,210.7],[-184461,203.4],[-182421,199.7],[-180246,217.7],[-179352,213.2],
    [-177923,207.7],[-175780,190.1],[-173883,196.0],[-167564,196.6],[-166796,183.8],[-164834,190.1],[-162385,196.5],[-161908,204.3],[-158205,187.5],
    [-152939,196.3],[-149495,202.3],[-146283,195.8],[-138000,192.8],[-136884,198.6],[-134616,203.7],[-132572,212.4],[-131826,222.7],[-130760,228.0],
    [-130026,232.3],[-129372,241.1],[-128868,250.8],[-127706,260.6],[-127128,268.4],[-126517,285.8],[-126223,280.7],[-126074,276.0],[-122455,281.5],
    [-122009,275.9],[-121064,279.2],[-118194,268.7],[-117766,274.6],[-117293,267.7],[-116708,277.7],[-115236,274.0],[-112300,267.9],[-111729,260.6],
    [-111169,264.8],[-110686,256.8],[-108605,246.7],[-106452,236.4],[-105025,240.3],[-104418,244.8],[-104306,241.4],[-104040,257.6],[-103557,248.8],
    [-103016,242.4],[-102381,238.9],[-102324,247.8],[-101359,240.7],[-100815,237.1],[-99376,244.8],[-95977,239.9],[-94525,245.8],[-92619,242.4],
    [-91873,238.2],[-90718,232.5],[-87746,228.9],[-86751,224.0],[-86186,217.8],[-85631,223.6],[-83941,228.8],[-83417,234.7],[-82987,238.4],
    [-82407,243.2],[-81991,250.8],[-81604,247.1],[-80577,240.9],[-79761,234.1],[-79257,230.3],[-78772,233.9],[-78380,230.6],[-77928,234.7],
    [-77460,229.3],[-76558,224.1],[-75106,231.7],[-74747,238.0],[-73901,249.9],[-73118,243.3],[-72271,231.3],[-70143,239.5],[-69329,235.0],
    [-68979,225.2],[-68477,220.3],[-68102,215.6],[-67642,211.3],[-67132,205.4],[-66196,200.2],[-65780,203.8],[-65010,207.2],[-63987,200.6],
    [-63596,209.0],[-63097,199.2],[-62707,203.7],[-62164,199.7],[-59951,206.4],[-59604,210.9],[-58567,217.2],[-58423,212.9],[-58160,216.7],
    [-57783,223.4],[-57155,231.3],[-56483,223.2],[-55526,217.4],[-54554,212.4],[-54287,207.7],[-53603,214.8],[-53343,208.2],[-53064,216.9],
    [-52207,220.4],[-51158,223.7],[-50435,219.1],[-50137,213.8],[-49079,207.6],[-48057,204.4],[-47353,200.1],[-46273,206.2],[-45136,210.3],
    [-44796,214.2],[-44359,218.3],[-44107,221.8],[-43746,217.5],[-43330,213.9],[-43192,207.9],[-43046,211.5],[-42540,204.8],[-40366,200.9],
    [-39656,205.5],[-39218,201.5],[-38358,197.9],[-38195,193.7],[-37950,197.6],[-37935,193.9],[-37565,200.4],[-37453,191.5],[-37429,204.8],
    [-37370,209.3],[-37104,204.3],[-36624,208.2],[-36138,214.4],[-35511,209.8],[-35388,206.6],[-35169,210.2],[-35073,206.4],[-34870,202.8],
    [-34556,199.0],[-34136,204.1],[-33998,198.8],[-33905,203.3],[-33140,198.8],[-32917,203.1],[-32761,197.2],[-30358,192.5],[-30201,196.9],
    [-30077,193.3],[-29574,189.9],[-28579,182.9],[-28328,186.5],[-28049,191.6],[-27255,188.1],[-27201,192.3],[-25977,189.0],[-25737,192.7],
    [-25135,186.3],[-23401,182.7],[-22320,186.7],[-21924,183.1],[-21650,188.0],[-21408,193.5],[-21327,197.7],[-21235,188.6],[-20654,185.2],
    [-20281,191.3],[-20106,187.4],[-19964,190.8],[-19613,185.2],[-19263,190.1],[-18587,193.9],[-18458,190.0],[-18069,193.7],[-17618,188.9],
    [-17044,192.7],[-16917,188.5],[-16854,193.0],[-16633,188.6],[-16190,184.9],[-16161,188.6],[-15715,194.4],[-15485,190.8],[-15362,194.7],
    [-15286,198.3],[-15142,202.1],[-14848,205.5],[-14784,210.2],[-14522,213.9],[-14508,217.2],[-14481,211.8],[-14311,218.6],[-14273,223.2],
    [-14259,227.3],[-14237,221.5],[-14217,226.2],[-14164,222.4],[-13395,228.9],[-13146,234.5],[-13123,229.0],[-13085,225.4],[-13026,229.8],
    [-12908,233.2],[-12895,227.9],[-12813,224.6],[-12809,227.9],[-12793,231.5],[-12757,228.2],[-12736,237.5],[-12714,233.4],[-12695,238.1],
    [-12603,241.7],[-12592,235.8],[-12581,243.2],[-12514,238.6],[-12472,242.6],[-12404,238.4],[-12393,242.1],[-12359,235.8],[-12349,239.0],
    [-12134,232.9],[-12110,241.3],[-12073,237.9],[-11809,241.1],[-11582,235.8],[-11537,240.2],[-11354,236.9],[-11317,240.4],[-11223,236.9],
    [-11138,241.6],[-11117,237.9],[-11072,234.7],[-11051,239.4],[-10790,247.3],[-10770,241.6],[-10680,246.9],[-10438,243.0],[-10393,247.0],
    [-10371,250.7],[-10155,255.7],[-10130,251.0],[-10041,255.4],[-9998,248.9],[-9977,258.6],[-9933,251.6],[-9870,257.2],[-9715,247.6],
    [-9698,257.1],[-9679,266.2],[-9661,261.3],[-9626,267.1],[-9610,262.7],[-9594,266.9],[-9486,270.1],[-9467,264.5],[-9450,268.2],
    [-9433,264.8],[-7574,260.9],[-7487,265.2],[-7110,259.3],[-5324,263.0],[-5088,257.6],[-4930,262.9],[-4733,259.4],[-4387,262.7],
    [-4049,266.7],[-3984,260.7],[-3902,265.5],[-3269,269.8],[-2019,274.9],[-1857,271.5],[-1578,275.0],[-758,278.9],[-678,273.9],
    [-576,277.9],[318,281.7],[357,277.8],[1070,282.8],[1278,278.4],[1330,284.1],[1349,278.4],[1449,282.2],[1603,275.1],
    [1609,271.1],[1640,276.7],[1779,280.2],[1780,273.1],[1794,281.6],[1827,285.9],[1843,281.6],[1847,286.8],[1857,283.2],
    [1859,286.6],[1874,291.6],[1880,287.8],[1883,292.5],[1884,289.2],[1887,294.3],[1890,290.9],[1892,295.2],[1905,299.0],
    [1918,303.9],[1928,308.0],[1938,312.3],[1938,308.5],[1941,311.8],[1956,315.3],[1959,316.3]
  ];

  /* ════════════════════ ottocentomila anni ════════════════════
     Il dente di sega delle ere glaciali e, a destra, la riga verticale che
     siamo noi. L'asse x e' lineare: ogni pixel vale circa mille anni, quindi
     tutto il periodo industriale sta in meno di un pixel ed e' per questo che
     la salita finale sembra un muro. Lo e'. */
  var is_=document.getElementById('ghiaccio');
  function drawIce(annual){
    if(!is_) return;
    var IW=CHART_W, IH=300;
    fitBox(is_,IW,IH);
    var ix0=54, ix1=IW-(NARROW?58:78), iy0=26, iy1=250;
    var iMin=160, iMax=445, xMin=-805000, xMax=2040;
    function IX(y){ return ix0 + (y-xMin)/(xMax-xMin)*(ix1-ix0); }
    function IY(v){ return iy1 - (v-iMin)/(iMax-iMin)*(iy1-iy0); }
    while(is_.firstChild) is_.removeChild(is_.firstChild);
    var f=document.createDocumentFragment();

    for(var gv=200; gv<=400; gv+=50){
      f.appendChild(el('line',{x1:ix0,x2:ix1,y1:IY(gv),y2:IY(gv),class:'grid-l'}));
      var gt=el('text',{x:ix0-10,y:IY(gv)+4,class:'svg-lab','text-anchor':'end'});
      gt.textContent=gv; f.appendChild(gt);
    }
    var iu=el('text',{x:ix0-10,y:iy0-8,class:'svg-unit','text-anchor':'end'});
    iu.textContent='ppm'; f.appendChild(iu);
    f.appendChild(el('line',{x1:ix0,x2:ix1,y1:iy1,y2:iy1,class:'axis-l'}));
    [[-800000,'800'],[-600000,'600'],[-400000,'400'],[-200000,'200'],[0,tr('oggi')]].forEach(function(t){
      f.appendChild(el('line',{x1:IX(t[0]),x2:IX(t[0]),y1:iy1,y2:iy1+5,class:'axis-l'}));
      var x=el('text',{x:IX(t[0]),y:iy1+22,class:'svg-lab','text-anchor':t[0]===0?'end':'middle'});
      x.textContent=t[1]; f.appendChild(x);
    });
    var xu=el('text',{x:ix0,y:iy1+38,class:'svg-unit'});
    xu.textContent=tr('migliaia di anni fa'); f.appendChild(xu);

    /* il tetto delle ere calde: mai sopra le 300 ppm in tutta la serie */
    f.appendChild(el('line',{x1:ix0,x2:ix1,y1:IY(300),y2:IY(300),
      stroke:tok('--ink-3'),'stroke-width':1,'stroke-dasharray':'4 3'}));
    var cap=el('text',{x:ix0+8,y:IY(300)-7,class:'svg-unit'});
    cap.textContent=tr('mai sopra le 300 ppm');
    f.appendChild(cap);

    var d='', last=null, i;
    for(i=0;i<ICE.length;i++){ d += (i?'L':'M')+IX(ICE[i][0]).toFixed(1)+' '+IY(ICE[i][1]).toFixed(1); last=ICE[i]; }
    f.appendChild(el('path',{d:d+'L'+IX(1958).toFixed(1)+' '+iy1+'L'+IX(xMin).toFixed(1)+' '+iy1+'Z',
      fill:tok('--atmos'),'fill-opacity':.10,stroke:'none'}));
    f.appendChild(el('path',{d:d,fill:'none',stroke:tok('--atmos'),'stroke-width':1.4,'stroke-linejoin':'round'}));

    /* la parte moderna: le stesse medie annue del primo grafico */
    var dm='M'+IX(last[0]).toFixed(1)+' '+IY(last[1]).toFixed(1);
    for(i=0;i<annual.length;i++){ dm += 'L'+IX(annual[i][0]).toFixed(1)+' '+IY(annual[i][1]).toFixed(1); }
    f.appendChild(el('path',{d:dm,fill:'none',stroke:tok('--source'),'stroke-width':2.6,'stroke-linecap':'round'}));

    var lastA=annual[annual.length-1];
    f.appendChild(el('circle',{cx:IX(lastA[0]),cy:IY(lastA[1]),r:4.5,fill:tok('--surface'),stroke:tok('--source'),'stroke-width':2.4}));
    var v1=el('text',{x:IX(lastA[0])-8,y:IY(lastA[1])-12,class:'svg-val','text-anchor':'end'});
    v1.style.fill=tok('--source'); v1.textContent=Math.round(lastA[1])+' ppm'; f.appendChild(v1);
    var v2=el('text',{x:IX(lastA[0])-8,y:IY(lastA[1])+3,class:'svg-unit','text-anchor':'end'});
    v2.textContent=tr('oggi'); f.appendChild(v2);

    if(!NARROW){
      var g1=el('text',{x:IX(-560000),y:IY(186),class:'svg-unit','text-anchor':'middle'});
      g1.textContent=tr('ere glaciali'); f.appendChild(g1);
      var g2=el('text',{x:IX(-215000),y:IY(316),class:'svg-unit','text-anchor':'middle'});
      g2.textContent=tr('periodi caldi'); f.appendChild(g2);
    }
    is_.appendChild(f);
  }
  drawIce(ANNUAL);

  /* esposto per live.js: ridisegna la curva coi dati appena letti da NOAA */
  window.Carbonio = {
    drawKeeling: drawKeeling,
    drawIce:     drawIce,
    drawRecent:  drawRecent,
    drawTemp:    drawTemp,
    bakedAnnual: ANNUAL,
    bakedMonthly: MONTHLY_RECENT,
    bakedGr:     GR,
    bakedTemp:   TEMP
  };
})();
