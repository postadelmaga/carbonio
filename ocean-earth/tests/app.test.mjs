// Test delle funzioni scientifiche del frontend (node --test tests/).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera, toXYZ, toLatLon, wrapLon, angularDistance } from '../app/geo.js';
import { climSelection, mixClim, Timeline } from '../app/timeline.js';
import { stampToYear } from '../app/chart.js';
import { lut } from '../app/palettes.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} ≠ ${b}`);

test('coordinate: andata e ritorno', () => {
  for (const [lat, lon] of [[0, 0], [45, 10], [-33.5, 151.2], [89, -179], [-60, 179.9]]) {
    const [la, lo] = toLatLon(toXYZ(lat, lon));
    near(la, lat, 1e-9); near(wrapLon(lo - lon), 0, 1e-9);
  }
  near(angularDistance(0, 0, 0, 90), 90, 1e-9);
  near(wrapLon(190), -170, 1e-9);
});

test('camera: il pixel al centro e\' il punto inquadrato, pick e project sono inversi', () => {
  const c = new Camera();
  c.width = 1200; c.height = 800; c.lat = 38; c.lon = 17; c.dist = 1.5;
  c.update();
  const [la, lo] = c.pick(600, 400);
  near(la, 38, 1e-3, 'lat'); near(lo, 17, 1e-3, 'lon');
  for (const [x, y] of [[300, 200], [900, 650], [610, 390]]) {
    const p = c.pick(x, y);
    const xy = c.project(p[0], p[1]);
    near(xy[0], x, 0.05); near(xy[1], y, 0.05);
  }
  // il nord e' in alto: un pixel piu' in alto ha latitudine maggiore
  assert.ok(c.pick(600, 300)[0] > c.pick(600, 500)[0]);
  // l'est e' a destra
  assert.ok(wrapLon(c.pick(800, 400)[1] - c.pick(400, 400)[1]) > 0);
  // un punto agli antipodi non si vede
  assert.equal(c.project(-38, -163), null);
});

test('climatologia: media mensile, giorni interpolati fra i centri dei mesi', () => {
  assert.deepEqual(climSelection('2024-07'), [6, 6, 0, 0]);
  const mid = climSelection('2024-07-16T12');            // centro di luglio
  assert.equal(mid[0], 6); near(mid[2], 0, 0.02);
  const s = climSelection('2024-07-31');
  assert.equal(s[0], 6); assert.equal(s[1], 7); assert.ok(s[2] > 0.4 && s[2] < 0.6);
  const j = climSelection('2024-01-02');                 // prima del centro di gennaio
  assert.equal(j[0], 11); assert.equal(j[1], 0); assert.ok(j[2] > 0.5);
  // fra due mesi di fila l'interpolazione passa da un mese al successivo
  assert.deepEqual(mixClim([6, 6, 0, 0], [7, 7, 0, 0], 0.25), [6, 7, 0.25, 0]);
});

test('tempo: anni decimali', () => {
  near(stampToYear('1993-01'), 1993 + 0.5 / 12, 1e-9);
  near(stampToYear('2024-12-31'), 2024 + 365.5 / 366, 1e-6);
  assert.ok(stampToYear('2026-10-29T23') > stampToYear('2026-10-29T00'));
});

test('timeline: interpolazione dichiarata solo fra due fotogrammi, attesa dei dati', () => {
  const frames = ['2020-01', '2020-02', '2020-03'].map((t) => ({ t, sst: 0, cur: 0 }));
  const tl = new Timeline({ tiers: { monthly: { frames } } });
  tl.setTier('monthly', false);
  assert.equal(tl.index, 2);
  tl.seek(0);
  tl.fps = 2;
  tl.play();
  assert.equal(tl.tick(0.25, () => true), true);
  assert.ok(tl.interpolated);
  near(tl.frac, 0.5, 1e-9);
  // se il fotogramma successivo non c'e' ancora, non si avanza
  const before = tl.pos;
  assert.equal(tl.tick(0.25, () => false), false);
  assert.equal(tl.pos, before);
  tl.pause();
  assert.equal(tl.interpolated, false);                  // da fermi: solo dati originali
});

test('tavolozze: estremi esatti', () => {
  const l = lut('classic');
  assert.deepEqual([...l.slice(0, 3)], [0x0b, 0x1a, 0x5c]);
  assert.deepEqual([...l.slice(255 * 4, 255 * 4 + 3)], [0x9e, 0x10, 0x28]);
  const a = lut('anomaly', 257);
  assert.deepEqual([...a.slice(128 * 4, 128 * 4 + 3)], [0xf7, 0xf7, 0xf7]);   // zero = bianco
});

test('traduzioni: ogni lingua del sito ha tutti i testi', async () => {
  const fs = await import('node:fs');
  const { TEXTS, LANGS } = await import('../app/i18n.js');
  assert.deepEqual(Object.keys(TEXTS).sort(), [...LANGS].sort());
  const en = Object.keys(TEXTS.en);
  for (const l of LANGS) {
    const missing = en.filter((k) => !TEXTS[l][k]);
    const extra = Object.keys(TEXTS[l]).filter((k) => !(k in TEXTS.en));
    assert.deepEqual(missing, [], `${l}: mancano ${missing}`);
    assert.deepEqual(extra, [], `${l}: chiavi che l'inglese non ha ${extra}`);
    // segnaposto come {n} uguali in tutte le lingue
    for (const k of en) assert.deepEqual(TEXTS[l][k].match(/\{\w+\}/g), TEXTS.en[k].match(/\{\w+\}/g), `${l}.${k}`);
  }
  // ogni chiave usata nella pagina e nel codice esiste
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const js = fs.readFileSync(new URL('../app/main.js', import.meta.url), 'utf8');
  const used = new Set([
    ...[...html.matchAll(/data-i18n(?:-title|-aria)?="([a-z_]+)"/g)].map((m) => m[1]),
    ...[...js.matchAll(/\bt\('([a-z_]+)'\)/g)].map((m) => m[1]),
  ]);
  for (const k of used) assert.ok(TEXTS.en[k], `chiave usata ma non definita: ${k}`);
  // la finestra informativa ha un testo per ogni lingua
  for (const l of LANGS) assert.ok(html.includes(`<div data-lang-only="${l}">`), `informazioni senza ${l}`);
});

test('date e numeri nel formato di ogni lingua', async () => {
  const i18n = await import('../app/i18n.js');
  const out = {};
  for (const l of i18n.LANGS) {
    i18n.setLang(l);
    out[l] = [i18n.fmtStamp('2024-07'), i18n.fmtStamp('2024-07-03T05'), i18n.fmtNum(1234.5, 1), i18n.fmtLon(-12)];
  }
  i18n.setLang('en');
  assert.match(out.it[0], /lug.*2024/);
  assert.match(out.zh[0], /2024年7月/);
  assert.match(out.fr[1], /3 juil\.? 2024 05:00 UTC/);
  assert.ok(out.it[2].includes('234,5') && out.en[2].includes('234.5'), JSON.stringify(out));
  assert.ok(out.es[3].endsWith('O') && out.en[3].endsWith('W'));
});
