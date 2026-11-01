// Battiti di un brano, tutto nel browser.
//   1. inviluppo degli attacchi: flusso spettrale sul logaritmo dello spettro
//   2. tempo: autocorrelazione dell'inviluppo, pesata attorno ai 120 BPM
//   3. battiti: programmazione dinamica (D. Ellis, "Beat tracking by dynamic
//      programming", 2007), che segue il tempo reale anche se oscilla
// Restituisce { bpm, beats: [secondi] }.

const N = 1024, HOP = 512;

function fftTables(n) {
  const rev = new Uint32Array(n), bits = Math.log2(n);
  for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
  const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos((2 * Math.PI * i) / n); sin[i] = -Math.sin((2 * Math.PI * i) / n); }
  return { rev, cos, sin };
}

function fft(re, im, T) {
  const n = re.length;
  for (let i = 0; i < n; i++) {
    const j = T.rev[i];
    if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1, step = n / size;
    for (let i = 0; i < n; i += size) {
      for (let k = 0; k < half; k++) {
        const c = T.cos[k * step], s = T.sin[k * step];
        const a = i + k, b = a + half;
        const tr = re[b] * c - im[b] * s, ti = re[b] * s + im[b] * c;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
      }
    }
  }
}

export function onsetEnvelope(buffer) {
  const sr = buffer.sampleRate, len = buffer.length, ch = buffer.numberOfChannels;
  const x = new Float32Array(len + N);                 // N/2 di silenzio prima: fotogrammi centrati
  for (let c = 0; c < ch; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < len; i++) x[i + N / 2] += d[i] / ch;
  }
  const frames = Math.floor(len / HOP);
  const T = fftTables(N), win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const bins = Math.min(N / 2, Math.round((8000 * N) / sr));   // fino a 8 kHz
  const re = new Float64Array(N), im = new Float64Array(N);
  let prev = new Float32Array(bins), cur = new Float32Array(bins);
  const env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const o = f * HOP;
    for (let i = 0; i < N; i++) { re[i] = x[o + i] * win[i]; im[i] = 0; }
    fft(re, im, T);
    let flux = 0;
    for (let k = 1; k < bins; k++) {
      cur[k] = Math.log1p(1000 * Math.hypot(re[k], im[k]));
      const d = cur[k] - prev[k];
      if (d > 0) flux += d;
    }
    env[f] = flux;
    [prev, cur] = [cur, prev];
  }
  // il primo fotogramma confronta il brano col nulla: non e' un attacco
  env[0] = 0; if (frames > 1) env[1] = Math.min(env[1], env[2] || 0);
  // tolta la media locale (mezzo secondo), solo la parte positiva, deviazione 1
  const fr = sr / HOP, w = Math.round(fr * 0.25);
  const out = new Float32Array(frames);
  let acc = 0;
  const cs = new Float64Array(frames + 1);
  for (let i = 0; i < frames; i++) cs[i + 1] = cs[i] + env[i];
  for (let i = 0; i < frames; i++) {
    const a = Math.max(0, i - w), b = Math.min(frames, i + w + 1);
    out[i] = Math.max(0, env[i] - (cs[b] - cs[a]) / (b - a));
    acc += out[i] * out[i];
  }
  const sd = Math.sqrt(acc / frames) || 1;
  for (let i = 0; i < frames; i++) out[i] /= sd;
  return { env: out, fr };
}

export function estimateTempo(env, fr, lo = 60, hi = 200) {
  const minLag = Math.floor((60 * fr) / hi), maxLag = Math.ceil((60 * fr) / lo);
  const ac = new Float64Array(maxLag + 2);
  for (let L = minLag - 1; L <= maxLag + 1; L++) {
    let s = 0;
    for (let i = L; i < env.length; i++) s += env[i] * env[i - L];
    ac[L] = s / (env.length - L);
  }
  let best = minLag, bs = -Infinity;
  for (let L = minLag; L <= maxLag; L++) {
    const bpm = (60 * fr) / L;
    const wgt = Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.9) ** 2);
    if (ac[L] * wgt > bs) { bs = ac[L] * wgt; best = L; }
  }
  // massimo fra i campioni (parabola)
  const a = ac[best - 1], b = ac[best], c = ac[best + 1];
  const den = a - 2 * b + c;
  const lag = best + (den ? (0.5 * (a - c)) / den : 0);
  return (60 * fr) / lag;
}

export function trackBeats(env, fr, bpm, tightness = 100) {
  const P = (60 * fr) / bpm, n = env.length;
  const score = new Float64Array(n), back = new Int32Array(n).fill(-1);
  const lo = Math.round(P / 2), hi = Math.round(2 * P);
  for (let t = 0; t < n; t++) {
    let best = 0, bi = -1;
    for (let tau = t - hi; tau <= t - lo; tau++) {
      if (tau < 0) continue;
      const pen = Math.log((t - tau) / P);
      const v = score[tau] - tightness * pen * pen;
      if (bi < 0 || v > best) { best = v; bi = tau; }
    }
    score[t] = env[t] + (bi >= 0 ? Math.max(0, best) : 0);
    back[t] = bi >= 0 && best > 0 ? bi : -1;
  }
  // l'ultimo battito: il punteggio migliore nell'ultimo periodo
  let end = n - 1, bs = -Infinity;
  for (let t = Math.max(0, n - Math.round(P)); t < n; t++) if (score[t] > bs) { bs = score[t]; end = t; }
  const beats = [];
  for (let t = end; t >= 0; t = back[t]) { beats.push(t / fr); if (back[t] < 0) break; }
  beats.reverse();
  // via i battiti di testa e di coda senza attacco (silenzio prima e dopo il brano)
  const at = (b) => { const f = Math.round(b * fr); let m = 0; for (let k = f - 2; k <= f + 2; k++) m = Math.max(m, env[k] || 0); return m; };
  const strong = beats.map(at), ref = [...strong].sort((x, y) => x - y)[Math.floor(strong.length / 2)] * 0.2;
  let i0 = 0, i1 = beats.length;
  while (i0 < i1 && strong[i0] < ref) i0++;
  while (i1 > i0 && strong[i1 - 1] < ref) i1--;
  return beats.slice(i0, i1);
}

export function analyze(buffer) {
  const { env, fr } = onsetEnvelope(buffer);
  const bpm = estimateTempo(env, fr);
  const beats = trackBeats(env, fr, bpm);
  // tempo dai battiti trovati: retta dei minimi quadrati (battito k al tempo t_k)
  const n = beats.length;
  if (n < 4) return { bpm, beats };
  let sk = 0, st = 0, skk = 0, skt = 0;
  beats.forEach((t, k) => { sk += k; st += t; skk += k * k; skt += k * t; });
  const slope = (n * skt - sk * st) / (n * skk - sk * sk);
  return { bpm: 60 / slope, beats };
}
