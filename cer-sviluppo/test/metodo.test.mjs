// Prova dei numeri del testo di «Come calcoliamo» contro costanti.json. La pagina si legge come testo, senza DOM: i valori
// restano scritti nel testo, quindi un cambio di costante fa fallire la suite finché il testo non si aggiorna.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
    `il ${perc(fondo)} a un fondo sociale`,
    `lo ${perc(v('degrado'), 1)} di produzione l'anno`,
    `Sui ${durata} anni`,
    `entro il ${scadenza}`,
    `supera i ${numero(sogliaPrezzo)} €/MWh`,
    `l'anno meteorologico ${PV.anno_meteo}`,
    `perdite del ${PV.parametri.loss}%`,
  ];
  const mancanti = frasi.filter((f) => !HTML.includes(f));
  assert.deepEqual(mancanti, [], 'frasi da aggiornare in cer/simulatore/metodo/index.html');

  // «Venti anni» e «il ventesimo anno» sono scritti a parole: valgono solo finché la durata è 20.
  // Se la durata cambia, vanno riscritte anche queste parole nella pagina.
  assert.equal(durata, 20, 'durata_tariffa_anni non è più 20: vanno riscritte in pagina anche «Venti anni» e «il ventesimo anno»');
  assert.ok(HTML.includes('Venti anni'), 'nella pagina manca «Venti anni»');
  assert.ok(HTML.includes('il ventesimo anno'), 'nella pagina manca «il ventesimo anno»');
});
