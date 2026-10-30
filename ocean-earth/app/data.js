// Accesso ai dati: manifest, decodifica nei worker, cache dei fotogrammi.

const BASE = new URL('../data/', import.meta.url);

export class DataStore {
  constructor() {
    this.manifest = null;
    this.workers = [];
    this.pending = new Map();
    this.seq = 0;
    this.next = 0;
    this.cache = new Map();             // chiave → Promise<risultato>, in ordine d'uso
    this.maxCache = /Mobi|Android/i.test(navigator.userAgent) ? 10 : 24;
  }

  async init() {
    const res = await fetch(new URL('manifest.json', BASE), { cache: 'no-cache' });
    if (!res.ok) throw new Error('manifest ' + res.status);
    this.manifest = await res.json();
    const n = Math.min(3, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./decode-worker.js', import.meta.url));
      w.postMessage({ type: 'init', encoding: this.manifest.encoding });
      w.onmessage = (ev) => {
        const p = this.pending.get(ev.data.id);
        if (!p) return;
        this.pending.delete(ev.data.id);
        ev.data.ok ? p.resolve(ev.data.out) : p.reject(new Error(ev.data.error));
      };
      this.workers.push(w);
    }
    return this.manifest;
  }

  url(path) { return new URL(path, BASE).href; }

  decode(path, kind) {
    const id = ++this.seq;
    const w = this.workers[this.next++ % this.workers.length];
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      w.postMessage({ id, url: this.url(path), kind });
    });
  }

  // un file decodificato, con cache LRU
  get(path, kind) {
    const key = kind + ':' + path;
    if (this.cache.has(key)) {
      const v = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, v);
      return v;
    }
    const p = this.decode(path, kind);
    p.catch(() => this.cache.delete(key));
    this.cache.set(key, p);
    while (this.cache.size > this.maxCache) this.cache.delete(this.cache.keys().next().value);
    return p;
  }

  has(path, kind) { return this.cache.has(kind + ':' + path); }

  tier(name) { return this.manifest.tiers[name]; }

  framePath(tierName, variable, stamp) {
    return `${this.tier(tierName).dir}/${variable}/${stamp}.png`;
  }

  source(i) { return i == null ? null : this.manifest.sources[i]; }

  // ── lettura dei valori esatti dai codici ──
  scalarValue(codes, i) {
    const c = codes[i];
    if (!c) return NaN;
    const e = this.manifest.encoding.scalar;
    return e.offset + (c - 1) * e.step;
  }

  vectorValue(frame, i) {
    const a = frame.cu[i], b = frame.cv[i];
    if (!a && !b) return [NaN, NaN];
    const e = this.manifest.encoding.vector;
    return [(a - e.zero) * e.step, (b - e.zero) * e.step];
  }

  // indice di cella sulla griglia 0,25° per lat/lon
  cell(lat, lon) {
    const g = this.manifest.grid;
    const r = Math.min(g.nlat - 1, Math.max(0, Math.floor((90 - lat) / g.step)));
    let c = Math.floor((lon + 180) / g.step);
    c = ((c % g.nlon) + g.nlon) % g.nlon;
    return { r, c, i: r * g.nlon + c, lat: 90 - (r + 0.5) * g.step, lon: -180 + (c + 0.5) * g.step };
  }

  // serie mensile di una cella: Float32Array (NaN dove manca)
  async series(lat, lon) {
    const s = this.manifest.series;
    if (!s.available) return null;
    if (!this.seriesMeta) {
      this.seriesMeta = fetch(this.url('series/sst.json')).then((r) => r.json());
    }
    const meta = await this.seriesMeta;
    const { r, c } = this.cell(lat, lon);
    const T = meta.tile;
    const tr = Math.floor(r / T), tcol = Math.floor(c / T);
    let tile;
    try {
      tile = await this.get(`series/sst/${tr}_${tcol}.png`, 'series');
    } catch (e) {
      return null;                       // tessera tutta di terra
    }
    const row = (r % T) * T + (c % T);
    const n = tile.w;
    const out = new Float32Array(n);
    for (let k = 0; k < n; k++) out[k] = this.scalarValue(tile.codes, row * n + k);
    return { stamps: meta.stamps, values: out };
  }
}
