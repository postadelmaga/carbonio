import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mesiAllaScadenza, testoScadenza, notaScadenza, ipotesi, testoEccedentaria, testoItaliani, testoStimaCo2, testoVentiAnniCo2, testoGiaInEsercizio, testoFondatori } from '../../cer/simulatore/js/testi.js';

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
    emissioni: { fattore: 413.3, fattoreAltro: 199.6, principale: 'fossili' },
  };
  const loc = { nome: 'La Spezia', sigla: 'SP', regione: 'Liguria' };
  const t = ipotesi(r, loc, { inclinazione: 33, anno_meteo: 2023, valori: [1000, 2000] }, costanti).join('\n');
  for (const parola of ['La Spezia (SP)', '2023', '33°', 'Eliodora', 'prudente', '130 €/MWh', '413,3', '199,6', '0,5%']) {
    assert.ok(t.includes(parola), parola);
  }
  assert.ok(t.includes('degrado dei pannelli: 0,5% della produzione l\'anno'), 'frase del degrado');
  assert.ok(!t.includes('il 0,5%'), 'nessun articolo davanti alla percentuale');
  assert.ok(t.includes('La produzione è calcolata sui kWp dei pannelli, con un inverter della stessa potenza e una connessione che permette di immettere tutto: non contiamo tagli dell\'inverter né limiti di immissione, e il costo della connessione è escluso.'), 'ipotesi sulla potenza dichiarata, senza tagli né limiti di immissione (esclude un\'ipotesi che tace sui limiti dell\'impianto)');
  const riga = t.split('\n').find((l) => l.startsWith('CO₂ evitata:'));
  assert.equal(riga, 'CO₂ evitata: ipotesi che ogni kWh dei pannelli sostituisca un kWh delle centrali fossili italiane, 413,3 g/kWh (metodo ISPRA, media nazionale annua, 2025 preliminare); con la CO₂ media di un kWh consumato sarebbe 199,6. Sui 20 anni il fattore resta quello di oggi: è una proiezione.');
});

