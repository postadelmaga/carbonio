// Ocean Earth: collega dati, tempo, globo e interfaccia.

import { Camera, DEG, wrapLon } from './geo.js';
import { Globe } from './globe.js';
import { DataStore } from './data.js';
import { Timeline, climSelection, mixClim } from './timeline.js';
import { LineChart, stampToYear } from './chart.js';
import { cssGradient } from './palettes.js';
import { t, LANG, LANGS, LANG_NAMES, setLang, siteHome, applyStatic, fmtStamp, fmtNum, fmtLat, fmtLon, compass } from './i18n.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const ui = {
  mode: 'sst',                 // livello principale (il piu' pesante): punto, scala, intervalli
  source: 'model',             // model | ostia (solo giornaliero)
  med: true,                   // Mediterraneo a 1/16° sopra la griglia globale (solo giornaliero)
  point: null, pointB: null,   // punti selezionati {lat, lon}
  picking: null,               // null | 'second'
  regionMode: false, region: null,
  compare: false, compareIndex: null,
};

const camera = new Camera();
const store = new DataStore();
let globe, timeline, manifest;
let climFrames = null, biasFrames = null;

// ── avvio ──────────────────────────────────────────────────────────────────
async function start() {
  applyStatic();
  const canvas = $('#globe');
  try {
    globe = new Globe(canvas, camera);
  } catch (e) {
    fatal(t('webgl_fail'));
    return;
  }
  if (!globe.floatTargets) note(t('particles_fail'));
  readTheme();
  // l'altezza vera della barra del tempo (cambia con la larghezza): i pannelli
  // e la legenda si appoggiano sopra
  new ResizeObserver(([e]) => document.documentElement.style.setProperty('--time-h', Math.ceil(e.target.getBoundingClientRect().height) + 'px')).observe($('.time'));
  if (matchMedia('(max-width: 720px)').matches) {
    camera.dist = 2.7;
    globe.state.particleCount = 4000;
    $('#p-count').value = 4000;
  }
  globe.resize();
  bindInput(canvas);
  requestAnimationFrame(loop);

  try {
    manifest = await store.init();
  } catch (e) {
    fatal('manifest: ' + e.message);
    return;
  }
  loadStatic();
  store.onSaved = () => drawSaved();
  store.scanSaved();
  timeline = new Timeline(manifest);
  timeline.on(onTime);
  buildTimeUI();
  bindControls();
  buildAbout();
  timeline.setTier(manifest.tiers.monthly ? 'monthly' : Object.keys(manifest.tiers)[0], false);
  $('#loading').hidden = true;
  // per i test automatici e per chi vuole curiosare dalla console
  window.__oe = { camera, timeline, globe, store, ui, shown: () => current };
}

function fatal(msg) {
  const l = $('#loading');
  l.hidden = false;
  l.textContent = msg;
  l.classList.add('error');
}

function note(msg) {
  const n = $('#note');
  n.textContent = msg;
  n.hidden = false;
  clearTimeout(note.timer);
  note.timer = setTimeout(() => { n.hidden = true; }, 7000);
}

async function loadStatic() {
  const big = globe.gl.getParameter(globe.gl.MAX_TEXTURE_SIZE) >= 8192 && !/Mobi|Android/i.test(navigator.userAgent);
  store.decode(big ? 'static/land-8192.png' : 'static/land.png', 'gray')
    .then((f) => globe.setLand(f.gray, f.w, f.h)).catch(() => {});
  store.decode('static/coast.json', 'json').then((r) => globe.setCoast(r.json)).catch(() => {});
}

// Campi mensili (12 file ciascuno): la climatologia GLORYS 1993–2020, la
// differenza anfc − GLORYS che sposta la base per i dati operativi
// (pipeline/bias.py) e il 90° percentile per gli hotspot. La climatologia
// parte dopo il primo fotogramma, per non rallentare l'apertura, o subito se
// la si chiede prima; il percentile solo quando si accendono gli hotspot.
const monthlyFields = {};
function loadMonthly(kind) {
  const avail = kind === 'bias' ? manifest.climatology.bias?.available : manifest.climatology.available;
  if (monthlyFields[kind] || !avail) return monthlyFields[kind];
  const months = [...Array(12).keys()].map((m) => String(m + 1).padStart(2, '0'));
  monthlyFields[kind] = Promise.all(months.map((m) => store.decode(`${kind}/sst-${m}.png`, 'scalar')))
    .then((f) => {
      globe.setMonthly(kind, f);
      if (kind === 'clim') climFrames = f; else if (kind === 'bias') biasFrames = f;
      if (kind !== 'p90') { refreshPoint(); loadSeries(); }
    })
    .catch(() => { monthlyFields[kind] = null; });   // senza, l'anomalia resta spenta
  return monthlyFields[kind];
}
function loadClim() { loadMonthly('bias'); return loadMonthly('clim'); }

// quanto della temperatura mostrata viene dall'analisi operativa (anfc)
function anfcShare(frameA, frameB, sv, mix) {
  const is = (f) => (store.source(f && f[sv])?.id || '').includes('anfc') ? 1 : 0;
  return (1 - mix) * is(frameA) + mix * is(frameB);
}

