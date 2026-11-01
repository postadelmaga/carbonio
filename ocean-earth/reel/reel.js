// Editor dei reel dell'Atlante del clima: un piccolo programma di montaggio.
//   libreria (viste dell'atlante, musica) · anteprima · proprieta' · timeline
//   con la traccia V1 (globo) e A1 (musica)

import { analyze, downbeats, silence } from './beats.js';
import {
  S, W, H, VIEWS, DOMAIN, SEA_PARTICLES, newClip, defaultProject, newAudio, migrate, total, clipStart, clipAt,
  audioEnd, srcBars, tlBeats, newSeg, segLen, segEnd, segAt, srcAt, camAt, progressIn, wrapLon, remember, undo, redo, canUndo, canRedo,
} from './model.js';
import { A, bootAtlas, applyAt, feed, clipRange } from './atlas.js';
import { compose, LOCALE } from './render.js';
import { initTimeline, renderTimeline, movePlayhead, setZoom, scrollToT, viewGradient } from './timeline.js';
import { pickCodecs, exportMp4, scheduleSong } from './export.js';

const $ = (s) => document.querySelector(s);

// ── testi ──────────────────────────────────────────────────────────────────
const UI = (() => {
  try { const l = new URLSearchParams(location.search).get('lang') || localStorage.getItem('lingua'); if (l) return l === 'it' ? 'it' : 'en'; } catch (e) { /* niente */ }
  return (navigator.language || 'en').startsWith('it') ? 'it' : 'en';
})();
const TX = {
  it: {
    project: 'Progetto', texts: 'Testi', format: 'Formato', title: 'Titolo', lang: 'Lingua dei testi', o_date: 'data', o_legend: 'legenda', o_caption: 'titolo e didascalia', o_credits: 'fonti dei dati',
    fps: 'Fotogrammi/s', rate: 'Qualità (Mbit/s)', globe_y: 'Globo più in basso (px)', legend_size: 'Dimensione legenda (%)', black_in: 'Nero all’inizio (s)', black_out: 'Nero alla fine (s)',
    proj_note: (n, d) => `${n} clip, ${d} s. Seleziona una clip o il brano nella timeline per modificarli.`,
    content: 'Contenuto', view: 'Vista', variant: 'Variante', from: 'Dal mese', to: 'Al mese', caption: 'Didascalia (vuota = quella della vista)', particles: 'scie delle correnti',
    time: 'Tempo', dur: 'Durata (s)', bars: 'Battute', fit: 'adatta', sync: 'Scorrere dei mesi', sync_beat: 'a tempo coi battiti', sync_linear: 'uniforme', hold: 'Pausa sull’ultimo mese (s)', dip: 'Stacco al nero (s)',
    framing: 'Inquadratura', cam0: 'Iniziale', cam1: 'Finale', use_view: 'vista attuale', go: 'vai', spin: 'Rotazione (°/s)',
    avail: (a, b) => `Dati di questa vista: ${a} – ${b}.`, dup: 'Duplica', split: 'Dividi', del: 'Elimina',
    song: 'Brano', replace: 'Sostituisci', remove_song: 'Rimuovi il brano', volume: 'Volume del brano (%)', mute: 'muto', offset: 'Entra al secondo del reel', in: 'Suona dal secondo del brano', out: 'fino al secondo', fade_in: 'Dissolvenza in entrata (s)', fade_out: 'Dissolvenza in uscita (s)',
    seg: (i, n) => `Pezzo ${i} di ${n}`, seg_gain: 'Volume del pezzo (%)', speed: 'Velocità (%)', seg_len: 'Durata nel reel (s)', stretch_bars: 'Allunga a battute', split_every: 'Dividi ogni … battute', close_gaps: 'Accoda i pezzi',
    seg_note: 'S divide il pezzo all’indicatore (Maiusc+←/→ salta di battuta in battuta). Trascina i bordi per tagliare, Maiusc + bordo per allungare o accorciare senza cambiare l’intonazione, il corpo per spostarlo. Duplica mette la copia subito dopo e sposta avanti i pezzi seguenti.',
    trim: 'Togli i silenzi', first_bar: 'Parti dalla battuta più vicina', rhythm: 'Ritmo', bpm: 'Tempo (BPM)', beats: 'Battiti', detected: 'rilevati', grid: 'griglia fissa', meter: 'Battiti per battuta', bar_off: 'La battuta parte dal battito', grid_off: 'Primo battito (s)', tap: 'Batti il tempo (T)',
    bpm_det: (b, n, m) => `${n} battiti rilevati, ${b} BPM, battute da ${m}. Se la griglia non cade sui colpi usa ÷2 o ×2, cambia il primo battito della battuta o batti il tempo con T durante il play.`,
    bpm_grid: (b) => `Griglia fissa a ${b} BPM.`, analyzing: (s) => `Analizzo il brano… ${s}`, song_missing: (n) => `Il progetto usa «${n}»: importalo di nuovo (resta nel browser).`, tap_more: (n) => `Batti ancora (${n})…`, tap_play: 'Avvia il play e batti a tempo.',
    trimmed: (a, b) => `Silenzi tolti: il pezzo suona da ${a} a ${b} s.`, no_bars_in: 'Nel pezzo non ci sono battute dove dividerlo.',
    sea: 'Mare', land: 'Terra', air: 'Aria', drop_song: 'Trascina qui un file audio, o usa «Importa un brano»', snap_bar: 'battute', snap_beat: 'battiti', snap_off: 'niente',
    total: (d, n) => `${d} s · ${n} clip`, bar_pos: (n, b) => `battuta ${n}.${b}`,
    no_webcodecs: 'Questo browser non ha WebCodecs: per esportare serve Chrome, Edge o Firefox recenti.',
    codec_info: (v, a) => `Video ${v}${a ? `, audio ${a}` : ', senza audio'}. Il video si costruisce fotogramma per fotogramma con i dati esatti: ci vuole qualche minuto.`,
    opus_note: 'Questo browser non codifica l’audio AAC: l’audio è Opus. Se Instagram non lo accetta: ffmpeg -i reel.mp4 -c:v copy -c:a aac reel-ig.mp4',
    frame: (i, n, eta) => `fotogramma ${i}/${n} · mancano ${eta}`, done: (mb, s) => `Fatto: ${mb} MB in ${s}.`, wait_data: 'aspetto i dati…',
    timeout: 'I dati di un istante non arrivano: controlla la connessione e riprova.', cancelled: 'Annullato.', close: 'Chiudi', cancel: 'Annulla',
    bad_project: 'Il file non è un progetto dell’editor.', atlas_fail: 'L’atlante non si è caricato.', no_clips: 'Aggiungi almeno una clip alla traccia V1.',
    fossil: 'fossili', natural: 'naturali',
  },
  en: {
    back: '‹ Climate Atlas', brand: 'Reel editor', open: 'Open project', save: 'Save project', export: 'Export MP4', loading: 'Loading the atlas…',
    views: 'Views', lib_hint: 'Drag a view onto track V1, or click to add it after the selected clip.', music: 'Music', import_song: 'Import a song',
    song_local: 'The song stays in your browser, it is not uploaded anywhere. To publish the reel you need the rights to the music.', safe: 'areas covered by Instagram',
    split: 'Split', del: 'Delete', on_bars: 'Clips on the bars', fill: 'To the end of the song', zoom: 'Zoom', track_v: 'Globe', track_a: 'Music',
    tl_help: 'Drag edges to stretch or trim (they snap to bars) · drag a clip to move it · song pieces: Shift + edge stretches without changing pitch, Alt + drag chooses which part plays · space play · S split · Ctrl+Z undo · Ctrl+wheel zoom',
    exporting: 'Export', cancel: 'Cancel', download: 'Download the video', wait: 'loading data…',
    undo: 'Undo (Ctrl+Z)', redo: 'Redo (Ctrl+Shift+Z)', go_start: 'Start (Home)', go_prev: 'Previous bar (Shift+←)', go_next: 'Next bar (Shift+→)', go_end: 'End (End)',
    snap_t: 'Snap', split_t: 'Split the clip at the playhead (S)', del_t: 'Delete (Del)', bars_t: 'Move every clip boundary to the nearest bar', fill_t: 'Stretch the clips to the end of the song', mute: 'mute',
    project: 'Project', texts: 'Texts', format: 'Format', title: 'Title', lang: 'Text language', o_date: 'date', o_legend: 'legend', o_caption: 'title and caption', o_credits: 'data sources',
    fps: 'Frames/s', rate: 'Quality (Mbit/s)', globe_y: 'Globe lower (px)', legend_size: 'Legend size (%)', black_in: 'Black at the start (s)', black_out: 'Black at the end (s)',
    proj_note: (n, d) => `${n} clips, ${d} s. Select a clip or the song in the timeline to edit it.`,
    content: 'Content', view: 'View', variant: 'Variant', from: 'From month', to: 'To month', caption: 'Caption (empty = the view’s own)', particles: 'current trails',
    time: 'Time', dur: 'Length (s)', bars: 'Bars', fit: 'fit', sync: 'Month flow', sync_beat: 'in time with the beats', sync_linear: 'even', hold: 'Hold on last month (s)', dip: 'Dip to black (s)',
    framing: 'Framing', cam0: 'Start', cam1: 'End', use_view: 'current view', go: 'go', spin: 'Rotation (°/s)',
    avail: (a, b) => `Data for this view: ${a} – ${b}.`, dup: 'Duplicate',
    song: 'Song', replace: 'Replace', remove_song: 'Remove the song', volume: 'Song volume (%)',
    seg: (i, n) => `Piece ${i} of ${n}`, seg_gain: 'Piece volume (%)', speed: 'Speed (%)', seg_len: 'Length in the reel (s)', stretch_bars: 'Stretch to bars', split_every: 'Split every … bars', close_gaps: 'Line up the pieces',
    seg_note: 'S splits the piece at the playhead (Shift+←/→ jumps bar to bar). Drag the edges to trim, Shift + edge to stretch or shorten without changing the pitch, the body to move it. Duplicate puts the copy right after and pushes the following pieces forward.', no_bars_in: 'There are no bars inside the piece to split at.', offset: 'Enters at reel second', in: 'Plays from song second', out: 'to second', fade_in: 'Fade in (s)', fade_out: 'Fade out (s)',
    trim: 'Remove silences', first_bar: 'Start on the nearest bar', rhythm: 'Rhythm', bpm: 'Tempo (BPM)', beats: 'Beats', detected: 'detected', grid: 'fixed grid', meter: 'Beats per bar', bar_off: 'Bar starts on beat', grid_off: 'First beat (s)', tap: 'Tap the tempo (T)',
    bpm_det: (b, n, m) => `${n} beats detected, ${b} BPM, bars of ${m}. If the grid does not land on the hits use ÷2 or ×2, change the first beat of the bar or tap the tempo with T while playing.`,
    bpm_grid: (b) => `Fixed grid at ${b} BPM.`, analyzing: (s) => `Analysing the song… ${s}`, song_missing: (n) => `The project uses “${n}”: import it again (it stays in the browser).`, tap_more: (n) => `Keep tapping (${n})…`, tap_play: 'Start playback and tap along.',
    trimmed: (a, b) => `Silences removed: the piece plays from ${a} to ${b} s.`,
    sea: 'Sea', land: 'Land', air: 'Air', drop_song: 'Drop an audio file here, or use “Import a song”', snap_bar: 'bars', snap_beat: 'beats', snap_off: 'off',
    total: (d, n) => `${d} s · ${n} clips`, bar_pos: (n, b) => `bar ${n}.${b}`,
    no_webcodecs: 'This browser has no WebCodecs: exporting needs a recent Chrome, Edge or Firefox.',
    codec_info: (v, a) => `Video ${v}${a ? `, audio ${a}` : ', no audio'}. The video is built frame by frame with the exact data: it takes a few minutes.`,
    opus_note: 'This browser does not encode AAC audio: the audio is Opus. If Instagram refuses it: ffmpeg -i reel.mp4 -c:v copy -c:a aac reel-ig.mp4',
    frame: (i, n, eta) => `frame ${i}/${n} · ${eta} left`, done: (mb, s) => `Done: ${mb} MB in ${s}.`, wait_data: 'waiting for data…',
    timeout: 'The data for one instant does not arrive: check the connection and try again.', cancelled: 'Cancelled.', close: 'Close',
    bad_project: 'The file is not an editor project.', atlas_fail: 'The atlas did not load.', no_clips: 'Add at least one clip to track V1.',
    fossil: 'fossil', natural: 'natural',
  },
};
const t = (k, ...a) => { const v = TX[UI][k] ?? TX.it[k] ?? k; return typeof v === 'function' ? v(...a) : v; };
document.documentElement.lang = UI;
if (UI !== 'it') {
  document.title = 'Reel editor · Climate Atlas';
  document.querySelectorAll('[data-u]').forEach((el) => { if (TX.en[el.dataset.u]) el.textContent = TX.en[el.dataset.u]; });
  document.querySelectorAll('[data-ut]').forEach((el) => { if (TX.en[el.dataset.ut]) el.title = TX.en[el.dataset.ut]; });
}
const VARIANTS = { co2: [['0', 'ppm'], ['1', UI === 'it' ? 'rispetto alla media globale del mese' : 'relative to the global mean of the month']], emis: [['0', UI === 'it' ? 'totale' : 'total'], ['1', t('fossil')], ['2', t('natural')]] };

