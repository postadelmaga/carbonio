// Grafico a linee in SVG per le serie storiche: piu' serie, linea dell'istante
// corrente, valore sotto il puntatore e selezione di un intervallo trascinando.

import { LANG, fmtNum } from './i18n.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}, parent) => {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};

// "1993-01" → anno decimale al centro del mese
export function stampToYear(s) {
  const y = +s.slice(0, 4), m = +s.slice(5, 7);
  if (s.length === 7) return y + (m - 0.5) / 12;
  const d = +s.slice(8, 10), h = s.length > 10 ? +s.slice(11, 13) : 12;
  const start = Date.UTC(y, 0, 1), end = Date.UTC(y + 1, 0, 1);
  return y + (Date.UTC(y, m - 1, d, h) - start) / (end - start);
}

export function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

export class LineChart {
  constructor(host, { unit = '°C', height = 170 } = {}) {
    this.host = host;
    this.unit = unit;
    this.height = height;
    this.series = [];
    this.marker = null;
    this.range = null;               // [anno da, anno a] o null = tutto
    this.svg = el('svg', { class: 'chart', role: 'img' }, host);
    this.tip = document.createElement('div');
    this.tip.className = 'chart-tip';
    this.tip.hidden = true;
    host.appendChild(this.tip);
    this.bindPointer();
    new ResizeObserver(() => this.draw()).observe(host);
  }

  // series: [{label, color, x: Float64Array anni, y: Float32Array, dash}]
  set(series, { zero = false } = {}) {
    this.series = series;
    this.zero = zero;
    this.draw();
  }

  setMarker(year) { this.marker = year; this.draw(); }
  setRange(r) { this.range = r; this.draw(); if (this.onRange) this.onRange(r); }

