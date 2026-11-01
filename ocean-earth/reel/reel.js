// Editor dei reel dell'Atlante del clima.
//
// L'atlante gira in un iframe nascosto (../index.html?reel) con un orologio
// virtuale: e' l'editor a decidere istante, inquadratura e passo di ogni
// fotogramma, poi copia il globo in un canvas 1080×1920 e ci disegna sopra i
// testi. L'anteprima e l'esportazione usano lo stesso disegno: quello che si
// vede e' quello che si esporta. L'esportazione e' fotogramma per fotogramma
// (aspetta i dati esatti di ogni istante) e scrive un MP4 con WebCodecs.

import { analyze } from './beats.js';
import { Muxer, ArrayBufferTarget } from './vendor/mp4-muxer.mjs';

const $ = (s) => document.querySelector(s);
const W = 1080, H = 1920;

// ── testi dell'editor (italiano o inglese) ─────────────────────────────────
const UI_LANG = (() => {
  try { const l = new URLSearchParams(location.search).get('lang') || localStorage.getItem('lingua'); if (l) return l === 'it' ? 'it' : 'en'; } catch (e) { /* niente */ }
  return (navigator.language || 'en').startsWith('it') ? 'it' : 'en';
})();
const U = {
  it: {},
  en: {
    back: '‹ Climate Atlas', brand: 'Reel editor', open: 'Open project', save: 'Save project', export: 'Export MP4', loading: 'Loading the atlas…',
    safe: 'areas covered by Instagram', drag_hint: 'Drag on the preview to turn the globe, scroll to zoom; then “current view” in the clip.',
    song: 'Song', pick_song: 'Choose an audio file', no_song: 'no song', song_local: 'The song stays in your browser: it is not uploaded anywhere. To publish the reel you need the rights to the music.',
    bpm: 'Tempo (BPM)', beats_src: 'Beats', detected: 'detected', grid: 'fixed grid', grid_off: 'First beat (s)', bar_off: 'Bar starts on beat', song_start: 'Start in the song (s)',
    snap: 'Snap to', beat: 'beat', bar: 'bar', none: 'nothing', fade_in: 'Fade in (s)', fade_out: 'Fade out (s)', tap: 'Tap the tempo (T)', start_beat: 'Start on nearest beat',
    clip: 'Clips', add: '+ Add', dup: 'Duplicate', del: 'Delete', view: 'View', variant: 'Variant', from: 'From month', to: 'To month', dur: 'Length (s)', bars: 'Bars', fit: 'fit',
    sync: 'Time flow', sync_beat: 'in time with the beats', sync_linear: 'even', hold: 'Hold on last month (s)', spin: 'Rotation (°/s)', dip: 'Dip to black (s)',
    particles: 'current trails', caption: 'Caption (empty = the view’s own)', cam0: 'Start framing', cam1: 'End framing', use_view: 'current view',
    texts: 'Texts and format', title: 'Title', lang: 'Text language', fps: 'Frames/s', globe_y: 'Globe lower (px)', quality: 'Quality (Mbit/s)',
    o_date: 'date', o_legend: 'legend', o_caption: 'title and caption', o_credits: 'data sources',
    tl_hint: 'Click to move · drag the right edge of a clip to stretch or shorten it (snaps to beats) · drag the light window on the whole song to choose where the music starts · space: play/pause',
    exporting: 'Export', cancel: 'Cancel', download: 'Download the video',
  },
};
const MSG = {
  it: {
    bpm_det: (b, n) => `${n} battiti rilevati, ${b} BPM. Se la griglia non cade sui colpi, correggi il tempo o batti il tempo con T.`,
    bpm_grid: (b) => `Griglia fissa a ${b} BPM.`, analyzing: 'Analizzo il brano…', avail: (a, b) => `Dati disponibili per questa vista: ${a} – ${b}.`,
    no_webcodecs: 'Questo browser non ha WebCodecs: per esportare serve Chrome, Edge o Firefox recenti.',
    codec_info: (v, a) => `Video ${v}${a ? `, audio ${a}` : ', senza audio'}. Il video si costruisce fotogramma per fotogramma con i dati esatti: ci vuole qualche minuto.`,
    opus_note: 'Questo browser non codifica l’audio AAC: l’audio è Opus. Se Instagram non lo accetta: ffmpeg -i reel.mp4 -c:v copy -c:a aac reel-ig.mp4',
    frame: (i, n, eta) => `fotogramma ${i}/${n} · mancano ${eta}`, done: (mb, s) => `Fatto: ${mb} MB in ${s}.`, wait_data: 'aspetto i dati…',
    timeout: 'I dati di un istante non arrivano: controlla la connessione e riprova.', cancelled: 'Annullato.', song_missing: (n) => `Il progetto usa «${n}»: sceglilo di nuovo.`,
    bad_project: 'Il file non è un progetto dell’editor.', atlas_fail: 'L’atlante non si è caricato.', tap_more: (n) => `Batti ancora (${n})…`,
  },
  en: {
    bpm_det: (b, n) => `${n} beats detected, ${b} BPM. If the grid does not land on the hits, fix the tempo or tap it with T.`,
    bpm_grid: (b) => `Fixed grid at ${b} BPM.`, analyzing: 'Analysing the song…', avail: (a, b) => `Data available for this view: ${a} – ${b}.`,
    no_webcodecs: 'This browser has no WebCodecs: exporting needs a recent Chrome, Edge or Firefox.',
    codec_info: (v, a) => `Video ${v}${a ? `, audio ${a}` : ', no audio'}. The video is built frame by frame with the exact data: it takes a few minutes.`,
    opus_note: 'This browser does not encode AAC audio: the audio is Opus. If Instagram refuses it: ffmpeg -i reel.mp4 -c:v copy -c:a aac reel-ig.mp4',
    frame: (i, n, eta) => `frame ${i}/${n} · ${eta} left`, done: (mb, s) => `Done: ${mb} MB in ${s}.`, wait_data: 'waiting for data…',
    timeout: 'The data for one instant does not arrive: check the connection and try again.', cancelled: 'Cancelled.', song_missing: (n) => `The project uses “${n}”: choose it again.`,
    bad_project: 'The file is not an editor project.', atlas_fail: 'The atlas did not load.', tap_more: (n) => `Keep tapping (${n})…`,
  },
}[UI_LANG];
document.documentElement.lang = UI_LANG;
if (UI_LANG !== 'it') {
  document.querySelectorAll('[data-u]').forEach((el) => { const v = U.en[el.dataset.u]; if (v) el.textContent = v; });
  document.title = 'Reel editor · Climate Atlas';
}

