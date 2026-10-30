// Il tempo: livello (mese, giorno, ora), posizione fra i fotogrammi,
// riproduzione con intervallo ripetuto. La posizione e' un numero reale:
// la parte intera indica il fotogramma A, la parte decimale quanto si e'
// avanzati verso B (interpolazione solo visiva, dichiarata nell'interfaccia).

import { stampToYear } from './chart.js';

export class Timeline {
  constructor(manifest) {
    this.manifest = manifest;
    this.tierName = null;
    this.frames = [];
    this.pos = 0;
    this.playing = false;
    this.fps = 4;                        // fotogrammi di dato al secondo
    this.loop = null;                    // [i0, i1] o null = tutto
    this.waiting = false;
    this.listeners = new Set();
  }

  on(fn) { this.listeners.add(fn); }
  emit(why) { for (const fn of this.listeners) fn(why); }

  get tiers() { return Object.keys(this.manifest.tiers); }
  get tier() { return this.manifest.tiers[this.tierName]; }
  get index() { return Math.floor(this.pos + 1e-9); }
  get frac() { return this.pos - this.index; }
  get frameA() { return this.frames[this.index]; }
  get frameB() { return this.frames[Math.min(this.frames.length - 1, this.index + 1)]; }
  get interpolated() { return this.frac > 1e-3 && this.index < this.frames.length - 1; }

  // anno decimale dell'istante mostrato (per il grafico e il passaggio di livello)
  get year() {
    const a = stampToYear(this.frameA.t);
    if (!this.interpolated) return a;
    return a + (stampToYear(this.frameB.t) - a) * this.frac;
  }

  setTier(name, keepYear = true) {
    const year = this.tierName && keepYear ? this.year : null;
    this.tierName = name;
    this.frames = this.tier.frames;
    this.loop = null;
    this.pos = year == null ? this.frames.length - 1 : this.nearest(year);
    this.emit('tier');
  }

  nearest(year) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < this.frames.length; i++) {
      const d = Math.abs(stampToYear(this.frames[i].t) - year);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  findStamp(prefix) {
    const i = this.frames.findIndex((f) => f.t.startsWith(prefix));
    return i;
  }

  seek(i, why = 'seek') {
    this.pos = Math.max(0, Math.min(this.frames.length - 1, i));
    this.emit(why);
  }

  step(d) { this.seek(Math.round(this.pos) + d); }

  setLoop(range) {
    this.loop = range;
    if (range && (this.pos < range[0] || this.pos > range[1])) this.pos = range[0];
    this.emit('loop');
  }

  play() {
    if (this.pos >= (this.loop ? this.loop[1] : this.frames.length - 1)) this.pos = this.loop ? this.loop[0] : 0;
    this.playing = true;
    this.emit('play');
  }

  pause() {
    this.playing = false;
    this.pos = Math.round(this.pos);       // da fermi si vede solo il dato originale
    this.emit('pause');
  }

  // avanza di dt secondi; ready(i) dice se il fotogramma i e' gia' pronto
  tick(dt, ready) {
    if (!this.playing) return false;
    const lo = this.loop ? this.loop[0] : 0;
    const hi = this.loop ? this.loop[1] : this.frames.length - 1;
    let next = this.pos + dt * this.fps;
    const need = Math.min(hi, Math.floor(next) + 1);
    // non si supera un fotogramma che non e' ancora arrivato: si aspetta
    if (!ready(Math.floor(next)) || !ready(need)) {
      this.waiting = true;
      return false;
    }
    this.waiting = false;
    if (next > hi) next = lo;              // ricomincia l'intervallo
    this.pos = next;
    this.emit('tick');
    return true;
  }
}

// mese di climatologia per un istante: [mese a (0-11), mese b, peso di b, 0]
// Le medie mensili usano il loro mese; per giorni e ore si interpola fra i
// centri dei due mesi vicini.
export function climSelection(stamp) {
  const y = +stamp.slice(0, 4), m = +stamp.slice(5, 7) - 1;
  if (stamp.length === 7) return [m, m, 0, 0];
  const d = +stamp.slice(8, 10), h = stamp.length > 10 ? +stamp.slice(11, 13) : 12;
  const t = Date.UTC(y, m, d, h);
  const mid = (yy, mm) => (Date.UTC(yy, mm, 1) + Date.UTC(yy, mm + 1, 1)) / 2;
  let a, b, ta, tb;
  if (t >= mid(y, m)) { a = m; b = (m + 1) % 12; ta = mid(y, m); tb = mid(y, m + 1); }
  else { a = (m + 11) % 12; b = m; ta = mid(y, m - 1); tb = mid(y, m); }
  return [a, b, (t - ta) / (tb - ta), 0];
}

export function mixClim(a, b, f) {
  // a e b sono selezioni di due fotogrammi: si interpola nel tempo
  if (f <= 0) return a;
  // due medie mensili: fra il mese di A e quello di B
  if (a[0] === a[1] && b[0] === b[1]) return [a[0], b[0], f, 0];
  if (a[0] === b[0] && a[1] === b[1]) return [a[0], a[1], a[2] + (b[2] - a[2]) * f, 0];
  // mesi diversi (passaggio fra mesi): si usa la selezione piu' vicina
  return f < 0.5 ? a : b;
}
