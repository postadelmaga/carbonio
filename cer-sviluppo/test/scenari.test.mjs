import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ingressiEntrare, ingressiFondare } from '../../cer/simulatore/js/scenari.js';
import { valida } from '../../cer/simulatore/js/motore.js';

const costanti = JSON.parse(readFileSync(new URL('../../cer/simulatore/dati/costanti.json', import.meta.url), 'utf8'));
const utente = (x = {}) => ({ ruolo: 'consumatore', tipo: 'famiglia', classe: '1,5-3', consumo: null, archetipo: 'com_orario_apertura', kwp: 4.5, esistente: false, abitudini: 0, ...x });
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
  assert.deepEqual(entra({ ruolo: 'prosumer', esistente: true }).impianti.map((k) => k.id), ['tuo', 'comune']);
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
  famiglie: { numero: 30, classe: '1,5-3', consumo: null }, pannelli: { numero: 5, classe: '1,5-3', consumo: null, kwp: 4.5, esistenti: false },
  attivita: { numero: 2, archetipo: 'com_orario_apertura', consumo: 10000, kwp: 0 }, enti: { numero: 1, archetipo: 'com_orario_apertura', consumo: 5000, kwp: 0 },
  comune: { kwp: 40, titolare: 'produttore', esistente: false }, fondatori: 3, io: 'famiglie', abitudini: 0, ...x,
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
  const es = fonda({ pannelli: { ...fondo().pannelli, esistenti: true }, comune: { kwp: 40, titolare: 'cer', esistente: false } });
  assert.deepEqual(es.impianti.map((k) => k.id), ['pannelli', 'comune']);
  assert.ok(!es.soci.some((s) => s.id === 'produttore'));
  assert.equal(fonda({ io: 'produttore', comune: { kwp: 40, titolare: 'cer', esistente: false } }).io, 'famiglie');
});

test('quote 70% + 50% dalla pagina: gli ingressi non passano la validazione (la pagina non arriva a calcola)', () => {
  const quote = (parametri) => ingressiEntrare({ area: 'nord', parametri, utente: utente(), comunita: {} }, costanti);
  assert.deepEqual(valida(quote({ quota_produttore: 0.7, quota_consumatori: 0.3 }), costanti), []);
  assert.deepEqual(valida(quote({ quota_produttore: 0.7, quota_consumatori: 0.5 }), costanti), ['quota del produttore più quota dei consumatori oltre il 100%']);
});