// ── progetto ───────────────────────────────────────────────────────────────
function loadLocal() {
  for (const k of ['oe-reel2', 'oe-reel']) {
    try { const p = migrate(JSON.parse(localStorage.getItem(k) || 'null')); if (p) return p; } catch (e) { /* prossimo */ }
  }
  return null;
}
S.P = loadLocal() || defaultProject(UI);
let saveT = 0;
function saveLocal() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem('oe-reel2', JSON.stringify(S.P)); } catch (e) { /* niente */ } }, 300); }

// ogni modifica: salva, ridisegna, riporta l'atlante all'istante
let need = true, camNeed = true, inspT = 0;
function changed(o = {}) {
  if (S.sel?.kind === 'v' && !S.P.video[S.sel.i]) S.sel = S.P.video.length ? { kind: 'v', i: S.P.video.length - 1 } : null;
  if (S.sel?.kind === 'a' && !S.P.audio?.clips[S.sel.i]) S.sel = S.P.audio?.clips.length ? { kind: 'a', i: S.P.audio.clips.length - 1 } : null;
  S.t = Math.min(S.t, total());
  saveLocal();
  renderTimeline();
  if (o.light) { if (!inspT) inspT = requestAnimationFrame(() => { inspT = 0; renderInspector(true); }); } else renderInspector();
  need = true; camNeed = true;
  $('#undo').disabled = !canUndo(); $('#redo').disabled = !canRedo();
  $('#export').disabled = !A.oe || !S.P.video.length;
}