// colori del tema (lo sfondo segue il tema chiaro/scuro del sito)
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const rgb = (name, fb) => {
    const v = cs.getPropertyValue(name).trim() || fb;
    const n = parseInt(v.replace('#', ''), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  globe.setColors({
    bg: rgb('--oe-space', '#06101a'), land: rgb('--oe-land', '#2a3136'),
    nodata: rgb('--oe-nodata', '#1c2b36'), glow: rgb('--oe-glow', '#4a8fd8'), coast: rgb('--oe-coast', '#dfe8ee'),
  });
}

// ── fotogrammi ─────────────────────────────────────────────────────────────
function sstVar(frame) {
  if (timeline.tierName === 'daily' && ui.source === 'ostia' && !(globe.state.layers.anom > 0) && frame.ostia != null) return 'ostia';
  return 'sst';
}

// durante la riproduzione si usano le anteprime leggere (pipeline/preview.py);
// da fermi, al clic e nei grafici i dati esatti. Il Mediterraneo e' gia' leggero.
function previewMode() {
  return !!(timeline && timeline.playing && manifest.preview && manifest.preview.available);
}

function keyFor(frame, v, prev = previewMode()) {
  return `${prev && v !== 'med' ? 'p:' : ''}${timeline.tierName}/${v}/${frame.t}`;
}

// percorso e tipo di decodifica di un file (anteprima durante il play)
function fileOf(frame, v, prev) {
  const tier = timeline.tierName;
  if (prev && v !== 'med') return [store.previewPath(tier, v, frame.t), v === 'cur' ? 'pcur' : 'psst'];
  return [store.framePath(tier, v, frame.t), v === 'cur' ? 'vector' : 'scalar'];
}

function request(frame, v, prev = previewMode()) {
  if (!frame || frame[v] == null) return null;
  return store.get(...fileOf(frame, v, prev));
}

// le variabili da mostrare per un istante
function needed(f) {
  const need = [sstVar(f), 'cur'];
  if (medOn()) need.push('med');
  return need.filter((v) => f[v] != null);
}

function medOn() {
  return ui.med && globe.state.layers.sst > 0 && timeline.tierName === 'daily' && !!manifest.regional?.med;
}

// pronto se ogni file e' arrivato; un file che manca non blocca la riproduzione
function isReady(i) {
  const f = timeline.frames[Math.max(0, Math.min(timeline.frames.length - 1, i))];
  if (!f) return true;
  let ok = true;
  for (const v of needed(f)) {
    const file = fileOf(f, v, previewMode());
    if (store.peek(...file)) continue;
    ok = false;
    store.get(...file).catch(() => {});
  }
  return ok;
}

// quanto avanti scaricare: tre secondi di riproduzione, senza superare la cache
function aheadFrames() {
  if (!timeline.playing) return 1;
  const room = previewMode() ? store.maxPrev : store.maxCache;
  return Math.max(2, Math.min(Math.floor(room / (medOn() ? 3 : 2)) - 2, Math.ceil(timeline.fps * 3)));
}

// l'istante k passi dopo quello mostrato, dentro l'intervallo che si ripete
function aheadIndex(k) {
  const [lo, hi] = playRange();
  let i = timeline.index + k;
  if (i > hi) i = lo + ((i - hi - 1) % (hi - lo + 1));
  return i;
}

function prefetch() {
  const n = aheadFrames();
  for (let k = 0; k <= n; k++) isReady(aheadIndex(k));
}

// Isteresi: se la riproduzione ha dovuto aspettare, riparte solo quando un
// secondo e mezzo di fotogrammi e' arrivato (non piu' di quanto stia in
// cache), invece di fermarsi a ogni fotogramma con una rete lenta.
function readyForPlayback(i) {
  if (!timeline.waiting) return isReady(i);
  const n = Math.min(Math.max(2, Math.ceil(timeline.fps * 1.5)), aheadFrames());
  let ok = true;
  for (let k = 0; k < n; k++) ok = isReady(aheadIndex(i - timeline.index + k)) && ok;
  return ok;
}

let applyToken = 0;
async function applyFrames() {
  const token = ++applyToken;
  const A = timeline.frameA, B = timeline.frameB;
  const svA = sstVar(A), svB = sstVar(B);
  const med = medOn();
  const got = (p) => (p ? p.catch(() => null) : null);
  // tutti i file prima di toccare il globo: temperatura, correnti e
  // Mediterraneo cambiano insieme, con l'interpolazione e la climatologia
  const [sA, sB, cA, cB, mA, mB] = await Promise.all([
    request(A, svA), request(B, svB), request(A, 'cur'), request(B, 'cur'),
    med ? request(A, 'med') : null, med ? request(B, 'med') : null,
  ].map(got));
  if (token !== applyToken) return;
  const st = globe.state;
  st.sstA = globe.frameTexture(keyFor(A, svA), sA, 'scalar');
  st.sstB = globe.frameTexture(keyFor(B, svB), sB, 'scalar') || st.sstA;
  st.curA = globe.frameTexture(keyFor(A, 'cur'), cA, 'vector');
  st.curB = globe.frameTexture(keyFor(B, 'cur'), cB, 'vector') || st.curA;
  st.medA = globe.frameTexture(keyFor(A, 'med'), mA, 'scalar', true);
  st.medB = globe.frameTexture(keyFor(B, 'med'), mB, 'scalar', true) || st.medA;
  if (med) { const g = manifest.regional.med; st.medBox = [g.west, g.south, g.east, g.north]; }
  current = { A, B, sA, sB, cA, cB, svA, svB, mA, mB, preview: previewMode(), missing: !sA && A[svA] != null };
  syncShown();
  syncTimeUI(false);
  loadClim();
  updateStatus();
  refreshPoint();
}
let current = null;

// La data di confronto (meta' destra): sempre dati esatti, mai anteprime;
// l'ultima richiesta vince anche se le risposte arrivano in disordine.
let compareToken = 0;
async function applyCompare() {
  const st = globe.state;
  const token = ++compareToken;
  if (!ui.compare) { st.compare = false; globe.pinned.clear(); return; }
  const C = timeline.frames[ui.compareIndex ?? 0];
  const sv = sstVar(C);
  const f = await request(C, sv, false)?.catch(() => null);
  if (token !== compareToken) return;
  const key = keyFor(C, sv, false);
  globe.pinned.clear();
  globe.pinned.add(key);
  st.sstC = st.sstD = globe.frameTexture(key, f, 'scalar');
  st.mixCmp = 0;
  st.climSelCmp = climSelection(C.t);
  st.biasWCmp = anfcShare(C, C, sv, 0);
  st.compare = true;
  $('#cmp-label').textContent = `${fmtStamp(C.t)} · ${t('cmp_sst_only')}`;
}

// Interpolazione e climatologia devono riferirsi ai fotogrammi che sono
// davvero sul globo. Finche' quelli richiesti non arrivano, restano quelli
// mostrati: prima si sottraeva gia' la climatologia del mese nuovo alla
// temperatura del mese vecchio (gennaio meno settembre: tutto il nord a +3 °C).
function syncShown() {
  if (!current) return;
  const st = globe.state;
  const A = timeline.frameA, B = timeline.frameB;
  if (current.A === A && current.B === B) {
    st.mix = timeline.interpolated ? timeline.frac : 0;
  } else if (current.B === A && current.A !== A) {
    st.mix = 1;                            // avanzati di uno: si tiene il B gia' mostrato
  } else if (current.A === A) {
    st.mix = 0;
  }
  st.climSel = mixClim(climSelection(current.A.t), climSelection(current.B.t), st.mix);
  st.biasW = anfcShare(current.A, current.B, current.svA, st.mix);
}

// il globo mostra ancora altri istanti (si sta caricando quello scelto)
function stale() {
  return !!current && (current.A !== timeline.frameA || (timeline.interpolated && current.B !== timeline.frameB));
}

function onTime(why) {
  const A = timeline.frameA, B = timeline.frameB;
  // cambio di livello o di fonte: finche' i fotogrammi nuovi non arrivano la
  // riga delle fonti non deve descrivere quelli di prima
  if (why === 'tier' || why === 'source') {
    current = null;
    $('#status').innerHTML = `<span class="interp">${t('loading')}</span>`;
  }
  if (!current || current.A !== A || current.B !== B || current.preview !== previewMode()) applyFrames();
  else updateStatus();
  syncShown();
  if (why === 'tier' || why === 'loop' || why === 'source') drawSaved();
  if (why === 'tier' || why === 'loop') syncTimeUI(true);
  else syncTimeUI(false);
  // la meta' di confronto segue fonte e modalita' (OSTIA non entra nell'anomalia)
  if (ui.compare && why === 'source') applyCompare();
  if (why === 'tier') {
    if (ui.compare) { ui.compareIndex = Math.max(0, timeline.frames.length - 1); buildCompareUI(); applyCompare(); }
    $('#src-row').hidden = timeline.tierName !== 'daily';
    $('#hotspot').disabled = timeline.tierName !== 'monthly';
    if (timeline.tierName !== 'monthly') { globe.state.hotspot = false; $('#hotspot').checked = false; drawLegend(); }
  }
  if (pointChart) pointChart.setMarker(timeline.year);
  if (regionChart) regionChart.setMarker(timeline.year);
}

// ── ciclo di disegno ───────────────────────────────────────────────────────
let staleSince = 0, lastBehind = false;
let last = performance.now(), fpsT0 = performance.now(), fpsN = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  fpsN++;
  if (now - fpsT0 > 1000) { window.__oeFps = (fpsN * 1000) / (now - fpsT0); fpsT0 = now; fpsN = 0; }
  inertia(dt);
  if (timeline) {
    timeline.tick(dt, readyForPlayback);
    prefetch();
    // il cambio di fotogramma durante il play dura un istante: l'avviso
    // compare solo se il globo resta indietro per piu' di un terzo di secondo
    if (!stale()) staleSince = 0; else if (!staleSince) staleSince = now;
    const behind = staleSince && now - staleSince > 350;
    $('#buffering').hidden = !((timeline.playing && timeline.waiting) || behind);
    // durante il play le barre escono dallo schermo: resta la pillola con data e pausa
    const imm = timeline.playing;
    if (imm !== document.body.classList.contains('immersive')) {
      document.body.classList.toggle('immersive', imm);
      $('#mini').setAttribute('aria-hidden', String(!imm));
      if (!imm) document.body.classList.remove('peek');
    }
    $('#mini').classList.toggle('wait', !$('#buffering').hidden);
    if (behind !== lastBehind) { lastBehind = behind; syncTimeUI(false); }
  }
  globe.resize();
  camera.update();
  globe.render();
  placeMarkers();
  requestAnimationFrame(loop);
}

