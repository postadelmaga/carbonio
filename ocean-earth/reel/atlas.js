// L'atlante in un iframe nascosto (../index.html?reel), con un orologio
// virtuale: e' l'editor a decidere istante, inquadratura e passo di ogni
// fotogramma.

import { S, W, H, VIEWS, NEEDS, LEGEND, clipAt, progressIn, camAt } from './model.js';

export const A = { oe: null, clock: null, frame: null, frames: [], views: {}, viewKey: '', legend: {} };

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

function installClock(w) {
  const q = [];
  let vt = w.performance.now();
  w.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
  w.cancelAnimationFrame = () => {};
  w.performance.now = () => vt;
  return { step(ms) { vt += ms; const cbs = q.splice(0); for (const cb of cbs) cb(vt); } };
}

export const until = (ok, ms = 60000, every = 30) => new Promise((res, rej) => {
  const t0 = performance.now();
  (function poll() {
    let v = false;
    try { v = ok(); } catch (e) { /* non ancora */ }
    if (v) return res(v);
    if (performance.now() - t0 > ms) return rej(new Error('timeout'));
    setTimeout(poll, every);
  })();
});

export async function bootAtlas(frame, lang) {
  A.frame = frame;
  A.oe = null; A.viewKey = ''; A.legend = {};
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  frame.style.width = `${W / dpr}px`;
  frame.style.height = `${H / dpr}px`;
  const loaded = new Promise((r) => { frame.onload = r; });
  frame.src = `../index.html?reel&lang=${encodeURIComponent(lang)}`;
  await loaded;
  const w = frame.contentWindow;
  await until(() => w.__oe && w.__oe.timeline && w.__oe.ready, 90000);
  A.oe = w.__oe;
  A.clock = installClock(w);
  A.oe.timeline.setTier('monthly', false);
  A.frames = A.oe.timeline.frames;
  const st = A.oe.globe.state;
  st.particleCount = 22000; st.particleWidth = 1.9; st.coast = true; st.hotspot = false;
  A.oe.globe.resetParticles?.();
  // le viste che hanno dati, con i nomi dell'atlante nella lingua scelta
  A.views = {};
  const doc = frame.contentDocument;
  for (const v of VIEWS) {
    const b = doc.querySelector(`.quick-mode button[data-mode=${v}]`);
    if (!b || b.hidden) continue;
    const idx = A.frames.map((f, i) => (NEEDS[v].every((k) => f[k] != null) ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) continue;
    A.views[v] = { name: b.querySelector('.l')?.textContent.trim() || v, title: b.title || '', first: idx[0], last: idx[idx.length - 1] };
  }
}

const keyOf = (c) => `${c.view}/${c.variant}/${c.particles}`;

// vista, variante e scie della clip; legenda e didascalia lette dall'atlante
export function ensureView(c) {
  const key = keyOf(c);
  if (key === A.viewKey) return;
  A.viewKey = key;
  const oe = A.oe, doc = A.frame.contentDocument;
  oe.setMode(c.view);
  const cap = doc.querySelector('#legend .lg-cap');
  let caption = cap ? (cap.querySelector('span')?.textContent || '').trim() : '';
  const vc = VCAP[`${c.view}/${c.variant}`];
  if (vc) caption = vc[S.P.lang] || vc.en;
  caption = caption.charAt(0).toUpperCase() + caption.slice(1);
  if (c.view === 'co2') oe.setAir(+c.variant, null);
  if (c.view === 'emis') oe.setAir(null, +c.variant);
  oe.globe.state.particles = !!c.particles;
  oe.globe.state.arrows = false;
  if (!A.legend[key]) A.legend[key] = { rows: LEGEND[c.view].map((k) => legendRow(doc, k)).filter(Boolean), caption };
}
export const legendNow = () => A.legend[A.viewKey] || { rows: [], caption: '' };

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
export function gradientStops(css) {
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

export function frameIndex(stamp, fallback) {
  const i = A.frames.findIndex((f) => f.t === stamp);
  return i >= 0 ? i : fallback;
}
export function clipRange(c) {
  const v = A.views[c.view];
  const lo = v ? v.first : 0, hi = v ? v.last : A.frames.length - 1;
  const a = Math.max(lo, Math.min(hi, frameIndex(c.from, lo))), b = Math.max(lo, Math.min(hi, frameIndex(c.to, hi)));
  return [a, b];
}

// porta l'atlante all'istante t del reel
export function applyAt(t, withCam = true) {
  const info = clipAt(t);
  if (!info) return null;
  const { c, t0, lt } = info;
  ensureView(c);
  const [a, b] = clipRange(c);
  info.p = progressIn(c, t0, lt);
  info.pos = a + (b - a) * info.p;
  info.range = [a, b];
  if (Math.abs(A.oe.timeline.pos - info.pos) > 1e-7) A.oe.timeline.seek(info.pos);
  if (withCam) Object.assign(A.oe.camera, camAt(c, lt));
  return info;
}

// posizione nei dati all'istante t senza toccare l'atlante (per scaricare in anticipo)
export function peekPos(t) {
  const info = clipAt(t);
  if (!info || keyOf(info.c) !== A.viewKey) return null;
  const [a, b] = clipRange(info.c);
  return a + (b - a) * progressIn(info.c, info.t0, info.lt);
}