// ── brano ──────────────────────────────────────────────────────────────────
let actx = null;
const audioCtx = () => (actx ||= new AudioContext());
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('oe-reel', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('song');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function storeSong(name, bytes) { try { const db = await idb(); db.transaction('song', 'readwrite').objectStore('song').put({ name, bytes }, 'last'); } catch (e) { /* niente */ } }
async function loadStoredSong() {
  try { const db = await idb(); return await new Promise((res) => { const r = db.transaction('song').objectStore('song').get('last'); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); }); } catch (e) { return null; }
}

function analyzeSong(buf) {
  const channels = [...Array(buf.numberOfChannels)].map((_, c) => buf.getChannelData(c).slice());
  return new Promise((res) => {
    let w;
    try { w = new Worker(new URL('./beats-worker.js', import.meta.url), { type: 'module' }); } catch (e) { w = null; }
    const local = () => { const r = analyze(buf), m4 = downbeats(r.beats, r.low, r.env, r.fr, 4, r.chroma); res({ bpm: r.bpm, beats: r.beats, meter: 4, barOff: m4.phase, trim: silence(buf) }); };
    if (!w) return local();
    w.onmessage = (e) => { res(e.data); w.terminate(); };
    w.onerror = () => { w.terminate(); local(); };
    w.postMessage({ sampleRate: buf.sampleRate, channels }, channels.map((c) => c.buffer));
  });
}

