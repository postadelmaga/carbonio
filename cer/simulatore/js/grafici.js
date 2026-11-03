// Grafici SVG del simulatore (spec §7.3): giornata media del mese, dodici mesi, divisione degli incentivi, scena della
// comunità. Colori dai token di simulatore.css; testi in inchiostro, mai nel colore della serie; legenda, etichette
// dirette, suggerimento al passaggio del puntatore e tabella equivalente.
import { numero, euro, kwh } from './formato.js';

export const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const SERIE = [
  { chiave: 'produzione', nome: 'Produzione', colore: 'var(--g-prod)' },
  { chiave: 'consumo', nome: 'Consumi', colore: 'var(--g-cons)' },
  { chiave: 'condivisa', nome: 'Condivisa', colore: 'var(--g-cond)' },
];
const NS = 'http://www.w3.org/2000/svg';
const W = 640, H = 260, M = { s: 56, d: 12, a: 16, b: 28 };

// Massimo «tondo» dell'asse: 1, 2 o 5 per una potenza di dieci.
export function tetto(x) {
  if (!(x > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(x)), m = x / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

// Linea, o area chiusa sulla base, per valori equidistanti.
export function percorso(valori, x, y, area = false) {
  const linea = `M${valori.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('L')}`;
  if (!area) return linea;
  const fine = x(valori.length - 1).toFixed(1), inizio = x(0).toFixed(1), base = y(0).toFixed(1);
  return `${linea}L${fine},${base}L${inizio},${base}Z`;
}

function el(nome, attributi = {}, testo) {
  const e = document.createElementNS(NS, nome);
  for (const [k, v] of Object.entries(attributi)) e.setAttribute(k, String(v));
  if (testo != null) e.textContent = testo;
  return e;
}

function suggerimento(contenitore) {
  let tip = contenitore.querySelector(':scope > .tip');
  if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; contenitore.append(tip); }
  return tip;
}
function mostraTip(tip, contenitore, evento, testo) {
  const r = contenitore.getBoundingClientRect();
  tip.textContent = testo;
  tip.hidden = false;
  const x = Math.min(evento.clientX - r.left + 12, r.width - tip.offsetWidth - 4);
  tip.style.left = `${Math.max(4, x)}px`;
  tip.style.top = `${Math.max(4, evento.clientY - r.top - 40)}px`;
}

function griglia(svg, max, y, unita) {
  const g = el('g', { class: 'asse' });
  for (const v of [0, max / 2, max]) {
    g.append(el('line', { x1: M.s, x2: W - M.d, y1: y(v), y2: y(v) }));
    g.append(el('text', { x: M.s - 6, y: y(v) + 4, 'text-anchor': 'end' }, `${numero(v, v > 0 && v < 10 && v % 1 ? 1 : 0)} ${unita}`));
  }
  svg.append(g);
  return g;
}

export function giornata(svg, g, mese) {
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const dati = SERIE.map((s) => g[s.chiave][mese]);
  const max = tetto(Math.max(...dati.flat(), 0.001));
  const x = (i) => M.s + ((i + 0.5) * (W - M.s - M.d)) / 24;
  const y = (v) => H - M.b - (v / max) * (H - M.a - M.b);
  const asse = griglia(svg, max, y, 'kWh');
  for (const h of [0, 6, 12, 18, 23]) asse.append(el('text', { x: x(h), y: H - 8, 'text-anchor': 'middle' }, `${h}`));
  svg.append(el('path', { d: percorso(dati[0], x, y, true), fill: 'var(--g-prod)', 'fill-opacity': 0.25, stroke: 'var(--g-prod)', 'stroke-width': 2 }));
  svg.append(el('path', { d: percorso(dati[2], x, y, true), fill: 'var(--g-cond)', 'fill-opacity': 0.5, stroke: 'var(--g-cond)', 'stroke-width': 2 }));
  svg.append(el('path', { d: percorso(dati[1], x, y), fill: 'none', stroke: 'var(--g-cons)', 'stroke-width': 2 }));
  const usati = [];
  SERIE.forEach((s, k) => { // etichette dirette al picco di ciascuna serie, spostate se si toccano
    const v = dati[k], i = v.indexOf(Math.max(...v));
    let ty = y(v[i]) - 8;
    while (usati.some((u) => Math.abs(u - ty) < 14)) ty -= 14;
    usati.push(ty);
    svg.append(el('text', { class: 'etichetta', x: Math.min(W - 40, Math.max(M.s + 30, x(i))), y: Math.max(12, ty), 'text-anchor': 'middle' }, s.nome));
  });
  const mirino = el('line', { class: 'mirino', y1: M.a, y2: H - M.b, visibility: 'hidden' });
  const area = el('rect', { x: M.s, y: M.a, width: W - M.s - M.d, height: H - M.a - M.b, fill: 'transparent' });
  svg.append(mirino, area);
  const contenitore = svg.parentElement, tip = suggerimento(contenitore);
  area.addEventListener('pointermove', (ev) => {
    const box = svg.getBoundingClientRect();
    const vx = ((ev.clientX - box.left) / box.width) * W;
    const h = Math.max(0, Math.min(23, Math.floor(((vx - M.s) / (W - M.s - M.d)) * 24)));
    mirino.setAttribute('x1', x(h)); mirino.setAttribute('x2', x(h)); mirino.setAttribute('visibility', 'visible');
    mostraTip(tip, contenitore, ev, `ore ${h}-${h + 1}: ${SERIE.map((s, k) => `${s.nome.toLowerCase()} ${numero(dati[k][h], 1)}`).join(', ')} kWh`);
  });
  area.addEventListener('pointerleave', () => { tip.hidden = true; mirino.setAttribute('visibility', 'hidden'); });
  svg.setAttribute('aria-label', `Giornata media di ${MESI[mese]}: in un'ora produzione fino a ${numero(Math.max(...dati[0]), 1)} kWh, consumi fino a ${numero(Math.max(...dati[1]), 1)}, condivisa fino a ${numero(Math.max(...dati[2]), 1)}.`);
}

export function anno(svg, m) {
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const max = tetto(Math.max(...SERIE.flatMap((s) => m[s.chiave]), 0.001));
  const largo = (W - M.s - M.d) / 12, barra = (largo - 8) / 3;
  const y = (v) => H - M.b - (v / max) * (H - M.a - M.b);
  const asse = griglia(svg, max, y, 'kWh');
  MESI.forEach((nome, i) => asse.append(el('text', { x: M.s + largo * (i + 0.5), y: H - 8, 'text-anchor': 'middle' }, nome.slice(0, 3))));
  const contenitore = svg.parentElement, tip = suggerimento(contenitore);
  MESI.forEach((nome, i) => SERIE.forEach((s, k) => {
    const v = m[s.chiave][i];
    const r = el('rect', { x: M.s + largo * i + 4 + k * barra, y: y(v), width: Math.max(1, barra - 2), height: Math.max(0, y(0) - y(v)), rx: 2, fill: s.colore });
    r.addEventListener('pointerenter', (ev) => mostraTip(tip, contenitore, ev, `${nome}, ${s.nome.toLowerCase()}: ${kwh(v)}`));
    r.addEventListener('pointerleave', () => { tip.hidden = true; });
    svg.append(r);
  }));
  svg.setAttribute('aria-label', 'Dodici mesi: produzione, consumi ed energia condivisa della comunità, in kWh.');
}

export function incentivi(div, inc) {
  const voci = [
    { nome: 'Produttori', valore: inc.produttori, colore: 'var(--g-prod)' },
    { nome: 'Consumatori', valore: inc.consumatori, colore: 'var(--g-cons)' },
    { nome: 'Fondo sociale', valore: inc.fondo, colore: 'var(--g-cond)' },
    { nome: 'Costi della CER', valore: inc.costi, colore: 'var(--g-costi)' },
  ];
  const tot = voci.reduce((s, v) => s + v.valore, 0);
  div.replaceChildren();
  const barra = document.createElement('div');
  barra.className = 'barra-incentivi';
  barra.setAttribute('role', 'img');
  barra.setAttribute('aria-label', `Incentivi del primo anno: ${voci.map((v) => `${v.nome.toLowerCase()} ${euro(v.valore)}`).join(', ')}.`);
  const tip = suggerimento(div);
  for (const v of voci) {
    if (!(v.valore > 0)) continue;
    const s = document.createElement('span');
    s.style.flex = String(v.valore / tot);
    s.style.background = v.colore;
    s.addEventListener('pointerenter', (ev) => mostraTip(tip, div, ev, `${v.nome}: ${euro(v.valore)} (${numero((100 * v.valore) / tot)}%)`));
    s.addEventListener('pointerleave', () => { tip.hidden = true; });
    barra.append(s);
  }
  const legenda = document.createElement('ul');
  legenda.className = 'legenda';
  for (const v of voci) {
    const li = document.createElement('li'), i = document.createElement('i'), b = document.createElement('b');
    i.style.background = v.colore;
    b.textContent = euro(v.valore);
    li.append(i, `${v.nome} `, b);
    legenda.append(li);
  }
  div.append(barra, legenda);
  if (!(tot > 0)) {
    const p = document.createElement('p');
    p.className = 'aiuto';
    p.textContent = 'Nessun incentivo: non c\'è energia condivisa.';
    div.append(p);
  }
}

// Scena della comunità tipo: case, attività, ente e impianto, con «tu» in evidenza (spec §7.1).
export function scenaComunita(div, c) {
  const svg = el('svg', { viewBox: '0 0 640 96', role: 'img' });
  let x = 8;
  const gruppo = (n, disegna, etichetta, max = 30) => {
    const inizio = x;
    for (let i = 0; i < Math.min(n, max); i++) { disegna(x, 30 + (i % 2) * 18); x += i % 2 ? 14 : 0; }
    if (n > max) { svg.append(el('text', { class: 'etichetta', x: x + 4, y: 52 }, `+${n - max}`)); x += 26; }
    svg.append(el('text', { class: 'etichetta', x: inizio, y: 90 }, etichetta));
    x += 24;
  };
  const casa = (colore) => (cx, cy) => svg.append(el('path', { d: `M${cx} ${cy + 6}L${cx + 6} ${cy}L${cx + 12} ${cy + 6}V${cy + 14}H${cx}Z`, fill: colore }));
  const negozio = (colore) => (cx, cy) => svg.append(el('rect', { x: cx, y: cy, width: 12, height: 14, rx: 2, fill: colore }));
  if (c.tu) gruppo(1, casa('var(--g-prod)'), 'tu');
  gruppo(c.famiglie, casa('var(--ink-3)'), `${c.famiglie} famiglie`);
  if (c.attivita) gruppo(c.attivita, negozio('var(--g-cons)'), `${c.attivita} attività`);
  if (c.enti) gruppo(c.enti, negozio('var(--g-cond)'), `${c.enti} ${c.enti === 1 ? 'ente' : 'enti'}`);
  if (c.kwp > 0) {
    svg.append(el('rect', { x, y: 34, width: 34, height: 22, rx: 2, fill: 'none', stroke: 'var(--g-prod)', 'stroke-width': 2 }));
    svg.append(el('path', { d: `M${x + 11} 34V56M${x + 23} 34V56M${x} 45H${x + 34}`, stroke: 'var(--g-prod)', 'stroke-width': 1.5 }));
    svg.append(el('text', { class: 'etichetta', x, y: 90 }, `${numero(c.kwp, 1)} kWp`));
  }
  svg.setAttribute('aria-label', `La comunità: ${c.tu ? 'tu, ' : ''}${c.famiglie} famiglie, ${c.attivita} attività, ${c.enti} enti, impianti per ${numero(c.kwp, 1)} kWp.`);
  div.replaceChildren(svg);
}

export function tabella(div, intestazioni, righe) {
  const t = document.createElement('table');
  t.className = 'tabella';
  const testa = t.createTHead().insertRow();
  for (const x of intestazioni) { const c = document.createElement('th'); c.scope = 'col'; c.textContent = x; testa.append(c); }
  const corpo = t.createTBody();
  for (const r of righe) { const tr = corpo.insertRow(); for (const x of r) tr.insertCell().textContent = x; }
  div.replaceChildren(t);
}
