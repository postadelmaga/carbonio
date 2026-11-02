// Modello del progetto e tempi del reel.
//
// Due tracce, come in un programma di montaggio:
//   V1 · Globo   clip una dopo l'altra, senza buchi: la loro somma e' la durata del reel
//   A1 · Musica  un brano tagliato in pezzi (segmenti): ognuno ha la sua posizione
//                sulla timeline (offset), il punto d'ingresso e d'uscita nel file
//                (in, out), la velocita' (rate: allungato o accorciato senza cambiare
//                l'intonazione), volume e dissolvenze
// I battiti si trovano nel brano (secondi del file) e si portano sulla timeline
// attraverso i segmenti.

export const W = 1080, H = 1920;

export const VIEWS = ['sst', 'anom', 'speed', 'sla', 'ice', 'mix', 'rain', 'drought', 'co2', 'emis'];
export const DOMAIN = { sst: 'sea', anom: 'sea', speed: 'sea', sla: 'sea', ice: 'sea', mix: 'sea', rain: 'land', drought: 'land', co2: 'air', emis: 'air' };
// dati che servono a ogni vista (per sapere da quando a quando esistono)
export const NEEDS = { sst: ['sst'], anom: ['sst'], speed: ['cur'], sla: ['sla'], ice: ['ice'], mix: ['sst', 'cur'], rain: ['precip', 'sst'], drought: ['soil', 'sst'], co2: ['co2'], emis: ['co2foss', 'co2nat'] };
// righe della legenda nel video
export const LEGEND = { sst: ['sst'], anom: ['anom'], speed: ['speed'], sla: ['sla'], ice: ['ice'], mix: ['anom'], rain: ['land'], drought: ['land'], co2: ['co2'], emis: ['flux'] };
// colori delle clip nella timeline (le scale dell'atlante)
export const PALETTE_OF = { sst: 'thermal', anom: 'anomaly', speed: 'speedField', sla: 'sla', ice: null, mix: 'anomaly', rain: 'precip', drought: 'precip', co2: 'co2', emis: 'flux' };
export const SEA_PARTICLES = ['sst', 'anom', 'speed', 'mix', 'sla', 'ice'];

export function newClip(over = {}) {
  return {
    view: 'co2', variant: 0, from: '1993-01', to: '2025-12', dur: 8, sync: 'beat', hold: 1, spin: 5, fade: 0, particles: false, caption: '',
    cam0: { lon: 10, lat: 35, dist: 3.3 }, cam1: { lon: 10, lat: 35, dist: 3.3 }, ...over,
  };
}

export function defaultProject(lang = 'it') {
  return {
    version: 3, title: 'ATLANTE DEL CLIMA', lang, fps: 60, rate: 20, globeY: 160, legendScale: 100,
    fadeIn: 0.6, fadeOut: 2.5, snap: 'bar', safe: false,
    overlay: { date: true, legend: true, caption: true, credits: true },
    video: [newClip({ dur: 24, hold: 1.5 })],
    audio: null,
  };
}

export function newSeg(over = {}) {
  return { offset: 0, in: 0, out: 10, rate: 1, gain: 1, fadeIn: 0, fadeOut: 0, ...over };
}
export function newAudio(name, duration) {
  return { name, gain: 1, mode: 'detected', bpm: 120, gridOff: 0, barOff: 0, meter: 4, mute: false, det: null, clips: [newSeg({ out: duration, fadeOut: 2.5 })] };
}
// brano con un solo pezzo (progetti di prima) → segmenti
function segAudio(a) {
  if (!a || Array.isArray(a.clips)) return a;
  const { offset = 0, in: i = 0, out = 10, fadeIn = 0, fadeOut = 2.5, ...rest } = a;
  return { ...rest, clips: [newSeg({ offset, in: i, out, fadeIn, fadeOut })] };
}