let songMsg = '';
async function loadSong(name, bytes, fromProject = false) {
  const buf = await audioCtx().decodeAudioData(bytes.slice(0));
  const sg = S.song;
  sg.buffer = buf; sg.name = name;
  const n = 6000, d0 = buf.getChannelData(0), d1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : d0, per = Math.max(1, Math.floor(buf.length / n));
  sg.peaks = new Float32Array(n);
  for (let i = 0; i < n; i++) { let m = 0; for (let k = i * per; k < (i + 1) * per && k < buf.length; k += 3) m = Math.max(m, Math.abs(d0[k]), Math.abs(d1[k])); sg.peaks[i] = m; }
  const Au = S.P.audio;
  if (fromProject && Au?.det?.name === name && Au.det.beats?.length) {
    sg.detected = Au.det.beats; sg.trimAuto = Au.det.trim || { start: 0, end: buf.duration };
  } else {
    if (!fromProject) remember();
    const keep = S.P.audio;
    S.P.audio = newAudio(name, buf.duration);
    if (keep) { S.P.audio.gain = keep.gain; S.P.audio.clips[0].offset = keep.clips[0]?.offset || 0; }
    S.sel = { kind: 'a', i: 0 };
    sg.detected = [];
    const t0 = performance.now();
    const tick = setInterval(() => { songMsg = t('analyzing', `${Math.round((performance.now() - t0) / 1000)} s`); renderInspector(); }, 1000);
    songMsg = t('analyzing', ''); changed();
    const r = await analyzeSong(buf);
    clearInterval(tick);
    songMsg = '';
    sg.detected = r.beats.map((b) => +b.toFixed(4)); sg.trimAuto = r.trim;
    const A2 = S.P.audio;
    Object.assign(A2, { det: { name, beats: sg.detected, trim: r.trim }, mode: 'detected', bpm: +r.bpm.toFixed(2), meter: r.meter, barOff: r.barOff, gridOff: +(r.beats[0] || 0).toFixed(3) });
    // il brano parte dalla prima battuta dopo il silenzio e finisce con la sua coda
    const first = srcBars().find((b) => b >= r.trim.start - 0.01);
    Object.assign(A2.clips[0], { in: first ?? r.trim.start, out: r.trim.end });
  }
  changed();
}
async function importFile(f) {
  const bytes = await f.arrayBuffer();
  await loadSong(f.name, bytes);
  storeSong(f.name, bytes);
}
$('#song-file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ''; });

// ── libreria ───────────────────────────────────────────────────────────────
function renderLibrary() {
  const box = $('#lib-views');
  const fmt = (i) => A.frames[i].t.slice(0, 4);
  box.innerHTML = ['sea', 'land', 'air'].map((d) => {
    const vs = VIEWS.filter((v) => DOMAIN[v] === d && A.views[v]);
    if (!vs.length) return '';
    return `<div class="lib-group">${t(d)}</div>` + vs.map((v) => `<button type="button" class="tile" draggable="true" data-view="${v}" title="${esc(A.views[v].title)}">
      <i style="background:${viewGradient(v)}"></i><span>${esc(A.views[v].name)}<small>${fmt(A.views[v].first)}–${fmt(A.views[v].last)}</small></span></button>`).join('');
  }).join('');
  box.querySelectorAll('.tile').forEach((el) => {
    el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-oe-view', el.dataset.view); e.dataTransfer.effectAllowed = 'copy'; });
    el.addEventListener('click', () => addView(el.dataset.view, S.sel?.kind === 'v' ? S.sel.i + 1 : S.P.video.length));
  });
}

// durata di una battuta al tempo del brano (null senza brano)
function barLength() { const Au = S.P.audio; return Au ? ((Au.meter || 4) * 60) / Au.bpm : null; }

// una vista nuova sulla traccia V1: tutto l'intervallo di dati, 4 battute
// (o 8 secondi senza brano), l'inquadratura di adesso
function addView(v, idx) {
  const vw = A.views[v];
  if (!vw) return;
  remember();
  const bar = barLength();
  const cam = A.oe ? { lon: wrapLon(A.oe.camera.lon), lat: A.oe.camera.lat, dist: A.oe.camera.dist } : { lon: 10, lat: 35, dist: 3.3 };
  const c = newClip({ view: v, from: A.frames[vw.first].t, to: A.frames[vw.last].t, particles: SEA_PARTICLES.includes(v), dur: bar ? bar * 4 : 8, cam0: { ...cam }, cam1: { ...cam } });
  S.P.video.splice(idx, 0, c);
  S.sel = { kind: 'v', i: idx };
  S.t = clipStart(idx) + 0.01;
  changed();
  scrollToT(S.t);
}

// ── proprieta' ─────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (f, v, step, min, max) => `<input type="number" data-f="${f}" value="${+(+v).toFixed(3)}" step="${step}"${min != null ? ` min="${min}"` : ''}${max != null ? ` max="${max}"` : ''}>`;
const sel = (f, v, opts) => `<select data-f="${f}">${opts.map(([k, l]) => `<option value="${k}"${String(k) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
const chk = (f, v, l) => `<label class="chk"><input type="checkbox" data-f="${f}"${v ? ' checked' : ''}> ${l}</label>`;
const fmtCam = (k) => `${k.lon.toFixed(1)}°, ${k.lat.toFixed(1)}°, ×${k.dist.toFixed(2)}`;
function months(lo, hi) {
  const f = new Intl.DateTimeFormat(LOCALE[UI] || 'it-IT', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const out = [];
  for (let i = lo; i <= hi; i++) { const s = A.frames[i].t; out.push([s, f.format(new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, 1)))]); }
  return out;
}
const curSeg = () => (S.sel?.kind === 'a' ? S.P.audio?.clips[S.sel.i] : null);
const selKey = () => (S.sel ? `${S.sel.kind}${S.sel.i ?? ''}` : 'p');
function readField(f) {
  const [o, k] = f.split('.');
  if (o === 'a' && k === 'gainPct') return S.P.audio ? Math.round(S.P.audio.gain * 100) : null;
  if (o === 's') {
    const c = curSeg();
    if (!c) return null;
    if (k === 'ratePct') return +((c.rate || 1) * 100).toFixed(1);
    if (k === 'gainPct') return Math.round((c.gain ?? 1) * 100);
    if (k === 'len') return segLen(c);
    return c[k];
  }
  const obj = o === 'v' ? S.P.video[S.sel?.i] : o === 'a' ? S.P.audio : o === 'p' ? S.P : null;
  return obj ? obj[k] : null;
}

function renderInspector(soft = false) {
  const box = $('#insp');
  // durante un trascinamento si aggiornano solo i numeri, senza rifare il pannello
  if (soft && box.dataset.for === selKey()) {
    box.querySelectorAll('input[type=number][data-f]').forEach((el) => {
      if (el === document.activeElement) return;
      const v = readField(el.dataset.f);
      if (v != null && Number.isFinite(+v)) el.value = +(+v).toFixed(3);
    });
    return;
  }
  // non si rifa' il pannello mentre si scrive in un campo di testo
  if (box.contains(document.activeElement) && document.activeElement.matches('input[type=text], textarea') && box.dataset.for === selKey()) return;
  box.dataset.for = selKey();
  const P = S.P;
  if (S.sel?.kind === 'v' && P.video[S.sel.i] && A.oe) box.innerHTML = clipPanel(P.video[S.sel.i], S.sel.i);
  else if (S.sel?.kind === 'a' && P.audio?.clips[S.sel.i]) box.innerHTML = audioPanel(P.audio);
  else box.innerHTML = projectPanel();
}

function projectPanel() {
  const P = S.P;
  return `<h3>${t('project')}</h3>
  <section><h4>${t('texts')}</h4><div class="f">
    <label class="w">${t('title')}<input type="text" data-f="p.title" value="${esc(P.title)}"></label>
    <label>${t('lang')}${sel('p.lang', P.lang, [['it', 'Italiano'], ['en', 'English'], ['es', 'Español'], ['fr', 'Français'], ['zh', '中文']])}</label><span></span>
    ${chk('o.date', P.overlay.date, t('o_date'))}${chk('o.legend', P.overlay.legend, t('o_legend'))}${chk('o.caption', P.overlay.caption, t('o_caption'))}${chk('o.credits', P.overlay.credits, t('o_credits'))}
  </div></section>
  <section><h4>${t('format')}</h4><div class="f">
    <label>${t('fps')}${sel('p.fps', P.fps, [[30, '30'], [60, '60']])}</label>
    <label>${t('rate')}${num('p.rate', P.rate, 1, 4, 40)}</label>
    <label>${t('globe_y')}${num('p.globeY', P.globeY, 10, 0, 700)}</label>
    <label>${t('legend_size')}${num('p.legendScale', P.legendScale || 100, 5, 40, 130)}</label>
    <label>${t('black_in')}${num('p.fadeIn', P.fadeIn, 0.1, 0, 10)}</label>
    <label>${t('black_out')}${num('p.fadeOut', P.fadeOut, 0.1, 0, 10)}</label>
  </div></section>
  <p class="note">${t('proj_note', P.video.length, total().toFixed(1))}</p>`;
}

function clipPanel(c, i) {
  const v = A.views[c.view];
  const vr = VARIANTS[c.view];
  const ms = v ? months(v.first, v.last) : [];
  const bar = barLength();
  return `<h3><i style="background:${viewGradient(c.view)}"></i>${esc(v?.name || c.view)} <span class="muted small">#${i + 1}</span></h3>
  <section><h4>${t('content')}</h4><div class="f">
    <label class="w">${t('view')}${sel('v.view', c.view, VIEWS.filter((k) => A.views[k]).map((k) => [k, A.views[k].name]))}</label>
    ${vr ? `<label class="w">${t('variant')}${sel('v.variant', c.variant, vr)}</label>` : ''}
    <label>${t('from')}${sel('v.from', c.from, ms)}</label>
    <label>${t('to')}${sel('v.to', c.to, ms)}</label>
    <label class="w">${t('caption')}<textarea data-f="v.caption" rows="2" placeholder="${esc(A.legend[`${c.view}/${c.variant}/${c.particles}`]?.caption || '')}">${esc(c.caption)}</textarea></label>
    ${chk('v.particles', c.particles, t('particles'))}
  </div></section>
  <section><h4>${t('time')}</h4><div class="f">
    <label>${t('dur')}${num('v.dur', c.dur, 0.01, 0.5)}</label>
    <label>${t('bars')}<span class="pair"><input type="number" id="fit-n" value="${bar ? Math.max(1, Math.round(c.dur / bar)) : 4}" min="1" step="1"${bar ? '' : ' disabled'}><button type="button" class="btn small" data-act="fit"${bar ? '' : ' disabled'}>${t('fit')}</button></span></label>
    <label>${t('sync')}${sel('v.sync', c.sync, [['beat', t('sync_beat')], ['linear', t('sync_linear')]])}</label>
    <label>${t('hold')}${num('v.hold', c.hold, 0.1, 0)}</label>
    ${i > 0 ? `<label>${t('dip')}${num('v.fade', c.fade, 0.1, 0, 3)}</label>` : ''}
  </div></section>
  <section><h4>${t('framing')}</h4>
    <div class="cam"><span><b>${t('cam0')}</b><span class="mono">${fmtCam(c.cam0)}</span></span><button type="button" class="btn small" data-act="cam0">${t('use_view')}</button><button type="button" class="btn small" data-act="go0">${t('go')}</button></div>
    <div class="cam"><span><b>${t('cam1')}</b><span class="mono">${fmtCam(c.cam1)}</span></span><button type="button" class="btn small" data-act="cam1">${t('use_view')}</button><button type="button" class="btn small" data-act="go1">${t('go')}</button></div>
    <div class="f"><label>${t('spin')}${num('v.spin', c.spin, 0.5)}</label></div>
  </section>
  <p class="note">${v ? t('avail', A.frames[v.first].t, A.frames[v.last].t) : ''}</p>
  <div class="row"><button type="button" class="btn small" data-act="dup">${t('dup')}</button><button type="button" class="btn small" data-act="split">✂ ${t('split')}</button><span class="grow"></span><button type="button" class="btn small danger" data-act="del">${t('del')}</button></div>`;
}

function audioPanel(Au) {
  const loaded = S.song.buffer && S.song.name === Au.name;
  const info = songMsg || (!loaded ? t('song_missing', Au.name) : Au.mode === 'detected' && S.song.detected.length ? t('bpm_det', Au.bpm.toFixed(1), S.song.detected.length, Au.meter) : t('bpm_grid', Au.bpm.toFixed(2)));
  const m = Au.meter || 4, i = S.sel.i, c = Au.clips[i], bl = barLength();
  const nb = bl ? Math.max(1, Math.round(segLen(c) / bl)) : 4;
  return `<h3>🎵 ${esc(Au.name)}</h3>
  <section><h4>${t('seg', i + 1, Au.clips.length)}</h4><div class="f">
    <label class="w">${t('offset')}${num('s.offset', c.offset, 0.01, 0)}</label>
    <label>${t('in')}${num('s.in', c.in, 0.01, 0)}</label>
    <label>${t('out')}${num('s.out', c.out, 0.01, 0)}</label>
    <label>${t('speed')}${num('s.ratePct', (c.rate || 1) * 100, 1, 25, 400)}</label>
    <label>${t('seg_len')}${num('s.len', segLen(c), 0.01, 0.25)}</label>
    <label>${t('stretch_bars')}<span class="pair"><input type="number" id="seg-bars" value="${nb}" min="1" step="1"${bl ? '' : ' disabled'}><button type="button" class="btn small" data-act="sfit"${bl ? '' : ' disabled'}>${t('fit')}</button></span></label>
    <label>${t('split_every')}<span class="pair"><input type="number" id="seg-every" value="1" min="1" step="1"${bl ? '' : ' disabled'}><button type="button" class="btn small" data-act="severy"${bl ? '' : ' disabled'}>✂</button></span></label>
    <label>${t('seg_gain')}${num('s.gainPct', Math.round((c.gain ?? 1) * 100), 5, 0, 200)}</label><span></span>
    <label>${t('fade_in')}${num('s.fadeIn', c.fadeIn, 0.1, 0)}</label>
    <label>${t('fade_out')}${num('s.fadeOut', c.fadeOut, 0.1, 0)}</label>
  </div>
  <div class="row"><button type="button" class="btn small" data-act="trim"${loaded ? '' : ' disabled'}>${t('trim')}</button><button type="button" class="btn small" data-act="firstbar"${loaded ? '' : ' disabled'}>${t('first_bar')}</button></div>
  <div class="row"><button type="button" class="btn small" data-act="split">✂ ${t('split')}</button><button type="button" class="btn small" data-act="sdup">${t('dup')}</button><button type="button" class="btn small" data-act="gaps"${Au.clips.length > 1 ? '' : ' disabled'}>${t('close_gaps')}</button><span class="grow"></span><button type="button" class="btn small danger" data-act="sdel"${Au.clips.length > 1 ? '' : ' disabled'}>${t('del')}</button></div>
  <p class="note">${t('seg_note')}</p></section>
  <section><h4>${t('song')}</h4><div class="f">
    <label>${t('volume')}${num('a.gainPct', Math.round(Au.gain * 100), 5, 0, 200)}</label>
    <span style="align-self:end">${chk('a.mute', Au.mute, t('mute'))}</span>
  </div></section>
  <section><h4>${t('rhythm')}</h4><div class="f">
    <label>${t('bpm')}<span class="pair">${num('a.bpm', Au.bpm, 0.01, 40, 240)}<button type="button" class="btn small" data-act="half">÷2</button><button type="button" class="btn small" data-act="double">×2</button></span></label>
    <label>${t('beats')}${sel('a.mode', Au.mode, [['detected', t('detected')], ['grid', t('grid')]])}</label>
    <label>${t('meter')}${sel('a.meter', m, [[4, '4'], [3, '3'], [2, '2'], [6, '6']])}</label>
    <label>${t('bar_off')}${sel('a.barOff', ((Au.barOff % m) + m) % m, [...Array(m)].map((_, k) => [k, String(k + 1)]))}</label>
    ${Au.mode === 'grid' ? `<label>${t('grid_off')}${num('a.gridOff', Au.gridOff, 0.001, 0)}</label>` : ''}
  </div>
  <div class="row"><button type="button" class="btn small" data-act="tap">${t('tap')}</button></div>
  <p class="note" id="beat-info">${esc(info)}</p></section>
  <div class="row"><label class="btn small file"><input type="file" accept="audio/*" data-act="replace" hidden>${t('replace')}</label><span class="grow"></span><button type="button" class="btn small danger" data-act="del">${t('remove_song')}</button></div>`;
}

// modifica di un campo del pannello
const insp = $('#insp');
insp.addEventListener('focusin', (e) => { if (e.target.matches('input[type=text], textarea')) remember(); });
insp.addEventListener('input', (e) => {
  const f = e.target.dataset.f;
  if (f === 'p.title') { S.P.title = e.target.value; saveLocal(); need = true; }
  if (f === 'v.caption' && S.sel?.kind === 'v') { S.P.video[S.sel.i].caption = e.target.value; saveLocal(); need = true; }
});
insp.addEventListener('change', async (e) => {
  const el = e.target, f = el.dataset.f;
  if (el.dataset.act === 'replace') { const file = el.files[0]; if (file) importFile(file); return; }
  if (!f || f === 'p.title' || f === 'v.caption') return;
  remember();
  const P = S.P, val = el.type === 'checkbox' ? el.checked : el.value, n = parseFloat(val);
  const [o, k] = f.split('.');
  let relang = false;
  if (o === 'o') P.overlay[k] = val;
  else if (o === 'p') {
    if (k === 'lang') { P.lang = val; relang = true; }
    else if (Number.isFinite(n)) P[k] = { fps: n, rate: Math.max(4, Math.min(40, n)), globeY: Math.max(0, Math.min(700, n)), legendScale: Math.max(40, Math.min(130, n)), fadeIn: Math.max(0, n), fadeOut: Math.max(0, n) }[k] ?? n;
  } else if (o === 'v') {
    const c = P.video[S.sel.i];
    if (k === 'view') {
      const v = A.views[val];
      Object.assign(c, { view: val, variant: 0, caption: '', particles: SEA_PARTICLES.includes(val), from: A.frames[v.first].t, to: A.frames[v.last].t });
    } else if (k === 'variant') c.variant = +val;
    else if (k === 'from' || k === 'to' || k === 'sync') c[k] = val;
    else if (k === 'particles') c.particles = val;
    else if (Number.isFinite(n)) {
      if (k === 'dur') c.dur = Math.max(0.5, n);
      if (k === 'hold') c.hold = Math.max(0, Math.min(c.dur - 0.2, n));
      if (k === 'fade') c.fade = Math.max(0, Math.min(3, n));
      if (k === 'spin') c.spin = n;
    }
  } else if (o === 'a') {
    const Au = P.audio;
    if (k === 'mute') Au.mute = val;
    else if (k === 'mode') Au.mode = val;
    else if (k === 'meter') { Au.meter = +val; Au.barOff = ((Au.barOff % Au.meter) + Au.meter) % Au.meter; }
    else if (k === 'barOff') Au.barOff = +val;
    else if (Number.isFinite(n)) {
      if (k === 'gainPct') Au.gain = Math.max(0, Math.min(2, n / 100));
      if (k === 'bpm') { Au.bpm = Math.max(40, Math.min(240, n)); Au.mode = 'grid'; }
      if (k === 'gridOff') Au.gridOff = Math.max(0, n);
    }
  } else if (o === 's' && curSeg() && Number.isFinite(n)) {
    const c = curSeg(), dur = S.song.buffer ? S.song.buffer.duration : Math.max(c.out, n);
    if (k === 'offset') c.offset = Math.max(0, n);
    if (k === 'in') c.in = Math.max(0, Math.min(c.out - 0.25, n));
    if (k === 'out') c.out = Math.max(c.in + 0.25, Math.min(dur, n));
    if (k === 'ratePct') c.rate = Math.max(0.25, Math.min(4, n / 100));
    if (k === 'len') c.rate = Math.max(0.25, Math.min(4, (c.out - c.in) / Math.max(0.05, n)));
    if (k === 'gainPct') c.gain = Math.max(0, Math.min(2, n / 100));
    if (k === 'fadeIn') c.fadeIn = Math.max(0, n);
    if (k === 'fadeOut') c.fadeOut = Math.max(0, n);
  }
  changed();
  if (relang) { pause(); await startAtlas(); }
});
insp.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || b.tagName === 'INPUT') return;
  const act = b.dataset.act, P = S.P;
  if (S.sel?.kind === 'v') {
    const i = S.sel.i, c = P.video[i];
    if (act === 'cam0' || act === 'cam1') {
      remember();
      const lt = Math.max(0, Math.min(c.dur, S.t - clipStart(i)));
      c[act] = { lon: wrapLon(A.oe.camera.lon - c.spin * lt), lat: A.oe.camera.lat, dist: A.oe.camera.dist };
      changed();
    }
    if (act === 'go0') seek(clipStart(i) + 0.001);
    if (act === 'go1') seek(clipStart(i) + c.dur - 0.001);
    if (act === 'fit') fitBars(i, Math.max(1, Math.round(+$('#fit-n').value || 1)));
    if (act === 'dup') { remember(); P.video.splice(i + 1, 0, JSON.parse(JSON.stringify(c))); S.sel = { kind: 'v', i: i + 1 }; changed(); }
    if (act === 'split') splitAt();
    if (act === 'del') deleteSel();
  } else if (S.sel?.kind === 'a') {
    const Au = P.audio, c = curSeg();
    if (!c) return;
    if (act === 'trim' && S.song.trimAuto) {
      remember();
      c.in = Math.max(c.in, S.song.trimAuto.start); c.out = Math.min(c.out, S.song.trimAuto.end);
      if (c.out - c.in < 0.5) { c.in = S.song.trimAuto.start; c.out = S.song.trimAuto.end; }
      songMsg = t('trimmed', c.in.toFixed(2), c.out.toFixed(2)); changed(); songMsg = '';
    }
    if (act === 'firstbar') {
      const bars = srcBars();
      if (bars.length) { remember(); const b0 = bars.reduce((x, y) => (Math.abs(y - c.in) < Math.abs(x - c.in) ? y : x)); c.in = Math.max(0, Math.min(c.out - 0.25, b0)); changed(); }
    }
    if (act === 'split') splitAt();
    if (act === 'sdup') dupSeg(S.sel.i);
    if (act === 'sdel') deleteSel();
    if (act === 'gaps') closeGaps();
    if (act === 'sfit') { const bl = barLength(), n = Math.max(1, Math.round(+$('#seg-bars').value || 1)); if (bl) { remember(); c.rate = Math.max(0.25, Math.min(4, (c.out - c.in) / (n * bl))); changed(); } }
    if (act === 'severy') splitEvery(S.sel.i, Math.max(1, Math.round(+$('#seg-every').value || 1)));
    if (act === 'half' || act === 'double') tempo(act === 'double' ? 2 : 0.5);
    if (act === 'tap') tap();
    if (act === 'del') { remember(); P.audio = null; S.sel = null; changed(); }
  }
});