test('con la media dei consumi come fattore, i 20 anni scendono del 2,9% l\'anno', () => {
  const r = {
    parametri: { prezzo_zonale: 115.94, quota_produttore: 0.4, quota_consumatori: 0.4, gestione_eur_anno: 500, costo_evitato: {} },
    impianti: [{ incentivato: true, tip: 130 }],
    emissioni: { fattore: 199.6, fattoreAltro: 413.3, principale: 'media' },
  };
  const loc = { nome: 'La Spezia', sigla: 'SP', regione: 'Liguria' };
  const t = ipotesi(r, loc, { inclinazione: 33, anno_meteo: 2023, valori: [1000, 2000] }, costanti).join('\n');
  const riga = t.split('\n').find((l) => l.startsWith('CO₂ evitata:'));
  assert.equal(riga, 'CO₂ evitata: ipotesi che ogni kWh dei pannelli valga la CO₂ media di un kWh consumato in Italia, 199,6 g/kWh (media nazionale annua, ISPRA, 2025 preliminare); con il metodo ISPRA delle emissioni evitate sarebbe 413,3. Sui 20 anni il fattore scende del 2,9% l\'anno, come in media dal 1990: è una proiezione.');
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
    emissioni: { fattore: 413.3, fattoreAltro: 199.6, principale: 'fossili' },
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
    emissioni: { fattore: 413.3, fattoreAltro: 199.6, principale: 'fossili' },
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

test('le emissioni in italiani: «circa come», mai «0 italiani», e senza CO₂ evitata la frase non c\'è', () => {
  const coda = 'in un anno (5,1 t a persona nel 2024, contando solo ciò che si emette sul territorio).';
  assert.equal(testoItaliani(12.4, 5.1), `Circa come le emissioni di 12 italiani ${coda}`);
  assert.equal(testoItaliani(12345.4, 5.1), `Circa come le emissioni di 12.345 italiani ${coda}`);
  assert.equal(testoItaliani(0.3, 5.1), `Meno delle emissioni di un italiano ${coda}`);
  assert.equal(testoItaliani(0.5, 5.1), `Circa come le emissioni di un italiano ${coda}`, 'arrotondato fa 1: non «1 italiani»');
  assert.equal(testoItaliani(1.5, 5.1), `Circa come le emissioni di 2 italiani ${coda}`);
  assert.equal(testoItaliani(0, 5.1), '');
});

test('la riga sotto la CO₂ evitata dice l\'ipotesi e quanto darebbe l\'altra, senza «fino a» (esclude due convenzioni presentate come intervallo)', () => {
  const f = testoStimaCo2('fossili', 11.0, costanti);
  assert.equal(f, 'Stima con il metodo ISPRA delle emissioni evitate: ogni kWh dei pannelli sostituisce un kWh delle centrali fossili italiane (413,3 g/kWh, 2025 preliminare). Con la CO₂ media di un kWh consumato in Italia (199,6 g/kWh) sarebbero circa 11 t. Non è un intervallo di certezza: il valore vero dipende dall\'ora, dalla zona e da quali centrali i pannelli fermano davvero.');
  const m = testoStimaCo2('media', 22.8, costanti);
  assert.ok(m.startsWith('Stima con la CO₂ media di un kWh consumato in Italia (199,6 g/kWh, 2025 preliminare). Con il metodo ISPRA delle emissioni evitate, che conta le centrali fossili italiane (413,3 g/kWh), sarebbero circa 23 t.'));
  assert.equal(testoStimaCo2('fossili', 0, costanti), '');
  assert.ok(!f.includes('fino a') && !m.includes('fino a'));
});

test('i 20 anni della CO₂: «se il fattore restasse quello di oggi» con il metodo ISPRA, il calo del 2,9% solo con la media', () => {
  assert.equal(testoVentiAnniCo2('fossili', 434.6, costanti), 'In 20 anni, se il fattore restasse quello di oggi: circa 430 t.');
  assert.equal(testoVentiAnniCo2('media', 161.8, costanti), 'In 20 anni, se il fattore medio continuasse a scendere del 2,9% l\'anno come in media dal 1990: circa 160 t.');
  assert.equal(testoVentiAnniCo2('fossili', 0, costanti), '');
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

test('la scadenza in «fondare»: esercizio dopo la costituzione, domanda che conviene presentare entro la data, solo contributo ARERA dopo (esclude «va presentata», che nessuna fonte scrive)', () => {
  const t = testoScadenza(new Date(2026, 10, 2), costanti);
  assert.equal(t, 'Per avere la tariffa premio gli impianti devono entrare in esercizio dopo la costituzione della CER ed entro il 31/12/2027: mancano 13 mesi. Conviene presentare la domanda al GSE entro la stessa data. Dopo, con le regole di oggi, un impianto riceve solo il contributo ARERA, molto più piccolo. La data cambierebbe solo con una proroga, che a oggi non c\'è.');
  assert.ok(!t.includes('va presentata'));
});

test('la nota sotto «Per te» in «Voglio entrare»: al consumatore solo la parte su chi entra, a prosumer e produttore una nota sola che comincia dall\'impianto (esclude la nota sull\'impianto mostrata al consumatore), e con l\'impianto già in esercizio solo la parte su chi entra (esclude la scadenza degli impianti nuovi mostrata a chi ha l\'impianto già in esercizio)', () => {
  const oggi = new Date(2026, 10, 4);
  const chi = 'La scadenza del 31/12/2027 riguarda gli impianti, non chi consuma. Se entri dopo quella data in una comunità i cui impianti hanno già la tariffa, la tua energia condivisa dovrebbe contare ancora, per gli anni che restano dei loro 20: nessuna regola lo esclude, ma nessuna lo scrive, e il GSE non l\'ha chiarito.';
  const impianto = 'Per avere la tariffa premio l\'impianto deve entrare in esercizio dopo la costituzione della CER ed entro il 31/12/2027, e conviene presentare la domanda al GSE entro la stessa data. Se entra in esercizio dopo, con le regole di oggi la tariffa non c\'è: la sua energia conta lo stesso per la comunità, ma riceve solo il contributo ARERA, molto più piccolo. La data può arrivare prima, se in Italia si raggiungono 5 GW di impianti incentivati, e cambierebbe solo con una proroga, che a oggi non c\'è.';
  assert.equal(notaScadenza('consumatore', oggi, costanti), chi);
  assert.equal(notaScadenza('prosumer', oggi, costanti), `${impianto} ${chi}`);
  assert.equal(notaScadenza('produttore', oggi, costanti), `${impianto} ${chi}`);
  assert.equal(notaScadenza('prosumer', oggi, costanti, 'precedente'), chi);
  assert.equal(notaScadenza('produttore', oggi, costanti, 'esistente'), chi);
  assert.equal(notaScadenza('prosumer', oggi, costanti, 'nuovo'), `${impianto} ${chi}`);
  assert.ok(notaScadenza('prosumer', new Date(2028, 1, 1), costanti).startsWith('La finestra della tariffa premio si è chiusa il 31/12/2027, salvo proroghe'));
});

test('le ipotesi seguono gli impianti: la riga dei nuovi solo con impianti nuovi, quella dei già in esercizio solo con loro (esclude un\'ipotesi in conflitto con il modulo)', () => {
  const base = {
    parametri: { prezzo_zonale: 115.94, quota_produttore: 0.4, quota_consumatori: 0.4, gestione_eur_anno: 500, costo_evitato: {} },
    emissioni: { fattore: 413.3, fattoreAltro: 199.6, principale: 'fossili' },
  };
  const loc = { nome: 'La Spezia', sigla: 'SP', regione: 'Liguria' }, pv = { inclinazione: 33, anno_meteo: 2023, valori: [1000, 2000] };
  const nuovi = 'Gli impianti nuovi entrano in esercizio dopo la costituzione della CER ed entro il 31/12/2027.';
  const gia = 'Gli impianti già in esercizio sono entrati in esercizio prima della costituzione della CER: niente tariffa premio, solo il contributo ARERA sulla loro condivisa.';
  const t1 = ipotesi({ ...base, impianti: [{ incentivato: true, tip: 130, giaInEsercizio: false }] }, loc, pv, costanti);
  assert.ok(t1.includes(nuovi) && !t1.includes(gia));
  const t2 = ipotesi({ ...base, impianti: [{ incentivato: false, tip: 0, giaInEsercizio: true }] }, loc, pv, costanti);
  assert.ok(!t2.includes(nuovi) && t2.includes(gia));
  const t3 = ipotesi({ ...base, impianti: [{ incentivato: false, tip: 0, giaInEsercizio: true }, { incentivato: true, tip: 130, giaInEsercizio: false }] }, loc, pv, costanti);
  assert.ok(t3.includes(nuovi) && t3.includes(gia));
});

test('l\'etichetta dei fondatori dice l\'importo che dividono, o solo «la costituzione» se manca (esclude un campo che divide una cifra invisibile)', () => {
  assert.equal(testoFondatori(360), 'Fondatori, che dividono i 360 € della costituzione');
  assert.equal(testoFondatori(null), 'Fondatori, che dividono la costituzione');
});