  extent() {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const s of this.series) {
      for (let i = 0; i < s.x.length; i++) {
        const x = s.x[i];
        if (this.range && (x < this.range[0] || x > this.range[1])) continue;
        const y = s.y[i];
        if (!Number.isFinite(y)) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    if (this.zero) { y0 = Math.min(y0, 0); y1 = Math.max(y1, 0); }
    const pad = (y1 - y0) * 0.08 || 0.5;
    return { x0, x1, y0: y0 - pad, y1: y1 + pad };
  }

  draw() {
    const W = Math.max(200, this.host.clientWidth), H = this.height;
    const m = { l: 38, r: 10, t: 8, b: 22 };
    this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    this.svg.setAttribute('width', W);
    this.svg.setAttribute('height', H);
    this.svg.replaceChildren();
    if (!this.series.length) return;
    const e = this.extent();
    if (!Number.isFinite(e.x0)) return;
    const sx = (x) => m.l + ((x - e.x0) / (e.x1 - e.x0 || 1)) * (W - m.l - m.r);
    const sy = (y) => H - m.b - ((y - e.y0) / (e.y1 - e.y0 || 1)) * (H - m.t - m.b);
    this.geom = { e, sx, sy, m, W, H };

    const grid = el('g', { class: 'grid' }, this.svg);
    // linee su valori tondi (1, 2, 2,5, 5 × 10ⁿ): con linee a intervalli
    // qualsiasi le etichette arrotondate non erano equidistanti
    const step = niceStep((e.y1 - e.y0) / 4);
    const decimals = (String(+step.toPrecision(3)).split('.')[1] || '').length;
    for (let v = Math.ceil(e.y0 / step) * step; v <= e.y1 + 1e-9; v += step) {
      const vv = Math.abs(v) < step * 1e-6 ? 0 : v;
      el('line', { x1: m.l, x2: W - m.r, y1: sy(vv), y2: sy(vv) }, grid);
      el('text', { x: m.l - 4, y: sy(vv) + 3, 'text-anchor': 'end' }, grid).textContent = fmtNum(vv, decimals);
    }
    const span = e.x1 - e.x0;
    const stepYears = span > 20 ? 5 : span > 8 ? 2 : span > 2 ? 1 : 0.25;
    for (let x = Math.ceil(e.x0 / stepYears) * stepYears; x <= e.x1; x += stepYears) {
      el('line', { x1: sx(x), x2: sx(x), y1: m.t, y2: H - m.b }, grid);
      const lab = stepYears < 1 ? `${Math.floor(x)}·${Math.round((x % 1) * 12) + 1}` : String(Math.round(x));
      el('text', { x: sx(x), y: H - 6, 'text-anchor': 'middle' }, grid).textContent = lab;
    }
    if (this.zero) el('line', { x1: m.l, x2: W - m.r, y1: sy(0), y2: sy(0), class: 'zero' }, this.svg);

    for (const s of this.series) {
      let d = '', pen = false;
      for (let i = 0; i < s.x.length; i++) {
        const x = s.x[i], y = s.y[i];
        if (!Number.isFinite(y) || (this.range && (x < this.range[0] || x > this.range[1]))) { pen = false; continue; }
        d += (pen ? 'L' : 'M') + sx(x).toFixed(1) + ' ' + sy(y).toFixed(1);
        pen = true;
      }
      el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': s.width || 1.4, 'stroke-dasharray': s.dash || '' }, this.svg);
    }
    if (this.marker != null && this.marker >= e.x0 && this.marker <= e.x1) {
      el('line', { x1: sx(this.marker), x2: sx(this.marker), y1: m.t, y2: H - m.b, class: 'marker' }, this.svg);
    }
    this.brushRect = el('rect', { class: 'brush', y: m.t, height: H - m.t - m.b, x: 0, width: 0 }, this.svg);
  }

  bindPointer() {
    let start = null;
    const xOf = (ev) => {
      const r = this.svg.getBoundingClientRect();
      return ev.clientX - r.left;
    };
    const yearAt = (px) => {
      const { e, m, W } = this.geom;
      return e.x0 + ((px - m.l) / (W - m.l - m.r)) * (e.x1 - e.x0);
    };
    this.svg.addEventListener('pointerdown', (ev) => {
      if (!this.geom) return;
      start = xOf(ev);
      this.svg.setPointerCapture(ev.pointerId);
    });
    this.svg.addEventListener('pointermove', (ev) => {
      if (!this.geom) return;
      const px = xOf(ev);
      if (start != null && Math.abs(px - start) > 4) {
        this.brushRect.setAttribute('x', Math.min(start, px));
        this.brushRect.setAttribute('width', Math.abs(px - start));
      }
      this.showTip(yearAt(px), px);
    });
    this.svg.addEventListener('pointerup', (ev) => {
      if (start == null) return;
      const px = xOf(ev);
      if (Math.abs(px - start) > 8) {
        const a = yearAt(Math.min(start, px)), b = yearAt(Math.max(start, px));
        if (b - a > 1 / 24) this.setRange([a, b]);
      }
      start = null;
    });
    this.svg.addEventListener('pointerleave', () => { this.tip.hidden = true; });
    this.svg.addEventListener('dblclick', () => this.setRange(null));
  }

  showTip(year, px) {
    const lines = [];
    for (const s of this.series) {
      let best = -1, bd = Infinity;
      for (let i = 0; i < s.x.length; i++) {
        const d = Math.abs(s.x[i] - year);
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0 && Number.isFinite(s.y[best])) {
        lines.push(`<span style="color:${s.color}">●</span> ${s.label}: <b>${fmtNum(s.y[best], 2)} ${this.unit}</b>`);
      }
      if (s === this.series[0] && best >= 0) {
        const y = s.x[best];
        const yr = Math.floor(y), mo = Math.min(11, Math.floor((y - yr) * 12));
        lines.unshift(new Date(Date.UTC(yr, mo, 1)).toLocaleDateString(LANG === 'it' ? 'it-IT' : 'en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }));
      }
    }
    this.tip.innerHTML = lines.join('<br>');
    this.tip.hidden = false;
    const w = this.host.clientWidth;
    this.tip.style.left = Math.min(w - 150, Math.max(0, px + 10)) + 'px';
  }
}