// tempo doppio o dimezzato: l'ambiguita' classica (80 o 160 BPM?)
function tempo(k) {
  const Au = S.P.audio, m = Au.meter || 4, sg = S.song;
  remember();
  Au.bpm = +(Au.bpm * k).toFixed(2);
  if (k === 2 && sg.detected.length > 1) {
    const d = sg.detected, out = [];
    d.forEach((b, i) => { out.push(b); if (i < d.length - 1) out.push(+((b + d[i + 1]) / 2).toFixed(4)); });
    sg.detected = out; Au.barOff = (Au.barOff * 2) % m;
  }
  if (k === 0.5 && sg.detected.length > 3) {
    const p = ((Au.barOff % 2) + 2) % 2;
    sg.detected = sg.detected.filter((_, i) => i % 2 === p); Au.barOff = Math.floor(Au.barOff / 2) % m;
  }
  if (Au.det) Au.det = { ...Au.det, beats: sg.detected };
  changed();
}
// batti il tempo durante il play: griglia fissa ancorata ai colpi
let taps = [];
function tap() {
  const Au = S.P.audio;
  if (!Au) return;
  if (!S.playing) { songMsg = t('tap_play'); renderInspector(); songMsg = ''; return; }
  const si = segAt(S.t);
  if (si < 0) return;
  const wall = performance.now() / 1000, src = srcAt(Au.clips[si], S.t);
  if (taps.length && wall - taps[taps.length - 1].w > 2) taps = [];
  taps.push({ w: wall, s: src });
  if (taps.length < 4) { songMsg = t('tap_more', 4 - taps.length); renderInspector(); songMsg = ''; return; }
  const step = (taps[taps.length - 1].w - taps[0].w) / (taps.length - 1);
  remember();
  Au.bpm = +(60 / step).toFixed(2); Au.mode = 'grid';
  Au.gridOff = +(((src % step) + step) % step).toFixed(3);
  changed();
}