// progetti dell'editor di prima (una sola lista di clip e un brano tagliato
// da "start" per la durata del reel)
export function migrate(p) {
  if (!p) return null;
  if (p.version === 3 && Array.isArray(p.video)) return p;
  // versione 2: un solo pezzo di brano; i video passano a 60 fotogrammi al secondo
  if (p.version === 2 && Array.isArray(p.video)) return { ...p, version: 3, fps: 60, rate: Math.max(p.rate || 14, 20), audio: segAudio(p.audio) };
  if (p.version !== 1 || !Array.isArray(p.clips)) return null;
  const T = p.clips.reduce((s, c) => s + c.dur, 0);
  const d = defaultProject(p.lang);
  const s = p.song || {};
  return {
    ...d, title: p.title ?? d.title, lang: p.lang ?? d.lang, globeY: p.globeY ?? d.globeY,
    legendScale: p.legendScale ?? 100, overlay: { ...d.overlay, ...p.overlay }, safe: !!p.safe,
    fadeIn: s.fadeIn ?? d.fadeIn, fadeOut: s.fadeOut ?? d.fadeOut, snap: s.snap === 'none' ? 'off' : s.snap || 'bar',
    video: p.clips.map((c) => newClip(c)),
    audio: s.name ? { ...newAudio(s.name, (s.start || 0) + T), clips: [newSeg({ in: s.start || 0, out: (s.start || 0) + T, fadeOut: s.fadeOut ?? 2.5 })],
      mode: s.mode || 'detected', bpm: s.bpm || 120, gridOff: s.gridOff || 0, barOff: s.barOff || 0, meter: s.meter || 4, det: s.det || null } : null,
  };
}

// ── stato condiviso ────────────────────────────────────────────────────────
export const S = {
  P: null,
  sel: null,            // { kind: 'v', i } | { kind: 'a', i } | null
  song: { buffer: null, peaks: null, name: '', detected: [], trimAuto: null },
  t: 0,                 // istante del reel mostrato
  playing: false,
  tool: 'v',            // strumento della timeline: v selezione, c lama, r allunga, y scorri
};

// ── tempi della traccia video ──────────────────────────────────────────────
export const total = () => S.P.video.reduce((s, c) => s + c.dur, 0);
export function clipStart(i) { let s = 0; for (let k = 0; k < i; k++) s += S.P.video[k].dur; return s; }
export function clipAt(t) {
  const V = S.P.video;
  if (!V.length) return null;
  let s = 0;
  for (let i = 0; i < V.length; i++) {
    const c = V[i];
    if (t < s + c.dur || i === V.length - 1) return { c, i, t0: s, lt: Math.max(0, Math.min(t - s, c.dur)) };
    s += c.dur;
  }
}

// ── brano sulla timeline ───────────────────────────────────────────────────
export const segs = () => S.P.audio?.clips || [];
export const segLen = (c) => Math.max(0, c.out - c.in) / (c.rate || 1);
export const segEnd = (c) => c.offset + segLen(c);
export const audioEnd = () => segs().reduce((m, c) => Math.max(m, segEnd(c)), 0);
// istante del reel → secondo del file nel segmento c
export const srcAt = (c, t) => c.in + (t - c.offset) * (c.rate || 1);
// il segmento che suona all'istante t (l'ultimo messo, se si sovrappongono)
export function segAt(t) {
  const C = segs();
  for (let i = C.length - 1; i >= 0; i--) if (t >= C[i].offset - 1e-6 && t <= segEnd(C[i]) + 1e-6) return i;
  return -1;
}
// battiti nel file: rilevati o griglia fissa
export function srcBeats() {
  const A = S.P.audio;
  if (!A) return [];
  if (A.mode === 'detected' && S.song.detected.length) return S.song.detected;
  const dur = S.song.buffer ? S.song.buffer.duration : Math.max(...A.clips.map((c) => c.out), 10), step = 60 / A.bpm, out = [];
  for (let b = A.gridOff; b < dur; b += step) out.push(b);
  return out;
}
export function isBarIdx(k) { const A = S.P.audio, m = A?.meter || 4; return (((k - (A?.barOff || 0)) % m) + m) % m === 0; }
// battute del file (secondi)
export const srcBars = () => srcBeats().filter((_, k) => isBarIdx(k));
// battiti sulla timeline, dentro i segmenti: { t, bar, n, s } (n = numero della
// battuta da 1 lungo il reel, s = segmento)
export function tlBeats() {
  const A = S.P.audio;
  if (!A) return [];
  const src = srcBeats(), out = [];
  A.clips.forEach((c, si) => {
    src.forEach((b, k) => {
      if (b < c.in - 1e-4 || b > c.out + 1e-4) return;
      out.push({ t: c.offset + (b - c.in) / (c.rate || 1), bar: isBarIdx(k), s: si });
    });
  });
  out.sort((a, b) => a.t - b.t);
  // segmenti che si toccano: un battito solo sul confine
  const ded = [];
  for (const b of out) {
    const p = ded[ded.length - 1];
    if (p && b.t - p.t < 0.03) { p.bar = p.bar || b.bar; continue; }
    ded.push({ ...b });
  }
  let n = 0;
  for (const b of ded) { if (b.bar) n++; b.n = n; }
  return ded;
}

