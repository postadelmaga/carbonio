// Diagnosi del player: tre passate sullo stesso tratto (prima visita, di nuovo
// nella stessa sessione, dopo aver ricaricato la pagina) con profilo persistente.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const url = process.argv[2], tier = process.argv[3] || 'monthly', secs = +(process.argv[4] || 30), fps = +(process.argv[5] || 4);
const profile = process.argv[6] || path.join(os.tmpdir(), 'oe-profile');
if (!process.argv[6]) fs.rmSync(profile, { recursive: true, force: true });
const server = new URL(url).origin;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: 'new', userDataDir: profile, args: ['--use-angle=gl', '--use-gl=angle', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
async function open() {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
  await sleep(1500);
  await page.evaluate((tier, fps) => {
    const s = document.querySelector('#tier'); s.value = tier; s.dispatchEvent(new Event('change'));
    __oe.timeline.fps = fps;
  }, tier, fps);
  await sleep(3000);
}
async function pass(label) {
  await fetch(server + '/__reset').catch(() => {});
  await page.evaluate(() => { __oe.store.net = null; __oe.timeline.pause(); __oe.timeline.seek(0); });
  await sleep(300);
  await page.evaluate(() => document.querySelector('#play').click());
  const t0 = Date.now(); let wait = 0, n = 0, longest = 0, cur = 0;
  while (Date.now() - t0 < secs * 1000) {
    const w = await page.evaluate(() => !document.querySelector('#buffering').hidden);
    n++; if (w) { wait++; cur += 100; longest = Math.max(longest, cur); } else cur = 0;
    await sleep(100);
  }
  const r = await page.evaluate(() => ({ pos: __oe.timeline.pos, net: __oe.store.net }));
  const srv = await fetch(server + '/__stats').then((x) => x.json()).catch(() => null);
  const nt = r.net || {};
  console.log(`${label.padEnd(22)} avanzati ${r.pos.toFixed(0).padStart(3)}/${fps * secs}  attesa ${String((100 * wait / n).toFixed(0)).padStart(3)}% (max ${(longest / 1000).toFixed(1)}s) | file ${nt.files ?? 0}: scaricati ${((nt.bytes ?? 0) / 1e6).toFixed(0)} MB, revalidati ${nt.revalidated ?? 0}, disco ${nt.stored ?? 0}, cache http ${nt.cached ?? 0}, rete media ${nt.files ? (nt.ms / nt.files).toFixed(0) : '-'} ms, decodifica media ${nt.files ? (nt.decodeMs / nt.files).toFixed(0) : '-'} ms${srv ? ` | server: ${srv.req} richieste, ${srv.r304} risposte 304, ${(srv.bytes / 1e6).toFixed(0)} MB` : ''}`);
}
await open();
await pass('1 prima visita');
await pass('2 stessa sessione');
await open();
await pass('3 dopo ricarica');
await browser.close();