// la clip i dura esattamente n battute, dalla battuta piu' vicina al suo inizio
function fitBars(i, n) {
  const bl = barLength();
  if (!bl) return;
  const bars = tlBeats().filter((b) => b.bar).map((b) => b.t);
  const st = clipStart(i);
  remember();
  const k = bars.findIndex((b) => b >= st - 0.06);
  let end = st + n * bl;
  if (k >= 0 && bars[k + n] != null) end = bars[k + n] - (bars[k] - st);
  S.P.video[i].dur = Math.max(0.5, end - st);
  changed();
}

// ── strumenti della timeline ───────────────────────────────────────────────
// pezzi del brano: dividere, duplicare, accodare
function splitSeg(i, t) {
  const C = S.P.audio.clips, c = C[i];
  if (!c || t < c.offset + 0.1 || t > segEnd(c) - 0.1) return false;
  const src = srcAt(c, t);
  C.splice(i, 1, { ...c, out: src, fadeOut: 0 }, { ...c, offset: t, in: src, fadeIn: 0 });
  return true;
}
// il pezzo i diviso a ogni n battute del brano che contiene
function splitEvery(i, n) {
  const c = S.P.audio.clips[i];
  const bars = srcBars(), onBar = bars.some((b) => Math.abs(b - c.in) < 0.1);
  // se il pezzo non parte su una battuta, la prima battuta dentro e' gia' un taglio (l'attacco resta a parte)
  const cuts = bars.filter((b) => b > c.in + 0.1 && b < c.out - 0.1).filter((_, k) => (onBar ? (k + 1) % n === 0 : k % n === 0));
  if (!cuts.length) { songMsg = t('no_bars_in'); renderInspector(); songMsg = ''; return; }
  remember();
  // da destra a sinistra: gli indici dei pezzi prima non cambiano
  for (const b of cuts.reverse()) splitSeg(i, c.offset + (b - c.in) / (c.rate || 1));
  S.sel = { kind: 'a', i };
  changed();
}
function dupSeg(i) {
  const C = S.P.audio.clips, c = C[i], len = segLen(c), end = segEnd(c);
  remember();
  for (const o of C) if (o !== c && o.offset >= end - 1e-3) o.offset += len;
  C.splice(i + 1, 0, { ...c, offset: end });
  S.sel = { kind: 'a', i: i + 1 };
  changed();
}
// in ordine di tempo, ognuno subito dopo il precedente (dal primo che resta dov'e')
function closeGaps() {
  const C = S.P.audio.clips;
  remember();
  const cur = C[S.sel.i];
  C.sort((a, b) => a.offset - b.offset);
  for (let k = 1; k < C.length; k++) C[k].offset = segEnd(C[k - 1]);
  S.sel = { kind: 'a', i: C.indexOf(cur) };
  changed();
}