// ── progetto ───────────────────────────────────────────────────────────────
const VIEWS = ['sst', 'anom', 'speed', 'sla', 'ice', 'mix', 'rain', 'drought', 'co2', 'emis'];
// dati che servono a ogni vista (per sapere da quando a quando esistono)
const NEEDS = { sst: ['sst'], anom: ['sst'], speed: ['cur'], sla: ['sla'], ice: ['ice'], mix: ['sst', 'cur'], rain: ['precip', 'sst'], drought: ['soil', 'sst'], co2: ['co2'], emis: ['co2foss', 'co2nat'] };
// righe della legenda da mostrare nel video
const LEGEND = { sst: ['sst'], anom: ['anom'], speed: ['speed'], sla: ['sla'], ice: ['ice'], mix: ['anom'], rain: ['land', 'anom'], drought: ['land', 'anom'], co2: ['co2'], emis: ['flux'] };
const VARIANTS = {
  co2: { it: [['0', 'in ppm (si vede la crescita)'], ['1', 'rispetto alla media globale del mese']], en: [['0', 'in ppm (shows the rise)'], ['1', 'relative to the global mean of the month']] },
  emis: { it: [['0', 'totale'], ['1', 'fossili'], ['2', 'naturali']], en: [['0', 'total'], ['1', 'fossil'], ['2', 'natural']] },
};
// fonti, per servizio Copernicus
const SRC = {
  sst: ['m:GLORYS12'], anom: ['m:GLORYS12'], mix: ['m:GLORYS12'], speed: ['m:Copernicus-GlobCurrent'], sla: ['m:DUACS'], ice: ['m:GLORYS12'],
  rain: ['c:ERA5', 'm:GLORYS12'], drought: ['c:ERA5-Land', 'm:GLORYS12'], co2: ['a:CAMS'], emis: ['a:CAMS'],
};
// didascalie delle varianti che l'atlante non ha come vista propria
const VCAP = {
  'co2/0': {
    it: 'Quanta CO₂ c’è nell’aria, media su tutta la colonna d’aria, in parti per milione (inversione CAMS, serie mensile)',
    en: 'How much CO₂ is in the air, averaged over the whole air column, in parts per million (CAMS inversion, monthly series)',
    es: 'Cuánto CO₂ hay en el aire, media de toda la columna de aire, en partes por millón (inversión CAMS, serie mensual)',
    fr: 'Quantité de CO₂ dans l’air, moyenne sur toute la colonne d’air, en parties par million (inversion CAMS, série mensuelle)',
    zh: '空气中的二氧化碳含量，整个气柱的平均值，单位为百万分之一（CAMS 反演，月度序列）',
  },
  'emis/1': {
    it: 'Le emissioni di CO₂ da combustibili fossili, in grammi di carbonio per m² al giorno (inversione CAMS, serie mensile)',
    en: 'CO₂ emissions from fossil fuels, in grams of carbon per m² per day (CAMS inversion, monthly series)',
    es: 'Las emisiones de CO₂ de combustibles fósiles, en gramos de carbono por m² al día (inversión CAMS, serie mensual)',
    fr: 'Les émissions de CO₂ des combustibles fossiles, en grammes de carbone par m² et par jour (inversion CAMS, série mensuelle)',
    zh: '化石燃料的二氧化碳排放，单位为每天每平方米碳克数（CAMS 反演，月度序列）',
  },
  'emis/2': {
    it: 'Lo scambio naturale di CO₂: foreste e oceani che assorbono (verde), incendi e suoli che emettono (rosso) (inversione CAMS, serie mensile)',
    en: 'The natural exchange of CO₂: forests and oceans absorbing (green), fires and soils emitting (red) (CAMS inversion, monthly series)',
    es: 'El intercambio natural de CO₂: bosques y océanos que absorben (verde), incendios y suelos que emiten (rojo) (inversión CAMS, serie mensual)',
    fr: 'L’échange naturel de CO₂ : forêts et océans qui absorbent (vert), incendies et sols qui émettent (rouge) (inversion CAMS, série mensuelle)',
    zh: '二氧化碳的自然交换：森林和海洋吸收（绿色），火灾和土壤排放（红色）（CAMS 反演，月度序列）',
  },
};
const SERVICE = { m: 'Copernicus Marine Service', c: 'Copernicus Climate Change Service', a: 'Copernicus Atmosphere Monitoring Service' };
const DATA_WORD = { it: 'Dati', en: 'Data', es: 'Datos', fr: 'Données', zh: '数据' };
const LOCALE = { en: 'en-GB', it: 'it-IT', es: 'es-ES', fr: 'fr-FR', zh: 'zh-CN' };

function newClip(over = {}) {
  return { view: 'co2', variant: 0, from: '1993-01', to: '2025-12', dur: 24, sync: 'beat', hold: 1.5, spin: 5, fade: 0.4, particles: false, caption: '',
    cam0: { lon: 10, lat: 35, dist: 3.3 }, cam1: { lon: 10, lat: 35, dist: 3.3 }, ...over };
}
function defaultProject() {
  return {
    version: 1, title: 'ATLANTE DEL CLIMA', lang: UI_LANG === 'it' ? 'it' : 'en', fps: 30, rate: 14, globeY: 160,
    overlay: { date: true, legend: true, caption: true, credits: true }, safe: false,
    song: { name: '', start: 0, fadeIn: 0.6, fadeOut: 2.5, mode: 'detected', bpm: 120, gridOff: 0, barOff: 0, snap: 'beat', beats: [] },
    clips: [newClip()],
  };
}
let P = loadLocal() || defaultProject();
let sel = 0;

function loadLocal() {
  try { const p = JSON.parse(localStorage.getItem('oe-reel') || 'null'); return valid(p) ? p : null; } catch (e) { return null; }
}
function valid(p) { return p && p.version === 1 && Array.isArray(p.clips) && p.clips.length && p.song; }
let saveT = 0;
function saveLocal() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { localStorage.setItem('oe-reel', JSON.stringify(P)); } catch (e) { /* niente */ } }, 300);
}

// il brano (i suoi byte) resta nel browser, in IndexedDB: cosi' riaprendo
// l'editor non serve sceglierlo di nuovo
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('oe-reel', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('song');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function storeSong(name, bytes) {
  try { const db = await idb(); db.transaction('song', 'readwrite').objectStore('song').put({ name, bytes }, 'last'); } catch (e) { /* niente */ }
}
async function loadStoredSong() {
  try {
    const db = await idb();
    return await new Promise((res) => { const r = db.transaction('song').objectStore('song').get('last'); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); });
  } catch (e) { return null; }
}

// ── tempo del reel ─────────────────────────────────────────────────────────
const total = () => P.clips.reduce((s, c) => s + c.dur, 0);
function clipStart(i) { let s = 0; for (let k = 0; k < i; k++) s += P.clips[k].dur; return s; }
function clipAt(t) {
  let s = 0;
  for (let i = 0; i < P.clips.length; i++) {
    const c = P.clips[i];
    if (t < s + c.dur || i === P.clips.length - 1) return { c, i, t0: s, lt: Math.max(0, Math.min(t - s, c.dur)) };
    s += c.dur;
  }
}

// battiti del brano (secondi nel file) e sul tempo del reel
let song = { buffer: null, peaks: null, detected: [] };
function songBeats() {
  const S = P.song;
  if (S.mode === 'detected' && song.detected.length) return song.detected;
  const dur = song.buffer ? song.buffer.duration : 600, step = 60 / S.bpm, out = [];
  for (let b = S.gridOff; b < dur; b += step) out.push(b);
  return out;
}
function reelBeats() { const s = P.song.start; return songBeats().map((b) => b - s).filter((b) => b >= -0.001 && b <= total() + 0.001); }
function isBar(k) { return ((k - P.song.barOff) % 4 + 4) % 4 === 0; }
function snapTime(t) {
  const mode = P.song.snap;
  if (mode === 'none' || !song.buffer) return t;
  const all = songBeats(), s = P.song.start;
  let best = t, bd = Infinity;
  all.forEach((b, k) => { if (mode === 'bar' && !isBar(k)) return; const d = Math.abs(b - s - t); if (d < bd) { bd = d; best = b - s; } });
  return best;
}

// quanto del suo intervallo di mesi ha percorso la clip (0…1)
function progressIn(c, t0, lt) {
  const active = Math.max(0.05, c.dur - c.hold);
  if (lt >= active) return 1;
  if (c.sync === 'linear' || !song.buffer) return lt / active;
  // tra un battito e l'altro lo stesso numero di mesi: segue anche un tempo che oscilla
  const bs = reelBeats().filter((b) => b > t0 + 0.04 && b < t0 + active - 0.04).map((b) => b - t0);
  const g = [0, ...bs, active];
  let k = 0;
  while (k < g.length - 2 && g[k + 1] <= lt) k++;
  return (k + (lt - g[k]) / (g[k + 1] - g[k])) / (g.length - 1);
}

const smooth = (x) => x * x * (3 - 2 * x);
function camAt(c, lt) {
  const e = smooth(Math.min(1, lt / Math.max(0.01, c.dur)));
  const d = ((c.cam1.lon - c.cam0.lon + 540) % 360) - 180;
  return { lon: c.cam0.lon + d * e + c.spin * lt, lat: c.cam0.lat + (c.cam1.lat - c.cam0.lat) * e, dist: c.cam0.dist + (c.cam1.dist - c.cam0.dist) * e };
}

// nero: all'inizio e alla fine del reel, e attorno agli stacchi fra le clip
function blackAt(t) {
  const T = total();
  let a = 0;
  if (P.song.fadeIn > 0) a = Math.max(a, 1 - t / P.song.fadeIn);
  if (P.song.fadeOut > 0) a = Math.max(a, 1 - (T - t) / P.song.fadeOut);
  for (let i = 1; i < P.clips.length; i++) {
    const f = P.clips[i].fade;
    if (!(f > 0)) continue;
    const d = Math.abs(t - clipStart(i));
    if (d < f / 2) a = Math.max(a, 1 - d / (f / 2));
  }
  return Math.max(0, Math.min(1, a));
}

