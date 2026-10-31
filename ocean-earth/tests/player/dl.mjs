// Linea lenta: riproduzione senza scaricare, poi "Scarica", poi riproduzione completa.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const url = process.argv[2], tier = process.argv[3] || 'monthly', fps = +(process.argv[4] || 4);
const profile = path.join(os.tmpdir(), 'oe-profile-dl');
fs.rmSync(profile, { recursive: true, force: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: 'new', userDataDir: profile, args: ['--use-angle=gl', '--use-gl=angle', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('ERRORE', e.message));
await page.setViewport({ width: 1440, height: 900 });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
await sleep(1500);
await page.evaluate((tier, fps) => { const s = document.querySelector('#tier'); s.value = tier; s.dispatchEvent(new Event('change')); __oe.timeline.fps = fps; }, tier, fps);
await sleep(2000);
async function play(secs, label) {
  await page.evaluate(() => { __oe.timeline.pause(); __oe.timeline.seek(0); document.querySelector('#play').click(); });
  const t0 = Date.now(); let wait = 0, n = 0;
  while (Date.now() - t0 < secs * 1000) {
    if (await page.evaluate(() => !document.querySelector('#buffering').hidden)) wait++;
    n++; await sleep(100);
  }
  const pos = await page.evaluate(() => { const p = __oe.timeline.pos; __oe.timeline.pause(); return p; });
  console.log(`${label}: avanzati ${pos.toFixed(0)}/${Math.min(fps * secs, 9999)} in ${secs}s, in caricamento ${(100 * wait / n).toFixed(0)}%`);
}
await play(20, 'senza scaricare');
const btn0 = await page.evaluate(() => document.querySelector('#dl').textContent);
console.log('pulsante:', btn0);
const t0 = Date.now();
await page.evaluate(() => document.querySelector('#dl').click());
let last = '';
while (true) {
  await sleep(5000);
  const s = await page.evaluate(() => ({ b: document.querySelector('#dl').textContent, i: document.querySelector('#dl-info').textContent, hidden: document.querySelector('#dl').hidden }));
  if (s.i !== last) { console.log(`  ${((Date.now() - t0) / 1000).toFixed(0)}s ${s.i}`); last = s.i; }
  if (s.hidden || /salvato|saved/.test(s.i)) break;
}
console.log(`scaricato in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
await page.screenshot({ path: path.join(os.tmpdir(), 'oe-dl-done.png') });
const n = await page.evaluate(() => __oe.timeline.frames.length);
await play(Math.ceil(n / fps) + 3, 'riproduzione completa dopo lo scaricamento');
await browser.close();