function splitAt() {
  if (S.sel?.kind === 'a' && S.P.audio) {
    // il pezzo scelto se l'indicatore ci sta dentro, altrimenti quello che suona li'
    const C = S.P.audio.clips, i = C[S.sel.i] && S.t > C[S.sel.i].offset && S.t < segEnd(C[S.sel.i]) ? S.sel.i : segAt(S.t);
    if (i < 0) return;
    remember();
    if (!splitSeg(i, S.t)) return;
    S.sel = { kind: 'a', i: i + 1 };
    changed();
    return;
  }
  const info = clipAt(S.t);
  if (!info) return;
  const { c, i, lt } = info;
  if (lt < 0.3 || c.dur - lt < 0.3) return;
  remember();
  const [a, b] = clipRange(c);
  const active = Math.max(0.05, c.dur - c.hold);
  const p = progressIn(c, info.t0, Math.min(lt, active));
  const mid = Math.round(a + (b - a) * p);
  const cm = camAt(c, lt);
  const copy = () => JSON.parse(JSON.stringify(c));
  const first = { ...copy(), dur: lt, hold: 0, to: A.frames[mid].t, cam1: { lon: wrapLon(cm.lon - c.spin * lt), lat: cm.lat, dist: cm.dist } };
  const second = { ...copy(), dur: c.dur - lt, fade: 0, from: A.frames[mid].t, cam0: { lon: wrapLon(cm.lon), lat: cm.lat, dist: cm.dist } };
  S.P.video.splice(i, 1, first, second);
  S.sel = { kind: 'v', i: i + 1 };
  changed();
}
function deleteSel() {
  if (!S.sel) return;
  remember();
  if (S.sel.kind === 'v') { S.P.video.splice(S.sel.i, 1); S.sel = S.P.video.length ? { kind: 'v', i: Math.max(0, S.sel.i - 1) } : null; }
  else if (S.P.audio.clips.length > 1) { S.P.audio.clips.splice(S.sel.i, 1); S.sel = { kind: 'a', i: Math.max(0, S.sel.i - 1) }; }
  else { S.P.audio = null; S.sel = null; }
  changed();
}
// confini fra le clip sulla battuta piu' vicina; fixLast: l'ultimo resta dov'e'
function onBars(ends, fixLast = false) {
  const bars = tlBeats().filter((b) => b.bar).map((b) => b.t).filter((b) => b > 0.4);
  let prev = 0;
  return ends.map((e, i) => {
    let best = e;
    if (bars.length && !(fixLast && i === ends.length - 1)) {
      let bd = Infinity;
      for (const b of bars) if (b > prev + 0.5 && Math.abs(b - e) < bd) { bd = Math.abs(b - e); best = b; }
    }
    const d = Math.max(0.5, best - prev);
    prev += d;
    return d;
  });
}
function setDurs(ds) { ds.forEach((d, i) => { const c = S.P.video[i]; c.dur = d; c.hold = Math.min(c.hold, Math.max(0, d - 0.2)); }); }
$('#t-bars').addEventListener('click', () => {
  if (!S.P.audio || !S.P.video.length) return;
  remember();
  let acc = 0;
  setDurs(onBars(S.P.video.map((c) => (acc += c.dur))));
  changed();
});
$('#t-fill').addEventListener('click', () => {
  if (!S.P.audio || !S.P.video.length) return;
  const target = audioEnd();
  if (target < 1) return;
  remember();
  const k = target / total();
  let acc = 0;
  const ends = S.P.video.map((c) => (acc += c.dur * k));
  ends[ends.length - 1] = target;                       // la musica finisce col reel
  setDurs(onBars(ends, true));
  changed();
});
$('#t-split').addEventListener('click', splitAt);
$('#t-del').addEventListener('click', deleteSel);
const SNAPS = ['bar', 'beat', 'off'];
function showSnapMode() { $('#t-snap-l').textContent = t(`snap_${S.P.snap}`); $('#t-snap').classList.toggle('on', S.P.snap !== 'off'); }
$('#t-snap').addEventListener('click', () => { S.P.snap = SNAPS[(SNAPS.indexOf(S.P.snap) + 1) % 3]; showSnapMode(); saveLocal(); renderTimeline(); });
$('#mute').addEventListener('click', () => { if (!S.P.audio) return; remember(); S.P.audio.mute = !S.P.audio.mute; $('#mute').classList.toggle('off', S.P.audio.mute); changed(); if (S.playing) { pause(); play(); } });
// annullando si torna anche ai battiti salvati nel progetto
function reloadSongState() { const Au = S.P.audio; if (Au?.det?.beats && S.song.name === Au.name) S.song.detected = Au.det.beats; }
$('#undo').addEventListener('click', () => { if (undo()) { reloadSongState(); changed(); } });
$('#redo').addEventListener('click', () => { if (redo()) { reloadSongState(); changed(); } });

// ── anteprima e trasporto ──────────────────────────────────────────────────
const out = $('#out'), ctx = out.getContext('2d');
let src = null, playT0 = 0, lastInfo = null, exporting = false;
function play() {
  if (!A.oe || exporting || !S.P.video.length) return;
  if (S.t >= total() - 0.05) S.t = 0;
  const a = audioCtx();
  a.resume();
  const when = a.currentTime + 0.05;
  src = scheduleSong(a, a.destination, S.t, when);
  playT0 = when - S.t;
  S.playing = true;
  A.oe.preview(true);
  A.asked.clear();
  $('#play').textContent = '❚❚';
}
function pause() {
  for (const x of src || []) { try { x.stop(); } catch (e) { /* gia' fermo */ } }
  src = null;
  S.playing = false;
  A.oe?.preview(false);
  $('#play').textContent = '▶';
  need = true;
}
function seek(tt) {
  S.t = Math.max(0, Math.min(total(), tt));
  need = true; camNeed = true;
  if (S.playing) { pause(); play(); }
  movePlayhead();
}
initTimeline({
  changed, seek, addView, importFile,
  select(s) {
    S.sel = s;
    if (s?.kind === 'v') { const st = clipStart(s.i), c = S.P.video[s.i]; if (S.t < st || S.t > st + c.dur) seek(st + 0.01); }
    renderInspector(); renderTimeline();
  },
  label: () => t('total', total().toFixed(2), S.P.video.length),
  text: (k) => t(k),
});

let lastNow = performance.now(), lateSince = 0;
function fmtTC(s) { const m = Math.floor(s / 60), r = s - m * 60; return `${String(m).padStart(2, '0')}:${r.toFixed(2).padStart(5, '0')}`; }
function frame(now) {
  const dt = Math.min(100, now - lastNow);
  lastNow = now;
  if (A.oe && !exporting) {
    if (S.playing) {
      S.t = Math.max(0, audioCtx().currentTime - playT0);
      if (S.t >= total()) { S.t = total(); pause(); }
      feed(S.t);
      lastInfo = applyAt(S.t, true, true);
    } else if (need || !lastInfo) {
      lastInfo = applyAt(S.t, camNeed);
      need = false; camNeed = false;
    }
    A.clock.step(dt);
    compose(ctx, lastInfo, S.t);
    // da fermi: il mese scelto non e' ancora sul globo (file in arrivo)
    const late = !S.playing && lastInfo && !A.oe.ready();
    if (!late) lateSince = 0; else if (!lateSince) lateSince = now;
    $('#wait').hidden = !((S.playing && lastInfo?.waiting) || (late && now - lateSince > 400));
    movePlayhead();
    $('#clock').textContent = fmtTC(S.t);
    const bs = tlBeats().filter((b) => b.t <= S.t + 1e-3);
    const lastBar = [...bs].reverse().find((b) => b.bar);
    $('#bar-pos').textContent = lastBar ? t('bar_pos', lastBar.n, bs.length - bs.indexOf(lastBar)) : '';
  }
  requestAnimationFrame(frame);
}
$('#play').addEventListener('click', () => (S.playing ? pause() : play()));
$('#go-start').addEventListener('click', () => { seek(0); scrollToT(0); });
$('#go-end').addEventListener('click', () => { seek(total()); scrollToT(total()); });
function stepBar(dir) {
  const bars = tlBeats().filter((b) => b.bar).map((b) => b.t);
  if (!bars.length) { seek(S.t + dir); return; }
  const nxt = dir > 0 ? bars.find((b) => b > S.t + 0.02) : [...bars].reverse().find((b) => b < S.t - 0.02);
  seek(nxt ?? (dir > 0 ? total() : 0));
  scrollToT(S.t);
}
$('#go-prev').addEventListener('click', () => stepBar(-1));
$('#go-next').addEventListener('click', () => stepBar(1));
$('#safe-on').addEventListener('change', (e) => { S.P.safe = e.target.checked; $('#safe').hidden = !S.P.safe; saveLocal(); });

