// Video di Ocean Earth: anomalia della temperatura e correnti, set 1994 → set 2026,
// 60 fps, il tempo che scorre agganciato ai battiti della musica.
// Orologio virtuale: requestAnimationFrame e performance.now sono sostituiti,
// ogni fotogramma del video avanza la pagina di 1/60 s esatto.
//   node render.mjs URL OUTDIR [--test N]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const [url, out] = process.argv.slice(2);
const testN = process.argv.includes('--test') ? +process.argv[process.argv.indexOf('--test') + 1] : 0;
fs.mkdirSync(out, { recursive: true });
const FPS = 60;
const A0 = +(process.env.A0 || 75.6);          // secondo della canzone da cui parte il video
const T0 = +(process.env.T0 || 81.603);        // entrata: il tempo comincia a scorrere
const T1 = +(process.env.T1 || 127.55);        // ultimo battito pieno: arriva settembre 2026
const END = +(process.env.END || 133.0);        // fine del video (dissolvenza negli ultimi secondi)
const beats = JSON.parse(fs.readFileSync(new URL('../beats.json', import.meta.url))).beats.filter((b) => b > T0 + 0.1 && b < T1 - 0.1);
const grid = [T0, ...beats, T1];
const N = Math.round((END - A0) * FPS);
const ROT = +(process.env.ROT || 6.3);
const VERT = !!process.env.VERT;
const LAND = process.env.LAND || '';     // precip | soil: anche la terraferma (ERA5)          // 1080×1920 per i reel
const VW = VERT ? 1080 : 1920, VH = VERT ? 1920 : 1080;   // gradi di rotazione al secondo

// posizione nella serie: lineare fra un battito e l'altro
function progress(ta) {
  if (ta <= T0) return 0;
  if (ta >= T1) return 1;
  let k = 0;
  while (grid[k + 1] < ta) k++;
  return (k + (ta - grid[k]) / (grid[k + 1] - grid[k])) / (grid.length - 1);
}

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable', headless: 'new',
  args: ['--use-angle=gl', '--use-gl=angle', '--ignore-gpu-blocklist', `--window-size=${VW},${VH}`],
});
const page = await browser.newPage();
await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('pageerror', e.message));
if (LAND) await page.evaluateOnNewDocument((l) => { window.__LAND = l; }, LAND);
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('tema', 'dark');
  localStorage.setItem('lingua', 'it');
  localStorage.setItem('oe-layers', JSON.stringify({ sst: 0, anom: 1, speed: 0.85, land: window.__LAND ? 1 : 0 }));
  if (window.__LAND) localStorage.setItem('oe-land', window.__LAND);
  let vt = 0; const q = [];
  window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
  window.cancelAnimationFrame = () => {};
  performance.now = () => vt;
  window.__step = (ms) => { vt += ms; const cbs = q.splice(0); for (const cb of cbs) cb(vt); };
});
await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
await page.waitForFunction(() => window.__oe && document.querySelector('#loading').hidden, { timeout: 120000 });
await page.evaluate(() => { for (let i = 0; i < 5; i++) window.__step(16.667); });

