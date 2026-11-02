// Il fotogramma del reel: il globo copiato dall'atlante e, sopra, titolo,
// didascalia, data, legenda e fonti. Anteprima ed esportazione usano questo.

import { S, W, H, blackAt } from './model.js';
import { A, legendNow } from './atlas.js';

const SRC = {
  sst: ['m:GLORYS12'], anom: ['m:GLORYS12'], mix: ['m:GLORYS12'], speed: ['m:Copernicus-GlobCurrent'], sla: ['m:DUACS'], ice: ['m:GLORYS12'],
  rain: ['c:ERA5'], drought: ['c:ERA5-Land'], co2: ['a:CAMS'], emis: ['a:CAMS'],
};
const SERVICE = { m: 'Copernicus Marine Service', c: 'Copernicus Climate Change Service', a: 'Copernicus Atmosphere Monitoring Service' };
const DATA_WORD = { it: 'Dati', en: 'Data', es: 'Datos', fr: 'Données', zh: '数据' };
export const LOCALE = { en: 'en-GB', it: 'it-IT', es: 'es-ES', fr: 'fr-FR', zh: 'zh-CN' };
const EMPTY = { it: 'Trascina una vista sulla traccia V1', en: 'Drag a view onto track V1', es: 'Arrastra una vista a la pista V1', fr: 'Glisse une vue sur la piste V1', zh: '把一个视图拖到 V1 轨道' };

const monthMemo = new Map();
function monthName(stamp) {
  const k = S.P.lang + stamp;
  let r = monthMemo.get(k);
  if (r == null) { r = monthNameRaw(stamp); monthMemo.set(k, r); }
  return r;
}
function monthNameRaw(stamp) {
  return new Date(Date.UTC(+stamp.slice(0, 4), +stamp.slice(5, 7) - 1, 1)).toLocaleDateString(LOCALE[S.P.lang] || 'en-GB', { month: 'long', timeZone: 'UTC' });
}

function wrap(g, text, maxW) {
  const words = text.split(/\s+/), lines = [];
  let line = '';
  // il cinese non ha spazi: si va a capo carattere per carattere
  const units = S.P.lang === 'zh' ? [...text] : words;
  const sep = S.P.lang === 'zh' ? '' : ' ';
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
  return `${DATA_WORD[S.P.lang] || 'Data'}: ` + Object.entries(by).map(([s, n]) => `${SERVICE[s]} (${n.join(', ')})`).join(' · ');
}

export function compose(ctx, info, t) {
  const g = ctx;
  const P = S.P;
  if (!info) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    g.fillStyle = '#05090d'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#6f8592'; g.font = '500 38px Archivo'; g.textAlign = 'center';
    g.fillText(EMPTY[P.lang] || EMPTY.en, W / 2, H / 2);
    return;
  }
  const gc = A.frame.contentDocument.querySelector('#globe');
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
      const sp = spaceColor(gc, info?.c);
      g.fillStyle = sp; g.fillRect(0, 0, W, dy);
      const fade = g.createLinearGradient(0, dy, 0, dy + 160);
      fade.addColorStop(0, sp); fade.addColorStop(1, sp.replace('rgb(', 'rgba(').replace(')', ',0)'));
      g.fillStyle = fade; g.fillRect(0, dy, W, 160);
    }
  }
  const { c, i } = info;
  const L = legendNow();
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
    const f = A.frames[Math.round(info.pos)];
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
    g.textAlign = 'left'; g.fillText(A.frames[info.range[0]].t.slice(0, 4), bx, y + 26);
    g.textAlign = 'right'; g.fillText(A.frames[info.range[1]].t.slice(0, 4), bx + bw, y + 26);
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
    // ridotta o ingrandita attorno al suo bordo basso, che resta sopra la zona di Instagram
    const k = (P.legendScale || 100) / 100, base = H - 430;
    g.save();
    g.translate(W / 2, base); g.scale(k, k); g.translate(-W / 2, -base);
    const hTot = blocks.reduce((s, b) => s + b.h, 0) + 24;
    let top = base - hTot;
    g.fillStyle = 'rgba(4,10,16,.62)';
    roundRect(g, 90, top, W - 180, hTot, 18); g.fill();
    top += 14;
    for (const b of blocks) { b.draw(top); top += b.h; }
    g.restore();
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
// il colore dello spazio: il pixel piu' scuro della prima riga del globo.
// Leggere i pixel della scheda video ferma tutto finche' il disegno non e'
// finito (era il costo piu' grande dell'anteprima, piu' di 3 s ogni 10): lo
// spazio non cambia coi mesi, quindi si rilegge solo cambiando clip o vista,
// e da fermi al massimo due volte al secondo.
const probe = document.createElement('canvas');
probe.width = 64; probe.height = 1;
const space = { key: null, color: '#000', at: 0 };
function spaceColor(gc, c) {
  const key = c ? `${c.view}/${c.variant}/${c.particles}/${S.P.lang}/${gc.width}x${gc.height}` : '';
  const now = performance.now();
  if (key === space.key && (S.playing || now - space.at < 500)) return space.color;
  space.key = key; space.at = now;
  space.color = readSpace(gc);
  return space.color;
}
function readSpace(gc) {
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