// punti a cui si aggancia un bordo trascinato: { t, kind } con kind
// 'b' confine fra clip (e fine del reel), 'a' inizio o fine del brano,
// 'beat' battito o battuta, 'p' indicatore, '0' inizio
export function snapPoints() {
  const pts = [{ t: 0, kind: '0' }, { t: S.t, kind: 'p' }];
  let s = 0;
  for (const c of S.P.video) { s += c.dur; pts.push({ t: s, kind: 'b' }); }
  segs().forEach((c, s) => pts.push({ t: c.offset, kind: 'a', s }, { t: segEnd(c), kind: 'a', s }));
  if (S.P.snap !== 'off') for (const b of tlBeats()) if (S.P.snap === 'beat' || b.bar) pts.push({ t: b.t, kind: 'beat', s: b.s });
  return pts;
}
export function snapTo(t, tol, pts) {
  let best = t, bd = tol;
  for (const p of pts) { const d = Math.abs(p.t - t); if (d < bd) { bd = d; best = p.t; } }
  return best;
}

// quanto del suo intervallo di mesi ha percorso la clip (0…1)
export function progressIn(c, t0, lt) {
  const active = Math.max(0.05, c.dur - c.hold);
  if (lt >= active) return 1;
  if (c.sync === 'linear' || !S.P.audio) return lt / active;
  // tra un battito e l'altro lo stesso numero di mesi: segue anche un tempo che oscilla
  const bs = tlBeats().map((b) => b.t).filter((b) => b > t0 + 0.04 && b < t0 + active - 0.04).map((b) => b - t0);
  if (!bs.length) return lt / active;
  const g = [0, ...bs, active];
  let k = 0;
  while (k < g.length - 2 && g[k + 1] <= lt) k++;
  return (k + (lt - g[k]) / (g[k + 1] - g[k])) / (g.length - 1);
}

const smooth = (x) => x * x * (3 - 2 * x);
export const wrapLon = (l) => ((((l + 180) % 360) + 360) % 360) - 180;
export function camAt(c, lt) {
  const e = smooth(Math.min(1, lt / Math.max(0.01, c.dur)));
  const d = ((c.cam1.lon - c.cam0.lon + 540) % 360) - 180;
  return { lon: c.cam0.lon + d * e + c.spin * lt, lat: c.cam0.lat + (c.cam1.lat - c.cam0.lat) * e, dist: c.cam0.dist + (c.cam1.dist - c.cam0.dist) * e };
}

// nero: inizio e fine del reel, e attorno agli stacchi fra le clip
export function blackAt(t) {
  const T = total(), P = S.P;
  let a = 0;
  if (P.fadeIn > 0) a = Math.max(a, 1 - t / P.fadeIn);
  if (P.fadeOut > 0) a = Math.max(a, 1 - (T - t) / P.fadeOut);
  for (let i = 1; i < P.video.length; i++) {
    const f = P.video[i].fade;
    if (!(f > 0)) continue;
    const d = Math.abs(t - clipStart(i));
    if (d < f / 2) a = Math.max(a, 1 - d / (f / 2));
  }
  return Math.max(0, Math.min(1, a));
}

// volume del segmento c all'istante t del reel: volume del brano e del pezzo,
// dissolvenze del pezzo e fine del reel
export function gainAt(c, t) {
  const A = S.P.audio;
  if (!A || A.mute || !c) return 0;
  const u = t - c.offset, len = segLen(c);
  if (u < 0 || u > len) return 0;
  let g = A.gain * (c.gain ?? 1);
  if (c.fadeIn > 0) g *= Math.min(1, u / c.fadeIn);
  if (c.fadeOut > 0) g *= Math.min(1, (len - u) / c.fadeOut);
  const T = total();
  if (S.P.fadeOut > 0 && audioEnd() > T) g *= Math.max(0, Math.min(1, (T - t) / S.P.fadeOut));
  return Math.max(0, g);
}

// ── annulla / ripeti ───────────────────────────────────────────────────────
const undoStack = [], redoStack = [];
export function remember() {
  undoStack.push(JSON.stringify(S.P));
  if (undoStack.length > 80) undoStack.shift();
  redoStack.length = 0;
}
// un comando che alla fine non ha cambiato nulla: via l'ultimo stato salvato
export function forget() { undoStack.pop(); }
export function undo() { if (!undoStack.length) return false; redoStack.push(JSON.stringify(S.P)); S.P = JSON.parse(undoStack.pop()); return true; }
export function redo() { if (!redoStack.length) return false; undoStack.push(JSON.stringify(S.P)); S.P = JSON.parse(redoStack.pop()); return true; }
export const canUndo = () => undoStack.length > 0, canRedo = () => redoStack.length > 0;
