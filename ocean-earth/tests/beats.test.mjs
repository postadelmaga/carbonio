// Rilevamento dei battiti dell'editor dei reel, su un brano sintetico a tempo noto
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../reel/beats.js';

test('battiti di un brano a 123,4 BPM', () => {
  const sr = 22050, dur = 30, bpm = 123.4, off = 0.37;
  const d = new Float32Array(sr * dur);
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
  for (let i = 0; i < d.length; i++) d[i] = 0.02 * rnd();
  for (let b = off; b < dur; b += 60 / bpm) { const s = Math.round(b * sr); for (let k = 0; k < 1000 && s + k < d.length; k++) d[s + k] += Math.exp(-k / 150) * Math.sin(k * 0.3) * 0.8; }
  const r = analyze({ sampleRate: sr, length: d.length, numberOfChannels: 1, getChannelData: () => d });
  assert.ok(Math.abs(r.bpm - bpm) < 0.5, `bpm ${r.bpm}`);
  const expected = Math.floor(((dur - off) * bpm) / 60) + 1;
  assert.ok(Math.abs(r.beats.length - expected) <= 1, `${r.beats.length} battiti, attesi ${expected}`);
  for (const b of r.beats) {
    const k = Math.round((b - off) / (60 / bpm));
    assert.ok(Math.abs(b - (off + (k * 60) / bpm)) < 0.03, `battito a ${b}`);
  }
});

test('primo battito della battuta: cassa su 1 e 3, accordo nuovo a ogni battuta, partenza in levare', async () => {
  const { downbeats } = await import('../reel/beats.js');
  const sr = 22050, bpm = 100, P = 60 / bpm, dur = 30, d = new Float32Array(sr * dur);
  const chords = [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]];
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
  for (let k = 0; k * P + 0.3 < dur; k++) {
    const beat = (k + 2) % 4, bar = Math.floor((k + 2) / 4), s0 = Math.round((0.3 + k * P) * sr);
    for (let i = 0; i < P * sr && s0 + i < d.length; i++) { let v = 0; for (const f of chords[bar % 4]) v += Math.sin((2 * Math.PI * f * i) / sr); d[s0 + i] += 0.05 * v; }
    for (let i = 0; i < 3000 && s0 + i < d.length; i++) d[s0 + i] += beat % 2 === 0 ? 0.8 * Math.exp(-i / 600) * Math.sin((2 * Math.PI * 55 * i) / sr) : 0.4 * Math.exp(-i / 300) * rnd();
  }
  const r = analyze({ sampleRate: sr, length: d.length, numberOfChannels: 1, getChannelData: () => d });
  const db = downbeats(r.beats, r.low, r.env, r.fr, 4, r.chroma);
  const first = r.beats.find((_, k) => k >= db.phase && (k - db.phase) % 4 === 0);
  assert.ok(Math.abs(first - (0.3 + 2 * P)) < 0.03, `prima battuta a ${first}`);
});