// ── input: rotazione, zoom, clic ───────────────────────────────────────────
let vel = { lat: 0, lon: 0 };
let fly = null;
function inertia(dt) {
  if (fly) {
    fly.t = Math.min(1, fly.t + dt / fly.dur);
    const e = fly.t < 0.5 ? 2 * fly.t * fly.t : 1 - Math.pow(-2 * fly.t + 2, 2) / 2;
    camera.lat = fly.from.lat + (fly.to.lat - fly.from.lat) * e;
    camera.lon = fly.from.lon + wrapLon(fly.to.lon - fly.from.lon) * e;
    camera.dist = fly.from.dist + (fly.to.dist - fly.from.dist) * e;
    if (fly.t >= 1) fly = null;
    return;
  }
  if (Math.abs(vel.lat) + Math.abs(vel.lon) < 0.01) return;
  camera.lat += vel.lat * dt;
  camera.lon += vel.lon * dt;
  const k = Math.exp(-dt * 4);
  vel.lat *= k; vel.lon *= k;
}

export function flyTo(lat, lon, dist) {
  fly = { t: 0, dur: 1.4, from: { lat: camera.lat, lon: camera.lon, dist: camera.dist }, to: { lat, lon, dist } };
}

function degPerPixel() {
  return (camera.viewRadiusDeg * 2) / Math.min(camera.width, camera.height) * 0.9;
}

function bindInput(canvas) {
  const pointers = new Map();
  let down = null, pinch = null, lastMove = 0;
  canvas.addEventListener('pointerdown', (ev) => {
    canvas.setPointerCapture(ev.pointerId);
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    fly = null;
    vel = { lat: 0, lon: 0 };
    if (pointers.size === 1) {
      down = { x: ev.clientX, y: ev.clientY, moved: false, region: ui.regionMode ? camera.pick(...local(ev)) : null };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: camera.dist };
      down = null;
    }
  });
  canvas.addEventListener('pointermove', (ev) => {
    const p = pointers.get(ev.pointerId);
    if (!p) return;
    const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
    p.x = ev.clientX; p.y = ev.clientY;
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      camera.dist = 1 + (pinch.dist - 1) * (pinch.d / Math.max(1, d));
      return;
    }
    if (!down) return;
    if (Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 5) down.moved = true;
    if (down.region) {
      const q = camera.pick(...local(ev));
      if (q) setRegion(down.region, q, false);
      return;
    }
    const k = degPerPixel();
    camera.lon -= dx * k / Math.max(0.25, Math.cos(camera.lat * DEG));
    camera.lat += dy * k;
    const now = performance.now(), dtm = Math.max(1, now - lastMove) / 1000;
    lastMove = now;
    vel = { lat: (dy * k) / dtm * 0.5, lon: (-dx * k / Math.max(0.25, Math.cos(camera.lat * DEG))) / dtm * 0.5 };
  });
  const up = (ev) => {
    pointers.delete(ev.pointerId);
    if (pinch) {
      // finito il pizzico, il dito rimasto riprende a ruotare (senza contare come clic)
      pinch = null;
      const [p] = pointers.values();
      down = p ? { x: p.x, y: p.y, moved: true, region: null } : null;
      return;
    }
    if (!down) return;
    if (down.region) {
      const q = camera.pick(...local(ev));
      if (q && down.moved) setRegion(down.region, q, true);
      ui.regionMode = false;
      $('#region-btn').classList.remove('on');
      canvas.classList.remove('crosshair');
    } else if (!down.moved) {
      const q = camera.pick(...local(ev));
      if (q) selectPoint(q[0], q[1]);
      vel = { lat: 0, lon: 0 };
    } else if (performance.now() - lastMove > 80) {
      vel = { lat: 0, lon: 0 };
    }
    down = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    fly = null;
    const f = Math.exp(ev.deltaY * (ev.deltaMode === 1 ? 0.05 : 0.0015));
    camera.dist = 1 + (camera.dist - 1) * f;
  }, { passive: false });
  canvas.addEventListener('dblclick', (ev) => {
    const q = camera.pick(...local(ev));
    if (q) flyTo(q[0], q[1], 1 + (camera.dist - 1) * 0.4);
  });
  window.addEventListener('keydown', (ev) => {
    // su un pulsante lo spazio lo preme gia': gestirlo anche qui lo annullerebbe
    if (ev.target.closest('input, select, textarea, summary') || (ev.key === ' ' && ev.target.closest('button'))) return;
    const k = degPerPixel() * 40;
    if (ev.key === 'ArrowLeft') camera.lon -= k;
    else if (ev.key === 'ArrowRight') camera.lon += k;
    else if (ev.key === 'ArrowUp') camera.lat += k;
    else if (ev.key === 'ArrowDown') camera.lat -= k;
    else if (ev.key === '+' || ev.key === '=') camera.dist = 1 + (camera.dist - 1) * 0.8;
    else if (ev.key === '-') camera.dist = 1 + (camera.dist - 1) * 1.25;
    else if (ev.key === ' ') { timeline && (timeline.playing ? timeline.pause() : timeline.play()); }
    else if (ev.key === '.' ) timeline && timeline.step(1);
    else if (ev.key === ',') timeline && timeline.step(-1);
    else return;
    ev.preventDefault();
  });
  window.addEventListener('resize', () => globe.resize());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme);
  new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

function local(ev) {
  const r = globe.canvas.getBoundingClientRect();
  return [ev.clientX - r.left, ev.clientY - r.top];
}

// marcatori dei punti scelti, in HTML sopra la tela
function placeMarkers() {
  for (const [sel, p] of [['#mark-a', ui.point], ['#mark-b', ui.pointB]]) {
    const m = $(sel);
    const xy = p && camera.project(p.lat, p.lon);
    if (!xy) { m.hidden = true; continue; }
    m.hidden = false;
    m.style.transform = `translate(${xy[0]}px, ${xy[1]}px)`;
  }
}

// ── pannello del punto ─────────────────────────────────────────────────────
let pointChart = null;
let showAnomSeries = false;
const seriesCache = new Map();

function selectPoint(lat, lon) {
  if (ui.picking === 'second') {
    ui.pointB = { lat, lon };
    ui.picking = null;
    $('#pick-b').classList.remove('on');
    $('#pick-b').textContent = t('remove');
  } else {
    ui.point = { lat, lon };
  }
  $('#info').hidden = false;
  refreshPoint();
  loadSeries();
}

function valueAt(frameA, frameB, i, kind) {
  // le anteprime della riproduzione non portano i codici esatti: il pannello
  // si riempie quando la timeline si ferma e tornano i dati originali
  if ((frameA && frameA.preview) || (frameB && frameB.preview)) return kind === 'scalar' ? NaN : [NaN, NaN];
  const mix = globe.state.mix;
  if (kind === 'scalar') {
    const a = frameA ? store.scalarValue(frameA.codes, i) : NaN;
    const b = frameB ? store.scalarValue(frameB.codes, i) : a;
    return mix > 0 && Number.isFinite(b) ? a + (b - a) * mix : a;
  }
  const a = frameA ? store.vectorValue(frameA, i) : [NaN, NaN];
  const b = frameB ? store.vectorValue(frameB, i) : a;
  if (mix > 0 && Number.isFinite(b[0])) return [a[0] + (b[0] - a[0]) * mix, a[1] + (b[1] - a[1]) * mix];
  return a;
}

function monthlyAt(frames, i, sel) {
  const a = store.scalarValue(frames[sel[0]].codes, i), b = store.scalarValue(frames[sel[1]].codes, i);
  return a + (b - a) * sel[2];
}

// la base dell'anomalia in una cella: climatologia GLORYS, spostata della
// differenza anfc − GLORYS per la parte di dato che viene da anfc (w)
function baseAt(i, sel, w) {
  if (!climFrames) return NaN;
  const b = w > 0 && biasFrames ? monthlyAt(biasFrames, i, sel) : 0;
  return monthlyAt(climFrames, i, sel) + w * (Number.isFinite(b) ? b : 0);
}

