// Battiti di un brano, tutto nel browser.
//   1. inviluppo degli attacchi: flusso spettrale sul logaritmo dello spettro
//   2. tempo: autocorrelazione dell'inviluppo, pesata attorno ai 120 BPM
//   3. battiti: programmazione dinamica (D. Ellis, "Beat tracking by dynamic
//      programming", 2007), che segue il tempo reale anche se oscilla
// Restituisce { bpm, beats: [secondi] }.


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
  // si lavora fra 16 e 24 kHz (media di f campioni): sopra gli 8 kHz non serve
  // niente, e finestre da ~21 ms costano meta' che a 48 kHz
  const f0 = Math.max(1, Math.floor(buffer.sampleRate / 22050));
  const sr = buffer.sampleRate / f0, len = Math.floor(buffer.length / f0), ch = buffer.numberOfChannels;
  const N = 2 ** Math.round(Math.log2(sr * 0.0213)), HOP = N / 2;
  const x = new Float32Array(len + N);                 // N/2 di silenzio prima: fotogrammi centrati
  for (let c = 0; c < ch; c++) {
    const d = buffer.getChannelData(c);
    const k = 1 / (ch * f0);
    for (let i = 0; i < len; i++) { let v = 0; for (let j = 0; j < f0; j++) v += d[i * f0 + j]; x[i + N / 2] += v * k; }
  }
  const frames = Math.floor(len / HOP);
  const T = fftTables(N), win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const bins = Math.min(N / 2, Math.round((8000 * N) / sr));   // fino a 8 kHz
  const lowBins = Math.max(2, Math.round((180 * N) / sr));        // bassi: cassa e basso
  const re = new Float64Array(N), im = new Float64Array(N);
  let prev = new Float32Array(bins), cur = new Float32Array(bins);
  const env = new Float32Array(frames), low = new Float32Array(frames);
  // armonia: energia per classe di nota (do, do#, …) fra 55 Hz e 2 kHz
  const chroma = new Float32Array(frames * 12);
  const pc = new Int8Array(bins).fill(-1);
  for (let k = 1; k < bins; k++) { const hz = (k * sr) / N; if (hz >= 55 && hz <= 2000) pc[k] = ((Math.round(12 * Math.log2(hz / 440)) + 69) % 12 + 12) % 12; }
  for (let f = 0; f < frames; f++) {
    const o = f * HOP;
    for (let i = 0; i < N; i++) { re[i] = x[o + i] * win[i]; im[i] = 0; }
    fft(re, im, T);
    let flux = 0, lf = 0;
    for (let k = 1; k < bins; k++) {
      cur[k] = Math.log1p(1000 * Math.hypot(re[k], im[k]));
      if (pc[k] >= 0) chroma[f * 12 + pc[k]] += cur[k];
      const d = cur[k] - prev[k];
      if (d > 0) { flux += d; if (k < lowBins) lf += d; }
    }
    env[f] = flux; low[f] = lf;
    [prev, cur] = [cur, prev];
  }
  // il primo fotogramma confronta il brano col nulla: non e' un attacco
  env[0] = 0; if (frames > 1) env[1] = Math.min(env[1], env[2] || 0);
  low[0] = 0; if (frames > 1) low[1] = Math.min(low[1], low[2] || 0);
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
  let ls = 0;
  for (let i = 0; i < frames; i++) ls += low[i] * low[i];
  ls = Math.sqrt(ls / frames) || 1;
  for (let i = 0; i < frames; i++) low[i] /= ls;
  return { env: out, low, chroma, fr };
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

// il primo battito di ogni battuta: quello su cui cadono piu' spesso i colpi
// bassi (cassa, basso). Si prova ogni sfasamento e, se non si impone, anche il 3/4.
export function downbeats(beats, low, env, fr, meter = 4, chroma = null) {
  const at = (b) => { const f = Math.round(b * fr); let m = 0; for (let k = f - 2; k <= f + 2; k++) m = Math.max(m, (low[k] || 0) + 0.3 * (env[k] || 0)); return m; };
  const hit = beats.map(at);
  // cambio d'armonia all'attacco di ogni battito: l'accordo del battito contro
  // quello del battito prima (1 − coseno fra i due vettori di note)
  const change = new Array(beats.length).fill(0);
  if (chroma) {
    const nF = chroma.length / 12;
    const seg = beats.map((b, k) => {
      const a = Math.max(0, Math.round(b * fr)), e = Math.min(nF, Math.round((beats[k + 1] ?? b + 0.5) * fr));
      const v = new Float64Array(12);
      for (let f = a; f < e; f++) for (let c = 0; c < 12; c++) v[c] += chroma[f * 12 + c];
      return v;
    });
    for (let k = 1; k < seg.length; k++) {
      let d = 0, na = 0, nb = 0;
      for (let c = 0; c < 12; c++) { d += seg[k][c] * seg[k - 1][c]; na += seg[k][c] ** 2; nb += seg[k - 1][c] ** 2; }
      change[k] = na && nb ? 1 - d / Math.sqrt(na * nb) : 0;
    }
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const mh = mean(hit) || 1, mc = mean(change) || 1;
  const s = hit.map((h, k) => h / mh + (chroma ? change[k] / mc : 0));
  const score = (m) => {
    const sum = new Array(m).fill(0), n = new Array(m).fill(0);
    s.forEach((v, k) => { sum[k % m] += v; n[k % m]++; });
    const mean = sum.map((v, k) => v / Math.max(1, n[k]));
    const best = mean.indexOf(Math.max(...mean));
    const rest = mean.filter((_, k) => k !== best);
    return { phase: best, contrast: mean[best] / (rest.reduce((a, b) => a + b, 0) / rest.length || 1) };
  };
  return { meter, ...score(meter), score };
}

// silenzio all'inizio e alla fine: finestre di 20 ms sotto i -50 dB dal picco
export function silence(buffer, db = -50) {
  const sr = buffer.sampleRate, w = Math.round(sr * 0.02), n = Math.floor(buffer.length / w);
  const ch = [...Array(buffer.numberOfChannels)].map((_, c) => buffer.getChannelData(c));
  const rms = new Float32Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (const d of ch) for (let k = i * w; k < (i + 1) * w; k += 2) s += d[k] * d[k];
    rms[i] = Math.sqrt(s / ((w / 2) * ch.length));
    peak = Math.max(peak, rms[i]);
  }
  const th = peak * 10 ** (db / 20);
  let a = 0, b = n - 1;
  while (a < n && rms[a] < th) a++;
  while (b > a && rms[b] < th) b--;
  // un attimo di margine prima dell'attacco e dopo la coda
  return { start: Math.max(0, (a * w) / sr - 0.05), end: Math.min(buffer.duration, ((b + 1) * w) / sr + 0.3) };
}

export function analyze(buffer) {
  const E = onsetEnvelope(buffer);
  const { env, low, fr } = E;
  const bpm = estimateTempo(env, fr);
  const beats = trackBeats(env, fr, bpm);
  // tempo dai battiti trovati: retta dei minimi quadrati (battito k al tempo t_k)
  const n = beats.length;
  if (n < 4) return { bpm, beats, env, low, chroma: E.chroma, fr };
  let sk = 0, st = 0, skk = 0, skt = 0;
  beats.forEach((t, k) => { sk += k; st += t; skk += k * k; skt += k * t; });
  const slope = (n * skt - sk * st) / (n * skk - sk * sk);
  return { bpm: 60 / slope, beats, env, low, chroma: E.chroma, fr };
}
