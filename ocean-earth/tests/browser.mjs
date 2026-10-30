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
  await page.click('#play');
  await sleep(500);
  const paused = await page.evaluate(() => ({ v: document.querySelector('#slider').value, now: document.querySelector('#now').innerText }));
  check('pausa su dato originale', Number.isInteger(+paused.v), JSON.stringify(paused));
  // giornaliero
  await page.select('#tier', 'daily');
  await sleep(3000);
  const daily = await page.evaluate(() => ({ now: document.querySelector('#now').innerText, src: !document.querySelector('#src-row').hidden, st: document.querySelector('#status').innerText }));
  check('livello giornaliero', /\d{1,2} \w+ 20\d\d/.test(daily.now) && daily.src, JSON.stringify(daily));
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
await browser.close();
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.extra ? '  — ' + r.extra : ''}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