// ── atlante nell'iframe ────────────────────────────────────────────────────
const frame = $('#atlas');
let oe = null, clock = null, frames = [], views = {}, viewKey = '', legendCache = {};

function installClock(w) {
  // performance.now e requestAnimationFrame dell'atlante: il tempo lo decide l'editor
  const q = [];
  let vt = w.performance.now();
  w.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
  w.cancelAnimationFrame = () => {};
  w.performance.now = () => vt;
  return { step(ms) { vt += ms; const cbs = q.splice(0); for (const cb of cbs) cb(vt); } };
}

const until = (ok, ms = 60000, every = 30) => new Promise((res, rej) => {
  const t0 = performance.now();
  (function poll() {
    let v = false;
    try { v = ok(); } catch (e) { /* non ancora */ }
    if (v) return res(v);
    if (performance.now() - t0 > ms) return rej(new Error('timeout'));
    setTimeout(poll, every);
  })();
});

async function bootAtlas() {
  $('#boot').hidden = false;
  $('#boot').textContent = U[UI_LANG].loading || 'Carico l’atlante…';
  oe = null; viewKey = ''; legendCache = {};
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  frame.style.width = `${W / dpr}px`;
  frame.style.height = `${H / dpr}px`;
  const loaded = new Promise((r) => { frame.onload = r; });
  frame.src = `../index.html?reel&lang=${encodeURIComponent(P.lang)}`;
  await loaded;
  const w = frame.contentWindow;
  try {
    await until(() => w.__oe && w.__oe.timeline && w.__oe.ready, 90000);
  } catch (e) {
    $('#boot').textContent = MSG.atlas_fail; $('#boot').classList.add('error');
    return;
  }
  oe = w.__oe;
  clock = installClock(w);
  oe.timeline.setTier('monthly', false);
  frames = oe.timeline.frames;
  const st = oe.globe.state;
  st.particleCount = 22000; st.particleWidth = 1.9; st.coast = true; st.hotspot = false;
  oe.globe.resetParticles?.();
  // le viste che hanno dati, con i nomi dell'atlante nella lingua scelta
  views = {};
  const doc = frame.contentDocument;
  for (const v of VIEWS) {
    const b = doc.querySelector(`.quick-mode button[data-mode=${v}]`);
    if (!b || b.hidden) continue;
    const idx = frames.map((f, i) => (NEEDS[v].every((k) => f[k] != null) ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) continue;
    views[v] = { name: b.querySelector('.l')?.textContent.trim() || v, first: idx[0], last: idx[idx.length - 1] };
  }
  await document.fonts.load('700 40px "IBM Plex Mono"').catch(() => {});
  await document.fonts.load('900 40px Archivo').catch(() => {});
  $('#boot').hidden = true;
  $('#play').disabled = false;
  $('#export').disabled = false;
  fillForms();
  need = true;
}

// vista, variante e scie della clip; legenda e didascalia lette dall'atlante
function ensureView(c) {
  const key = `${c.view}/${c.variant}/${c.particles}`;
  if (key === viewKey) return;
  viewKey = key;
  oe.setMode(c.view);
  const doc = frame.contentDocument;
  const cap = doc.querySelector('#legend .lg-cap');
  let caption = cap ? (cap.querySelector('span')?.textContent || '').trim() : '';
  const vc = VCAP[`${c.view}/${c.variant}`];
  if (vc) caption = vc[P.lang] || vc.en;
  caption = caption.charAt(0).toUpperCase() + caption.slice(1);
  if (c.view === 'co2') oe.setAir(+c.variant, null);
  if (c.view === 'emis') oe.setAir(null, +c.variant);
  oe.globe.state.particles = !!c.particles;
  oe.globe.state.arrows = false;
  if (!legendCache[key]) {
    const rows = LEGEND[c.view].map((k) => legendRow(doc, k)).filter(Boolean);
    legendCache[key] = { rows, caption };
  }
}

function legendRow(doc, k) {
  const el = doc.querySelector(`#legend .mx[data-layer=${k}]`);
  if (!el) return null;
  const bar = el.querySelector('.mx-scale .lg-bar');
  if (!bar) return null;
  const stops = gradientStops(bar.style.background || '');
  if (stops.length < 2) return null;
  let title = el.querySelector('.lg-t')?.textContent.trim() || '';
  const opt = el.querySelector('.mx-var select option:checked')?.textContent.trim();
  const unit = el.querySelector('.mx-var .muted')?.textContent.trim();
  if (opt && k !== 'co2' && !title.includes(opt)) title += ` · ${opt}`;
  if (unit && !title.includes(unit)) title += ` (${unit})`;
  const ticks = [...el.querySelectorAll('.mx-scale .lg-ticks span')].map((s) => ({ text: s.textContent.trim(), at: s.style.left.endsWith('%') ? parseFloat(s.style.left) / 100 : 0 }));
  const ends = [...el.querySelectorAll('.mx-scale .lg-ends span')].map((s) => s.textContent.trim());
  return { title, stops, ticks, ends };
}

// "linear-gradient(90deg, rgb(..) 0%, rgba(..), #abc 15%)" → [[0, colore], …];
// le posizioni mancanti si distribuiscono fra quelle note, come fa il CSS
function gradientStops(css) {
  const i = css.indexOf('(');
  if (i < 0) return [];
  const body = css.slice(i + 1, css.lastIndexOf(')'));
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  parts.push(cur.trim());
  const st = parts.filter((p) => !/^(-?[\d.]+deg|to\s)/.test(p)).map((p) => {
    const m = p.match(/^(.*?)(?:\s+(-?[\d.]+)%)?$/);
    return [m[2] != null ? +m[2] / 100 : null, m[1].trim()];
  });
  if (!st.length) return [];
  if (st[0][0] == null) st[0][0] = 0;
  if (st[st.length - 1][0] == null) st[st.length - 1][0] = 1;
  for (let a = 0; a < st.length; a++) {
    if (st[a][0] != null) continue;
    let b = a; while (st[b][0] == null) b++;
    for (let k = a; k < b; k++) st[k][0] = st[a - 1][0] + ((st[b][0] - st[a - 1][0]) * (k - a + 1)) / (b - a + 1);
    a = b;
  }
  return st;
}

function frameIndex(stamp, fallback) {
  const i = frames.findIndex((f) => f.t === stamp);
  return i >= 0 ? i : fallback;
}
function clipRange(c) {
  const v = views[c.view];
  const lo = v ? v.first : 0, hi = v ? v.last : frames.length - 1;
  const a = Math.max(lo, Math.min(hi, frameIndex(c.from, lo))), b = Math.max(lo, Math.min(hi, frameIndex(c.to, hi)));
  return [a, b];
}

// porta l'atlante all'istante t del reel
function applyAt(t, withCam = true) {
  const info = clipAt(t);
  const { c, t0, lt } = info;
  ensureView(c);
  const [a, b] = clipRange(c);
  info.p = progressIn(c, t0, lt);
  info.pos = a + (b - a) * info.p;
  info.range = [a, b];
  if (Math.abs(oe.timeline.pos - info.pos) > 1e-7) oe.timeline.seek(info.pos);
  if (withCam) Object.assign(oe.camera, camAt(c, lt));
  return info;
}

// ── disegno del fotogramma ─────────────────────────────────────────────────
const out = $('#out');
const ctx = out.getContext('2d');

function fmtTime(s) { const m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`; }
function monthName(stamp) {
  return new Date(Date.UTC(+stamp.slice(0, 4), +stamp.slice(5, 7) - 1, 1)).toLocaleDateString(LOCALE[P.lang] || 'en-GB', { month: 'long', timeZone: 'UTC' });
}

function wrap(g, text, maxW) {
  const words = text.split(/\s+/), lines = [];
  let line = '';
  // il cinese non ha spazi: si va a capo carattere per carattere
  const units = P.lang === 'zh' ? [...text] : words;
  const sep = P.lang === 'zh' ? '' : ' ';
  for (const w of units) {
    const tryL = line ? line + sep + w : w;
    if (g.measureText(tryL).width > maxW && line) { lines.push(line); line = w; } else line = tryL;
  }
  if (line) lines.push(line);
  return lines;
}

function credits(c) {
  const ids = [...SRC[c.view]];
  if (c.particles && !ids.includes('m:Copernicus-GlobCurrent')) ids.push('m:Copernicus-GlobCurrent');
  const by = {};
  for (const id of ids) { const [s, n] = id.split(':'); (by[s] = by[s] || []).push(n); }
  return `${DATA_WORD[P.lang] || 'Data'}: ` + Object.entries(by).map(([s, n]) => `${SERVICE[s]} (${n.join(', ')})`).join(' · ');
}

function compose(info, t) {
  const g = ctx;
  const gc = frame.contentDocument.querySelector('#globe');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  const dy = Math.round(P.globeY);
  if (gc && gc.width) {
    g.drawImage(gc, 0, 0, gc.width, gc.height, 0, dy, W, H);
    // sopra il globo abbassato: il colore dello spazio, poi una sfumatura che
    // nasconde il bordo del disegno del globo
    if (dy > 0) {
      const sp = spaceColor(gc);
      g.fillStyle = sp; g.fillRect(0, 0, W, dy);
      const fade = g.createLinearGradient(0, dy, 0, dy + 160);
      fade.addColorStop(0, sp); fade.addColorStop(1, sp.replace('rgb(', 'rgba(').replace(')', ',0)'));
      g.fillStyle = fade; g.fillRect(0, dy, W, 160);
    }
  }
  const { c, i } = info;
  const L = legendCache[viewKey] || { rows: [], caption: '' };
  // velature in alto e in basso: i testi restano leggibili sopra il globo
  let gr = g.createLinearGradient(0, 0, 0, 760);
  gr.addColorStop(0, 'rgba(0,0,0,.62)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, 760);
  gr = g.createLinearGradient(0, H - 700, 0, H);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.7)');
  g.fillStyle = gr; g.fillRect(0, H - 700, W, 700);
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  let y = 268;
  if (P.overlay.caption) {
    g.fillStyle = '#e8f0f4';
    g.font = '900 40px Archivo';
    g.letterSpacing = '7px';
    g.fillText(P.title.toUpperCase(), W / 2, y);
    g.letterSpacing = '0px';
    y += 50;
    const cap = c.caption.trim() || L.caption;
    g.font = '500 28px Archivo';
    g.fillStyle = '#c3d2da';
    for (const line of wrap(g, cap, 840).slice(0, 3)) { g.fillText(line, W / 2, y); y += 37; }
  }
  if (P.overlay.date) {
    const f = frames[Math.round(info.pos)];
    y += 118;
    g.fillStyle = '#ffffff';
    g.font = '700 132px "IBM Plex Mono"';
    g.fillText(f.t.slice(0, 4), W / 2, y);
    y += 46;
    g.font = '500 32px Archivo';
    g.fillStyle = '#c3d2da';
    g.fillText(monthName(f.t), W / 2, y);
    // dove siamo nell'intervallo della clip
    y += 30;
    const bw = 420, bx = (W - bw) / 2;
    g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(bx, y, bw, 4);
    g.fillStyle = '#e8f0f4'; g.fillRect(bx, y, bw * info.p, 4);
    g.font = '500 19px "IBM Plex Mono"'; g.fillStyle = '#9fb3bd';
    g.textAlign = 'left'; g.fillText(frames[info.range[0]].t.slice(0, 4), bx, y + 26);
    g.textAlign = 'right'; g.fillText(frames[info.range[1]].t.slice(0, 4), bx + bw, y + 26);
    g.textAlign = 'center';
  }
  // legenda e fonti sopra la zona che Instagram copre in basso, su un fondo
  // scuro: devono leggersi anche sopra un globo chiaro
  const blocks = [];
  if (P.overlay.legend) for (const r of L.rows) blocks.push({ h: r.ends.length ? 122 : 98, draw: (top) => drawLegendRow(g, r, top) });
  if (P.overlay.credits) {
    g.font = '500 19px Archivo';
    const lines = [...wrap(g, credits(c), 820), 'co2-info.duckdns.org/atlante'];
    blocks.push({ h: lines.length * 26 + 10, draw: (top) => { g.font = '500 19px Archivo'; g.fillStyle = '#93a8b2'; lines.forEach((l, k) => g.fillText(l, W / 2, top + 26 + k * 26)); } });
  }
  if (blocks.length) {
    const hTot = blocks.reduce((s, b) => s + b.h, 0) + 24;
    let top = H - 430 - hTot;
    g.fillStyle = 'rgba(4,10,16,.62)';
    roundRect(g, 90, top, W - 180, hTot, 18); g.fill();
    top += 14;
    for (const b of blocks) { b.draw(top); top += b.h; }
  }
  const a = blackAt(t);
  if (a > 0) { g.globalAlpha = a; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
}
function drawLegendRow(g, r, top) {
  const lw = 680, lx = (W - lw) / 2;
  g.textAlign = 'center';
  g.font = '600 24px Archivo'; g.fillStyle = '#e1eaef';
  g.fillText(wrap(g, r.title, lw + 140)[0], W / 2, top + 28);
  const lg = g.createLinearGradient(lx, 0, lx + lw, 0);
  for (const [o, col] of r.stops) lg.addColorStop(Math.min(1, Math.max(0, o)), col);
  g.fillStyle = lg;
  roundRect(g, lx, top + 42, lw, 16, 6); g.fill();
  g.font = '500 20px "IBM Plex Mono"'; g.fillStyle = '#b9c9d2';
  // nel video bastano estremi e centro (o le tacche speciali, come il 15% del ghiaccio)
  const tk = r.ticks.length > 3 ? r.ticks.filter((s) => [0, 0.5, 1].some((a) => Math.abs(s.at - a) < 0.01)) : r.ticks;
  for (const s of tk) {
    g.textAlign = s.at < 0.02 ? 'left' : s.at > 0.98 ? 'right' : 'center';
    g.fillText(s.text, lx + lw * s.at, top + 84);
  }
  if (r.ends.length === 2) {
    g.font = 'italic 500 19px Archivo'; g.fillStyle = '#93a8b2';
    g.textAlign = 'left'; g.fillText(r.ends[0], lx, top + 110);
    g.textAlign = 'right'; g.fillText(r.ends[1], lx + lw, top + 110);
  }
  g.textAlign = 'center';
}
// il colore dello spazio: il pixel piu' scuro della prima riga del globo
const probe = document.createElement('canvas');
probe.width = 64; probe.height = 1;
function spaceColor(gc) {
  const p = probe.getContext('2d', { willReadFrequently: true });
  p.drawImage(gc, 0, 0, gc.width, 1, 0, 0, 64, 1);
  const d = p.getImageData(0, 0, 64, 1).data;
  let best = 0, bl = Infinity;
  for (let i = 0; i < 64; i++) { const l = d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]; if (l < bl) { bl = l; best = i; } }
  return `rgb(${d[best * 4]},${d[best * 4 + 1]},${d[best * 4 + 2]})`;
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// ── anteprima ──────────────────────────────────────────────────────────────
let tNow = 0, playing = false, need = true, camNeed = true, exporting = false;
let actx = null, src = null, playT0 = 0, playWall = 0;

function audioCtx() { if (!actx) actx = new AudioContext(); return actx; }
function play() {
  if (!oe || exporting) return;
  if (tNow >= total() - 0.05) tNow = 0;
  playing = true;
  oe.preview(true);
  $('#play').textContent = '❚❚';
  if (song.buffer) {
    const a = audioCtx();
    a.resume();
    const gain = a.createGain();
    src = a.createBufferSource();
    src.buffer = song.buffer;
    src.connect(gain).connect(a.destination);
    envelope(gain.gain, a.currentTime, tNow);
    src.start(0, P.song.start + tNow, total() - tNow);
    playT0 = a.currentTime - tNow;
  } else playWall = performance.now() / 1000 - tNow;
}
function pause() {
  playing = false;
  if (src) { try { src.stop(); } catch (e) { /* gia' fermo */ } src = null; }
  if (oe) oe.preview(false);
  $('#play').textContent = '▶';
  need = true;
}
function playTime() { return song.buffer && actx ? actx.currentTime - playT0 : performance.now() / 1000 - playWall; }
// volume con le dissolvenze, a partire dall'istante t0 del reel
function envelope(p, at, t0) {
  const T = total(), fi = P.song.fadeIn, fo = P.song.fadeOut;
  const v = (t) => Math.min(fi > 0 ? Math.min(1, t / fi) : 1, fo > 0 ? Math.min(1, (T - t) / fo) : 1);
  p.setValueAtTime(Math.max(0, v(t0)), at);
  if (fi > 0 && t0 < fi) p.linearRampToValueAtTime(1, at + fi - t0);
  if (fo > 0) { const s = Math.max(t0, T - fo); p.setValueAtTime(Math.max(0, v(s)), at + s - t0); p.linearRampToValueAtTime(0, at + T - t0); }
}

let lastNow = performance.now(), lastInfo = null;
function tick(now) {
  const dt = Math.min(100, now - lastNow);
  lastNow = now;
  if (oe && !exporting) {
    if (playing) {
      tNow = playTime();
      if (tNow >= total()) { tNow = total(); pause(); }
      lastInfo = applyAt(tNow);
      // i prossimi due secondi: scaricati in anticipo
      for (let k = 1; k <= 8; k++) { const f = applyPeek(tNow + k * 0.25); if (f != null) { oe.want(Math.floor(f)); oe.want(Math.floor(f) + 1); } }
    } else if (need || !lastInfo) {
      lastInfo = applyAt(tNow, camNeed);
      need = false; camNeed = false;
    }
    clock.step(dt);
    compose(lastInfo, tNow);
    drawTimeline();
    $('#clock').textContent = `${fmtTime(tNow)} / ${fmtTime(total())}`;
  }
  requestAnimationFrame(tick);
}
// posizione nei dati all'istante t, senza toccare l'atlante
function applyPeek(t) {
  if (t > total()) return null;
  const { c, t0, lt } = clipAt(t);
  if (`${c.view}/${c.variant}/${c.particles}` !== viewKey) return null;
  const [a, b] = clipRange(c);
  return a + (b - a) * progressIn(c, t0, lt);
}
function seek(t) { tNow = Math.max(0, Math.min(total(), t)); need = true; camNeed = true; if (playing) { pause(); play(); } }

// trascinare l'anteprima gira il globo (a pausa), la rotella avvicina
{
  let drag = null;
  out.addEventListener('pointerdown', (e) => { if (!oe || playing) return; drag = { x: e.clientX, y: e.clientY }; out.setPointerCapture(e.pointerId); });
  out.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const k = (oe.camera.dist - 1) * 40 / out.clientHeight;
    oe.camera.lon -= (e.clientX - drag.x) * k * 1.8;
    oe.camera.lat = Math.max(-85, Math.min(85, oe.camera.lat + (e.clientY - drag.y) * k * 1.8));
    drag = { x: e.clientX, y: e.clientY };
    showCams();
  });
  out.addEventListener('pointerup', () => { drag = null; });
  out.addEventListener('wheel', (e) => {
    if (!oe || playing) return;
    e.preventDefault();
    oe.camera.dist = Math.max(1.3, Math.min(6, oe.camera.dist * Math.exp(e.deltaY * 0.0012)));
    showCams();
  }, { passive: false });
}

// ── brano ──────────────────────────────────────────────────────────────────
async function setSong(name, bytes, keepStart = false) {
  $('#beat-info').textContent = MSG.analyzing;
  const a = audioCtx();
  const buf = await a.decodeAudioData(bytes.slice(0));
  song.buffer = buf;
  P.song.name = name;
  if (!keepStart) P.song.start = 0;
  $('#song-name').textContent = `${name} · ${fmtTime(buf.duration)}`;
  // forma d'onda: massimo per colonna, 4000 colonne
  const n = 4000, d0 = buf.getChannelData(0), d1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : d0, per = Math.floor(buf.length / n);
  const peaks = new Float32Array(n);
  for (let i = 0; i < n; i++) { let m = 0; for (let k = i * per; k < (i + 1) * per; k += 4) m = Math.max(m, Math.abs(d0[k]), Math.abs(d1[k])); peaks[i] = m; }
  song.peaks = peaks;
  await new Promise((r) => setTimeout(r, 30));          // lascia disegnare il messaggio
  const r = analyze(buf);
  song.detected = r.beats;
  if (!keepStart || !P.song.bpm) P.song.bpm = +r.bpm.toFixed(2);
  if (!keepStart) P.song.gridOff = +(r.beats[0] || 0).toFixed(3);
  fillSong();
  need = true;
  saveLocal();
}

function fillSong() {
  const S = P.song;
  $('#bpm').value = S.bpm; $('#beat-mode').value = S.mode; $('#grid-off').value = S.gridOff; $('#bar-off').value = String(S.barOff + 1);
  $('#song-start').value = +S.start.toFixed(2); $('#snap').value = S.snap; $('#fade-in').value = S.fadeIn; $('#fade-out').value = S.fadeOut;
  $('#beat-info').textContent = !song.buffer ? '' : S.mode === 'detected' && song.detected.length ? MSG.bpm_det(S.bpm.toFixed(1), song.detected.length) : MSG.bpm_grid(S.bpm.toFixed(2));
}

$('#song-file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const bytes = await f.arrayBuffer();
  await setSong(f.name, bytes);
  storeSong(f.name, bytes);
});
const num = (id, fn) => $(id).addEventListener('change', (e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) { fn(v); fillSong(); need = true; saveLocal(); } });
num('#bpm', (v) => { P.song.bpm = Math.max(40, Math.min(240, v)); P.song.mode = 'grid'; });
num('#grid-off', (v) => { P.song.gridOff = Math.max(0, v); });
num('#song-start', (v) => { P.song.start = Math.max(0, Math.min(song.buffer ? song.buffer.duration - 1 : 9999, v)); });
num('#fade-in', (v) => { P.song.fadeIn = Math.max(0, v); });
num('#fade-out', (v) => { P.song.fadeOut = Math.max(0, v); });
$('#beat-mode').addEventListener('change', (e) => { P.song.mode = e.target.value; fillSong(); need = true; saveLocal(); });
$('#bar-off').addEventListener('change', (e) => { P.song.barOff = +e.target.value - 1; saveLocal(); });
$('#snap').addEventListener('change', (e) => { P.song.snap = e.target.value; saveLocal(); });
$('#start-beat').addEventListener('click', () => {
  const all = songBeats();
  if (!all.length) return;
  let best = all[0];
  all.forEach((b, k) => { if ((P.song.snap !== 'bar' || isBar(k)) && Math.abs(b - P.song.start) < Math.abs(best - P.song.start)) best = b; });
  P.song.start = best; fillSong(); need = true; saveLocal();
});
// batti il tempo: griglia fissa dal tempo battuto, il primo colpo e' l'ancora
let taps = [];
function tap() {
  if (!song.buffer) return;
  const now = playing ? P.song.start + playTime() : null;
  const wall = performance.now() / 1000;
  if (taps.length && wall - taps[taps.length - 1].w > 2) taps = [];
  taps.push({ w: wall, s: now });
  if (taps.length < 4) { $('#beat-info').textContent = MSG.tap_more(4 - taps.length); return; }
  const iv = (taps[taps.length - 1].w - taps[0].w) / (taps.length - 1);
  P.song.bpm = +(60 / iv).toFixed(2);
  P.song.mode = 'grid';
  if (now != null) { const step = 60 / P.song.bpm; P.song.gridOff = +(((now % step) + step) % step).toFixed(3); }
  fillSong(); need = true; saveLocal();
}
$('#tap').addEventListener('click', tap);

// ── clip ───────────────────────────────────────────────────────────────────
function stampOptions(selEl, lo, hi, value) {
  const fmt = new Intl.DateTimeFormat(LOCALE[UI_LANG] || 'it-IT', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  selEl.innerHTML = '';
  for (let i = lo; i <= hi; i++) {
    const t = frames[i].t;
    const o = new Option(fmt.format(new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, 1))), t);
    selEl.add(o);
  }
  selEl.value = value;
  if (selEl.value !== value) selEl.value = value < frames[lo].t ? frames[lo].t : frames[hi].t;
  return selEl.value;
}

function fillForms() {
  if (!oe) return;
  sel = Math.max(0, Math.min(P.clips.length - 1, sel));
  const c = P.clips[sel];
  const vs = $('#c-view');
  vs.innerHTML = '';
  for (const v of VIEWS) if (views[v]) vs.add(new Option(views[v].name, v));
  if (!views[c.view]) c.view = Object.keys(views)[0];
  vs.value = c.view;
  const vr = VARIANTS[c.view];
  $('#c-variant-l').hidden = !vr;
  if (vr) { $('#c-variant').innerHTML = vr[UI_LANG].map(([v, l]) => `<option value="${v}">${l}</option>`).join(''); $('#c-variant').value = String(c.variant); }
  const v = views[c.view];
  c.from = stampOptions($('#c-from'), v.first, v.last, c.from);
  c.to = stampOptions($('#c-to'), v.first, v.last, c.to);
  $('#c-avail').textContent = MSG.avail(frames[v.first].t, frames[v.last].t);
  $('#c-dur').value = +c.dur.toFixed(2); $('#c-sync').value = c.sync; $('#c-hold').value = c.hold; $('#c-spin').value = c.spin; $('#c-fade').value = c.fade;
  $('#c-particles').checked = !!c.particles; $('#c-caption').value = c.caption;
  $('#c-caption').placeholder = c.view === (viewKey.split('/')[0]) ? (legendCache[viewKey]?.caption || '') : '';
  $('#c-fade').disabled = sel === 0;
  $('#clip-del').disabled = P.clips.length < 2;
  $('#clip-left').disabled = sel === 0; $('#clip-right').disabled = sel === P.clips.length - 1;
  $('#p-title').value = P.title; $('#p-lang').value = P.lang; $('#p-fps').value = String(P.fps); $('#p-globey').value = P.globeY; $('#p-rate').value = P.rate;
  for (const k of ['date', 'legend', 'caption', 'credits']) $(`#o-${k}`).checked = !!P.overlay[k];
  $('#safe-on').checked = !!P.safe; $('#safe').hidden = !P.safe;
  showCams();
  fillSong();
}
const fmtCam = (k) => `${k.lon.toFixed(1)}°, ${k.lat.toFixed(1)}°, ×${k.dist.toFixed(2)}`;
function showCams() {
  const c = P.clips[sel];
  $('#c-cam0').textContent = fmtCam(c.cam0);
  $('#c-cam1').textContent = fmtCam(c.cam1);
}

function changed(cam = false) { need = true; camNeed = camNeed || cam; saveLocal(); fillForms(); }
const cl = () => P.clips[sel];
$('#c-view').addEventListener('change', (e) => { cl().view = e.target.value; cl().variant = 0; cl().caption = ''; cl().particles = ['sst', 'anom', 'speed', 'mix', 'sla', 'ice'].includes(e.target.value); const v = views[e.target.value]; cl().from = frames[v.first].t; cl().to = frames[v.last].t; changed(); });
$('#c-variant').addEventListener('change', (e) => { cl().variant = +e.target.value; changed(); });
$('#c-from').addEventListener('change', (e) => { cl().from = e.target.value; changed(); });
$('#c-to').addEventListener('change', (e) => { cl().to = e.target.value; changed(); });
$('#c-sync').addEventListener('change', (e) => { cl().sync = e.target.value; changed(); });
$('#c-particles').addEventListener('change', (e) => { cl().particles = e.target.checked; changed(); });
$('#c-caption').addEventListener('input', (e) => { cl().caption = e.target.value; need = true; saveLocal(); });
const cnum = (id, fn, cam) => $(id).addEventListener('change', (e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) { fn(v); changed(cam); } });
cnum('#c-dur', (v) => { cl().dur = Math.max(0.5, v); });
cnum('#c-hold', (v) => { cl().hold = Math.max(0, Math.min(cl().dur - 0.2, v)); });
cnum('#c-spin', (v) => { cl().spin = v; }, true);
cnum('#c-fade', (v) => { cl().fade = Math.max(0, Math.min(3, v)); });
// l'inquadratura vista ora diventa quella iniziale o finale della clip; la
// rotazione automatica (°/s) si toglie, perche' camAt la riaggiunge
const wrapLon = (l) => ((l % 360) + 540) % 360 - 180;
$('#c-set0').addEventListener('click', () => {
  if (!oe) return;
  const c = cl(), lt = Math.max(0, Math.min(c.dur, tNow - clipStart(sel)));
  c.cam0 = { lon: wrapLon(oe.camera.lon - c.spin * lt), lat: oe.camera.lat, dist: oe.camera.dist };
  if (lt < 0.05) c.cam1 = c.cam1 || { ...c.cam0 };
  changed();
});
$('#c-set1').addEventListener('click', () => {
  if (!oe) return;
  const c = cl(), lt = Math.max(0, Math.min(c.dur, tNow - clipStart(sel)));
  c.cam1 = { lon: wrapLon(oe.camera.lon - c.spin * lt), lat: oe.camera.lat, dist: oe.camera.dist };
  changed();
});
// adatta: la clip dura esattamente N battute del brano, dal punto in cui comincia
$('#c-fit').addEventListener('click', () => {
  const n = Math.max(1, Math.round(+$('#c-bars').value || 1));
  const t0 = clipStart(sel), s0 = P.song.start + t0;
  const all = songBeats();
  if (!all.length) return;
  let k = 0, bd = Infinity;
  all.forEach((b, i) => { const d = Math.abs(b - s0); if (d < bd) { bd = d; k = i; } });
  const end = all[k + n * 4] ?? all[k] + (n * 4 * 60) / P.song.bpm;
  cl().dur = Math.max(0.5, end - s0);
  changed();
});
$('#clip-add').addEventListener('click', () => { const c = cl(); P.clips.splice(sel + 1, 0, newClip({ view: c.view, variant: c.variant, particles: c.particles, cam0: { ...c.cam1 }, cam1: { ...c.cam1 }, from: c.from, to: c.to, dur: 8 })); sel++; changed(); seek(clipStart(sel) + 0.01); });
$('#clip-dup').addEventListener('click', () => { P.clips.splice(sel + 1, 0, JSON.parse(JSON.stringify(cl()))); sel++; changed(); });
$('#clip-del').addEventListener('click', () => { if (P.clips.length < 2) return; P.clips.splice(sel, 1); sel = Math.max(0, sel - 1); changed(true); seek(Math.min(tNow, total())); });
$('#clip-left').addEventListener('click', () => { if (sel < 1) return; [P.clips[sel - 1], P.clips[sel]] = [P.clips[sel], P.clips[sel - 1]]; sel--; changed(true); });
$('#clip-right').addEventListener('click', () => { if (sel >= P.clips.length - 1) return; [P.clips[sel + 1], P.clips[sel]] = [P.clips[sel], P.clips[sel + 1]]; sel++; changed(true); });