// istanti mensili della serie storica che vengono da anfc
let anfcMonths = null;
function monthlyBase(stamp, i) {
  if (!anfcMonths) anfcMonths = new Set(manifest.tiers.monthly.frames.filter((f) => anfcShare(f, f, 'sst', 0)).map((f) => f.t));
  const m = +stamp.slice(5, 7) - 1;
  return baseAt(i, [m, m, 0, 0], anfcMonths.has(stamp) ? 1 : 0);
}


function pointValues(p) {
  if (!current) return null;
  const c = store.cell(p.lat, p.lon);
  let sst = valueAt(current.sA, current.sB, c.i, 'scalar');
  let med = false;
  const g = manifest.regional && manifest.regional.med;
  if (current.mA && g && ui.mode === 'sst' && p.lat >= g.south && p.lat <= g.north && p.lon >= g.west && p.lon <= g.east) {
    const r = Math.min(g.nlat - 1, Math.floor((g.north - p.lat) / (g.north - g.south) * g.nlat));
    const cc = Math.min(g.nlon - 1, Math.floor((p.lon - g.west) / (g.east - g.west) * g.nlon));
    const v = valueAt(current.mA, current.mB, r * g.nlon + cc, 'scalar');
    if (Number.isFinite(v)) { sst = v; med = true; }
  }
  const cl = baseAt(c.i, globe.state.climSel, globe.state.biasW);
  const [u, v] = valueAt(current.cA, current.cB, c.i, 'vector');
  const speed = Math.hypot(u, v);
  const dirDeg = (Math.atan2(u, v) / DEG + 360) % 360;         // verso cui va, da nord in senso orario
  // l'anomalia e' sempre sul modello, come la climatologia: con OSTIA non c'e'
  const model = current.svA === 'sst' ? valueAt(current.sA, current.sB, c.i, 'scalar') : NaN;
  return { c, sst, anom: model - cl, u, v, speed, dirDeg, med };
}


function refreshPoint() {
  if (!ui.point || !current) return;
  const rows = [];
  const one = (p, tag) => {
    const v = pointValues(p);
    if (!v) return;
    const head = tag ? `<span class="tag ${tag}">${tag.toUpperCase()}</span> ` : '';
    rows.push(`<div class="pt-head">${head}${fmtLat(p.lat)}, ${fmtLon(p.lon)} <span class="muted">· ${t('resolution')} ${fmtNum(0.25, 2)}° (${fmtLat(v.c.lat)}, ${fmtLon(v.c.lon)})</span></div>`);
    if (!Number.isFinite(v.sst) && !Number.isFinite(v.speed)) { rows.push(`<div class="muted">${t('no_data')}</div>`); return; }
    const dir = compass(v.dirDeg);
    rows.push(`<dl class="vals">
      <dt>${t('temp')}</dt><dd>${Number.isFinite(v.sst) ? `<b>${fmtNum(v.sst, 2)} °C</b>` : '—'}${v.med ? ` <span class="muted">· ${store.source(current.A.med)?.name}, 1/16°</span>` : ''}</dd>
      <dt>${t('anom')}</dt><dd>${Number.isFinite(v.anom) ? `<b class="${v.anom >= 0 ? 'warm' : 'cold'}">${v.anom >= 0 ? '+' : ''}${fmtNum(v.anom, 2)} °C</b> <span class="muted">${t('clim_base')} ${manifest.climatology.years.join('–')}</span>` : current.svA === 'ostia' ? `— <span class="muted">${t('anom_model_only')}</span>` : '—'}</dd>
      <dt>${t('cur_speed')}</dt><dd>${Number.isFinite(v.speed) ? `<b>${fmtNum(v.speed, 3)} m/s</b> · ${t('towards')} ${dir} (${Math.round(v.dirDeg)}°) <span class="muted">u ${fmtNum(v.u, 3)} · v ${fmtNum(v.v, 3)}</span>` : '—'}</dd>
    </dl>`);
  };
  one(ui.point, ui.pointB ? 'a' : null);
  if (ui.pointB) one(ui.pointB, 'b');
  const srcS = store.source(current.A[current.svA]);
  const srcC = store.source(current.A.cur);
  rows.push(`<dl class="vals meta">
    <dt>${t('datum')}</dt><dd>${timeLabel()}</dd>
    <dt>${t('dataset')}</dt><dd>${srcS ? srcLine(srcS) : '—'}<br>${srcC ? srcLine(srcC) : '—'}</dd>
  </dl>`);
  $('#pt-values').innerHTML = rows.join('');
}

function freqLabel(s) {
  if (s.freq === 'P1M') return t('monthly_mean');
  if (s.freq === 'P1D') return t('daily_mean');
  return s.id.endsWith('-i') ? t('hourly_inst') : t('hourly_mean');
}

function srcLine(s) {
  return `<a href="https://data.marine.copernicus.eu/product/${s.product}/description" target="_blank" rel="noopener">${s.name}</a> <span class="muted">· ${t(s.kind)} · ${freqLabel(s)} · ${s.res}${s.res !== '0.25°' ? ` → ${fmtNum(0.25, 2)}°` : ''}</span>`;
}

// l'istante dei valori del pannello: quello sul globo, non quello richiesto
function timeLabel() {
  const A = current ? current.A : timeline.frameA, B = current ? current.B : timeline.frameB;
  const mix = current ? globe.state.mix : timeline.frac;
  if (mix > 1e-3 && mix < 1 - 1e-3 && A !== B) return `${fmtStamp(A.t)} → ${fmtStamp(B.t)} <span class="interp">${t('interpolated')} ${Math.round(mix * 100)}%</span>`;
  return `${fmtStamp((mix >= 1 - 1e-3 ? B : A).t)} <span class="orig">${t('original')}</span>`;
}

async function getSeries(p) {
  const c = store.cell(p.lat, p.lon);
  const k = `${c.r}/${c.c}`;
  if (!seriesCache.has(k)) seriesCache.set(k, store.series(p.lat, p.lon).catch(() => null));
  return seriesCache.get(k);
}

async function loadSeries() {
  if (!ui.point) return;
  if (!pointChart) {
    pointChart = new LineChart($('#pt-chart'));
    pointChart.onRange = (r) => { $('#pt-range').textContent = r ? `${r[0].toFixed(1)} – ${r[1].toFixed(1)}` : '1993 – ' + timeline.frames.at(-1).t.slice(0, 4); };
  }
  const pts = [ui.point, ui.pointB].filter(Boolean);
  const all = await Promise.all(pts.map(getSeries));
  const colors = ['var(--oe-a)', 'var(--oe-b)'];
  const series = [];
  all.forEach((s, k) => {
    if (!s) return;
    const x = new Float64Array(s.stamps.map(stampToYear));
    let y = s.values;
    if (showAnomSeries && climFrames) {
      const c = store.cell(pts[k].lat, pts[k].lon);
      y = y.map((v, i) => v - monthlyBase(s.stamps[i], c.i));
    }
    series.push({ label: pts.length > 1 ? (k ? 'B' : 'A') : (showAnomSeries ? t('anom') : t('temp')), color: colors[k], x, y });
  });
  pointChart.set(series, { zero: showAnomSeries });
  pointChart.setMarker(timeline.year);
  pointChart.onRange(pointChart.range);
}

// ── regione ────────────────────────────────────────────────────────────────
let regionChart = null;
function setRegion(a, b, final) {
  let s = Math.min(a[0], b[0]), n = Math.max(a[0], b[0]);
  let w = a[1], e = b[1];
  if (wrapLon(e - w) < 0) [w, e] = [e, w];
  if (e < w) e += 360;
  // al massimo 40° per lato: le tessere da scaricare restano poche
  n = Math.min(n, s + 40); e = Math.min(e, w + 40);
  ui.region = [s, w, n, e];
  globe.setRegion(ui.region);
  if (final) regionStats();
}

