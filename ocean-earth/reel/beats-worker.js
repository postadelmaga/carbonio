// Analisi del brano fuori dal thread della pagina (dura qualche secondo).
import { analyze, downbeats, silence } from './beats.js';

self.onmessage = (e) => {
  const { sampleRate, channels } = e.data;
  const buf = { sampleRate, length: channels[0].length, numberOfChannels: channels.length, duration: channels[0].length / sampleRate, getChannelData: (c) => channels[c] };
  const r = analyze(buf);
  const m4 = downbeats(r.beats, r.low, r.env, r.fr, 4, r.chroma);
  const m3 = m4.score(3);
  // il 3/4 solo se si impone chiaramente sul 4/4
  const meter = m3.contrast > m4.contrast * 1.15 ? 3 : 4;
  self.postMessage({ bpm: r.bpm, beats: r.beats, meter, barOff: meter === 3 ? m3.phase : m4.phase, trim: silence(buf) });
};
