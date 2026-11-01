// La timeline: righello, griglia dei battiti, traccia V1 (globo) e A1 (musica).
//
// V1: clip una dopo l'altra. Bordo destro = allunga o accorcia la clip e sposta
// le seguenti; bordo sinistro = sposta il confine con la clip prima (la durata
// totale non cambia); trascinare il corpo = cambiare l'ordine.
// A1: bordi = tagliare l'inizio o la fine del brano; corpo = spostarlo nel
// tempo; Alt + corpo = scegliere quale parte del brano suona; i pallini in alto
// = dissolvenze.

import { S, total, clipStart, audioLen, audioEnd, tlBeats, snapPoints, snapTo, remember, PALETTE_OF } from './model.js';
import { A } from './atlas.js';
import { cssGradient } from '../app/palettes.js';

const $ = (s) => document.querySelector(s);
let H = {};                 // agganci verso l'app: changed, seek, select, addView, importFile, label
let pps = 40, zoomZ = 0;    // pixel per secondo
const ICE = 'linear-gradient(90deg,#20364a,#b8d6ed 40%,#f7fcff)';
export const viewGradient = (v) => (PALETTE_OF[v] ? cssGradient(PALETTE_OF[v]) : ICE);

const contentLen = () => Math.max(5, total(), audioEnd()) + 2;
function fitPps() { return Math.max(4, ($('#tl-scroll').clientWidth - 20) / contentLen()); }
function updatePps() {
  const lo = fitPps(), hi = 320;
  pps = lo * Math.pow(Math.max(1.0001, hi / lo), zoomZ);
  // le tele non possono superare ~32k px
  pps = Math.min(pps, 30000 / contentLen());
}
const X = (t) => 10 + t * pps;
const T = (x) => (x - 10) / pps;

export function setZoom(z, keepT = S.t) {
  const sc = $('#tl-scroll');
  const before = X(keepT) - sc.scrollLeft;
  zoomZ = Math.max(0, Math.min(1, z));
  $('#zoom').value = zoomZ;
  renderTimeline();
  sc.scrollLeft = Math.max(0, X(keepT) - before);
}