let regionToken = 0;
async function regionStats() {
  const token = ++regionToken;
  try {
    await regionStatsInner(token);
  } catch (err) {
    if (token === regionToken) $('#reg-values').textContent = t('frame_missing');
  }
}

async function regionStatsInner(token) {
  const [s, w, n, e] = ui.region;
  const panel = $('#region');
  panel.hidden = false;
  $('#reg-box').textContent = `${fmtLat(s)} – ${fmtLat(n)}, ${fmtLon(wrapLon(w))} – ${fmtLon(wrapLon(e))}`;
  $('#reg-values').textContent = t('loading');
  await loadClim();                       // l'anomalia della regione ne ha bisogno
  const g = manifest.grid;
  const meta = await fetch(store.url('series/sst.json')).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  const T = meta.tile, nm = meta.stamps.length;
  const r0 = Math.floor((90 - n) / g.step), r1 = Math.floor((90 - s) / g.step);
  const c0 = Math.floor((w + 180) / g.step), c1 = Math.floor((e + 180) / g.step);
  const sum = new Float64Array(nm), wsum = new Float64Array(nm), max = new Float64Array(nm).fill(-Infinity);
  const asum = new Float64Array(nm), awsum = new Float64Array(nm);
  let cells = 0;
  const tiles = [];
  for (let tr = Math.floor(r0 / T); tr <= Math.floor(r1 / T); tr++) {
    for (let tc = Math.floor(c0 / T); tc <= Math.floor(c1 / T); tc++) tiles.push([tr, tc]);
  }
  await Promise.all(tiles.map(async ([tr, tcRaw]) => {
    const tc = ((tcRaw % (g.nlon / T)) + g.nlon / T) % (g.nlon / T);
    let tile;
    try { tile = await store.decode(`series/sst/${tr}_${tc}.png`, 'series'); } catch (err) { return; }
    for (let rr = 0; rr < T; rr++) {
      const r = tr * T + rr;
      if (r < r0 || r > r1) continue;
      const wt = Math.cos((90 - (r + 0.5) * g.step) * DEG);
      for (let cc = 0; cc < T; cc++) {
        const cAbs = tcRaw * T + cc;
        if (cAbs < c0 || cAbs > c1) continue;
        const gi = r * g.nlon + (tc * T + cc);
        const row = rr * T + cc;
        let any = false;
        for (let k = 0; k < nm; k++) {
          const v = store.scalarValue(tile.codes, row * nm + k);
          if (!Number.isFinite(v)) continue;
          any = true;
          sum[k] += v * wt; wsum[k] += wt;
          if (v > max[k]) max[k] = v;
          if (climFrames) {
            const cl = monthlyBase(meta.stamps[k], gi);
            if (Number.isFinite(cl)) { asum[k] += (v - cl) * wt; awsum[k] += wt; }
          }
        }
        if (any) cells++;
      }
    }
  }));
  if (token !== regionToken) return;       // nel frattempo si e' scelta un'altra regione
  const x = new Float64Array(meta.stamps.map(stampToYear));
  const mean = Float32Array.from(sum, (v, k) => (wsum[k] ? v / wsum[k] : NaN));
  const mx = Float32Array.from(max, (v) => (Number.isFinite(v) ? v : NaN));
  const an = Float32Array.from(asum, (v, k) => (awsum[k] ? v / awsum[k] : NaN));
  ui.regionSeries = { x, mean, mx, an };
  const k = nm - 1;
  $('#reg-values').innerHTML = `<dl class="vals">
    <dt>${t('reg_cells')}</dt><dd>${cells}</dd>
    <dt>${t('reg_mean')}</dt><dd><b>${fmtNum(mean[k], 2)} °C</b> <span class="muted">${fmtStamp(meta.stamps[k])}</span></dd>
    <dt>${t('reg_max')}</dt><dd><b>${fmtNum(mx[k], 2)} °C</b></dd>
    <dt>${t('reg_anom')}</dt><dd><b class="${an[k] >= 0 ? 'warm' : 'cold'}">${an[k] >= 0 ? '+' : ''}${fmtNum(an[k], 2)} °C</b> <span class="muted">${t('clim_base')} ${manifest.climatology.years.join('–')}</span></dd>
  </dl>`;
  if (!regionChart) regionChart = new LineChart($('#reg-chart'));
  drawRegionChart();
}

function drawRegionChart() {
  const r = ui.regionSeries;
  if (!r || !regionChart) return;
  const anom = $('#reg-anom').checked;
  regionChart.set(anom
    ? [{ label: t('reg_anom'), color: 'var(--oe-warm)', x: r.x, y: r.an }]
    : [{ label: t('reg_mean'), color: 'var(--oe-a)', x: r.x, y: r.mean }, { label: t('reg_max'), color: 'var(--oe-warm)', x: r.x, y: r.mx, dash: '3 2' }],
  { zero: anom });
  regionChart.setMarker(timeline.year);
}

// ── barra del tempo ────────────────────────────────────────────────────────
// ── serie salvata nel browser ─────────────────────────────────────────────
// I file che servono alla riproduzione di un istante: anteprime di temperatura
// e correnti, piu' il Mediterraneo (gia' leggero) col passo giornaliero.
function playFiles(f) {
  const tier = timeline.tierName, out = [];
  const usePrev = manifest.preview && manifest.preview.available;
  for (const v of [sstVar(f), 'cur']) {
    if (f[v] != null) out.push([v, usePrev ? store.previewPath(tier, v, f.t) : store.framePath(tier, v, f.t)]);
  }
  if (ui.med && tier === 'daily' && f.med != null) out.push(['med', store.framePath(tier, 'med', f.t)]);
  return out;
}

function playRange() {
  return timeline.loop ? timeline.loop : [0, timeline.frames.length - 1];
}

// quanto manca da scaricare per vedere l'intervallo senza attese
function missing() {
  const [i0, i1] = playRange();
  const sizes = (manifest.preview.bytes || {})[timeline.tierName] || {};
  const files = [];
  let bytes = 0;
  for (let i = i0; i <= i1; i++) {
    for (const [v, path] of playFiles(timeline.frames[i])) {
      if (store.saved.has(path)) continue;
      files.push(path);
      bytes += sizes[v] || 300e3;
    }
  }
  return { files, bytes, frames: i1 - i0 + 1 };
}

const fmtMB = (b) => b >= 1e9 ? fmtNum(b / 1e9, 1) + ' GB' : Math.max(1, Math.round(b / 1e6)) + ' MB';

let dl = null;                           // scaricamento in corso
function syncDownload() {
  const btn = $('#dl');
  if (!btn || !timeline) return;
  if (!store.cacheNames) { btn.hidden = true; return; }
  if (dl) {
    btn.textContent = t('dl_stop');
    $('#dl-info').textContent = `${dl.done}/${dl.total} · ${fmtMB(dl.bytes)}`;
    return;
  }
  const m = missing();
  btn.hidden = m.files.length === 0;
  btn.textContent = `${t('dl_btn')} (${fmtMB(m.bytes)})`;
  btn.title = t('dl_title');
  $('#dl-info').textContent = m.files.length === 0 ? t('dl_done') : '';
}

