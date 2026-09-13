(function(){
  "use strict";
  var root = document.documentElement;
  var btn  = document.getElementById('theme-toggle');
  if(!btn) return;

  function current(){
    var set = root.getAttribute('data-theme');
    if(set) return set;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function paint(){
    var d = current() === 'dark';
    btn.setAttribute('aria-pressed', String(d));
    btn.title = d ? 'Passa al tema chiaro' : 'Passa al tema scuro';
  }
  btn.addEventListener('click', function(){
    var next = current() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try{ localStorage.setItem('tema', next); }catch(e){}
    paint();
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paint);
  paint();
})();

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
  function it(n,d){ return n.toFixed(d===undefined?1:d).replace('.',','); }

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
  var W=880,H=400, L=54, R=118, T=22, B=44;
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
    var anchors=[[1960,'1960'],[1980,'1980'],[2000,'2000'],[2020,'2020']];
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
    rateNote(1968,'+0,9 ppm/anno',-20);
    rateNote(2012,'+2,4 ppm/anno',58);

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
    var BW=880;
    var bx0=30, bx1=BW-30;
    var barW=bx1-bx0;
    var topY=58, topH=42;
    var botY=190, botH=54;

    var FOSSIL=35.9, LUC=5.0;
    var total=40.9;
    var parts=[
      {k:'ocean',v:11.8,c:tok('--ocean'),lab:'Oceano',     pct:'29%'},
      {k:'land', v:8.7, c:tok('--land'), lab:'Vegetazione',pct:'21%'},
      {k:'atmos',v:20.4,c:tok('--atmos'),lab:'Atmosfera',  pct:'50%'}
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

    var th=el('text',{x:bx0,y:topY-24,class:'svg-lab-b'}); th.textContent='EMESSO OGNI ANNO';
    th.setAttribute('letter-spacing','.08em'); bf.appendChild(th);
    var tt=el('text',{x:bx0,y:topY-6,class:'svg-val'}); tt.setAttribute('font-size','17');
    tt.textContent='40,9 GtCO₂, cioè 5,3 ppm se restassero tutte in aria'; bf.appendChild(tt);

    var f1=el('text',{x:bx0+12,y:topY+27,class:'svg-val'}); f1.style.fill=tok('--ink');
    f1.textContent='Fossili e cemento  35,9'; bf.appendChild(f1);
    var f2=el('text',{x:bx1,y:topY-6,class:'svg-val','text-anchor':'end'}); f2.style.fill=tok('--source');
    f2.textContent='Uso del suolo  5,0'; bf.appendChild(f2);

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
        var lb=el('text',{x:xA+11,y:botY+24,class:'svg-lab-b'});
        lb.style.fill = p.k==='atmos' ? tok('--surface') : tok('--ink'); if(p.k==='atmos') lb.style.stroke='none';
        lb.textContent=p.lab; bf.appendChild(lb);
        var vv=el('text',{x:xA+11,y:botY+44,class:'svg-val'});
        vv.style.fill = p.k==='atmos' ? tok('--surface') : tok('--ink'); if(p.k==='atmos') vv.style.stroke='none';
        vv.textContent=it(p.v)+' GtCO₂ · '+p.pct; bf.appendChild(vv);
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
    a1.textContent='ASSORBITO — 20,5 GtCO₂ (50%)'; a1.setAttribute('letter-spacing','.06em'); bf.appendChild(a1);
    bf.appendChild(el('line',{x1:bx0,x2:ax-4,y1:botY+botH+62,y2:botY+botH+62,stroke:tok('--rule-strong'),'stroke-width':2}));

    var a2=el('text',{x:ax+8,y:botY+botH+52,class:'svg-lab'});
    a2.style.fill=tok('--source');
    a2.textContent='RESTA IN ARIA — 20,4 GtCO₂ = 2,6 ppm all’anno'; a2.setAttribute('letter-spacing','.06em'); bf.appendChild(a2);
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
    var DW=880, dx0=58, dx1=DW-20, dy0=34, dy1=250;
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
    var bw=Math.min(54,(slot-34)/2);
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
  var TW=880, tx0=54, tx1=TW-110, ty0=26, ty1=314;
  var tMin=-0.4, tMax=1.7, txMin=1850, txMax=2028;
  function TX(y){ return tx0 + (y-txMin)/(txMax-txMin)*(tx1-tx0); }
  function TY(v){ return ty1 - (v-tMin)/(tMax-tMin)*(ty1-ty0); }

  function drawTemp(series){
    if(!ts) return;
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
    sl.textContent='1,5 °C — il limite dell’Accordo di Parigi'; f.appendChild(sl);

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
    var CW=880, cx0=56, cx1=CW-124, cy0=28, cy1=286;
    var cyMin=300, cyMax=612, cxMin=1959, cxMax=2027;
    function CX(y){ return cx0 + (y-cxMin)/(cxMax-cxMin)*(cx1-cx0); }
    function CY(v){ return cy1 - (v-cyMin)/(cyMax-cyMin)*(cy1-cy0); }

    var cf=document.createDocumentFragment();

    for(var gv=300; gv<=600; gv+=50){
      cf.appendChild(el('line',{x1:cx0,x2:cx1,y1:CY(gv),y2:CY(gv),class:'grid-l'}));
      var gt=el('text',{x:cx0-10,y:CY(gv)+4,class:'svg-lab','text-anchor':'end'});
      gt.textContent=gv; cf.appendChild(gt);
    }
    var cu=el('text',{x:cx0-10,y:CY(580)-14,class:'svg-unit','text-anchor':'end'});
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
    endLab(lastCf[1], Math.round(lastCf[1])+' ppm', 'senza pozzi', tok('--ink'));
    endLab(lastOb[1], Math.round(lastOb[1])+' ppm', 'osservato',   tok('--source'));

    /* freccia che misura il divario */
    var gx=CX(2012), y1c=CY(CF[CF.length-14][1]), y2c=CY(ANNUAL[ANNUAL.length-14][1]);
    cf.appendChild(el('line',{x1:gx,x2:gx,y1:y1c,y2:y2c,stroke:tok('--land'),'stroke-width':1.6}));
    cf.appendChild(el('line',{x1:gx-5,x2:gx+5,y1:y1c,y2:y1c,stroke:tok('--land'),'stroke-width':1.6}));
    cf.appendChild(el('line',{x1:gx-5,x2:gx+5,y1:y2c,y2:y2c,stroke:tok('--land'),'stroke-width':1.6}));
    var gl=el('text',{x:gx+11,y:y1c+(y2c-y1c)*0.38,class:'svg-lab-b','text-anchor':'start'});
    gl.style.fill=tok('--land'); gl.textContent='tolto da oceani e foreste'; cf.appendChild(gl);

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
  var MESI=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];

  var rs=document.getElementById('recente');
  var RW=880, rx0=54, rx1=RW-136;
  var pT0=22,  pT1=196;    /* pannello alto: concentrazione */
  var pB0=246, pB1=326;    /* pannello centrale: crescita annua */
  var pC0=376, pC1=466;    /* pannello basso: temperatura, in parallelo */

  /* i due blocchi di live.js arrivano in ordine qualsiasi: ognuno passa solo
     cio' che ha letto, il resto resta com'era */
  var rState={monthly:MONTHLY_RECENT, gr:GR, temp:null};
  function drawRecent(monthly, gr, temp){
    if(!rs) return;
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
        yl.textContent=yr; f.appendChild(yl);
      }
    }

    /* ── pannello alto ── */
    for(var v=Math.ceil(yMin/10)*10; v<=yMax; v+=10){
      f.appendChild(el('line',{x1:rx0,x2:rx1,y1:TYr(v),y2:TYr(v),class:'grid-l'}));
      var t=el('text',{x:rx0-10,y:TYr(v)+4,class:'svg-lab','text-anchor':'end'});
      t.textContent=v; f.appendChild(t);
    }
    var u1=el('text',{x:rx0-10,y:pT0-8,class:'svg-unit','text-anchor':'end'}); u1.textContent='ppm'; f.appendChild(u1);
    var h1=el('text',{x:rx0,y:pT0-8,class:'svg-lab-b'}); h1.textContent='Concentrazione, media mensile a Mauna Loa'; f.appendChild(h1);

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
    var l2=el('text',{x:rx1+12,y:py+12,class:'svg-unit'}); l2.textContent='ultimo mese'; f.appendChild(l2);
    var l2b=el('text',{x:rx1+12,y:py+26,class:'svg-unit'}); l2b.textContent=MESI[mIdx]+' '+Math.floor(lastM[0]); f.appendChild(l2b);

    /* ── pannello basso ── */
    for(var g=0; g<=bMax; g+=2){
      f.appendChild(el('line',{x1:rx0,x2:rx1,y1:BY(g),y2:BY(g),class:g===0?'axis-l':'grid-l'}));
      var gt=el('text',{x:rx0-10,y:BY(g)+4,class:'svg-lab','text-anchor':'end'}); gt.textContent=g; f.appendChild(gt);
    }
    var u2=el('text',{x:rx0-10,y:pB0-10,class:'svg-unit','text-anchor':'end'}); u2.textContent='ppm'; f.appendChild(u2);
    var h2=el('text',{x:rx0,y:pB0-10,class:'svg-lab-b'}); h2.textContent='Di quanto è cresciuta in ciascun anno, ppm per anno'; f.appendChild(h2);

    bars.forEach(function(b){
      var bx=RX(b[0])+7, bw=RX(b[0]+1)-RX(b[0])-14;
      var strong = b[1] > gMean;
      f.appendChild(el('rect',{x:bx,y:BY(b[1]),width:bw,height:pB1-BY(b[1]),fill:tok('--source'),'fill-opacity':strong?1:.55,rx:2}));
      var vt=el('text',{x:bx+bw/2,y:BY(b[1])+15,class:'svg-val','text-anchor':'middle'});
      vt.setAttribute('font-size','12'); vt.textContent='+'+it(b[1],2);
      vt.style.fill = strong ? tok('--surface') : tok('--ink'); vt.style.stroke='none';
      f.appendChild(vt);
    });

    f.appendChild(el('line',{x1:rx0,x2:rx1,y1:BY(gMean),y2:BY(gMean),stroke:tok('--ink-3'),'stroke-width':1,'stroke-dasharray':'4 3'}));
    var ml=el('text',{x:rx1+12,y:BY(gMean)-4,class:'svg-val'}); ml.textContent=it(gMean,2)+' ppm/anno'; f.appendChild(ml);
    var ml2=el('text',{x:rx1+12,y:BY(gMean)+12,class:'svg-unit'}); ml2.textContent='media '+xMin+'–'+lastG; f.appendChild(ml2);

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
      var h3=el('text',{x:rx0,y:pC0-10,class:'svg-lab-b'}); h3.textContent='Temperatura globale sul 1850–1900, media annua'; f.appendChild(h3);

      if(1.5>cMin && 1.5<cMax){
        f.appendChild(el('line',{x1:rx0,x2:rx1,y1:CY(1.5),y2:CY(1.5),stroke:tok('--heat'),'stroke-width':1.2,'stroke-dasharray':'5 4','stroke-opacity':.85}));
        var sl=el('text',{x:rx0+8,y:CY(1.5)-6,class:'svg-unit'}); sl.style.fill=tok('--heat'); sl.textContent='1,5 °C, il limite dell’Accordo di Parigi'; f.appendChild(sl);
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
          tv.setAttribute('font-size','12'); tv.textContent='+'+it(t[1],2); f.appendChild(tv);
        }
      });
      var tl=tp[tp.length-1];
      var l3=el('text',{x:rx1+12,y:CY(tl[1])-4,class:'svg-val'}); l3.textContent='+'+it(tl[1],2)+' °C'; f.appendChild(l3);
      var l4=el('text',{x:rx1+12,y:CY(tl[1])+12,class:'svg-unit'}); l4.textContent='nel '+tl[0]; f.appendChild(l4);
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
    var KW=880, kx0=54, kx1=KW-30, ky0=26, ky1=250;
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
    kw.textContent='periodo di impegno 2008–2012'; kf.appendChild(kw);
    [[1997,'firma'],[2005,'in vigore'],[2012,'fine 1° periodo']].forEach(function(m){
      var v=KY[m[0]-kyMin], px=KX(m[0]+0.5), py=KY_(v);
      kf.appendChild(el('circle',{cx:px,cy:py,r:5,fill:tok('--surface'),stroke:tok('--source'),'stroke-width':2.2}));
      var t1=el('text',{x:px+10,y:py+17,class:'svg-val'}); t1.textContent=it(v,1); kf.appendChild(t1);
      var t2=el('text',{x:px+10,y:py+32,class:'svg-unit'}); t2.textContent=m[0]+' · '+m[1]; kf.appendChild(t2);
    });
    var lv=KY[KY.length-1], lx=KX(kyMax-0.5), ly=KY_(lv);
    kf.appendChild(el('circle',{cx:lx,cy:ly,r:5,fill:tok('--surface'),stroke:tok('--source'),'stroke-width':2.2}));
    var l1=el('text',{x:lx-10,y:ly-12,class:'svg-val','text-anchor':'end'}); l1.textContent=it(lv,1)+' nel 2024'; kf.appendChild(l1);
    var c20=el('text',{x:KX(2020.5),y:KY_(KY[30])+22,class:'svg-unit','text-anchor':'middle'}); c20.textContent='2020 · pandemia'; kf.appendChild(c20);
    ks.appendChild(kf);
  }

  /* esposto per live.js: ridisegna la curva coi dati appena letti da NOAA */
  window.Carbonio = {
    drawKeeling: drawKeeling,
    drawRecent:  drawRecent,
    drawTemp:    drawTemp,
    bakedAnnual: ANNUAL,
    bakedMonthly: MONTHLY_RECENT,
    bakedGr:     GR,
    bakedTemp:   TEMP
  };
})();