// testi e formato
$('#p-title').addEventListener('input', (e) => { P.title = e.target.value; saveLocal(); });
$('#p-lang').addEventListener('change', async (e) => { P.lang = e.target.value; saveLocal(); pause(); await bootAtlas(); });
$('#p-fps').addEventListener('change', (e) => { P.fps = +e.target.value; saveLocal(); });
$('#p-globey').addEventListener('change', (e) => { P.globeY = Math.max(0, Math.min(700, +e.target.value || 0)); saveLocal(); });
$('#p-rate').addEventListener('change', (e) => { P.rate = Math.max(4, Math.min(40, +e.target.value || 14)); saveLocal(); });
for (const k of ['date', 'legend', 'caption', 'credits']) $(`#o-${k}`).addEventListener('change', (e) => { P.overlay[k] = e.target.checked; saveLocal(); });
$('#safe-on').addEventListener('change', (e) => { P.safe = e.target.checked; $('#safe').hidden = !P.safe; saveLocal(); });

// progetto su file
$('#proj-save').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(P, null, 1)], { type: 'application/json' }));
  a.download = `reel-${(P.title || 'atlante').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
$('#proj-open').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const p = JSON.parse(await f.text());
    if (!valid(p)) throw new Error('x');
    const langChanged = p.lang !== P.lang;
    P = { ...defaultProject(), ...p, overlay: { ...defaultProject().overlay, ...p.overlay }, song: { ...defaultProject().song, ...p.song } };
    sel = 0; saveLocal();
    if (P.song.name && P.song.name !== song.name) $('#beat-info').textContent = MSG.song_missing(P.song.name);
    if (langChanged) await bootAtlas(); else { fillForms(); seek(0); }
  } catch (err) { alert(MSG.bad_project); }
  e.target.value = '';
});

$('#play').addEventListener('click', () => (playing ? pause() : play()));
addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select')) return;
  if (e.code === 'Space') { e.preventDefault(); playing ? pause() : play(); }
  if (e.key === 't' || e.key === 'T') tap();
});

// ── timeline ───────────────────────────────────────────────────────────────
const tl = $('#timeline'), ov = $('#overview');
const TL = { wave: [6, 56], clips: [70, 128], ruler: 140 };
let tlDrag = null;
function tlScale() { const w = tl.clientWidth; return { w, pps: (w - 20) / Math.max(5, total()), x0: 10 }; }
function sizeCanvas(c) { const d = devicePixelRatio || 1; const w = Math.round(c.clientWidth * d), h = Math.round(+c.getAttribute('height') * d); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } c.style.height = c.getAttribute('height') + 'px'; return d; }

function drawTimeline() {
  const d = sizeCanvas(tl), g = tl.getContext('2d');
  g.setTransform(d, 0, 0, d, 0, 0);
  const { w, pps, x0 } = tlScale(), Hh = +tl.getAttribute('height');
  g.clearRect(0, 0, w, Hh);
  const X = (t) => x0 + t * pps;
  // forma d'onda della parte di brano usata
  if (song.peaks) {
    const n = song.peaks.length, dur = song.buffer.duration, [y0, y1] = TL.wave, mid = (y0 + y1) / 2, hh = (y1 - y0) / 2;
    g.fillStyle = '#35556b';
    for (let x = 0; x < w - 20; x++) {
      const s = P.song.start + x / pps;
      if (s > dur) break;
      const p = song.peaks[Math.min(n - 1, Math.floor((s / dur) * n))];
      g.fillRect(x0 + x, mid - p * hh, 1, Math.max(1, 2 * p * hh));
    }
    // battiti; le battute piu' marcate
    const all = songBeats();
    all.forEach((b, k) => {
      const t = b - P.song.start;
      if (t < 0 || t > total()) return;
      g.fillStyle = isBar(k) ? 'rgba(255,214,102,.9)' : 'rgba(255,214,102,.35)';
      g.fillRect(X(t) - 0.5, TL.wave[0], isBar(k) ? 2 : 1, TL.clips[1] - TL.wave[0]);
    });
  } else {
    g.fillStyle = '#6f8592'; g.font = '12px Archivo'; g.textAlign = 'left';
    g.fillText(UI_LANG === 'it' ? 'Scegli un brano: qui compaiono forma d’onda e battiti' : 'Choose a song: waveform and beats appear here', x0, 36);
  }
  // clip
  let s = 0;
  P.clips.forEach((c, i) => {
    const x = X(s), cw = c.dur * pps, [y0, y1] = TL.clips;
    g.fillStyle = i === sel ? '#3f84bb' : '#24506f';
    roundRect(g, x + 1, y0, cw - 2, y1 - y0, 6); g.fill();
    if (c.hold > 0) { g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x + cw - c.hold * pps, y0 + 1, c.hold * pps - 2, y1 - y0 - 2); }
    g.fillStyle = '#e8f0f4'; g.font = '600 12px Archivo'; g.textAlign = 'left';
    g.save(); g.beginPath(); g.rect(x + 4, y0, cw - 14, y1 - y0); g.clip();
    g.fillText(views[c.view]?.name || c.view, x + 8, y0 + 18);
    g.font = '11px "IBM Plex Mono"'; g.fillStyle = '#bcd0db';
    g.fillText(`${c.from} → ${c.to}`, x + 8, y0 + 34);
    g.fillText(`${c.dur.toFixed(2)} s`, x + 8, y0 + 49);
    g.restore();
    // maniglia per allungare
    g.fillStyle = i === sel ? '#e8f0f4' : '#9fb9c9';
    g.fillRect(x + cw - 6, y0 + 14, 3, y1 - y0 - 28);
    s += c.dur;
  });
  // righello
  g.fillStyle = '#6f8592'; g.font = '10px "IBM Plex Mono"'; g.textAlign = 'center';
  const step = total() > 60 ? 10 : 5;
  for (let t = 0; t <= total() + 0.01; t += step) { g.fillRect(X(t), TL.ruler - 8, 1, 4); g.fillText(fmtTime(t).replace(/\.0$/, ''), X(t), TL.ruler + 4); }
  // indicatore
  g.fillStyle = '#ff5d5d';
  g.fillRect(X(tNow) - 1, 0, 2, TL.clips[1] + 4);
  drawOverview();
}

function drawOverview() {
  const d = sizeCanvas(ov), g = ov.getContext('2d');
  g.setTransform(d, 0, 0, d, 0, 0);
  const w = ov.clientWidth, h = +ov.getAttribute('height');
  g.clearRect(0, 0, w, h);
  if (!song.peaks) return;
  const dur = song.buffer.duration, n = song.peaks.length;
  g.fillStyle = '#35556b';
  for (let x = 0; x < w; x++) { const p = song.peaks[Math.floor((x / w) * n)]; g.fillRect(x, h / 2 - p * (h / 2 - 3), 1, Math.max(1, 2 * p * (h / 2 - 3))); }
  const a = (P.song.start / dur) * w, b = ((P.song.start + total()) / dur) * w;
  g.fillStyle = 'rgba(232,240,244,.16)'; g.fillRect(a, 0, b - a, h);
  g.strokeStyle = '#e8f0f4'; g.lineWidth = 1.5; g.strokeRect(a + 0.5, 0.5, Math.max(2, b - a - 1), h - 1);
  if (playing) { g.fillStyle = '#ff5d5d'; g.fillRect(((P.song.start + tNow) / dur) * w - 1, 0, 2, h); }
}

tl.addEventListener('pointerdown', (e) => {
  if (!oe) return;
  const r = tl.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  const { pps, x0 } = tlScale();
  const t = (x - x0) / pps;
  // bordo destro di una clip: si allunga
  let s = 0;
  for (let i = 0; i < P.clips.length; i++) {
    s += P.clips[i].dur;
    if (y >= TL.clips[0] && y <= TL.clips[1] && Math.abs(x - (x0 + s * pps)) < 8) {
      tlDrag = { kind: 'edge', i, start: s - P.clips[i].dur, pps };
      sel = i; fillForms();
      tl.setPointerCapture(e.pointerId);
      return;
    }
  }
  if (y >= TL.clips[0] && y <= TL.clips[1]) { const k = clipAt(Math.max(0, t)).i; if (k !== sel) { sel = k; fillForms(); } }
  tlDrag = { kind: 'seek' };
  tl.setPointerCapture(e.pointerId);
  seek(t);
});
tl.addEventListener('pointermove', (e) => {
  const r = tl.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  const { pps, x0 } = tlScale();
  if (!tlDrag) {
    let s = 0, edge = false;
    for (const c of P.clips) { s += c.dur; if (y >= TL.clips[0] && y <= TL.clips[1] && Math.abs(x - (x0 + s * pps)) < 8) edge = true; }
    tl.style.cursor = edge ? 'ew-resize' : 'pointer';
    return;
  }
  if (tlDrag.kind === 'seek') { seek((x - x0) / pps); return; }
  // la scala resta quella di quando si e' preso il bordo: il bordo segue il puntatore
  const tEnd = snapTime((x - x0) / tlDrag.pps);
  const c = P.clips[tlDrag.i];
  c.dur = Math.max(0.5, tEnd - tlDrag.start);
  c.hold = Math.min(c.hold, Math.max(0, c.dur - 0.2));
  need = true;
  $('#c-dur').value = +c.dur.toFixed(2);
});
tl.addEventListener('pointerup', () => { if (tlDrag?.kind === 'edge') { saveLocal(); fillForms(); } tlDrag = null; });

{
  let drag = null;
  ov.addEventListener('pointerdown', (e) => {
    if (!song.buffer) return;
    const r = ov.getBoundingClientRect(), x = e.clientX - r.left, dur = song.buffer.duration;
    const s = (x / r.width) * dur;
    drag = { off: s >= P.song.start && s <= P.song.start + total() ? s - P.song.start : 0 };
    ov.setPointerCapture(e.pointerId);
    move(e);
  });
  const move = (e) => {
    if (!drag) return;
    const r = ov.getBoundingClientRect(), dur = song.buffer.duration;
    let s = ((e.clientX - r.left) / r.width) * dur - drag.off;
    s = Math.max(0, Math.min(dur - Math.min(dur, total()), s));
    P.song.start = s;
    $('#song-start').value = +s.toFixed(2);
    need = true;
  };
  ov.addEventListener('pointermove', move);
  ov.addEventListener('pointerup', () => {
    if (!drag) return;
    drag = null;
    // aggancia l'inizio a un battito (o a una battuta)
    if (P.song.snap !== 'none') {
      const all = songBeats();
      let best = P.song.start, bd = Infinity;
      all.forEach((b, k) => { if (P.song.snap === 'bar' && !isBar(k)) return; const d = Math.abs(b - P.song.start); if (d < bd) { bd = d; best = b; } });
      P.song.start = best;
    }
    fillSong(); need = true; saveLocal();
    if (playing) { pause(); play(); }
  });
}

// ── esportazione MP4 ───────────────────────────────────────────────────────
let cancelExport = false;
async function pickCodecs() {
  if (!('VideoEncoder' in window)) return null;
  const fps = P.fps, bitrate = P.rate * 1e6;
  let video = null;
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.420028', 'avc1.640032']) {
    const cfg = { codec, width: W, height: H, bitrate, framerate: fps, avc: { format: 'avc' } };
    try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) { video = cfg; break; } } catch (e) { /* prossimo */ }
  }
  if (!video) return null;
  let audio = null;
  if (song.buffer && 'AudioEncoder' in window) {
    for (const [codec, mux] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
      const cfg = { codec, sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 };
      try { if ((await AudioEncoder.isConfigSupported(cfg)).supported) { audio = { cfg, mux }; break; } } catch (e) { /* prossimo */ }
    }
  }
  return { video, audio };
}

async function renderAudio() {
  const T = total(), sr = 48000;
  const oc = new OfflineAudioContext(2, Math.ceil(T * sr), sr);
  const s = oc.createBufferSource(), gain = oc.createGain();
  s.buffer = song.buffer;
  s.connect(gain).connect(oc.destination);
  envelope(gain.gain, 0, 0);
  s.start(0, P.song.start, T);
  return oc.startRendering();
}

function fmtDur(s) { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return m ? `${m} min ${s % 60} s` : `${s} s`; }

async function exportMp4() {
  if (!oe || exporting) return;
  pause();
  const dlg = $('#exp'), info = $('#exp-info'), bar = $('#exp-bar'), status = $('#exp-status'), dl = $('#exp-dl');
  dl.hidden = true; bar.value = 0; status.textContent = '';
  $('#exp-cancel').textContent = UI_LANG === 'it' ? 'Annulla' : 'Cancel';
  dlg.showModal();
  const codecs = await pickCodecs();
  if (!codecs) { info.textContent = MSG.no_webcodecs; return; }
  info.textContent = MSG.codec_info(`H.264 ${W}×${H} ${P.fps} fps`, codecs.audio ? (codecs.audio.mux === 'aac' ? 'AAC' : 'Opus') : null) + (codecs.audio?.mux === 'opus' ? ' ' + MSG.opus_note : '');
  exporting = true; cancelExport = false;
  const fps = P.fps, N = Math.round(total() * fps);
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: W, height: H, frameRate: fps },
    audio: codecs.audio ? { codec: codecs.audio.mux, numberOfChannels: 2, sampleRate: 48000 } : undefined,
    fastStart: 'in-memory',
  });
  let failed = null;
  const venc = new VideoEncoder({ output: (ch, meta) => muxer.addVideoChunk(ch, meta), error: (e) => { failed = e; } });
  venc.configure(codecs.video);
  const t0 = performance.now();
  try {
    oe.preview(false);
    // le scie partono gia' formate: un po' di simulazione prima del primo fotogramma
    let inf = applyAt(0);
    await until(() => oe.ready(), 120000, 20);
    for (let k = 0; k < 150; k++) clock.step(1000 / fps);
    for (let f = 0; f < N; f++) {
      if (cancelExport) throw new Error('cancel');
      if (failed) throw failed;
      const t = f / fps;
      inf = applyAt(t);
      if (!oe.ready()) {
        status.textContent = MSG.wait_data;
        try { await until(() => oe.ready(), 90000, 15); } catch (e) { throw new Error(MSG.timeout); }
      }
      clock.step(1000 / fps);
      compose(inf, t);
      const vf = new VideoFrame(out, { timestamp: Math.round((f * 1e6) / fps), duration: Math.round(1e6 / fps) });
      venc.encode(vf, { keyFrame: f % (fps * 2) === 0 });
      vf.close();
      if (venc.encodeQueueSize > 6) await new Promise((r) => { const w = () => (venc.encodeQueueSize > 2 ? setTimeout(w, 5) : r()); w(); });
      if (f % 5 === 0) {
        bar.value = (f + 1) / N;
        const el = (performance.now() - t0) / 1000;
        status.textContent = MSG.frame(f + 1, N, fmtDur((el / (f + 1)) * (N - f - 1)));
        drawTimelineAt(t);
        await new Promise((r) => setTimeout(r, 0));     // lascia aggiornare la pagina
      }
    }
    await venc.flush();
    if (codecs.audio) {
      const buf = await renderAudio();
      const aenc = new AudioEncoder({ output: (ch, meta) => muxer.addAudioChunk(ch, meta), error: (e) => { failed = e; } });
      aenc.configure(codecs.audio.cfg);
      const L = buf.getChannelData(0), R = buf.getChannelData(1), step = 4800;
      for (let i = 0; i < buf.length; i += step) {
        const n = Math.min(step, buf.length - i), data = new Float32Array(n * 2);
        data.set(L.subarray(i, i + n), 0); data.set(R.subarray(i, i + n), n);
        const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((i * 1e6) / 48000), data });
        aenc.encode(ad); ad.close();
      }
      await aenc.flush();
      if (failed) throw failed;
    }
    muxer.finalize();
    const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
    dl.href = URL.createObjectURL(blob);
    dl.download = `reel-${(P.title || 'atlante').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.mp4`;
    dl.hidden = false;
    bar.value = 1;
    status.textContent = MSG.done((blob.size / 1e6).toFixed(1), fmtDur((performance.now() - t0) / 1000));
    $('#exp-cancel').textContent = UI_LANG === 'it' ? 'Chiudi' : 'Close';
    window.__reelBlob = blob;                            // per i test automatici
  } catch (e) {
    status.textContent = e.message === 'cancel' ? MSG.cancelled : String(e.message || e);
    try { venc.close(); } catch (err) { /* gia' chiuso */ }
  } finally {
    exporting = false;
    need = true; camNeed = true;
  }
}
function drawTimelineAt(t) { const k = tNow; tNow = t; drawTimeline(); tNow = k; }
$('#export').addEventListener('click', exportMp4);
$('#exp-cancel').addEventListener('click', () => { if (exporting) cancelExport = true; else $('#exp').close(); });

// ── avvio ──────────────────────────────────────────────────────────────────
window.__reel = { get P() { return P; }, set P(p) { P = p; fillForms(); need = true; camNeed = true; }, seek, play, pause, exportMp4, setSong, get song() { return song; }, get oe() { return oe; }, get t() { return tNow; } };
requestAnimationFrame(tick);
await bootAtlas();
const stored = await loadStoredSong();
if (stored && stored.name === P.song.name) {
  try { song.name = stored.name; await setSong(stored.name, stored.bytes, true); } catch (e) { /* il brano salvato non si legge piu': si sceglie di nuovo */ }
} else if (P.song.name) $('#beat-info').textContent = MSG.song_missing(P.song.name);
