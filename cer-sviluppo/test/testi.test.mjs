import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mesiAllaScadenza, testoScadenza, ipotesi } from '../../cer/simulatore/js/testi.js';

const costanti = JSON.parse(readFileSync(new URL('../../cer/simulatore/dati/costanti.json', import.meta.url), 'utf8'));

test('mesi alla scadenza del 31/12/2027', () => {
  assert.equal(mesiAllaScadenza(new Date(2026, 10, 2), '2027-12-31'), 13);
  assert.equal(mesiAllaScadenza(new Date(2028, 0, 5), '2027-12-31'), -1);
  assert.match(testoScadenza(new Date(2026, 10, 2), costanti), /31\/12\/2027.*13 mesi/);
  assert.match(testoScadenza(new Date(2028, 1, 1), costanti), /si è chiusa/);
});

test('le ipotesi dicono riparto d\'esempio, scelta prudente, anno meteo e fattore', () => {
  const r = {
    parametri: { prezzo_zonale: 115.94, quota_produttore: 0.4, quota_consumatori: 0.4, gestione_eur_anno: 500, costo_evitato: {} },
    impianti: [{ incentivato: true, tip: 130 }],
    emissioni: { fattore: 199.6, fattoreAlto: 366.5, principale: 'media' },
  };
  const loc = { nome: 'La Spezia', sigla: 'SP', regione: 'Liguria' };
  const t = ipotesi(r, loc, { inclinazione: 33, anno_meteo: 2023, valori: [1000, 2000] }, costanti).join('\n');
  for (const parola of ['La Spezia (SP)', '2023', '33°', 'Eliodora', 'prudente', '130 €/MWh', '199,6', '366,5', '0,5%', '2,9%']) {
    assert.ok(t.includes(parola), parola);
  }
  assert.ok(t.includes('degrado dei pannelli: 0,5% della produzione l\'anno'), 'frase del degrado');
  assert.ok(!t.includes('il 0,5%'), 'nessun articolo davanti alla percentuale');
});

test('con il termoelettrico come numero principale, i 20 anni restano sulla media dei consumi', () => {
  const r = {
    parametri: { prezzo_zonale: 115.94, quota_produttore: 0.4, quota_consumatori: 0.4, gestione_eur_anno: 500, costo_evitato: {} },
    impianti: [{ incentivato: true, tip: 130 }],
    emissioni: { fattore: 366.5, fattoreAlto: 366.5, principale: 'termoelettrico' },
  };
  const loc = { nome: 'La Spezia', sigla: 'SP', regione: 'Liguria' };
  const t = ipotesi(r, loc, { inclinazione: 33, anno_meteo: 2023, valori: [1000, 2000] }, costanti).join('\n');
  const riga = t.split('\n').find((l) => l.startsWith('CO₂:'));
  assert.ok(riga.includes('366,5'), riga);
  assert.ok(riga.includes('sui 20 anni si usa la media dei consumi, 199,6 g per kWh'), riga);
  assert.ok(riga.includes('2,9%'), riga);
});

test('la scadenza ragiona al giorno: ultimo giorno aperto, poi chiusa', () => {
  assert.match(testoScadenza(new Date(2027, 10, 15, 9), costanti), /manca un mese/);
  assert.match(testoScadenza(new Date(2027, 11, 15, 9), costanti), /manca meno di un mese/);
  const ultimo = testoScadenza(new Date(2027, 11, 31, 12), costanti);
  assert.match(ultimo, /entro il 31\/12\/2027/);
  assert.match(ultimo, /manca meno di un mese/);
  assert.match(testoScadenza(new Date(2028, 0, 1, 0, 30), costanti), /si è chiusa il 31\/12\/2027/);
});

test('l\'anno meteorologico viene dal file PV, non è scritto a mano', () => {
  const r = {
    parametri: { prezzo_zonale: 115.94, quota_produttore: 0.4, quota_consumatori: 0.4, gestione_eur_anno: 500, costo_evitato: {} },
    impianti: [{ incentivato: true, tip: 130 }],
    emissioni: { fattore: 199.6, fattoreAlto: 366.5, principale: 'media' },
  };
  const loc = { nome: 'La Spezia', sigla: 'SP', regione: 'Liguria' };
  const t = ipotesi(r, loc, { inclinazione: 33, anno_meteo: 2024, valori: [1000, 2000] }, costanti).join('\n');
  assert.ok(t.includes('anno meteorologico 2024'), 'anno meteorologico 2024');
  assert.ok(!t.includes('2023'), 'nessun 2023 scritto a mano');
});
