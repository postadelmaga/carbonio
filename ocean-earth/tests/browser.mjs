import puppeteer from 'puppeteer-core';
// uso: npm i puppeteer-core@23 (fuori dal repository) e poi
//   node tests/browser.mjs [URL] [cartella degli screenshot]
// CHROME=/percorso/del/browser per cambiare eseguibile.
const base = process.argv[2] || 'http://127.0.0.1:8765/index.html';
const outDir = process.argv[3] || '.';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', headless: 'new',
  args: ['--use-angle=gl', '--use-gl=angle', '--ignore-gpu-blocklist'] });
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok: !!ok, extra }); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(w, h, mobile, theme) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 404/.test(m.text())) errors.push(m.text()); });
  // la favicon sta nella radice del sito: in locale (solo ocean-earth/) manca
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.svg')) errors.push(`${r.status()} ${r.url()}`); });
  if (theme) await page.evaluateOnNewDocument((t) => localStorage.setItem('tema', t), theme);
  await page.goto(base, { waitUntil: 'networkidle0', timeout: 90000 });
  await sleep(3000);
  return { page, errors };
}

// desktop
{
  const { page, errors } = await open(1440, 900, false, 'dark');
  check('caricamento senza errori', errors.length === 0, errors.join(' | '));
  const loaded = await page.evaluate(() => document.querySelector('#loading').hidden);
  check('manifest caricato', loaded);
  // clic al centro del globo (Atlantico)
  await page.mouse.click(620, 430);
  // la serie storica arriva con una tessera da scaricare e decodificare
  for (let i = 0; i < 10 && !(await page.evaluate(() => document.querySelectorAll('#pt-chart path').length)); i++) await sleep(1000);
  const info = await page.evaluate(() => ({ vis: !document.querySelector('#info').hidden, txt: document.querySelector('#pt-values').innerText, chart: document.querySelectorAll('#pt-chart path').length }));
  check('pannello del punto', info.vis && /°C/.test(info.txt), info.txt.replace(/\n/g, ' ').slice(0, 220));
  check('grafico storico', info.chart > 0, `${info.chart} serie`);
  await page.screenshot({ path: `${outDir}/f-desktop-point.png` });
  // riproduzione
  const before = await page.evaluate(() => document.querySelector('#slider').value);
  await page.click('#first');
  await page.click('#play');
  await sleep(4000);
  const during = await page.evaluate(() => ({ now: document.querySelector('#now').innerText, v: document.querySelector('#slider').value, fps: window.__oeFps, st: document.querySelector('#status').innerText }));
  check('riproduzione avanza', +during.v > 0, JSON.stringify(during));
  await page.screenshot({ path: `${outDir}/f-desktop-play.png` });
  // in play le barre escono dallo schermo e resta la pillola con data e pausa
  const vis = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return getComputedStyle(document.querySelector(sel)).opacity > 0.5 && r.bottom > 0 && r.top < innerHeight; };
  const imm = await page.evaluate((f) => { const v = eval(f); return { top: v('.top'), time: v('.time'), mini: v('#mini'), now: document.querySelector('#mini-now').innerText }; }, vis.toString());
  check('barre nascoste in play', !imm.top && !imm.time && imm.mini && imm.now.length > 0, JSON.stringify(imm));
  await page.click('#mini-play');
  await sleep(600);
  const back = await page.evaluate((f) => { const v = eval(f); return { top: v('.top'), time: v('.time'), mini: v('#mini') }; }, vis.toString());
  check('barre di nuovo visibili in pausa', back.top && back.time && !back.mini, JSON.stringify(back));
  const paused = await page.evaluate(() => ({ v: document.querySelector('#slider').value, now: document.querySelector('#now').innerText }));
  // anomalia: la climatologia usata deve essere quella del mese sul globo,
  // anche nell'attimo in cui il mese scelto non e' ancora arrivato
  const clim = await page.evaluate(async () => {
    const tl = __oe.timeline;
    document.querySelector('.quick-mode button[data-mode=anom]').click();
    tl.pause();
    for (let k = 0; k < 40 && !__oe.shown(); k++) await new Promise((r) => setTimeout(r, 250));
    tl.seek(tl.findStamp('2001-07'));            // mai caricato prima, mese diverso
    const during = { shown: __oe.shown().A.t, sel: __oe.globe.state.climSel[0] };
    await new Promise((r) => setTimeout(r, 6000));
    const after = { shown: __oe.shown().A.t, sel: __oe.globe.state.climSel[0] };
    document.querySelector('.quick-mode button[data-mode=sst]').click();
    return { during, after };
  });
  const mon = (t) => +t.slice(5, 7) - 1;
  check('anomalia col mese mostrato', clim.during.sel === mon(clim.during.shown) && clim.during.shown !== '2001-07' && clim.after.shown === '2001-07' && clim.after.sel === 6, JSON.stringify(clim));
  check('pausa su dato originale', Number.isInteger(+paused.v), JSON.stringify(paused));
  // terraferma (ERA5): umidita' del suolo dell'estate 2022, siccita' in Europa
  const land = await page.evaluate(async () => {
    const tl = __oe.timeline;
    const row = document.querySelector('.mx[data-layer=land]');
    if (!row) return { row: false };
    const sel = row.querySelector('select');
    sel.value = 'soil'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    tl.seek(tl.findStamp('2022-07'));
    for (let k = 0; k < 40 && !(__oe.shown()?.lv === 'soil' && __oe.shown().lA && __oe.shown().A.t === '2022-07'); k++) await new Promise((r) => setTimeout(r, 250));
    const c = __oe.shown();
    // una cella nella pianura padana: luglio 2022 sotto il normale
    const i = __oe.store.cell(45.1, 10.0).i;
    const v = c.lA ? __oe.store.scalarValue(c.lA.codes, i) : NaN;
    const out = { row: true, lv: c.lv, t: c.A.t, po: Math.round(v), status: document.querySelector('#status').innerText.includes('ERA5') };
    const r = row.querySelector('input[type=range]');
    r.value = 0; r.dispatchEvent(new Event('input', { bubbles: true }));
    return out;
  });
  check('terraferma: umidita\' del suolo', land.row && land.lv === 'soil' && land.t === '2022-07' && land.po > 0 && land.po < 100 && land.status, JSON.stringify(land));
  // giornaliero
  await page.select('#tier', 'daily');
  await sleep(3000);
  const daily = await page.evaluate(() => ({ now: document.querySelector('#now').innerText, src: !document.querySelector('#src-row').hidden, st: document.querySelector('#status').innerText }));
  check('livello giornaliero', /\d{1,2} \w+ 20\d\d/.test(daily.now) && daily.src, JSON.stringify(daily));
  // il pannello laterale parte chiuso: lo si apre come farebbe chi usa la pagina
  check('pannello laterale chiuso all\'avvio', await page.evaluate(() => !document.body.classList.contains('side-open')));
  await page.click('#side-btn');
  await sleep(400);
  await page.click('input[name=source][value=ostia]');
  await sleep(2500);
  const ost = await page.evaluate(() => document.querySelector('#status').innerText);
  check('fonte OSTIA', /OSTIA/.test(ost), ost);
  await page.screenshot({ path: `${outDir}/f-desktop-ostia.png` });
  // velocita' + frecce, zoom nel Mediterraneo
  await page.click('.quick-mode button[data-mode=speed]');
  await page.click('#arrows');
  await page.click('#med-btn');
  await sleep(5000);
  await page.screenshot({ path: `${outDir}/f-desktop-med-speed.png` });
  check('errori dopo le interazioni', errors.length === 0, errors.join(' | '));
  // cache del browser: un intervallo breve si scarica col pulsante e, ricaricata
  // la pagina, si rilegge dal disco senza chiedere nulla al server
  await page.evaluate(() => {
    const s = document.querySelector('#tier'); s.value = 'monthly'; s.dispatchEvent(new Event('change'));
    __oe.timeline.setLoop([200, 205]);         // mesi mai visti prima in questo test
  });
  await sleep(1500);
  const dlBefore = await page.evaluate(() => ({ btn: document.querySelector('#dl').textContent, hidden: document.querySelector('#dl').hidden }));
  await page.evaluate(() => document.querySelector('#dl').click());
  for (let k = 0; k < 60; k++) {
    await sleep(1000);
    if (await page.evaluate(() => document.querySelector('#dl').hidden)) break;
  }
  const done = await page.evaluate(() => document.querySelector('#dl-info').textContent);
  check('scaricamento di un intervallo', !dlBefore.hidden && /MB/.test(dlBefore.btn) && /salvato|saved/.test(done), `${dlBefore.btn} → ${done}`);
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(2500);
  const saved = await page.evaluate(async () => {
    __oe.store.net = null;
    const s = document.querySelector('#tier'); s.value = 'monthly'; s.dispatchEvent(new Event('change'));
    __oe.timeline.fps = 4; __oe.timeline.seek(200); __oe.timeline.play();
    await new Promise((r) => setTimeout(r, 1500));
    __oe.timeline.pause();
    return { saved: __oe.store.saved.size, net: __oe.store.net };
  });
  check('dopo la ricarica letti dal disco', saved.saved >= 12 && saved.net && saved.net.stored > 0, JSON.stringify(saved));
  await page.close();
}
// telefono
{
  const { page, errors } = await open(390, 844, true, null);
  await page.screenshot({ path: `${outDir}/f-mobile.png` });
  await page.tap('#side-btn');
  await sleep(800);
  await page.screenshot({ path: `${outDir}/f-mobile-side.png` });
  check('telefono senza errori', errors.length === 0, errors.join(' | '));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check('niente scorrimento orizzontale', !overflow);
  await page.close();
}
// le cinque lingue del sito, sul telefono: niente errori, niente che esce
// dallo schermo, testi tradotti (non le chiavi e non l'inglese)
for (const [lang, word] of [['en', 'Anomaly'], ['it', 'Anomalia'], ['es', 'Anomalía'], ['fr', 'Anomalie'], ['zh', '距平']]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + (base.includes('?') ? '&' : '?') + 'lang=' + lang, { waitUntil: 'networkidle0', timeout: 90000 });
  await sleep(2500);
  const r = await page.evaluate(() => {
    const top = document.querySelector('.top');
    return {
      htmlLang: document.documentElement.lang,
      mode: document.querySelector('.quick-mode button[data-mode=anom] .l').textContent,
      qfit: (() => { const q = document.querySelector('.quick-mode'); return q.scrollWidth <= q.clientWidth + 1; })(),
      status: document.querySelector('#status').innerText,
      fits: top.scrollWidth <= top.clientWidth + 1 && document.documentElement.scrollWidth <= window.innerWidth,
      back: document.querySelector('#back-link').getAttribute('href'),
    };
  });
  const home = lang === 'en' ? '/' : `/${lang}/`;
  check(`lingua ${lang}`, errors.length === 0 && r.htmlLang === lang && r.mode === word && r.fits && r.qfit && r.back === home && !/_[a-z]+\b/.test(r.status),
    JSON.stringify({ ...r, status: r.status.slice(0, 60), errors }));
  await page.close();
}
await browser.close();
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.extra ? '  — ' + r.extra : ''}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