async function startDownload() {
  if (dl) { dl.stop = true; return; }
  const m = missing();
  if (!m.files.length) return;
  // spazio: se non basta lo si dice prima di cominciare
  try {
    const est = await navigator.storage.estimate();
    if (est.quota && est.quota - est.usage < m.bytes * 1.1) { note(t('dl_quota').replace('{n}', fmtMB(est.quota - est.usage))); return; }
    // chiedere di non cancellare i dati alla prima pulizia del browser
    if (navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch (e) { /* senza stima si prova lo stesso */ }
  const job = dl = { done: 0, total: m.files.length, bytes: 0, stop: false };
  const queue = m.files.slice();
  // si comincia da dove si e' adesso, poi il resto dell'intervallo
  const here = playFiles(timeline.frameA).map((x) => x[1]);
  queue.sort((a, b) => here.includes(b) - here.includes(a));
  const sizes = (manifest.preview.bytes || {})[timeline.tierName] || {};
  let failed = 0;
  const worker = async () => {
    while (queue.length && !job.stop) {
      const path = queue.shift();
      try { await store.store(path); } catch (e) { failed++; }
      job.done++;
      job.bytes += sizes[path.split('/').at(-2)] || 0;
      syncDownload();
    }
  };
  syncDownload();
  await Promise.all([1, 2, 3, 4].map(worker));
  dl = null;
  if (failed) note(t('dl_failed').replace('{n}', failed));
  syncDownload();
  drawSaved();
}

// barra sotto la timeline: quali istanti sono gia' nel browser
let savedRaf = 0;
function drawSaved() {
  if (savedRaf) return;
  savedRaf = requestAnimationFrame(() => {
    savedRaf = 0;
    const cv = $('#saved-bar');
    if (!cv || !timeline || !timeline.frames.length) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(cv.clientWidth * dpr)), h = Math.max(1, Math.round(cv.clientHeight * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = getComputedStyle(cv).color;
    const n = timeline.frames.length;
    const cw = w / n;
    let run = -1;
    for (let i = 0; i <= n; i++) {
      const ok = i < n && playFiles(timeline.frames[i]).every(([, p]) => store.saved.has(p));
      if (ok && run < 0) run = i;
      if (!ok && run >= 0) { ctx.fillRect(Math.floor(run * cw), 0, Math.max(1, Math.ceil((i - run) * cw)), h); run = -1; }
    }
    if (!dl) syncDownload();
  });
}

function buildTimeUI() {
  const tierSel = $('#tier');
  tierSel.replaceChildren(...timeline.tiers.map((k) => {
    const o = document.createElement('option');
    o.value = k;
    const tr = manifest.tiers[k];
    o.textContent = `${t('tier_' + k)} · ${tr.first.slice(0, 4)}–${tr.last.slice(0, 4)}`;
    return o;
  }));
}

function syncTimeUI(full) {
  const n = timeline.frames.length;
  const slider = $('#slider');
  if (full) {
    $('#tier').value = timeline.tierName;
    slider.max = n - 1;
    const years = [...new Set(timeline.frames.map((f) => f.t.slice(0, 4)))];
    for (const id of ['#loop-from', '#loop-to']) {
      const sel = $(id);
      sel.replaceChildren(...years.map((y) => { const o = document.createElement('option'); o.value = o.textContent = y; return o; }));
    }
    $('#loop-from').value = (timeline.loop ? timeline.frames[timeline.loop[0]] : timeline.frames[0]).t.slice(0, 4);
    $('#loop-to').value = (timeline.loop ? timeline.frames[timeline.loop[1]] : timeline.frames[n - 1]).t.slice(0, 4);
    const di = $('#date');
    const tier = timeline.tierName;
    di.type = tier === 'monthly' ? 'month' : tier === 'daily' ? 'date' : 'datetime-local';
    const conv = (s) => tier === 'hourly' ? s.slice(0, 13) + ':00' : s;
    di.min = conv(timeline.frames[0].t);
    di.max = conv(timeline.frames[n - 1].t);
    di.step = tier === 'hourly' ? 3600 : 1;
    $('#loop-chk').checked = !!timeline.loop;
    $('#loop-range').hidden = !timeline.loop;
    const track = $('#loop-track');
    if (timeline.loop) {
      track.hidden = false;
      track.style.left = (timeline.loop[0] / Math.max(1, n - 1) * 100) + '%';
      track.style.width = ((timeline.loop[1] - timeline.loop[0]) / Math.max(1, n - 1) * 100) + '%';
    } else track.hidden = true;
  }
  slider.value = timeline.pos;
  const A = timeline.frameA;
  const behind = lastBehind && current;
  $('#now').classList.toggle('pending', !!behind);
  $('#now').title = behind ? `${t('on_globe')}: ${fmtStamp(current.A.t)}` : '';
  $('#now').innerHTML = timeline.interpolated
    ? `${fmtStamp(A.t)} <span class="interp" title="${t('interpolated')}">→ ${fmtStamp(timeline.frameB.t)}</span>`
    : fmtStamp(A.t);
  const di = $('#date');
  if (document.activeElement !== di) di.value = timeline.tierName === 'hourly' ? A.t.slice(0, 13) + ':00' : A.t;
  $('#play').classList.toggle('on', timeline.playing);
  $('#play').title = t(timeline.playing ? 'pause' : 'play');
  $('#play').setAttribute('aria-label', $('#play').title);
  $('#mini-now').textContent = fmtStamp(A.t);
}

function updateStatus() {
  if (!current) return;
  const sS = store.source(current.A[current.svA]);
  const sC = store.source(current.A.cur);
  const notes = [];
  if (current.missing) notes.push(t('frame_missing'));
  if ((globe.state.layers.anom > 0 || globe.state.hotspot) && globe.state.biasW > 0) notes.push(t('bias_note'));
  if (timeline.tierName === 'daily' && ui.source === 'ostia') {
    if (globe.state.layers.anom > 0) notes.push(t('anom_uses_model'));
    else if (current.svA !== 'ostia') notes.push(t('ostia_missing'));
  }
  const parts = [];
  if (sS) parts.push(`<b>${t('temp')}</b> ${sS.name} <span class="muted">(${t(sS.kind)}, ${freqLabel(sS)}, ${sS.res})</span>`);
  if (sC) parts.push(`<b>${t('cur_speed')}</b> ${sC.name} <span class="muted">(${t(sC.kind)}, ${freqLabel(sC)}, ${sC.res})</span>`);
  if (current.mA && globe.state.layers.sst > 0) {
    const m = store.source(current.A.med);
    if (m) parts.push(`<b>${t('med_hi')}</b> ${m.name} <span class="muted">(${t(m.kind)}, ${freqLabel(m)}, ${m.res})</span>`);
  }
  parts.push(timeline.interpolated ? `<span class="interp">${t('interpolated')}</span>` : `<span class="orig">${t('original')}</span>`);
  if (current.preview) parts.push(`<span class="muted">${t('preview_note')}</span>`);
  $('#status').innerHTML = parts.join(' · ') + (notes.length ? ` · <span class="warn">${notes.join(' · ')}</span>` : '');
}

// ── controlli ──────────────────────────────────────────────────────────────
function bindControls() {
  const st = globe.state;
  $('#tier').addEventListener('change', (e) => timeline.setTier(e.target.value));
  $('#slider').addEventListener('input', (e) => {
    if (timeline.playing) timeline.pause();
    timeline.seek(Math.round(+e.target.value));
  });
  $('#play').addEventListener('click', () => (timeline.playing ? timeline.pause() : timeline.play()));
  $('#mini-play').addEventListener('click', () => timeline.pause());
  // col mouse sul bordo alto le barre tornano visibili anche in play (in basso
  // c'e' gia' la pillola con la pausa: farla sparire sotto il mouse la renderebbe
  // impossibile da cliccare)
  let peekOff = 0;
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !document.body.classList.contains('immersive')) return;
    const near = e.clientY < 72 || (document.body.classList.contains('peek') && e.clientY < innerHeight - 8 && e.target.closest('.top, .time'));
    clearTimeout(peekOff);
    if (near) document.body.classList.add('peek');
    else peekOff = setTimeout(() => document.body.classList.remove('peek'), 600);
  });
  $('#dl').addEventListener('click', startDownload);
  window.addEventListener('resize', drawSaved);
  $('#back').addEventListener('click', () => { timeline.pause(); timeline.step(-1); });
  $('#fwd').addEventListener('click', () => { timeline.pause(); timeline.step(1); });
  $('#first').addEventListener('click', () => { timeline.pause(); timeline.seek(timeline.loop ? timeline.loop[0] : 0); });
  $('#last').addEventListener('click', () => { timeline.pause(); timeline.seek(timeline.loop ? timeline.loop[1] : timeline.frames.length - 1); });
  $('#fps').addEventListener('change', (e) => { timeline.fps = +e.target.value; });
  $('#date').addEventListener('change', (e) => {
    const v = e.target.value;
    if (!v) return;
    const key = timeline.tierName === 'hourly' ? v.slice(0, 13).replace(' ', 'T') : v;
    timeline.pause();
    timeline.seek(timeline.nearest(stampToYear(key)));
  });
  const applyLoop = () => {
    if (!$('#loop-chk').checked) { timeline.setLoop(null); return; }
    const a = $('#loop-from').value, b = $('#loop-to').value;
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const i0 = timeline.findStamp(String(lo));
    let i1 = -1;
    for (let i = timeline.frames.length - 1; i >= 0; i--) if (timeline.frames[i].t.startsWith(String(hi))) { i1 = i; break; }
    if (i0 >= 0 && i1 >= i0) timeline.setLoop([i0, i1]);
  };
  $('#loop-chk').addEventListener('change', applyLoop);
  $('#loop-from').addEventListener('change', () => { $('#loop-chk').checked = true; applyLoop(); });
  $('#loop-to').addEventListener('change', () => { $('#loop-chk').checked = true; applyLoop(); });
  $('#loop-year').addEventListener('click', () => {
    const y = timeline.frameA.t.slice(0, 4);
    $('#loop-from').value = y; $('#loop-to').value = y; $('#loop-chk').checked = true;
    applyLoop();
    timeline.play();
  });

  // livelli
  $$('.quick-mode button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  bindMixer();
  try {
    const saved = JSON.parse(localStorage.getItem('oe-layers') || 'null');
    if (saved && LAYERS.every((k) => typeof saved[k] === 'number' && saved[k] >= 0 && saved[k] <= 1)) setLayers(saved);
  } catch (e) { /* niente */ }
  $('#particles').addEventListener('change', (e) => { st.particles = e.target.checked; drawLegend(); });
  $('#arrows').addEventListener('change', (e) => { st.arrows = e.target.checked; drawLegend(); });
  $('#coast').addEventListener('change', (e) => { st.coast = e.target.checked; });
  $('#hotspot').addEventListener('change', (e) => { st.hotspot = e.target.checked; if (st.hotspot) loadMonthly('p90'); drawLegend(); });
  $$('input[name=source]').forEach((r) => r.addEventListener('change', () => { ui.source = r.value; onTime('source'); }));
  $('#med-hi').addEventListener('change', (e) => { ui.med = e.target.checked; onTime('source'); });
  $('#p-count').addEventListener('change', (e) => { st.particleCount = +e.target.value; globe.resetParticles(); });
  $('#p-speed').addEventListener('input', (e) => { st.particleSpeed = +e.target.value; });
  $('#p-width').addEventListener('input', (e) => { st.particleWidth = +e.target.value; });
  $('#a-density').addEventListener('input', (e) => { st.arrowDensity = +e.target.value; });
  $('#palette').addEventListener('change', (e) => { st.paletteSst = e.target.value; globe.setPalette('sst', e.target.value); drawLegend(); });
  $('#opacity').addEventListener('input', (e) => { st.opacity = +e.target.value; });
  const ranges = () => {
    const lo = parseFloat($('#r-min').value), hi = parseFloat($('#r-max').value);
    if (!(hi > lo)) return;
    if (ui.mode === 'anom') st.rangeAnom = [lo, hi];
    else if (ui.mode === 'speed') st.rangeSpeed = [lo, hi];
    else st.rangeSst = [lo, hi];
    drawLegend();
  };
  $('#r-auto').addEventListener('click', autoRange);
  $('#r-min').addEventListener('change', ranges);
  $('#r-max').addEventListener('change', ranges);

  // strumenti
  $('#med-btn').addEventListener('click', () => flyTo(38.3, 17.5, 1.42));
  $('#med-hi-row').hidden = !(manifest.regional && manifest.regional.med);
  $('#world-btn').addEventListener('click', () => flyTo(20, camera.lon, matchMedia('(max-width: 720px)').matches ? 2.7 : 3.2));
  $('#region-btn').addEventListener('click', () => {
    ui.regionMode = !ui.regionMode;
    $('#region-btn').classList.toggle('on', ui.regionMode);
    globe.canvas.classList.toggle('crosshair', ui.regionMode);
    if (ui.regionMode) note(t('region_hint'));
  });
  $('#reg-anom').addEventListener('change', drawRegionChart);
  $('#reg-close').addEventListener('click', () => { $('#region').hidden = true; ui.region = null; globe.setRegion(null); });
  $('#cmp-chk').addEventListener('change', (e) => {
    ui.compare = e.target.checked;
    $('#cmp-row').hidden = !ui.compare;
    $('#cmp-split').hidden = !ui.compare;
    if (ui.compare && ui.compareIndex == null) ui.compareIndex = 0;
    buildCompareUI();
    applyCompare();
  });
  $('#cmp-slider').addEventListener('input', (e) => { ui.compareIndex = +e.target.value; applyCompare(); });
  bindSplit();

  // pannello del punto
  $('#info-close').addEventListener('click', () => {
    $('#info').hidden = true;
    ui.point = ui.pointB = null;
    ui.picking = null;
    $('#pick-b').classList.remove('on');
    $('#pick-b').textContent = t('compare_point');
  });
  $('#pick-b').addEventListener('click', () => {
    if (ui.pointB) { ui.pointB = null; $('#pick-b').textContent = t('compare_point'); refreshPoint(); loadSeries(); return; }
    ui.picking = 'second';
    $('#pick-b').classList.add('on');
    note(t('pick_second'));
  });
  $('#pt-anom').addEventListener('change', (e) => { showAnomSeries = e.target.checked; loadClim(); loadSeries(); });
  $('#pt-reset').addEventListener('click', () => pointChart && pointChart.setRange(null));

  // barra in alto
  $('#about-btn').addEventListener('click', () => $('#about').showModal());
  $('#about-close').addEventListener('click', () => $('#about').close());
  $('#side-btn').addEventListener('click', () => document.body.classList.toggle('side-open'));
  const langSel = $('#lang-sel');
  // codici brevi come nel selettore del sito: sul telefono il nome intero
  // spingeva fuori i pulsanti delle modalita'
  langSel.replaceChildren(...LANGS.map((l) => Object.assign(new Option(l === 'zh' ? '中文' : l.toUpperCase(), l), { title: LANG_NAMES[l] })));
  langSel.value = LANG;
  langSel.addEventListener('change', () => {
    setLang(langSel.value);
    // la stessa scelta vale per il sito: stessa chiave e stesso cookie della home
    try { localStorage.setItem('lingua', LANG); } catch (e) { /* niente */ }
    try { document.cookie = `lingua=${LANG}; path=/; max-age=31536000; SameSite=Lax`; } catch (e) { /* niente */ }
    $('#back-link').href = siteHome();
    buildTimeUI(); syncTimeUI(true); updateStatus(); refreshPoint(); drawLegend(); buildAbout(); loadSeries();
    if (ui.region && !$('#region').hidden) regionStats();
    if (ui.compare) applyCompare();
  });
  $('#back-link').href = siteHome();
  syncModeButtons();
  drawLegend();
}

// scala adattata a quello che si vede: 2° e 98° percentile dei valori
// nella calotta inquadrata (temperatura, anomalia o velocita')
function autoRange() {
  if (!current) return;
  const g = manifest.grid, st = globe.state;
  const R = Math.min(90, camera.viewRadiusDeg);
  const vals = [];
  const stepDeg = Math.max(g.step, R / 60);
  const medG = manifest.regional && manifest.regional.med;
  for (let lat = Math.max(-89.9, camera.lat - R); lat <= Math.min(89.9, camera.lat + R); lat += stepDeg) {
    const span = Math.min(180, R / Math.max(0.05, Math.cos(lat * DEG)));
    for (let dl = -span; dl <= span; dl += stepDeg / Math.max(0.05, Math.cos(lat * DEG))) {
      const lon = wrapLon(camera.lon + dl);
      if (!camera.project(lat, lon)) continue;
      const pv = pointValues({ lat, lon });
      const v = ui.mode === 'anom' ? pv.anom : ui.mode === 'speed' ? pv.speed : pv.sst;
      if (Number.isFinite(v)) vals.push(v);
    }
  }
  if (vals.length < 10) return;
  vals.sort((a, b) => a - b);
  let lo = vals[Math.floor(vals.length * 0.02)], hi = vals[Math.ceil(vals.length * 0.98) - 1];
  if (ui.mode === 'anom') { const m = Math.max(Math.abs(lo), Math.abs(hi)); lo = -m; hi = m; }
  if (ui.mode === 'speed') lo = 0;
  const r = (x) => Math.round(x * 10) / 10;
  lo = r(lo); hi = Math.max(r(hi), lo + 0.1);
  if (ui.mode === 'anom') st.rangeAnom = [lo, hi];
  else if (ui.mode === 'speed') st.rangeSpeed = [lo, hi];
  else st.rangeSst = [lo, hi];
  syncModeButtons();
  drawLegend();
}

// I tre livelli si sommano con un peso ciascuno (legenda = mixer). I pulsanti
// in alto sono scorciatoie: un livello solo, oppure "Mix" con tutti e tre.
const PRESETS = {
  sst: { sst: 1, anom: 0, speed: 0 }, anom: { sst: 0, anom: 1, speed: 0 },
  speed: { sst: 0, anom: 0, speed: 1 }, mix: { sst: 1, anom: 0.7, speed: 0.6 },
};
const LAYERS = ['sst', 'anom', 'speed'];
function setMode(mode) { setLayers(PRESETS[mode]); drawLegend(); }

function setLayers(w) {
  const st = globe.state, before = { ...st.layers };
  st.layers = { ...st.layers, ...w };
  // livello principale: il piu' pesante (a parita' temperatura, poi anomalia)
  const top = LAYERS.reduce((a, k) => (st.layers[k] > st.layers[a] ? k : a), 'sst');
  const changedMain = top !== ui.mode;
  ui.mode = top;
  if (st.layers.anom > 0 && !globe.hasClim) { note(t('loading')); loadClim(); }
  try { localStorage.setItem('oe-layers', JSON.stringify(st.layers)); } catch (e) { /* niente */ }
  syncModeButtons();
  // quale file serve (OSTIA, Mediterraneo) dipende da quali livelli sono accesi
  const on = (o) => LAYERS.map((k) => o[k] > 0).join();
  if (!current) return;               // all'avvio: i fotogrammi non ci sono ancora
  if (on(before) !== on(st.layers)) onTime('source');
  else if (changedMain) refreshPoint();
}

function syncModeButtons() {
  const L = globe.state.layers, n = LAYERS.filter((k) => L[k] > 0).length;
  $$('.quick-mode button').forEach((b) => b.classList.toggle('on', b.dataset.mode === 'mix' ? n > 1 : n === 1 && L[b.dataset.mode] > 0));
  const st = globe.state;
  const r = ui.mode === 'anom' ? st.rangeAnom : ui.mode === 'speed' ? st.rangeSpeed : st.rangeSst;
  $('#r-min').value = r[0];
  $('#r-max').value = r[1];
  $('#palette-row').hidden = !(st.layers.sst > 0);
}

function buildCompareUI() {
  const s = $('#cmp-slider');
  s.max = timeline.frames.length - 1;
  s.value = ui.compareIndex ?? 0;
}

function bindSplit() {
  const h = $('#cmp-split');
  let drag = false;
  h.addEventListener('pointerdown', (e) => { drag = true; h.setPointerCapture(e.pointerId); });
  h.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = globe.canvas.getBoundingClientRect();
    globe.state.split = Math.min(0.95, Math.max(0.05, (e.clientX - r.left) / r.width));
    h.style.left = (globe.state.split * 100) + '%';
  });
  h.addEventListener('pointerup', () => { drag = false; });
}

