// Accesso ai dati: manifest, decodifica nei worker, cache dei fotogrammi.

// dove stanno i dati: <meta name="data-base"> (deploy.sh la punta a /ocean-earth/data/,
// che arm_php aggiorna; la pagina vive in /atlante/), altrimenti data/ accanto alla pagina
const META_BASE = globalThis.document?.querySelector('meta[name=data-base]')?.content;
const BASE = META_BASE ? new URL(META_BASE, globalThis.document.baseURI) : new URL('../data/', import.meta.url);

export class DataStore {
  constructor() {
    this.manifest = null;
    this.workers = [];
    this.pending = new Map();
    this.seq = 0;
    this.next = 0;
    this.cache = new Map();             // chiave → Promise<risultato>, in ordine d'uso
    const mobile = /Mobi|Android/i.test(navigator.userAgent);
    this.maxCache = mobile ? 10 : 24;
    // le anteprime (circa 6 MB decodificate contro 18) hanno una cache a parte,
    // piu' lunga: e' quella che fa da riserva durante la riproduzione
    this.prevCache = new Map();
    this.maxPrev = mobile ? 24 : 64;
    this.saved = new Set();               // percorsi gia' nella cache del browser
    this.failed = new Map();              // chiave → quando e' fallito
    this.onSaved = null;
  }

  async init() {
    const res = await fetch(new URL('manifest.json', BASE), { cache: 'no-cache' });
    if (!res.ok) throw new Error('manifest ' + res.status);
    this.manifest = await res.json();
    const c = this.manifest.cache;
    this.cacheNames = c && self.caches ? { frames: `oe-frames-${c.frames}`, static: `oe-static-${c.static}` } : null;
    const n = Math.min(3, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./decode-worker.js', import.meta.url));
      w.postMessage({ type: 'init', encoding: this.manifest.encoding, preview: this.manifest.preview, cache: this.cacheNames });
      w.onmessage = (ev) => {
        const p = this.pending.get(ev.data.id);
        if (!p) return;
        this.pending.delete(ev.data.id);
        if (ev.data.ok && ev.data.out.net) {
          this.countNet(ev.data.out.net);
          if (ev.data.out.net.stored) this.markSaved(p.path);
        }
        ev.data.ok ? p.resolve(ev.data.out) : p.reject(new Error(ev.data.error));
      };
      this.workers.push(w);
    }
    return this.manifest;
  }

  // ── cache del browser ──
  // quali file sono gia' su disco: serve alla barra sotto la timeline e a non
  // riscaricare quello che c'e'. Si legge all'avvio e si aggiorna a ogni arrivo.
  markSaved(path) {
    this.saved.add(path);
    if (this.onSaved) this.onSaved(path);
  }

  async scanSaved() {
    if (!this.cacheNames) return;
    try {
      // le versioni vecchie (fotogrammi rigenerati, climatologia rifatta) si buttano
      for (const k of await caches.keys()) {
        if (k.startsWith('oe-') && !Object.values(this.cacheNames).includes(k)) await caches.delete(k);
      }
      const cache = await caches.open(this.cacheNames.frames);
      const base = this.url('');
      const known = new Set();
      for (const [name, t] of Object.entries(this.manifest.tiers)) {
        for (const f of t.frames) known.add(`${t.dir}/${f.t}`);
      }
      const keys = await cache.keys();
      for (const req of keys) {
        const path = req.url.startsWith(base) ? req.url.slice(base.length) : null;
        const m = path && path.match(/^(?:p\/)?([mdh])\/[a-z]+\/([^/]+)\.(?:png|webp)$/);
        // istanti usciti dalle finestre mobili (giorni, ore): non torneranno
        if (!m || !known.has(`${m[1]}/${m[2]}`)) { await cache.delete(req); continue; }
        this.saved.add(path);
      }
      if (this.onSaved) this.onSaved(null);
    } catch (e) { /* senza Cache Storage si lavora solo con la rete */ }
  }

  // scarica e salva senza decodificare (per la riproduzione senza attese)
  store(path) {
    if (this.saved.has(path)) return Promise.resolve();
    return this.decode(path, 'store');
  }

  // statistiche di rete per la diagnosi (window.__oe.store.net)
  countNet(n) {
    const s = this.net || (this.net = { files: 0, bytes: 0, cached: 0, revalidated: 0, ms: 0, decodeMs: 0 });
    s.files++;
    s.ms += n.ms;
    s.decodeMs += n.total - n.ms;
    if (n.stored && n.transfer === 0) s.stored = (s.stored || 0) + 1;
    else if (n.transfer === 0) s.cached++;
    else if (n.transfer > 0 && n.transfer < 2000) s.revalidated++;
    else s.bytes += Math.max(0, n.transfer);
  }

  url(path) { return new URL(path, BASE).href; }

  decode(path, kind) {
    const id = ++this.seq;
    const w = this.workers[this.next++ % this.workers.length];
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, path });
      w.postMessage({ id, url: this.url(path), kind });
    });
  }

  // Un file decodificato, con cache LRU (l'unica: la pagina non tiene altre
  // copie, cosi' la memoria resta entro maxCache + maxPrev fotogrammi).
  // Ogni voce e' { p: Promise, v: valore quando arriva }: peek() dice in modo
  // sincrono se un file e' pronto, per la riproduzione.
  get(path, kind) {
    const key = kind + ':' + path;
    const cache = this.cacheFor(kind);
    const hit = cache.get(key);
    if (hit) {
      cache.delete(key);
      cache.set(key, hit);
      return hit.p;
    }
    // un file che non arriva si riprova dopo un po', non a ogni fotogramma
    if (this.peek(path, kind) === 'failed') return Promise.reject(new Error('non disponibile'));
    const e = { p: this.decode(path, kind), v: null };
    e.p.then((v) => { e.v = v; this.failed.delete(key); },
      () => { cache.delete(key); this.failed.set(key, performance.now()); });
    cache.set(key, e);
    const max = cache === this.prevCache ? this.maxPrev : this.maxCache;
    while (cache.size > max) cache.delete(cache.keys().next().value);
    return e.p;
  }

  cacheFor(kind) { return kind === 'psst' || kind === 'pcur' ? this.prevCache : this.cache; }

  // il valore se e' gia' arrivato; 'failed' se il file manca da poco; altrimenti null
  peek(path, kind) {
    const key = kind + ':' + path;
    const e = this.cacheFor(kind).get(key);
    if (e) return e.v;
    const f = this.failed.get(key);
    return f && performance.now() - f < 30000 ? 'failed' : null;
  }

  tier(name) { return this.manifest.tiers[name]; }

  framePath(tierName, variable, stamp) {
    return `${this.tier(tierName).dir}/${variable}/${stamp}.png`;
  }

  previewPath(tierName, variable, stamp) {
    return `p/${this.tier(tierName).dir}/${variable}/${stamp}.webp`;
  }

  source(i) { return i == null ? null : this.manifest.sources[i]; }

  // ── lettura dei valori esatti dai codici ──
  // off: zero della variabile se diverso (livello del mare), dal fotogramma
  scalarValue(codes, i, off) {
    const c = codes[i];
    if (!c) return NaN;
    const e = this.manifest.encoding.scalar;
    return (off ?? e.offset) + (c - 1) * e.step;
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