// trascinare l'anteprima gira il globo (a pausa), la rotella avvicina
{
  let drag = null;
  out.addEventListener('pointerdown', (e) => { if (!A.oe || S.playing) return; drag = { x: e.clientX, y: e.clientY }; out.setPointerCapture(e.pointerId); });
  out.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const k = ((A.oe.camera.dist - 1) * 40) / out.clientHeight;
    A.oe.camera.lon -= (e.clientX - drag.x) * k * 1.8;
    A.oe.camera.lat = Math.max(-85, Math.min(85, A.oe.camera.lat + (e.clientY - drag.y) * k * 1.8));
    drag = { x: e.clientX, y: e.clientY };
  });
  out.addEventListener('pointerup', () => { drag = null; });
  out.addEventListener('wheel', (e) => { if (!A.oe || S.playing) return; e.preventDefault(); A.oe.camera.dist = Math.max(1.3, Math.min(6, A.oe.camera.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
}

// tastiera
addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select') || $('#exp').open) return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); $(e.shiftKey ? '#redo' : '#undo').click(); return; }
  if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); $('#redo').click(); return; }
  if (ctrl) return;
  if (e.code === 'Space') { e.preventDefault(); S.playing ? pause() : play(); }
  else if (e.key === 's' || e.key === 'S') splitAt();
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); }
  else if (e.key === 't' || e.key === 'T') tap();
  else if (e.key === 'Home') seek(0);
  else if (e.key === 'End') seek(total());
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    if (e.shiftKey) stepBar(dir); else seek(S.t + dir / S.P.fps);
  } else if (e.key === '+' || e.key === '=') setZoom(+$('#zoom').value + 0.08);
  else if (e.key === '-') setZoom(+$('#zoom').value - 0.08);
  else if (e.key === 'Escape') { S.sel = null; renderInspector(); renderTimeline(); }
});
// un file audio lasciato sulla pagina
addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
addEventListener('drop', (e) => {
  const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith('audio/'));
  if (!f || e.defaultPrevented) return;
  e.preventDefault();
  importFile(f);
});

// ── progetto su file ───────────────────────────────────────────────────────
const slug = () => (S.P.title || 'atlante').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
$('#proj-save').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S.P, null, 1)], { type: 'application/json' }));
  a.download = `reel-${slug()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
$('#proj-open').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  let p = null;
  try { p = migrate(JSON.parse(await f.text())); } catch (err) { p = null; }
  if (!p) { alert(t('bad_project')); return; }
  remember();
  const relang = p.lang !== S.P.lang;
  S.P = { ...defaultProject(UI), ...p, overlay: { ...defaultProject(UI).overlay, ...p.overlay } };
  S.sel = null; S.t = 0;
  reloadSongState();
  showSnapMode();
  changed();
  if (relang) { pause(); await startAtlas(); }
});

// ── esportazione ───────────────────────────────────────────────────────────
let cancelExport = false;
const fmtDur = (s) => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return m ? `${m} min ${s % 60} s` : `${s} s`; };
$('#export').addEventListener('click', async () => {
  if (!A.oe || exporting) return;
  if (!S.P.video.length) { alert(t('no_clips')); return; }
  pause();
  const dlg = $('#exp'), info = $('#exp-info'), bar = $('#exp-bar'), status = $('#exp-status'), dl = $('#exp-dl');
  dl.hidden = true; bar.value = 0; status.textContent = '';
  $('#exp-cancel').textContent = t('cancel');
  dlg.showModal();
  const withAudio = !!(S.P.audio && S.song.buffer && S.song.name === S.P.audio.name && !S.P.audio.mute);
  const codecs = await pickCodecs(withAudio);
  if (!codecs) { info.textContent = t('no_webcodecs'); return; }
  info.textContent = t('codec_info', `H.264 ${W}×${H} ${S.P.fps} fps`, codecs.audio ? (codecs.audio.mux === 'aac' ? 'AAC' : 'Opus') : null) + (codecs.audio?.mux === 'opus' ? ' ' + t('opus_note') : '');
  exporting = true; cancelExport = false;
  try {
    const r = await exportMp4(out, codecs, (p) => {
      if (p.wait) { status.textContent = t('wait_data'); return; }
      bar.value = p.f / p.N;
      status.textContent = t('frame', p.f, p.N, fmtDur((p.elapsed / p.f) * (p.N - p.f)));
      S.t = p.t; movePlayhead();
    }, () => cancelExport);
    dl.href = URL.createObjectURL(r.blob);
    dl.download = `reel-${slug()}-${new Date().toISOString().slice(0, 10)}.mp4`;
    dl.hidden = false;
    bar.value = 1;
    status.textContent = t('done', (r.blob.size / 1e6).toFixed(1), fmtDur(r.seconds));
    $('#exp-cancel').textContent = t('close');
    window.__reelBlob = r.blob;                          // per i test automatici
  } catch (err) {
    status.textContent = err.message === 'cancel' ? t('cancelled') : err.message === 'timeout' ? t('timeout') : String(err.message || err);
  } finally {
    exporting = false;
    need = true; camNeed = true;
  }
});
$('#exp-cancel').addEventListener('click', () => { if (exporting) cancelExport = true; else $('#exp').close(); });

// ── avvio ──────────────────────────────────────────────────────────────────
async function startAtlas() {
  const boot = $('#boot');
  boot.hidden = false; boot.classList.remove('error');
  try {
    await bootAtlas($('#atlas'), S.P.lang);
  } catch (err) {
    boot.textContent = t('atlas_fail'); boot.classList.add('error');
    return;
  }
  await document.fonts.load('700 40px "IBM Plex Mono"').catch(() => {});
  await document.fonts.load('900 40px Archivo').catch(() => {});
  // clip di viste che qui non hanno dati: alla prima vista disponibile
  for (const c of S.P.video) if (!A.views[c.view]) c.view = Object.keys(A.views)[0];
  boot.hidden = true;
  $('#play').disabled = false;
  renderLibrary();
  changed();
}

window.__reel = {
  get P() { return S.P; }, set P(p) { S.P = p; changed(); }, get S() { return S; }, get oe() { return A.oe; }, get t() { return S.t; },
  seek, play, pause, loadSong, addView, splitAt, fitBars, select: (s) => { S.sel = s; renderInspector(); renderTimeline(); },
};
$('#safe-on').checked = !!S.P.safe; $('#safe').hidden = !S.P.safe;
$('#mute').classList.toggle('off', !!S.P.audio?.mute);
showSnapMode();
renderInspector();
renderTimeline();
requestAnimationFrame(frame);
await startAtlas();
const stored = await loadStoredSong();
if (S.P.audio && stored && stored.name === S.P.audio.name) {
  try { await loadSong(stored.name, stored.bytes, true); } catch (err) { /* si reimporta */ }
}
renderInspector();
