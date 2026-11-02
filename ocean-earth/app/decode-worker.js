// Worker: scarica un PNG di dati e lo decodifica fuori dal thread principale.
// Restituisce i codici interi (per leggere i valori esatti al clic) e un array
// half-float pronto per la GPU (valore × maschera, maschera), vedi shaders.js.

let ENC = null;
let PREV = null;
let GPU_PREV = false;                // anteprime decodificate dalla scheda video

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);
function toHalf(v) {
  f32[0] = v;
  const x = u32[0];
  const sign = (x >>> 16) & 0x8000;
  let e = ((x >>> 23) & 0xff) - 112;
  let m = x & 0x7fffff;
  if (e <= 0) {
    if (e < -10) return sign;
    m = (m | 0x800000) >>> (1 - e);
    return sign | ((m + 0x1000) >>> 13);
  }
  if (e >= 31) return sign | 0x7c00;
  // somma, non OR: se l'arrotondamento della mantissa riporta, sale l'esponente
  return sign | ((e << 10) + ((m + 0x1000) >>> 13));
}
const HALF_ONE = toHalf(1);

// tabelle codice → mezzo-float, calcolate una volta: la conversione per pixel
// era il grosso del tempo di decodifica
const LUT = {};
function lut(name, n, fn) {
  if (!LUT[name]) {
    const t = new Uint16Array(n);
    for (let c = 1; c < n; c++) t[c] = toHalf(fn(c));
    LUT[name] = t;
  }
  return LUT[name];
}

// misura di rete per ogni file: byte arrivati e millisecondi (Resource Timing)
function netInfo(url, t0) {
  const e = performance.getEntriesByName(url).pop();
  performance.clearResourceTimings();
  return { ms: performance.now() - t0, transfer: e ? e.transferSize : -1, size: e ? e.decodedBodySize : -1 };
}

// Cache del browser (Cache Storage): i fotogrammi non cambiano mai una volta
// pubblicati, quindi una volta scaricati si rileggono dal disco senza chiedere
// nulla al server, anche alle visite successive. I file fissi (terra, coste,
// climatologia) seguono la versione del manifest. Il resto passa dalla rete.
let CACHES = null;
const FRAME_RE = /\/data\/(p\/)?[mdh]\/[a-z0-9]+\/[^/]+\.(png|webp)$/;
const STATIC_RE = /\/data\/(static|clim|p90|bias)\//;

function cacheFor(url) {
  if (!CACHES) return null;
  if (FRAME_RE.test(url)) return CACHES.frames;
  if (STATIC_RE.test(url)) return CACHES.static;
  return null;
}

