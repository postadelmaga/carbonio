import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ingressiEntrare, ingressiFondare, sceltaIo, limitaQuote } from '../../cer/simulatore/js/scenari.js';
import { valida } from '../../cer/simulatore/js/motore.js';

const costanti = JSON.parse(readFileSync(new URL('../../cer/simulatore/dati/costanti.json', import.meta.url), 'utf8'));
const utente = (x = {}) => ({ ruolo: 'consumatore', tipo: 'famiglia', classe: '1,5-3', consumo: null, archetipo: 'com_orario_apertura', kwp: 4.5, stato: 'nuovo', abitudini: 0, ...x });
const entra = (u, comunita = {}) => ingressiEntrare({ area: 'nord', parametri: {}, utente: utente(u), comunita }, costanti);

test('consumatore: la comunità tipo intorno, un solo impianto', () => {
  const i = entra({});
  assert.deepEqual(i.soci.map((s) => s.id), ['io', 'famiglie', 'attivita', 'enti', 'produttore']);
  assert.deepEqual(i.impianti.map((k) => k.id), ['comune']);
  assert.equal(i.soci[1].numero, 30);
  assert.equal(i.io, 'io');
  assert.equal(i.fondatore, false);
  assert.deepEqual(valida(i, costanti), []);
});

test('prosumer: impianto nuovo dopo il comune, esistente prima', () => {
  assert.deepEqual(entra({ ruolo: 'prosumer' }).impianti.map((k) => [k.id, k.sul_pod_del_titolare]), [['comune', false], ['tuo', true]]);
  assert.deepEqual(entra({ ruolo: 'prosumer', stato: 'precedente' }).impianti.map((k) => k.id), ['tuo', 'comune']);
  assert.equal(entra({ ruolo: 'produttore' }).impianti[1].sul_pod_del_titolare, false);
});

test('attività senza consumo: errore di validazione', () => {
  assert.ok(valida(entra({ tipo: 'attivita', consumo: null }), costanti).some((m) => /consumo annuo/.test(m)));
  assert.deepEqual(valida(entra({ tipo: 'ente', consumo: 8000 }), costanti), []);
});

test('comunità tipo modificata in esperto; senza impianto comune non c\'è il produttore', () => {
  const i = entra({}, { famiglie: 10, kwp_comune: 0 });
  assert.equal(i.soci.find((s) => s.id === 'famiglie').numero, 10);
  assert.ok(!i.soci.some((s) => s.id === 'produttore'));
  assert.deepEqual(i.impianti, []);
});

const fondo = (x = {}) => ({
  famiglie: { numero: 30, classe: '1,5-3', consumo: null }, pannelli: { numero: 5, classe: '1,5-3', consumo: null, kwp: 4.5 },
  pannelliEsistenti: { numero: 0, classe: '1,5-3', consumo: null, kwp: 4.5, stato: 'precedente' },
  attivita: { numero: 2, archetipo: 'com_orario_apertura', consumo: 10000, kwp: 0 }, enti: { numero: 1, archetipo: 'com_orario_apertura', consumo: 5000, kwp: 0 },
  comune: { kwp: 40, titolare: 'produttore', stato: 'nuovo' }, fondatori: 3, io: 'famiglie', abitudini: 0, ...x,
});
const fonda = (x) => ingressiFondare({ area: 'nord', parametri: {}, fondare: fondo(x) }, costanti);

test('fondare: gruppi, impianti per anzianità, fondatore', () => {
  const i = fonda({});
  assert.deepEqual(i.soci.map((s) => s.id), ['famiglie', 'pannelli', 'attivita', 'enti', 'produttore']);
  assert.deepEqual(i.impianti.map((k) => k.id), ['comune', 'pannelli']);
  assert.equal(i.impianti[1].per_ogni_membro, true);
  assert.equal(i.fondatore, true);
  assert.equal(i.parametri.fondatori, 3);
  assert.deepEqual(valida(i, costanti), []);
  const es = fonda({ pannelliEsistenti: { ...fondo().pannelliEsistenti, numero: 3, stato: 'esistente' }, comune: { kwp: 40, titolare: 'cer', stato: 'precedente' } });
  assert.deepEqual(es.soci.map((s) => s.id), ['famiglie', 'pannelli', 'pannelli_esistenti', 'attivita', 'enti']);
  assert.deepEqual(es.impianti.map((k) => [k.id, k.stato]), [['pannelli_esistenti', 'esistente'], ['comune', 'precedente'], ['pannelli', 'nuovo']]);
  assert.deepEqual(valida(es, costanti), []);
  assert.equal(fonda({ io: 'produttore', comune: { kwp: 40, titolare: 'cer', stato: 'nuovo' } }).io, 'famiglie');
});

