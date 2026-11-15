// Grafici SVG del simulatore (spec §7.3): giornata media del mese, dodici mesi, divisione degli incentivi, scena della
// comunità. Colori dai token di simulatore.css; testi in inchiostro, mai nel colore della serie; legenda, etichette
// dirette, suggerimento al passaggio del puntatore e tabella equivalente.
// Si disegna in pixel reali: il viewBox è largo quanto l'elemento al momento del disegno, così il testo resta da 11-12 px
// a ogni larghezza. Chi mostra la pagina ridisegna quando la larghezza cambia.
import { numero, euro, kwh } from './formato.js';

export const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const SERIE = [
  { chiave: 'produzione', nome: 'Produzione', colore: 'var(--g-prod)' },
  { chiave: 'consumo', nome: 'Consumi', colore: 'var(--g-cons)' },
  { chiave: 'condivisa', nome: 'Condivisa', colore: 'var(--g-cond)' },
];
const NS = 'http://www.w3.org/2000/svg';
const H = 260, M = { s: 54, d: 12, a: 20, b: 28 };
const LARGHEZZA_PREDEFINITA = 640, SOGLIA_STRETTA = 480;
const RIGA_SCENA = 96; // altezza di una riga della scena


// Larghezza del disegno: quella misurata, arrotondata; 640 se manca (Node, elemento nascosto).
export function larghezzaDisegno(misurata) {
  const w = Math.round(misurata);
  return Number.isFinite(w) && w > 0 ? w : LARGHEZZA_PREDEFINITA;
}

// Indici dei mesi che portano l'etichetta: tutti, e uno sì e uno no sotto i 480 px. Le barre restano dodici.
export function mesiEtichettati(W) {
  return MESI.map((_, i) => i).filter((i) => W >= SOGLIA_STRETTA || i % 2 === 0);
}

// Quante figure si disegnano al più per gruppo nella scena; le altre diventano «+N».
export const figureMassime = (W) => (W < SOGLIA_STRETTA ? 10 : 30);

