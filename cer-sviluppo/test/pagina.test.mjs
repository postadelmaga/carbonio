// Prova statica dei nomi fra la pagina e lo script: index.html, interfaccia.js e simulatore.css si leggono come testo,
// senza DOM. Un nome rinominato da una parte sola fa fallire la prova, ed è quello che il browser mostrerebbe solo
// come un campo che non risponde o un numero che resta vuoto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leggi = (p) => readFileSync(new URL(`../../cer/simulatore/${p}`, import.meta.url), 'utf8');
const HTML = leggi('index.html'), JS = leggi('js/interfaccia.js'), CSS = leggi('simulatore.css');

const tutti = (testo, re) => [...testo.matchAll(re)].map((m) => m.slice(1).find((x) => x !== undefined));
const unici = (v) => [...new Set(v)];

// Il testo di un oggetto letterale al suo primo livello: ciò che sta fra parentesi annidate si scarta.
function primoLivello(js, inizio) {
  const da = js.indexOf(inizio);
  assert.ok(da >= 0, `«${inizio}» non c'è in interfaccia.js`);
  let livello = 0, fuori = '';
  for (let i = js.indexOf('{', da); i < js.length; i++) {
    const c = js[i];
    if ('{(['.includes(c)) { livello++; continue; }
    if ('})]'.includes(c)) { if (--livello === 0) break; continue; }
    if (livello === 1) fuori += c;
  }
  return fuori;
}
const chiaviVista = (js, inizio = 'const vista = {') => tutti(primoLivello(js, inizio), /(?:^|,)\s*([A-Za-z_]\w*)\s*(?=:|,|$)/g);
const chiaviConDuePunti = (js, inizio) => tutti(primoLivello(js, inizio), /(?:^|,)\s*(?:'([^']+)'|([A-Za-z_]\w*))\s*:/g);

function nomiMancanti(html, js) {
  const nomi = new Set(tutti(html, /\bname="([^"]+)"/g));
  const usati = [
    ...tutti(js, /\b(?:campo|scelto|numeroDi|quota)\('([^']+)'/g),
    ...tutti(js, /input\[name="([a-z][a-z0-9-]*)"\]/g),
    // le coppie [cursore, uscita] di aggiornaUscite: `tutti` prende un solo gruppo per volta, quindi una espressione per elemento
    ...tutti(js, /\['([a-z-]+)', '[a-z-]+-valore'\]/g),
    ...tutti(js, /\['[a-z-]+', '([a-z-]+-valore)'\]/g),
    ...chiaviConDuePunti(js, 'const valori = {'),
  ];
  return unici(usati).filter((n) => !nomi.has(n));
}
function idMancanti(html, js) {
  const id = new Set(tutti(html, /\bid="([^"]+)"/g));
  return unici(tutti(js, /\$\('#([A-Za-z0-9_-]+)'\)/g)).filter((n) => !id.has(n));
}
function rilegatureMancanti(html, js) {
  const prime = new Set(chiaviVista(js)), costanti = new Set(chiaviVista(js, 'cost: {'));
  return unici(tutti(html, /\bdata-r="([^"]+)"/g)).filter((r) => {
    const [primo, secondo] = r.split('.');
    return !prime.has(primo) || (primo === 'cost' && !costanti.has(secondo));
  });
}

test('ogni nome cercato dallo script esiste come name nella pagina', () => {
  assert.deepEqual(nomiMancanti(HTML, JS), []);
});
test('ogni id cercato dallo script esiste nella pagina', () => {
  assert.deepEqual(idMancanti(HTML, JS), []);
});
test('ogni data-r della pagina comincia con una chiave di vista, e le chiavi sono quelle del vincolo «Nomi»', () => {
  assert.deepEqual(rilegatureMancanti(HTML, JS), []);
  assert.deepEqual(chiaviVista(JS).sort(), ['com', 'cost', 'emissioni', 'te']);
});
test('un nome rinominato da una parte sola non passa: la prova se ne accorge', () => {
  assert.deepEqual(nomiMancanti(HTML.replaceAll('name="kwp"', 'name="potenza"'), JS), ['kwp']);
  assert.deepEqual(idMancanti(HTML.replaceAll('id="mese"', 'id="mesi"'), JS), ['mese']);
  assert.ok(rilegatureMancanti(HTML, JS.replace('    te,', '    tuo,')).includes('te.totale'));
  assert.ok(rilegatureMancanti(HTML, JS.replace('anni: voce(', 'durata: voce(')).includes('cost.anni'));
});
test('ogni cursore ha un id uguale al name e una label che lo indica con for', () => {
  const cursori = tutti(HTML, /<input\b([^>]*\btype="range"[^>]*)>/g);
  assert.equal(cursori.length, 7);
  for (const a of cursori) {
    const nome = a.match(/\bname="([^"]+)"/)[1];
    assert.equal(a.match(/\bid="([^"]+)"/)?.[1], nome, `il cursore ${nome} non ha id="${nome}"`);
    assert.match(HTML, new RegExp(`<label\\b[^>]*\\bfor="${nome}"`), `nessuna label for="${nome}"`);
  }
});
test('negli identificatori (classi, id, name, data-*, selettori, codice) non compare «clima»', () => {
  assert.deepEqual(tutti(HTML, /\s(?:class|id|name|for|data-[a-z-]+)="([^"]*clima[^"]*)"/g), []);
  assert.deepEqual(tutti(CSS, /([.#][\w-]*clima[\w-]*)/g), []);
  assert.doesNotMatch(JS, /clima/i);
});

test('aggiorna valida gli ingressi prima di calcolare: gli errori di validazione non arrivano a calcola né alla console', () => {
  const da = JS.indexOf('function aggiorna()'), a = JS.indexOf('function preimposta()');
  assert.ok(da >= 0 && a > da, 'aggiorna non si trova in interfaccia.js');
  const corpo = JS.slice(da, a);
  const valida = corpo.indexOf('valida(ingressi'), calcola = corpo.indexOf('calcola(ingressi');
  assert.ok(valida >= 0, 'aggiorna non chiama valida');
  assert.ok(calcola > valida, 'calcola viene prima di valida');
  const fra = corpo.slice(valida, calcola);
  assert.match(fra, /\breturn;/, 'fra valida e calcola manca l\'uscita');
  assert.doesNotMatch(fra, /console\.error/, 'un errore di validazione non va in console');
  assert.equal((corpo.match(/console\.error/g) ?? []).length, 1, 'console.error resta solo per le eccezioni vere');
  assert.match(corpo.slice(calcola), /catch \(e\) \{\s*console\.error\(e\);/);
});