test('fondare: famiglie con pannelli nuovi e già in esercizio sono due gruppi, con l\'anzianità esistente → precedente → comune nuovo → altri nuovi (esclude una spunta unica per tutte e un ordine che dia la condivisa ai nuovi per primi)', () => {
  const i = fonda({ pannelliEsistenti: { ...fondo().pannelliEsistenti, numero: 2, stato: 'precedente' }, io: 'pannelli_esistenti' });
  assert.deepEqual(i.impianti.map((k) => k.id), ['pannelli_esistenti', 'comune', 'pannelli']);
  assert.equal(i.io, 'pannelli_esistenti');
  assert.equal(i.soci.find((s) => s.id === 'pannelli_esistenti').numero, 2);
  const k = i.impianti[0];
  assert.deepEqual([k.titolare, k.sul_pod_del_titolare, k.per_ogni_membro], ['pannelli_esistenti', true, true]);
  const zero = fonda({ pannelliEsistenti: { ...fondo().pannelliEsistenti, numero: 0 } });
  assert.ok(!zero.soci.some((s) => s.id === 'pannelli_esistenti'), 'zero famiglie: nessun gruppo');
});

test('fondare: un comune già in esercizio da prima passa davanti alle famiglie con pannelli già in esercizio più recenti (esclude l\'ordine del modulo senza l\'ordinamento per anzianità)', () => {
  const i = fonda({ pannelliEsistenti: { ...fondo().pannelliEsistenti, numero: 2, stato: 'precedente' }, comune: { kwp: 40, titolare: 'cer', stato: 'esistente' } });
  assert.deepEqual(i.impianti.map((k) => [k.id, k.stato]), [['comune', 'esistente'], ['pannelli_esistenti', 'precedente'], ['pannelli', 'nuovo']]);
});

test('quote 70% + 50% dalla pagina: gli ingressi non passano la validazione (la pagina non arriva a calcola)', () => {
  const quote = (parametri) => ingressiEntrare({ area: 'nord', parametri, utente: utente(), comunita: {} }, costanti);
  assert.deepEqual(valida(quote({ quota_produttore: 0.7, quota_consumatori: 0.3 }), costanti), []);
  assert.deepEqual(valida(quote({ quota_produttore: 0.7, quota_consumatori: 0.5 }), costanti), ['quota del produttore più quota dei consumatori oltre il 100%']);
});

test('«Io sono»: le opzioni dei gruppi assenti si disabilitano e la scelta passa al gruppo che il calcolo usa davvero', () => {
  const ids = ['famiglie', 'pannelli', 'pannelli_esistenti', 'attivita', 'enti', 'produttore'];
  const cer = fonda({ io: 'produttore', comune: { kwp: 40, titolare: 'cer', stato: 'nuovo' } });
  assert.deepEqual(sceltaIo(cer, ids), { io: 'famiglie', disabilitati: ['pannelli_esistenti', 'produttore'] });
  const senzaPannelli = fonda({ io: 'pannelli', pannelli: { ...fondo().pannelli, numero: 0 } });
  assert.deepEqual(sceltaIo(senzaPannelli, ids), { io: 'famiglie', disabilitati: ['pannelli', 'pannelli_esistenti'] });
  const tutti = fonda({ io: 'enti' });
  assert.deepEqual(sceltaIo(tutti, ids), { io: 'enti', disabilitati: ['pannelli_esistenti'] });
  const solo = fonda({ io: 'famiglie', pannelli: { ...fondo().pannelli, numero: 0 }, attivita: { ...fondo().attivita, numero: 0 }, enti: { ...fondo().enti, numero: 0 }, comune: { kwp: 0, titolare: 'produttore', stato: 'nuovo' } });
  assert.deepEqual(sceltaIo(solo, ids), { io: 'famiglie', disabilitati: ['pannelli', 'pannelli_esistenti', 'attivita', 'enti', 'produttore'] });
  const nessuno = ingressiFondare({ area: 'nord', parametri: {}, fondare: fondo({ famiglie: { numero: 0, classe: '1,5-3', consumo: null }, pannelli: { ...fondo().pannelli, numero: 0 }, attivita: { ...fondo().attivita, numero: 0 }, enti: { ...fondo().enti, numero: 0 }, comune: { kwp: 0, titolare: 'produttore', stato: 'nuovo' } }) }, costanti);
  assert.deepEqual(sceltaIo(nessuno, ids), { io: null, disabilitati: ids });
});

test('cursori del riparto: se la somma supera 100 l\'altro cursore scende, mai sotto zero (esclude quote oltre il 100% e valori negativi)', () => {
  assert.equal(limitaQuote(50, 40), 40, 'somma 90: nulla cambia');
  assert.equal(limitaQuote(70, 40), 30, 'la parte alla CER è già a zero, scende l\'altra');
  assert.equal(limitaQuote(100, 40), 0);
  assert.equal(limitaQuote(60, 40), 40, 'somma 100: nulla cambia');
});
