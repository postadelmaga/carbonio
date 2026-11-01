// Esportazione MP4: fotogramma per fotogramma, aspettando i dati esatti di
// ogni istante, H.264 con WebCodecs e mp4-muxer; l'audio e' il mix della
// traccia musica (AAC dove il browser lo codifica, altrimenti Opus).

import { Muxer, ArrayBufferTarget } from './vendor/mp4-muxer.mjs';
import { S, W, H, total, gainAt, audioLen } from './model.js';
import { A, applyAt, until } from './atlas.js';
import { compose } from './render.js';

export async function pickCodecs(withAudio) {
  if (!('VideoEncoder' in window)) return null;
  const fps = S.P.fps, bitrate = S.P.rate * 1e6;
  let video = null;
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.420028', 'avc1.640032']) {
    const cfg = { codec, width: W, height: H, bitrate, framerate: fps, avc: { format: 'avc' } };
    try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) { video = cfg; break; } } catch (e) { /* prossimo */ }
  }
  if (!video) return null;
  let audio = null;
  if (withAudio && 'AudioEncoder' in window) {
    for (const [codec, mux] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
      const cfg = { codec, sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 };
      try { if ((await AudioEncoder.isConfigSupported(cfg)).supported) { audio = { cfg, mux }; break; } } catch (e) { /* prossimo */ }
    }
  }
  return { video, audio };
}

// curva del volume campionata (50 punti al secondo) da t0 per la durata d
export function gainCurve(t0, d) {
  const n = Math.max(2, Math.ceil(d * 50));
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = gainAt(t0 + (d * i) / (n - 1));
  return c;
}

// il brano suonato sulla timeline da t0 (in tempo reale o fuori linea)
export function scheduleSong(ctx, dest, t0, when) {
  const P = S.P, Au = P.audio;
  if (!Au || !S.song.buffer || Au.mute) return null;
  const T = total(), len = audioLen();
  const startTl = Math.max(t0, Au.offset), endTl = Math.min(T, Au.offset + len);
  if (endTl <= startTl) return null;
  const src = ctx.createBufferSource(), gain = ctx.createGain();
  src.buffer = S.song.buffer;
  src.connect(gain).connect(dest);
  const at = when + (startTl - t0), d = endTl - startTl;
  gain.gain.value = gainAt(startTl);
  gain.gain.setValueCurveAtTime(gainCurve(startTl, d), at, d);
  src.start(at, Au.in + (startTl - Au.offset), d);
  return src;
}

async function renderAudio() {
  const T = total(), sr = 48000;
  const oc = new OfflineAudioContext(2, Math.ceil(T * sr), sr);
  scheduleSong(oc, oc.destination, 0, 0);
  return oc.startRendering();
}

export async function exportMp4(out, codecs, onProgress, cancelled) {
  const ctx = out.getContext('2d');
  const fps = S.P.fps, N = Math.round(total() * fps), oe = A.oe;
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: W, height: H, frameRate: fps },
    audio: codecs.audio ? { codec: codecs.audio.mux, numberOfChannels: 2, sampleRate: 48000 } : undefined,
    fastStart: 'in-memory',
  });
  let failed = null;
  const venc = new VideoEncoder({ output: (ch, meta) => muxer.addVideoChunk(ch, meta), error: (e) => { failed = e; } });
  venc.configure(codecs.video);
  const t0 = performance.now();
  try {
    oe.preview(false);
    // le scie partono gia' formate: un po' di simulazione prima del primo fotogramma
    let inf = applyAt(0);
    await until(() => oe.ready(), 120000, 20);
    for (let k = 0; k < 150; k++) A.clock.step(1000 / fps);
    for (let f = 0; f < N; f++) {
      if (cancelled()) throw new Error('cancel');
      if (failed) throw failed;
      const t = f / fps;
      inf = applyAt(t);
      if (!oe.ready()) {
        onProgress({ f, N, t, wait: true });
        try { await until(() => oe.ready(), 90000, 15); } catch (e) { throw new Error('timeout'); }
      }
      A.clock.step(1000 / fps);
      compose(ctx, inf, t);
      const vf = new VideoFrame(out, { timestamp: Math.round((f * 1e6) / fps), duration: Math.round(1e6 / fps) });
      venc.encode(vf, { keyFrame: f % (fps * 2) === 0 });
      vf.close();
      if (venc.encodeQueueSize > 6) await new Promise((r) => { const w = () => (venc.encodeQueueSize > 2 ? setTimeout(w, 5) : r()); w(); });
      if (f % 5 === 0) {
        onProgress({ f: f + 1, N, t, elapsed: (performance.now() - t0) / 1000 });
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    await venc.flush();
    if (codecs.audio) {
      const buf = await renderAudio();
      const aenc = new AudioEncoder({ output: (ch, meta) => muxer.addAudioChunk(ch, meta), error: (e) => { failed = e; } });
      aenc.configure(codecs.audio.cfg);
      const L = buf.getChannelData(0), R = buf.getChannelData(1), step = 4800;
      for (let i = 0; i < buf.length; i += step) {
        const n = Math.min(step, buf.length - i), data = new Float32Array(n * 2);
        data.set(L.subarray(i, i + n), 0); data.set(R.subarray(i, i + n), n);
        const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((i * 1e6) / 48000), data });
        aenc.encode(ad); ad.close();
      }
      await aenc.flush();
      if (failed) throw failed;
    }
    muxer.finalize();
    return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), seconds: (performance.now() - t0) / 1000 };
  } catch (e) {
    try { venc.close(); } catch (err) { /* gia' chiuso */ }
    throw e;
  }
}