// restituisce il contenuto (Blob) e com'e' arrivato
async function load(url) {
  const t0 = performance.now();
  const cp = cacheFor(url);
  const cache = cp && await cp.catch(() => null);
  if (cache) {
    const hit = await cache.match(url).catch(() => null);
    if (hit) return { blob: await hit.blob(), net: { ms: performance.now() - t0, transfer: 0, stored: true } };
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const blob = await res.blob();
  const net = netInfo(url, t0);
  if (cache) {
    // se lo spazio e' finito si va avanti senza salvare
    net.stored = await cache.put(url, new Response(blob, { headers: { 'Content-Type': blob.type } })).then(() => true, () => false);
  }
  return { blob, net };
}

async function pixels(blob) {
  const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const cv = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
  bmp.close();
  return img;
}

async function decode({ url, kind }) {
  const { blob, net } = await load(url);
  if (kind === 'store') return { net };       // solo scaricare e salvare
  const out = await decodeBlob(blob, kind);
  out.net = net;
  return out;
}

async function decodeBlob(blob, kind) {
  if (kind === 'json') return { json: JSON.parse(await blob.text()) };
  // anteprime con la scheda video: qui solo la decodifica dell'immagine e i
  // canali che servono come byte (1 per la temperatura, 2 per le correnti);
  // la conversione in valori la fa uno shader (Globe.previewTexture). I byte
  // si caricano sulla scheda in un terzo del tempo di un'immagine.
  if (GPU_PREV && (kind === 'psst' || kind === 'pcur')) {
    const { width: w, height: h, data } = await pixels(blob);
    const n = w * h, ch = kind === 'pcur' ? 2 : 1, bytes = new Uint8Array(n * ch);
    if (ch === 1) for (let i = 0; i < n; i++) bytes[i] = data[i * 4];
    else for (let i = 0; i < n; i++) { bytes[i * 2] = data[i * 4]; bytes[i * 2 + 1] = data[i * 4 + 1]; }
    return { w, h, bytes, pk: kind, enc: kind === 'psst' ? PREV.sst : PREV.cur, preview: true };
  }
  const img = await pixels(blob);
  const { width: w, height: h, data } = img;
  const n = w * h;
  if (kind === 'gray') {
    const g = new Uint8Array(n);
    for (let i = 0; i < n; i++) g[i] = data[i * 4];
    return { w, h, gray: g };
  }
  if (kind === 'scalar' || kind === 'series' || kind.startsWith('v:')) {
    // 'v:<variabile>': una variabile col suo zero (manifest: encoding.scalar.offsets),
    // come il livello del mare o i flussi di CO₂
    const { step } = ENC.scalar;
    const offset = kind.startsWith('v:') ? ENC.scalar.offsets[kind.slice(2)] : ENC.scalar.offset;
    const codes = new Uint16Array(n);
    for (let i = 0; i < n; i++) codes[i] = (data[i * 4] << 8) | data[i * 4 + 1];
    if (kind === 'series') return { w, h, codes };
    const L = lut('scalar' + offset, 65536, (c) => offset + (c - 1) * step);   // una tabella per zero
    const gpu = new Uint16Array(n * 2);
    for (let i = 0; i < n; i++) {
      const c = codes[i];
      if (c) { gpu[i * 2] = L[c]; gpu[i * 2 + 1] = HALF_ONE; }
    }
    return { w, h, codes, gpu, off: offset };
  }
  // anteprime per la riproduzione (pipeline/preview.py): 8 bit
  if (kind === 'psst') {
    const { offset, step } = PREV.sst;
    const L = lut('psst', 256, (c) => offset + (c - 1) * step);
    const gpu = new Uint16Array(n * 2);
    for (let i = 0; i < n; i++) {
      const c = data[i * 4];
      if (c) { gpu[i * 2] = L[c]; gpu[i * 2 + 1] = HALF_ONE; }
    }
    return { w, h, gpu, preview: true };
  }
  if (kind === 'pcur') {
    const { max, zero, scale } = PREV.cur;
    const gpu = new Uint16Array(n * 4);
    const L = lut('pcur', 256, (c) => Math.sign(c - zero) * max * Math.pow(Math.abs(c - zero) / scale, 2));
    for (let i = 0; i < n; i++) {
      const a = data[i * 4], b = data[i * 4 + 1];
      if (a && b) { gpu[i * 4] = L[a]; gpu[i * 4 + 1] = L[b]; gpu[i * 4 + 2] = HALF_ONE; }
    }
    return { w, h, gpu, preview: true };
  }
  if (kind === 'vector') {
    const { step, zero } = ENC.vector;
    // il codice 0 vale -4,096 m/s quando l'altra componente c'e'
    const L = lut('vector', 4096, (c) => (c - zero) * step);
    L[0] = toHalf(-zero * step);
    const cu = new Uint16Array(n), cv = new Uint16Array(n);
    const gpu = new Uint16Array(n * 4);
    for (let i = 0; i < n; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const a = (r << 4) | (b >> 4), c = (g << 4) | (b & 15);
      cu[i] = a; cv[i] = c;
      if (a || c) {
        gpu[i * 4] = L[a];
        gpu[i * 4 + 1] = L[c];
        gpu[i * 4 + 2] = HALF_ONE;
      }
    }
    return { w, h, cu, cv, gpu };
  }
  throw new Error('tipo sconosciuto ' + kind);
}

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (msg.type === 'init') {
    ENC = msg.encoding; PREV = msg.preview; GPU_PREV = !!msg.gpuPrev;
    if (msg.cache && self.caches) {
      CACHES = { frames: caches.open(msg.cache.frames), static: caches.open(msg.cache.static) };
    }
    return;
  }
  try {
    const t0 = performance.now();
    const out = await decode(msg);
    out.net.total = performance.now() - t0;
    const transfer = Object.values(out).filter((v) => v && v.buffer).map((v) => v.buffer);
    self.postMessage({ id: msg.id, ok: true, out }, transfer);
  } catch (e) {
    self.postMessage({ id: msg.id, ok: false, error: String(e && e.message || e) });
  }
};