function fmt(t) { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${String(Math.floor(s)).padStart(2, '0')}`; }

// ── disegno ───────────────────────────────────────────────────────────────
export function renderTimeline() {
  updatePps();
  const inner = $('#tl-inner'), sc = $('#tl-scroll');
  const width = Math.max(sc.clientWidth, Math.ceil(X(contentLen())));
  inner.style.width = `${width}px`;
  drawRuler(width);
  drawGrid(width);
  drawVideo();
  drawAudio();
  movePlayhead();
  $('#tl-total').textContent = H.label ? H.label() : '';
}

function canvasFit(c, w, h) {
  const d = Math.min(2, devicePixelRatio || 1);
  const cw = Math.min(32000, Math.round(w * d)), ch = Math.round(h * d);
  if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
  c.style.width = `${w}px`; c.style.height = `${h}px`;
  const g = c.getContext('2d');
  g.setTransform(cw / w, 0, 0, ch / h, 0, 0);
  g.clearRect(0, 0, w, h);
  return g;
}

function drawRuler(width) {
  const c = $('#tl-ruler'), h = 28, g = canvasFit(c, width, h);
  const steps = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
  const step = steps.find((s) => s * pps >= 64) || 60;
  g.fillStyle = '#6f8592'; g.font = '10px "IBM Plex Mono"'; g.textAlign = 'left';
  for (let t = 0; t <= contentLen(); t += step / 4) {
    const major = Math.abs(t / step - Math.round(t / step)) < 1e-6;
    g.fillRect(Math.round(X(t)), major ? h - 10 : h - 5, 1, major ? 10 : 5);
    if (major) g.fillText(step < 1 ? `${fmt(t)}.${String(Math.round((t % 1) * 100)).padStart(2, '0')}` : fmt(t), X(t) + 3, h - 12);
  }
  // numeri delle battute, se c'e' spazio
  let last = -99;
  g.fillStyle = '#ffd666'; g.font = '600 10px "IBM Plex Mono"';
  for (const b of tlBeats()) {
    if (!b.bar || X(b.t) - last < 26) continue;
    g.fillText(String(b.n), X(b.t) + 2, 9);
    g.fillRect(Math.round(X(b.t)), 0, 1, 11);
    last = X(b.t);
  }
  // fine del reel
  g.fillStyle = 'rgba(255,255,255,.5)';
  g.fillRect(Math.round(X(total())), 0, 1, h);
}

function drawGrid(width) {
  const c = $('#tl-grid'), h = $('#lane-v').offsetHeight + $('#lane-a').offsetHeight, g = canvasFit(c, width, h);
  for (const b of tlBeats()) {
    if (!b.bar && pps * 60 / (S.P.audio?.bpm || 120) < 5) continue;   // battiti troppo fitti: solo le battute
    g.fillStyle = b.bar ? 'rgba(255,214,102,.38)' : 'rgba(255,214,102,.12)';
    g.fillRect(Math.round(X(b.t)), 0, 1, h);
  }
  // oltre la fine del reel: in ombra
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.fillRect(X(total()), 0, width - X(total()), h);
}

function variantLabel(c) {
  if (c.view === 'co2') return c.variant ? ' · Δ' : ' · ppm';
  if (c.view === 'emis') return ['', ' · fossili', ' · naturali'][c.variant] || '';
  return '';
}

function drawVideo() {
  const lane = $('#lane-v'), sel = S.sel;
  lane.innerHTML = S.P.video.map((c, i) => {
    const x = X(clipStart(i)), w = c.dur * pps, on = sel?.kind === 'v' && sel.i === i;
    const name = (A.views[c.view]?.name || c.view) + variantLabel(c);
    return `<div class="clip${on ? ' sel' : ''}" data-i="${i}" tabindex="0" style="left:${x}px;width:${Math.max(2, w)}px" title="${name}">
      <div class="bg" style="background:${viewGradient(c.view)}"></div><div class="shade"></div>
      ${c.hold > 0 ? `<div class="hold" style="width:${Math.min(w, c.hold * pps)}px"></div>` : ''}
      ${i > 0 && c.fade > 0 ? '<div class="dip"></div>' : ''}
      <div class="lab">${name}</div><div class="sub">${c.from} → ${c.to} · ${c.dur.toFixed(2)} s</div>
      ${i > 0 ? '<div class="h l" data-h="l"></div>' : ''}<div class="h r" data-h="r"></div></div>`;
  }).join('');
}

function drawAudio() {
  const lane = $('#lane-a'), Au = S.P.audio;
  if (!Au) {
    lane.innerHTML = `<div class="empty-a" id="empty-a">${H.text ? H.text('drop_song') : ''}</div>`;
    return;
  }
  const x = X(Au.offset), w = Math.max(2, audioLen() * pps), on = S.sel?.kind === 'a';
  const fi = Math.min(w, Au.fadeIn * pps), fo = Math.min(w, Au.fadeOut * pps);
  lane.innerHTML = `<div class="clip audio${on ? ' sel' : ''}" data-a="1" tabindex="0" style="left:${x}px;width:${w}px" title="${Au.name}">
    <canvas></canvas>
    <div class="fade" style="left:0;width:${fi}px;background:linear-gradient(to top right, rgba(0,0,0,.45) 50%, transparent 50%)"></div>
    <div class="fade" style="right:0;width:${fo}px;background:linear-gradient(to top left, rgba(0,0,0,.45) 50%, transparent 50%)"></div>
    <div class="lab">${Au.mute ? '🔇 ' : ''}${Au.name}</div>
    <div class="fh" data-f="in" style="left:${Math.max(2, fi - 6)}px"></div><div class="fh" data-f="out" style="right:${Math.max(2, fo - 6)}px"></div>
    <div class="h l" data-h="l"></div><div class="h r" data-h="r"></div></div>`;
  const cv = lane.querySelector('canvas');
  const h = lane.offsetHeight - 10;
  const cw = Math.min(16000, w);
  const g = canvasFit(cv, cw, h);
  cv.style.width = '100%';
  const sg = S.song;
  if (!sg.peaks) return;
  const dur = sg.buffer.duration, n = sg.peaks.length, mid = h / 2 + 6, amp = h / 2 - 9;
  g.fillStyle = 'rgba(150,200,235,.75)';
  for (let px = 0; px < cw; px++) {
    const s = Au.in + (px / cw) * audioLen();
    const p = sg.peaks[Math.min(n - 1, Math.floor((s / dur) * n))] || 0;
    g.fillRect(px, mid - p * amp, 1, Math.max(1, 2 * p * amp));
  }
}

export function movePlayhead() {
  const ph = $('#playhead');
  ph.style.left = `${X(S.t)}px`;
  // durante il play la timeline segue l'indicatore
  if (S.playing) {
    const sc = $('#tl-scroll'), x = X(S.t);
    if (x < sc.scrollLeft + 40 || x > sc.scrollLeft + sc.clientWidth - 60) sc.scrollLeft = x - 80;
  }
}

// ── interazioni ───────────────────────────────────────────────────────────
function showSnap(t, raw) {
  const s = $('#snapline');
  s.hidden = Math.abs(t - raw) < 1e-9;
  s.style.left = `${X(t)}px`;
}
const tol = () => 8 / pps;

export function initTimeline(hooks) {
  H = hooks;
  const inner = $('#tl-inner');
  let drag = null;

  inner.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const r = inner.getBoundingClientRect(), x = e.clientX - r.left;
    const vClip = e.target.closest('.clip:not(.audio)'), aClip = e.target.closest('.clip.audio');
    inner.setPointerCapture(e.pointerId);
    if (e.target.id === 'tl-ruler' || (!vClip && !aClip)) {
      drag = { kind: 'seek' };
      if (!e.target.closest('#tl-ruler')) H.select(null);
      H.seek(Math.max(0, T(x)));
      return;
    }
    if (vClip) {
      const i = +vClip.dataset.i, hnd = e.target.dataset.h;
      H.select({ kind: 'v', i });
      const st = clipStart(i), c = S.P.video[i];
      const all = snapPoints();
      // si escludono i punti che si muovono insieme al bordo
      if (hnd === 'r') drag = { kind: 'v-r', i, st, x0: x, d0: c.dur, pts: all.filter((p) => !(p.kind === 'b' && p.t >= st + c.dur - 1e-6)) };
      else if (hnd === 'l') drag = { kind: 'v-l', i, st, x0: x, prev: S.P.video[i - 1].dur, d0: c.dur, pts: all.filter((p) => !(p.kind === 'b' && Math.abs(p.t - st) < 1e-6)) };
      else drag = { kind: 'v-move', i, x0: x, moved: false };
      return;
    }
    const Au = S.P.audio;
    H.select({ kind: 'a' });
    const f = e.target.dataset.f, hnd = e.target.dataset.h;
    // spostando il brano si spostano anche i suoi battiti; tagliandolo restano
    const all = snapPoints().filter((p) => p.kind !== 'a');
    const base = { x0: x, off: Au.offset, in: Au.in, out: Au.out, fi: Au.fadeIn, fo: Au.fadeOut, pts: all };
    if (f) drag = { kind: f === 'in' ? 'a-fi' : 'a-fo', ...base };
    else if (hnd === 'l') drag = { kind: 'a-l', ...base };
    else if (hnd === 'r') drag = { kind: 'a-r', ...base };
    else drag = { kind: e.altKey ? 'a-slip' : 'a-move', ...base, pts: all.filter((p) => p.kind !== 'beat') };
  });

  inner.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = inner.getBoundingClientRect(), x = e.clientX - r.left, dt = (x - (drag.x0 ?? x)) / pps;
    if (drag.kind === 'seek') { H.seek(Math.max(0, T(x))); return; }
    if (!drag.remembered && drag.kind !== 'v-move') { remember(); drag.remembered = true; }
    const V = S.P.video, Au = S.P.audio;
    switch (drag.kind) {
      case 'v-r': {
        const raw = drag.st + drag.d0 + dt, t = snapTo(raw, tol(), drag.pts);
        V[drag.i].dur = Math.max(0.5, t - drag.st);
        V[drag.i].hold = Math.min(V[drag.i].hold, Math.max(0, V[drag.i].dur - 0.2));
        showSnap(t, raw);
        break;
      }
      case 'v-l': {
        const p0 = drag.st - drag.prev, end = drag.st + drag.d0;
        const raw = drag.st + dt, t = Math.max(p0 + 0.5, Math.min(end - 0.5, snapTo(raw, tol(), drag.pts)));
        V[drag.i - 1].dur = t - p0; V[drag.i].dur = end - t;
        V[drag.i].hold = Math.min(V[drag.i].hold, Math.max(0, V[drag.i].dur - 0.2));
        showSnap(t, raw);
        break;
      }
      case 'v-move': {
        if (!drag.moved && Math.abs(x - drag.x0) < 5) return;
        drag.moved = true;
        drag.to = insertIndex(T(x), drag.i);
        const d = $('#drop');
        d.hidden = false;
        d.style.left = `${X(clipStart(drag.to))}px`;
        inner.querySelector(`.clip[data-i="${drag.i}"]`)?.classList.add('drag');
        return;
      }
      case 'a-move': {
        const raw = drag.off + dt;
        // si aggancia l'inizio del brano oppure la sua fine
        let t = snapTo(raw, tol(), drag.pts);
        if (t === raw) t = snapTo(raw + audioLen(), tol(), drag.pts) - audioLen();
        Au.offset = Math.max(0, t);
        showSnap(Au.offset, raw);
        break;
      }
      case 'a-slip': {
        const len = drag.out - drag.in, dur = S.song.buffer ? S.song.buffer.duration : drag.out;
        Au.in = Math.max(0, Math.min(dur - len, drag.in - dt));
        Au.out = Au.in + len;
        break;
      }
      case 'a-l': {
        const raw = drag.off + dt, t = snapTo(raw, tol(), drag.pts);
        const d = Math.max(-drag.in, Math.min(drag.out - drag.in - 0.5, t - drag.off));
        Au.offset = Math.max(0, drag.off + d); Au.in = drag.in + (Au.offset - drag.off);
        showSnap(Au.offset, raw);
        break;
      }
      case 'a-r': {
        const end0 = drag.off + (drag.out - drag.in), raw = end0 + dt, t = snapTo(raw, tol(), drag.pts);
        const dur = S.song.buffer ? S.song.buffer.duration : drag.out;
        Au.out = Math.max(Au.in + 0.5, Math.min(dur, drag.in + (t - drag.off)));
        showSnap(Au.offset + audioLen(), raw);
        break;
      }
      case 'a-fi': Au.fadeIn = Math.max(0, Math.min(audioLen() / 2, drag.fi + dt)); break;
      case 'a-fo': Au.fadeOut = Math.max(0, Math.min(audioLen() / 2, drag.fo - dt)); break;
    }
    H.changed({ light: true });
  });

  const end = () => {
    if (!drag) return;
    if (drag.kind === 'v-move' && drag.moved && drag.to != null) {
      const from = drag.i, to = drag.to > from ? drag.to - 1 : drag.to;
      if (to !== from) {
        remember();
        const [c] = S.P.video.splice(from, 1);
        S.P.video.splice(to, 0, c);
        S.sel = { kind: 'v', i: to };
      }
    }
    const was = drag;
    drag = null;
    $('#drop').hidden = true;
    $('#snapline').hidden = true;
    if (was.kind !== 'seek') H.changed({});
  };
  inner.addEventListener('pointerup', end);
  inner.addEventListener('pointercancel', end);

  // zoom: cursore e Ctrl+rotella (attorno al puntatore)
  $('#zoom').addEventListener('input', (e) => setZoom(+e.target.value));
  $('#tl-scroll').addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const r = inner.getBoundingClientRect();
    setZoom(zoomZ - e.deltaY * 0.0015, T(e.clientX - r.left));
  }, { passive: false });
  new ResizeObserver(() => renderTimeline()).observe($('#tl-scroll'));

  // dalla libreria: una vista trascinata sulla traccia V1
  const lane = $('#lane-v');
  lane.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes('text/x-oe-view')) return;
    e.preventDefault();
    const r = inner.getBoundingClientRect(), i = insertIndex(T(e.clientX - r.left), -1);
    const d = $('#drop'); d.hidden = false; d.style.left = `${X(clipStart(i))}px`;
    lane.classList.add('over');
  });
  lane.addEventListener('dragleave', () => { $('#drop').hidden = true; lane.classList.remove('over'); });
  lane.addEventListener('drop', (e) => {
    const v = e.dataTransfer.getData('text/x-oe-view');
    $('#drop').hidden = true; lane.classList.remove('over');
    if (!v) return;
    e.preventDefault();
    const r = inner.getBoundingClientRect();
    H.addView(v, insertIndex(T(e.clientX - r.left), -1));
  });
  // un file audio lasciato sulla traccia A1 (o sulla pagina)
  const la = $('#lane-a');
  la.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); la.querySelector('.empty-a')?.classList.add('over'); } });
  la.addEventListener('dragleave', () => la.querySelector('.empty-a')?.classList.remove('over'));
  la.addEventListener('drop', (e) => {
    const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|aac|opus)$/i.test(x.name));
    if (!f) return;
    e.preventDefault();
    H.importFile(f);
  });
}

// dove cade una clip lasciata all'istante t: prima della clip di cui supera meno della meta'
function insertIndex(t, skip) {
  const V = S.P.video;
  let s = 0;
  for (let i = 0; i < V.length; i++) {
    if (i !== skip && t < s + V[i].dur / 2) return i;
    s += V[i].dur;
  }
  return V.length;
}

export function scrollToT(t) {
  const sc = $('#tl-scroll'), x = X(t);
  if (x < sc.scrollLeft || x > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = x - sc.clientWidth / 3;
}
