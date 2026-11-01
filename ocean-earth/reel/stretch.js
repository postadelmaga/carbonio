// Allungare o accorciare un pezzo di brano senza cambiarne l'intonazione:
// WSOLA (sovrapposizione e somma di finestre, ognuna spostata di poco dove
// l'onda combacia meglio con la precedente). Va bene per la musica con un
// cambio di velocita' moderato (60-160%); oltre si sentono gli artefatti.

const N = 2048, HS = N / 2, TOL = 512;
const WIN = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));   // Hann periodica: a meta' sovrapposizione somma 1

// buf: AudioBuffer; a, b: secondi nel file; rate > 1 piu' veloce (piu' corto)
export function stretchBuffer(buf, a, b, rate) {
  const sr = buf.sampleRate, nch = buf.numberOfChannels;
  const ch = [...Array(nch)].map((_, c) => buf.getChannelData(c));
  const s0 = Math.max(0, Math.floor(a * sr)), s1 = Math.min(buf.length, Math.ceil(b * sr));
  const outLen = Math.max(1, Math.round((s1 - s0) / rate));
  // canale unico per cercare dove le finestre combaciano
  const mono = new Float32Array(buf.length);
  for (const d of ch) for (let i = s0; i < s1; i++) mono[i] += d[i];
  const out = [...Array(nch)].map(() => new Float32Array(outLen + N));
  const last = Math.max(s0, buf.length - N);
  const ha = HS * rate;
  let prev = s0;
  for (let k = 0, op = 0; op < outLen; k++, op += HS) {
    let pos = Math.min(last, Math.round(s0 + k * ha));
    if (k > 0) {
      const want = prev + HS;                               // continuazione naturale della finestra di prima
      const corr = (p, step) => { let s = 0; for (let j = 0; j < HS; j += step) s += mono[p + j] * mono[want + j]; return s; };
      const lo = Math.max(s0, pos - TOL), hi = Math.min(last, pos + TOL);
      let best = pos, bv = -Infinity;
      for (let p = lo; p <= hi; p += 8) { const v = corr(p, 8); if (v > bv) { bv = v; best = p; } }
      const c = best;
      bv = -Infinity;
      for (let p = Math.max(lo, c - 8); p <= Math.min(hi, c + 8); p++) { const v = corr(p, 2); if (v > bv) { bv = v; best = p; } }
      pos = want <= last ? best : pos;
    }
    for (let c = 0; c < nch; c++) {
      const d = ch[c], o = out[c];
      for (let j = 0; j < N && pos + j < s1; j++) o[op + j] += d[pos + j] * WIN[j];
    }
    prev = pos;
  }
  // la prima mezza finestra non ha una compagna: si riporta su
  for (const o of out) for (let j = 0; j < HS; j++) o[j] /= Math.max(0.05, WIN[j]);
  const res = new AudioBuffer({ length: outLen, numberOfChannels: nch, sampleRate: sr });
  out.forEach((o, c) => res.copyToChannel(o.subarray(0, outLen), c));
  return res;
}

// pezzi allungati gia' calcolati (si rifanno solo quando cambiano)
const memo = new Map();
export function stretched(buf, a, b, rate) {
  const key = `${a.toFixed(4)}|${b.toFixed(4)}|${rate.toFixed(5)}`;
  if (memo.get('buf') !== buf) { memo.clear(); memo.set('buf', buf); }
  let r = memo.get(key);
  if (!r) {
    r = stretchBuffer(buf, a, b, rate);
    if (memo.size > 40) for (const k of memo.keys()) if (k !== 'buf') { memo.delete(k); break; }
    memo.set(key, r);
  }
  return r;
}