function drawLegend() {
  const st = globe.state;
  const L = [];
  const scale = (pal, lo, hi, digits) => {
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => `<span style="left:${f * 100}%">${fmtNum(lo + (hi - lo) * f, digits)}</span>`).join('');
    return `<div class="lg-bar" style="background:${cssGradient(pal)}"></div><div class="lg-ticks">${ticks}</div>`;
  };
  // ogni scala ha il suo cursore: la legenda e' anche il mixer dei livelli
  const row = (k, title, pal, lo, hi, digits) => {
    const w = Math.round(st.layers[k] * 100);
    L.push(`<div class="lg mx${w ? '' : ' off'}" data-layer="${k}">
      <label class="mx-head"><span class="lg-t">${title}</span><input type="range" min="0" max="100" step="5" value="${w}" aria-label="${title}"><output>${w}%</output></label>
      <div class="mx-scale">${scale(pal, lo, hi, digits)}</div></div>`);
  };
  row('sst', t('sst_label'), st.paletteSst, st.rangeSst[0], st.rangeSst[1], 0);
  row('anom', `${t('anom_label')} ${manifest ? manifest.climatology.years.join('–') : '1993–2020'}`, 'anomaly', st.rangeAnom[0], st.rangeAnom[1], 1);
  row('speed', t('speed_label'), 'speedField', st.rangeSpeed[0], st.rangeSpeed[1], 1);
  if ((st.particles || st.arrows) && !(st.layers.speed > 0)) L.push(`<div class="lg"><div class="lg-t">${t('particles')} · ${t('speed_label')}</div>${scale('speed', st.rangeSpeed[0], st.rangeSpeed[1], 1)}</div>`);
  if (st.hotspot) L.push(`<div class="lg"><span class="hatch"></span> ${t('hotspot')}</div>`);
  $('#legend').innerHTML = L.join('');
}

