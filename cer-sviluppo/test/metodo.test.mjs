// Prova dei numeri del testo di «Come calcoliamo» contro costanti.json. La pagina si legge come testo, senza DOM: i valori
// restano scritti nel testo, quindi un cambio di costante fa fallire la suite finché il testo non si aggiorna.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { numero, perc } from '../../cer/simulatore/js/formato.js';

const leggi = (p) => readFileSync(new URL(`../../cer/simulatore/${p}`, import.meta.url), 'utf8');
const HTML = leggi('metodo/index.html');
const C = JSON.parse(leggi('dati/costanti.json')).voci;
const PV = JSON.parse(leggi('dati/pv/011015.json'));
const v = (voce) => C[voce].valore;

test('i numeri del testo di «Come calcoliamo» coincidono con costanti.json (esclude un testo rimasto indietro dopo un cambio di costante)', () => {
  const durata = v('durata_tariffa_anni');
  const riparto = v('quote_riparto');
  const fasce = v('tariffa_fasce');
  const sogliaPrezzo = v('tariffa_prezzo_riferimento') - (fasce[0].tetto - fasce[0].base);
  const scadenza = v('scadenza_esercizio').split('-').reverse().join('/');
  const fondo = 1 - riparto.produttore - riparto.consumatori;

  const frasi = [
    `Il ${perc(v('spostamento_massimo'))} massimo`,
    `fino a ${durata} anni`,
    `supera il ${perc(v('soglia_eccedentaria'))}`,
    `Il ${perc(riparto.produttore)} della tariffa va al titolare`,
    `il ${perc(riparto.consumatori)} ai consumatori`,
    `il ${perc(fondo)} resta alla CER, che ne decide l'uso`,
    `lo ${perc(v('degrado'), 1)} di produzione l'anno`,
    `Sui ${durata} anni`,
    `entro il ${scadenza}`,
    `supera i ${numero(sogliaPrezzo)} €/MWh`,
    `l'anno meteorologico ${PV.anno_meteo}`,
    `perdite del ${PV.parametri.loss}%`,
    `non oltre ${fasce.at(-1).fino_kw / 1000} MW di potenza, fino a ${durata} anni`,
    'se non ce ne sono, va a finalità sociali',
    'Se i costi superano gli incentivi, il simulatore lo segnala: vanno coperti in altro modo, per esempio con una quota associativa.',
    'Sui 20 anni si usa sempre il fattore medio, che cala come ha fatto in media dal 1990 al 2024.',
  ];
  const mancanti = frasi.filter((f) => !HTML.includes(f));
  assert.deepEqual(mancanti, [], 'frasi da aggiornare in cer/simulatore/metodo/index.html');
  // il fondo contro la povertà energetica è una scelta del regolamento di Eliodora, non della nostra CER
  assert.ok(!HTML.includes('fondo sociale'), 'nella pagina c\'è ancora «fondo sociale»');
  assert.ok(!HTML.includes('povertà energetica'), 'nella pagina c\'è ancora «povertà energetica»');
  assert.ok(!HTML.includes('fondo della comunità'), '«fondo della comunità» si confonde con il 20% che resta alla CER: la quota eccedentaria senza consumatori non imprese va a finalità sociali');

  // «Venti anni» e «il ventesimo anno» sono scritti a parole: valgono solo finché la durata è 20.
  // Se la durata cambia, vanno riscritte anche queste parole nella pagina.
  assert.equal(durata, 20, 'durata_tariffa_anni non è più 20: vanno riscritte in pagina anche «Venti anni» e «il ventesimo anno»');
  assert.ok(HTML.includes('Venti anni'), 'nella pagina manca «Venti anni»');
  assert.ok(HTML.includes('il ventesimo anno'), 'nella pagina manca «il ventesimo anno»');
});

test('la pagina dice che i 20 anni usano sempre il fattore medio e come si leggono le fonti (esclude una pagina che dice il contrario del calcolo)', () => {
  assert.ok(HTML.includes('si usa sempre il fattore medio'), 'nella pagina manca «si usa sempre il fattore medio»');
  assert.ok(HTML.includes("unita === 'data'"), 'lo script non scrive le date in GG/MM/AAAA');
  assert.ok(HTML.includes("join(', ')"), 'le liste della tabella non si uniscono con «, »');
  assert.ok(HTML.includes('console.error(e)'), 'il ramo di errore non registra l\'errore');
  assert.equal(C.correttivo_fv.note, 'Le regioni di ciascuna area sono nella riga seguente.');
  assert.ok(leggi('simulatore.css').includes('.metodo .tabella th{text-align:left}'), 'manca lo stile delle intestazioni della tabella');
});

test('«Come calcoliamo» dice quando sono stati scaricati i dati, leggendo la data da un file dei dati, e ha i tag og: della pagina del simulatore', () => {
  assert.match(PV.scaricato_il, /^\d{4}-\d{2}-\d{2}$/);
  const tutte = readdirSync(new URL('../../cer/simulatore/dati/pv/', import.meta.url)).filter((f) => f.endsWith('.json'));
  const date = new Set(tutte.map((f) => JSON.parse(leggi(`dati/pv/${f}`)).scaricato_il));
  assert.deepEqual([...date], [PV.scaricato_il], 'le serie PVGIS non sono state scaricate tutte lo stesso giorno: una sola data non basta');
  assert.ok(HTML.includes("fetch('/cer/simulatore/dati/pv/011015.json')"), 'lo script non legge il file PV');
  assert.ok(HTML.includes('scaricato_il'), 'lo script non legge scaricato_il');
  assert.ok(HTML.includes('id="data-dati"'), 'manca il punto in cui scrivere la data');
  const [a, m, g] = PV.scaricato_il.split('-');
  assert.ok(!HTML.includes(PV.scaricato_il) && !HTML.includes(`${g}/${m}/${a}`), 'la data dei dati è scritta a mano nella pagina');
  const og = (p) => HTML.match(new RegExp(`<meta property="og:${p}" content="([^"]+)">`))?.[1];
  const sim = leggi('index.html');
  const ogSim = (p) => sim.match(new RegExp(`<meta property="og:${p}" content="([^"]+)">`))?.[1];
  assert.equal(og('type'), ogSim('type'));
  assert.equal(og('image'), ogSim('image'));
  assert.equal(og('url'), 'https://co2-info.duckdns.org/cer/simulatore/metodo/');
  assert.equal(og('title'), 'Come calcoliamo · Simulatore della CER');
  assert.ok(og('description')?.length > 20, 'manca og:description');
});
