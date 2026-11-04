import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mesiAllaScadenza, testoScadenza, ipotesi, testoEccedentaria, testoFinoA, testoItaliani, testoGiaInEsercizio } from '../../cer/simulatore/js/testi.js';

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

test('le ipotesi dicono che il 20% resta alla CER, non che va a un fondo sociale (la scelta del fondo è del regolamento di Eliodora)', () => {
  const r = {
    parametri: { prezzo_zonale: 115.94, quota_produttore: 0.4, quota_consumatori: 0.4, gestione_eur_anno: 500, costo_evitato: {} },
    impianti: [{ incentivato: true, tip: 130 }],
    emissioni: { fattore: 199.6, fattoreAlto: 366.5, principale: 'media' },
  };
  const loc = { nome: 'La Spezia', sigla: 'SP', regione: 'Liguria' };
  const riga = ipotesi(r, loc, { inclinazione: 33, anno_meteo: 2023, valori: [1000, 2000] }, costanti).find((l) => l.startsWith('Riparto:'));
  assert.ok(riga.includes('20% alla CER'), riga);
  assert.ok(!/fondo sociale/i.test(riga), riga);
  assert.ok(riga.includes('40% della tariffa al titolare dell\'impianto, 40% ai consumatori'), riga);
});

test('la frase sull\'eccedentaria compare solo se c\'è, e dice dove va', () => {
  assert.equal(testoEccedentaria({ quotaEccedentaria: 0, eccedentaria: 0, fondoSociale: 0 }), '');
  assert.equal(
    testoEccedentaria({ quotaEccedentaria: 0.1, eccedentaria: 300, fondoSociale: 0 }),
    'La quota eccedentaria della tariffa, 300 € l\'anno, va ai consumatori che non sono imprese (statuto, art. 12).',
  );
  assert.equal(
    testoEccedentaria({ quotaEccedentaria: 0.1, eccedentaria: 300, fondoSociale: 300 }),
    'La quota eccedentaria della tariffa, 300 € l\'anno, va ai consumatori che non sono imprese (statuto, art. 12). Senza consumatori che non siano imprese, va a finalità sociali: 300 € l\'anno.',
  );
});

test('«fino a …» compare solo quando il numero principale è la media e la CO₂ evitata è positiva: né col termoelettrico (lo stesso numero due volte) né senza impianti nuovi («0 kg … fino a 0 kg»)', () => {
  assert.equal(testoFinoA('media', 20.2, 36.8), ', fino a 36,8 t');
  assert.equal(testoFinoA('media', 0.2, 0.4), ', fino a 400 kg');
  assert.equal(testoFinoA('termoelettrico', 36.8, 36.8), '');
  assert.equal(testoFinoA('media', 0, 0), '');
  assert.equal(testoFinoA('termoelettrico', 0, 0), '');
});

test('le emissioni in italiani: un numero che arrotondato è 0 non diventa «0 italiani», e senza CO₂ evitata la frase non c\'è', () => {
  assert.equal(testoItaliani(12.4, 5.1), 'Sono le emissioni di 12 italiani in un anno (5,1 t a testa).');
  assert.equal(testoItaliani(12345.4, 5.1), 'Sono le emissioni di 12.345 italiani in un anno (5,1 t a testa).');
  assert.equal(testoItaliani(0.3, 5.1), 'Sono meno delle emissioni di un italiano in un anno (5,1 t a testa).');
  assert.equal(testoItaliani(0.49, 5.1), 'Sono meno delle emissioni di un italiano in un anno (5,1 t a testa).');
  assert.equal(testoItaliani(0.5, 5.1), 'Sono le emissioni di un italiano in un anno (5,1 t a testa).', 'arrotondato fa 1: non «1 italiani»');
  assert.equal(testoItaliani(1.4, 5.1), 'Sono le emissioni di un italiano in un anno (5,1 t a testa).');
  assert.equal(testoItaliani(1.5, 5.1), 'Sono le emissioni di 2 italiani in un anno (5,1 t a testa).');
  assert.equal(testoItaliani(0, 5.1), '', 'senza CO₂ evitata non c\'è nessun confronto: «meno di un italiano» direbbe che qualcosa si evita');
});

test('il testo sugli impianti già in esercizio: vuoto per un impianto nuovo, la frase del 30% solo per gli esistenti fino al 15/12/2021 (esclude il limite detto agli impianti successivi)', () => {
  assert.equal(testoGiaInEsercizio('nuovo'), '');
  const p = testoGiaInEsercizio('precedente'), e = testoGiaInEsercizio('esistente');
  assert.ok(p.startsWith('Un impianto entrato in esercizio prima della costituzione della CER, con le regole di oggi, non riceve la tariffa premio'));
  assert.ok(p.includes('Se hai lo scambio sul posto, per entrare va chiuso.'));
  assert.ok(p.includes('riduce i kWh incentivati di quelli nuovi'));
  assert.ok(!p.includes('30%'));
  assert.ok(e.endsWith('Un impianto entrato in esercizio fino al 15/12/2021 è un impianto «esistente»: la comunità può averne al massimo il 30% della potenza.'));
});