function bindMixer() {
  // la legenda si ridisegna spesso: un solo ascoltatore sul contenitore
  $('#legend').addEventListener('input', (e) => {
    const r = e.target.closest('.mx input[type=range]');
    if (!r) return;
    const row = r.closest('.mx'), k = row.dataset.layer, v = +r.value / 100;
    row.classList.toggle('off', v === 0);
    row.querySelector('output').textContent = `${r.value}%`;
    setLayers({ [k]: v });
  });
  // a cursore rilasciato la legenda si aggiorna (scala delle particelle, ecc.)
  $('#legend').addEventListener('change', (e) => { if (e.target.closest('.mx')) drawLegend(); });
}

function buildAbout() {
  if (!manifest) return;
  const rows = manifest.sources.map((s) => `<tr><td><a href="https://data.marine.copernicus.eu/product/${s.product}/description" target="_blank" rel="noopener">${s.product}</a><br><code>${s.id}</code></td><td>${s.name}</td><td>${t(s.kind)}</td><td>${freqLabel(s)}</td><td>${s.res}</td><td>${s.doi ? `<a href="https://doi.org/${s.doi}" target="_blank" rel="noopener">${s.doi}</a>` : ''}</td></tr>`).join('');
  const tiers = Object.entries(manifest.tiers).map(([k, v]) => `<li><b>${t('tier_' + k)}</b>: ${fmtStamp(v.first)} → ${fmtStamp(v.last)} (${v.frames.length})</li>`).join('');
  $('#about-sources').innerHTML = `<table><thead><tr><th>Copernicus</th><th></th><th></th><th></th><th></th><th>DOI</th></tr></thead><tbody>${rows}</tbody></table>`;
  $('#about-tiers').innerHTML = tiers;
  $('#about-updated').textContent = manifest.generated;
}

start();