// Massimo «tondo» dell'asse: 1, 2 o 5 per una potenza di dieci.
export function tetto(x) {
  if (!(x > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(x)), m = x / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

// Massimo dell'asse della giornata (revisione §10.1): su tutti i mesi e tutte le serie, così cambiando mese la scala resta.
export const massimoGiornata = (g) => tetto(Math.max(...SERIE.flatMap((s) => g[s.chiave].flat()), 0.001));

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

// Griglia con tre tacche (solo i numeri) e l'unità una volta sola, in alto a sinistra.
function griglia(svg, W, max, y, unita) {
  const g = el('g', { class: 'asse' });
  g.append(el('text', { x: 2, y: 11 }, unita));
  for (const v of [0, max / 2, max]) {
    g.append(el('line', { x1: M.s, x2: W - M.d, y1: y(v), y2: y(v) }));
    const dec = Number.isInteger(v) ? 0 : Number.isInteger(v * 10) ? 1 : 2;
    g.append(el('text', { x: M.s - 6, y: y(v) + 4, 'text-anchor': 'end' }, numero(v, dec)));
  }
  svg.append(g);
  return g;
}

export function giornata(svg, g, mese) {
  const W = larghezzaDisegno(svg.getBoundingClientRect().width);
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const dati = SERIE.map((s) => g[s.chiave][mese]);
  const max = massimoGiornata(g);
  const x = (i) => M.s + ((i + 0.5) * (W - M.s - M.d)) / 24;
  const y = (v) => H - M.b - (v / max) * (H - M.a - M.b);
  const asse = griglia(svg, W, max, y, 'kWh');
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
  const W = larghezzaDisegno(svg.getBoundingClientRect().width);
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const max = tetto(Math.max(...SERIE.flatMap((s) => m[s.chiave]), 0.001));
  const largo = (W - M.s - M.d) / 12, vuoto = Math.min(8, largo * 0.2), barra = (largo - vuoto) / 3;
  const y = (v) => H - M.b - (v / max) * (H - M.a - M.b);
  const asse = griglia(svg, W, max, y, 'kWh');
  for (const i of mesiEtichettati(W)) asse.append(el('text', { x: M.s + largo * (i + 0.5), y: H - 8, 'text-anchor': 'middle' }, MESI[i].slice(0, 3)));
  const contenitore = svg.parentElement, tip = suggerimento(contenitore);
  MESI.forEach((nome, i) => SERIE.forEach((s, k) => {
    const v = m[s.chiave][i];
    const r = el('rect', { x: M.s + largo * i + vuoto / 2 + k * barra, y: y(v), width: Math.max(1, barra - 2), height: Math.max(0, y(0) - y(v)), rx: 2, fill: s.colore });
    r.addEventListener('pointerenter', (ev) => mostraTip(tip, contenitore, ev, `${nome}, ${s.nome.toLowerCase()}: ${kwh(v)}`));
    r.addEventListener('pointerleave', () => { tip.hidden = true; });
    svg.append(r);
  }));
  svg.setAttribute('aria-label', 'Dodici mesi: produzione, consumi ed energia condivisa della comunità, in kWh.');
}

// Le voci della barra degli incentivi. «Finalità sociali» c'è solo se è positiva, accanto ad «Alla CER»: ha un colore suo,
// il viola della tavolozza di riferimento della skill dataviz, perché due voci vicine dello stesso colore non si
// distinguono.
export function vociIncentivi(inc) {
  return [
    { nome: 'Produttori', valore: inc.produttori, colore: 'var(--g-prod)' },
    { nome: 'Consumatori', valore: inc.consumatori, colore: 'var(--g-cons)' },
    { nome: 'Alla CER', valore: inc.cer, colore: 'var(--g-cond)' },
    ...(inc.fondoSociale > 0 ? [{ nome: 'Finalità sociali', valore: inc.fondoSociale, colore: 'var(--g-sociale)' }] : []),
    { nome: 'Costi della CER', valore: inc.costi, colore: 'var(--g-costi)' },
  ];
}

export function incentivi(div, inc) {
  const voci = vociIncentivi(inc);
  const tot = voci.reduce((s, v) => s + v.valore, 0);
  div.replaceChildren();
  const barra = document.createElement('div');
  barra.className = 'barra-incentivi';
  barra.setAttribute('role', 'img');
  barra.setAttribute('aria-label', `Incentivi del primo anno: ${voci.map((v) => `${v.nome} ${euro(v.valore)}`).join(', ')}.`);
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

// Disposizione dei gruppi della scena in larghezza W, in pixel reali. Ogni gruppo è { n, etichetta } (figure in colonne da
// due) o { fisso, etichetta } (un disegno solo, largo `fisso`). Le figure sono al più figureMassime(W), il resto è «+N».
// Un gruppo largo quanto il più largo fra figure con «+N» ed etichetta; se non entra nella riga va a capo. `misura(testo)`
// dà la larghezza del testo in pixel: il chiamante la misura sullo schermo, i test la stimano.
export function disposizioneScena(gruppi, W, misura = (t) => t.length * 7) {
  const massimo = figureMassime(W), bordo = 8, vuoto = 16;
  let x = bordo, riga = 0;
  const posti = gruppi.map((g) => {
    const disegnate = g.fisso ? 0 : Math.min(g.n, massimo), resto = g.fisso ? 0 : g.n - disegnate;
    const colonne = Math.ceil(disegnate / 2);
    const figure = g.fisso ?? (colonne > 0 ? colonne * 14 - 2 : 0);
    const larghezza = Math.max(figure + (resto > 0 ? 4 + misura(`+${resto}`) : 0), misura(g.etichetta));
    if (x > bordo && x + larghezza > W - bordo) { riga++; x = bordo; }
    const posto = { x, riga, disegnate, resto, colonne, larghezza };
    x += larghezza + vuoto;
    return posto;
  });
  return { posti, righe: riga + 1 };
}

// Scena della comunità tipo: case, attività, ente e impianto, con «tu» in evidenza (spec §7.1).
export function scenaComunita(div, c) {
  const svg = el('svg', { role: 'img' });
  div.replaceChildren(svg);
  const W = larghezzaDisegno(div.getBoundingClientRect().width);
  svg.setAttribute('viewBox', `0 0 ${W} ${RIGA_SCENA}`);
  const sonda = el('text', { class: 'etichetta', visibility: 'hidden' }); // per misurare le etichette in pixel reali
  svg.append(sonda);
  const misura = (t) => { sonda.textContent = t; return sonda.getComputedTextLength?.() || t.length * 7; };
  const conta = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;
  const casa = (colore) => (cx, cy) => svg.append(el('path', { d: `M${cx} ${cy + 6}L${cx + 6} ${cy}L${cx + 12} ${cy + 6}V${cy + 14}H${cx}Z`, fill: colore }));
  const negozio = (colore) => (cx, cy) => svg.append(el('rect', { x: cx, y: cy, width: 12, height: 14, rx: 2, fill: colore }));
  const impianto = (x, y0) => {
    svg.append(el('rect', { x, y: y0 + 34, width: 34, height: 22, rx: 2, fill: 'none', stroke: 'var(--g-prod)', 'stroke-width': 2 }));
    svg.append(el('path', { d: `M${x + 11} ${y0 + 34}V${y0 + 56}M${x + 23} ${y0 + 34}V${y0 + 56}M${x} ${y0 + 45}H${x + 34}`, stroke: 'var(--g-prod)', 'stroke-width': 1.5 }));
  };
  const gruppi = [];
  if (c.tu) gruppi.push({ n: 1, etichetta: 'tu', figura: casa('var(--g-prod)') });
  if (c.famiglie > 0) gruppi.push({ n: c.famiglie, etichetta: conta(c.famiglie, 'famiglia', 'famiglie'), figura: casa('var(--ink-3)') });
  if (c.attivita) gruppi.push({ n: c.attivita, etichetta: conta(c.attivita, 'attività', 'attività'), figura: negozio('var(--g-cons)') });
  if (c.enti) gruppi.push({ n: c.enti, etichetta: conta(c.enti, 'ente', 'enti'), figura: negozio('var(--g-cond)') });
  if (c.kwp > 0) gruppi.push({ fisso: 34, etichetta: `${numero(c.kwp, 1)} kWp`, figura: impianto });
  const { posti, righe } = disposizioneScena(gruppi, W, misura);
  sonda.remove();
  posti.forEach((p, k) => {
    const g = gruppi[k], y0 = p.riga * RIGA_SCENA;
    if (g.fisso) g.figura(p.x, y0);
    for (let i = 0; i < p.disegnate; i++) g.figura(p.x + Math.floor(i / 2) * 14, y0 + 30 + (i % 2) * 18);
    if (p.resto > 0) svg.append(el('text', { class: 'etichetta', x: p.x + p.colonne * 14 + 2, y: y0 + 52 }, `+${p.resto}`));
    svg.append(el('text', { class: 'etichetta', x: p.x, y: y0 + 90 }, g.etichetta));
  });
  svg.setAttribute('viewBox', `0 0 ${W} ${righe * RIGA_SCENA}`);
  svg.setAttribute('aria-label', `La comunità: ${[c.tu && 'tu', c.famiglie > 0 && conta(c.famiglie, 'famiglia', 'famiglie'), c.attivita > 0 && conta(c.attivita, 'attività', 'attività'), c.enti > 0 && conta(c.enti, 'ente', 'enti'), c.kwp > 0 && `impianti per ${numero(c.kwp, 1)} kWp`].filter(Boolean).join(', ')}.`);
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
