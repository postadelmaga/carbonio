// Worker: scarica un PNG di dati e lo decodifica fuori dal thread principale.
// Restituisce i codici interi (per leggere i valori esatti al clic) e un array
// half-float pronto per la GPU (valore × maschera, maschera), vedi shaders.js.

let ENC = null;

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
  const h = sign | (e << 10) | ((m + 0x1000) >>> 13);
  return h;
}
const HALF_ONE = toHalf(1);

async function pixels(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const blob = await res.blob();
  const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const cv = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
  bmp.close();
  return img;
}

async function decode({ url, kind }) {
  const img = await pixels(url);
  const { width: w, height: h, data } = img;
  const n = w * h;
  if (kind === 'gray') {
    const g = new Uint8Array(n);
    for (let i = 0; i < n; i++) g[i] = data[i * 4];
    return { w, h, gray: g };
  }
  if (kind === 'scalar' || kind === 'series') {
    const { offset, step } = ENC.scalar;
    const codes = new Uint16Array(n);
    for (let i = 0; i < n; i++) codes[i] = (data[i * 4] << 8) | data[i * 4 + 1];
    if (kind === 'series') return { w, h, codes };
    const gpu = new Uint16Array(n * 2);
    for (let i = 0; i < n; i++) {
      const c = codes[i];
      if (c) { gpu[i * 2] = toHalf(offset + (c - 1) * step); gpu[i * 2 + 1] = HALF_ONE; }
    }
    return { w, h, codes, gpu };
  }
  if (kind === 'vector') {
    const { step, zero } = ENC.vector;
    const cu = new Uint16Array(n), cv = new Uint16Array(n);
    const gpu = new Uint16Array(n * 4);
    for (let i = 0; i < n; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const a = (r << 4) | (b >> 4), c = (g << 4) | (b & 15);
      cu[i] = a; cv[i] = c;
      if (a || c) {
        gpu[i * 4] = toHalf((a - zero) * step);
        gpu[i * 4 + 1] = toHalf((c - zero) * step);
        gpu[i * 4 + 2] = HALF_ONE;
      }
    }
    return { w, h, cu, cv, gpu };
  }
  throw new Error('tipo sconosciuto ' + kind);
}

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (msg.type === 'init') { ENC = msg.encoding; return; }
  try {
    const out = await decode(msg);
    const transfer = Object.values(out).filter((v) => v && v.buffer).map((v) => v.buffer);
    self.postMessage({ id: msg.id, ok: true, out }, transfer);
  } catch (e) {
    self.postMessage({ id: msg.id, ok: false, error: String(e && e.message || e) });
  }
};