// grafica del video al posto dei comandi
const anomBar = await page.evaluate(() => document.querySelector('.mx[data-layer=anom] .lg-bar')?.style.background || '');
const landBar = await page.evaluate(() => document.querySelector('.mx[data-layer=land] .lg-bar')?.style.background || '');
await page.addStyleTag({ content: `
  .top, .time, .side, .legend, .hint, #info, .mini, .note, #buffering, .panel, .mark, .split, #status { display: none !important; }
  #v-ov { position: fixed; inset: 0; pointer-events: none; font-family: Archivo, sans-serif; color: #e8f0f4; }
  #v-title { position: absolute; left: 72px; top: 60px; }
  #v-title b { display: block; font-size: 30px; font-weight: 900; font-stretch: 118%; letter-spacing: .16em; }
  #v-title span { display: block; margin-top: 10px; font-size: 19px; color: #a9bcc6; max-width: 520px; line-height: 1.4; }
  #v-date { position: absolute; left: 72px; bottom: 120px; }
  #v-year { font: 700 132px/0.9 "IBM Plex Mono", monospace; letter-spacing: -.02em; }
  #v-month { font-size: 30px; color: #a9bcc6; margin-top: 10px; text-transform: lowercase; }
  #v-prog { width: 300px; height: 3px; background: rgba(255,255,255,.18); margin-top: 22px; border-radius: 2px; }
  #v-prog u { display: block; height: 100%; width: 0; background: #e8f0f4; border-radius: 2px; }
  #v-ends { width: 300px; display: flex; justify-content: space-between; margin: 6px 0 0; font: 500 13px "IBM Plex Mono", monospace; color: #7f939c; }
  #v-leg { position: absolute; right: 72px; bottom: 124px; width: 360px; font-size: 15px; color: #a9bcc6; }
  #v-leg i { display: block; height: 12px; border-radius: 4px; margin: 8px 0 6px; background: ${anomBar}; }
  #v-leg p { display: flex; justify-content: space-between; margin: 0; font: 500 14px "IBM Plex Mono", monospace; }
  #v-leg small { display: block; margin-top: 12px; }
  #v-leg .l2 { margin-top: 18px; }
  #v-leg i.land { background: ${landBar}; }
  #v-src { position: absolute; left: 72px; right: 72px; bottom: 52px; font-size: 14px; color: #7f939c; display: flex; justify-content: space-between; }
  #v-fade { position: absolute; inset: 0; background: #000; }
`});
if (VERT) await page.addStyleTag({ content: `
  #globe { transform: translateY(${LAND ? 105 : 150}px); }
  #v-title { left: 0; right: 0; top: 200px; text-align: center; }
  #v-title b { font-size: 36px; }
  #v-title span { margin: 10px auto 0; font-size: 21px; max-width: 760px; }
  #v-date { left: 0; right: 0; top: 330px; bottom: auto; text-align: center; }
  #v-year { font-size: 140px; }
  #v-month { margin-top: 6px; font-size: 28px; }
  #v-prog, #v-ends { margin-left: auto; margin-right: auto; width: 420px; }
  #v-prog { margin-top: 16px; }
  #v-leg { left: 50%; right: auto; transform: translateX(-50%); bottom: ${LAND ? 215 : 230}px; width: ${LAND ? 720 : 560}px; text-align: center; font-size: 18px; }
  #v-leg small { font-size: 16px; }
  #v-src { top: auto; bottom: 170px; left: 0; right: 0; justify-content: center; gap: 4px 18px; font-size: 15px; flex-wrap: wrap; text-align: center; }
`});
await page.evaluate((LAND) => {
  const d = document.createElement('div');
  const LT = { soil: 'Umidità del suolo', precip: 'Precipitazioni' }[LAND];
  d.id = 'v-ov';
  d.innerHTML = `
    <div id="v-title"><b>OCEAN EARTH</b><span>${LT ? `Anomalia della temperatura del mare, correnti e ${LT.toLowerCase()} sulla terraferma, rispetto al 1993–2020` : 'Anomalia della temperatura del mare rispetto al 1993–2020 e correnti superficiali'}</span></div>
    <div id="v-date"><div id="v-year"></div><div id="v-month"></div><div id="v-prog"><u></u></div><p id="v-ends"><span>1994</span><span>2026</span></p></div>
    <div id="v-leg">Anomalia della temperatura superficiale<i></i><p><span>−3 °C</span><span>0</span><span>+3 °C</span></p>${LT ? `<div class="l2">${LT}, % del normale<i class="land"></i><p>${LAND === "soil" ? "<span>50%</span><span>100%</span><span>200%</span>" : "<span>25%</span><span>100%</span><span>400%</span>"}</p></div>` : ''}<small>Le scie luminose sono le correnti: piu' chiare dove sono piu' veloci${LT ? '. In grigio i deserti, dove il normale e\' quasi zero' : ''}</small></div>
    <div id="v-src"><span>Dati: Copernicus Marine Service · GLORYS12, analisi globale, Copernicus-GlobCurrent${LT ? ' · Copernicus Climate Change Service · ' + (LAND === 'soil' ? 'ERA5-Land' : 'ERA5') : ''}</span><span>co2-info.duckdns.org/ocean-earth</span></div>
    <div id="v-fade"></div>`;
  document.body.appendChild(d);
  const st = __oe.globe.state;
  st.particleCount = 22000; st.particleWidth = 1.9; st.coast = true; st.hotspot = false;
  __oe.globe.resetParticles();
}, LAND);

const idx = await page.evaluate(() => ({ a: __oe.timeline.findStamp('1994-09'), b: __oe.timeline.findStamp('2026-09') }));
console.log('indici', idx, 'battiti', grid.length - 1, 'fotogrammi', N);
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

async function setFrame(f) {
  const tv = f / FPS, ta = A0 + tv;
  const pos = idx.a + (idx.b - idx.a) * progress(ta);
  const fade = Math.max(0, 1 - tv / 1.5, (tv - (END - A0 - 3.5)) / 3.5);
  await page.evaluate((pos, tv, fade, MONTHS, prog, ROT, DUR, DIST, LAT0) => {
    const c = __oe.camera;
    c.lon = -40 + ROT * tv;
    c.lat = LAT0 + 12 * Math.sin((2 * Math.PI * tv) / DUR);
    c.dist = DIST;
    __oe.timeline.seek(pos);
    const fr = __oe.timeline.frames[Math.round(pos)];
    document.getElementById('v-year').textContent = fr.t.slice(0, 4);
    document.getElementById('v-month').textContent = MONTHS[+fr.t.slice(5, 7) - 1];
    document.getElementById('v-fade').style.opacity = Math.min(1, fade);
    document.querySelector('#v-prog u').style.width = (prog * 100) + '%';
  }, pos, tv, fade, MONTHS, progress(ta), ROT, END - A0, VERT ? (LAND ? 4.15 : 3.8) : 3.55, +(process.env.LAT0 || 16));
  // aspetta che i due fotogrammi da mescolare siano sul globo
  await page.waitForFunction((L) => {
    const c = __oe.shown(), tl = __oe.timeline;
    return c && c.A === tl.frameA && c.B === tl.frameB && c.sA && c.cA && __oe.globe.hasClim && (!L || (c.lA && c.lB));
  }, { timeout: 60000, polling: 20 }, LAND);
}

// le particelle partono gia' con le loro scie
await setFrame(0);
await page.evaluate(() => { for (let i = 0; i < 180; i++) window.__step(1000 / 60); });

const t0 = Date.now();
const only = process.env.AT ? process.env.AT.split(',').map(Number) : null;
for (let f = 0; f < N; f++) {
  if (only && !only.includes(f)) continue;
  await setFrame(f);
  await page.evaluate(() => window.__step(1000 / 60));
  await page.screenshot({ path: `${out}/f${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 93 });
  if (f % 120 === 0) console.log(`${f}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
console.log('fatto', ((Date.now() - t0) / 1000).toFixed(0), 's');
await browser.close();
