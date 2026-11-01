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
