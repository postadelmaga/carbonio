import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcola, valida, prepara, anno, flussi, peso, asse } from '../../cer/simulatore/js/motore.js';
import { TIPI } from '../../cer/simulatore/js/calendario.js';

const leggi = (p) => JSON.parse(readFileSync(new URL(`../../cer/simulatore/dati/${p}`, import.meta.url), 'utf8'));
const costanti = leggi('costanti.json'), attivita = leggi('consumi/attivita.json');
const a = asse();
// forme finte uguali in tutte le classi; sole fra le 8 e le 17
const piatta = Object.fromEntries(TIPI.map((t) => [t, Array.from({ length: 12 }, () => Array.from({ length: 24 }, (_, o) => (o >= 18 && o <= 22 ? 0.4 : 0.15)))]));
const forme = { classi: Object.fromEntries(['0-1,5', '1,5-3', '3-4,5', '4,5-6', 'oltre_6'].map((k) => [k, piatta])) };
const pv = Array.from({ length: a.n }, (_, i) => (a.ora[i] >= 8 && a.ora[i] <= 17 ? Math.round(600 * Math.sin((Math.PI * (a.ora[i] - 7.5)) / 11)) : 0));
const dati = { pv, forme, attivita, costanti };
const quasi = (x, y, eps, msg) => assert.ok(Math.abs(x - y) <= eps, `${msg ?? ''} ${x} ≠ ${y}`);

const base = (sovrascrivi = {}) => ({
  area: 'nord',
  soci: [
    { id: 'io', tipo: 'famiglia', numero: 1, consumo_kwh_anno: 2700, classe_potenza: '1,5-3', spostamento: 0 },
    { id: 'famiglie', tipo: 'famiglia', numero: 30, consumo_kwh_anno: null, classe_potenza: '1,5-3', spostamento: 0 },
    { id: 'attivita', tipo: 'attivita', numero: 2, consumo_kwh_anno: 10000, archetipo: 'com_orario_apertura', spostamento: 0 },
    { id: 'produttore', tipo: 'attivita', numero: 1, consumo_kwh_anno: 0, archetipo: 'com_orario_apertura', spostamento: 0 },
  ],
  impianti: [{ id: 'comune', kwp: 40, titolare: 'produttore', sul_pod_del_titolare: false, per_ogni_membro: false, esistente: false }],
  parametri: {}, io: 'io', fondatore: false, ...sovrascrivi,
});

test('validazione: errori in italiano, con il campo', () => {
  assert.deepEqual(valida(base(), costanti), []);
  const e = valida(base({
    impianti: [{ id: 'x', kwp: 2000, titolare: 'nessuno', sul_pod_del_titolare: false, per_ogni_membro: false, esistente: false }],
    parametri: { quota_produttore: 0.7, quota_consumatori: 0.5 },
  }), costanti);
  assert.ok(e.some((m) => /potenza fra 0,5 e 1\.000/.test(m)));
  assert.ok(e.some((m) => /titolare «nessuno»/.test(m)));
  assert.ok(e.some((m) => /oltre il 100%/.test(m)));
  assert.throws(() => calcola(base({ area: 'marte' }), dati), /area/);
  // rifiuti da cui dipendono energia, economia ed emissioni
  const zero = base();
  zero.soci[1] = { ...zero.soci[1], numero: 0 };
  assert.ok(valida(zero, costanti).some((m) => m.includes('numero dei membri fra 1 e 500')));
  const senzaPod = base({ impianti: [{ id: 'x', kwp: 4, titolare: 'produttore', sul_pod_del_titolare: false, per_ogni_membro: true, esistente: false }] });
  assert.ok(valida(senzaPod, costanti).some((m) => m.includes('un impianto per ogni membro sta sul POD di ciascuno')));
  const gruppo = base({ impianti: [{ id: 'x', kwp: 4, titolare: 'famiglie', sul_pod_del_titolare: true, per_ogni_membro: false, esistente: false }] });
  assert.ok(valida(gruppo, costanti).some((m) => m.includes('il titolare è un gruppo, l\'impianto va indicato per ogni membro')));
  const sposta = base();
  sposta.soci[0] = { ...sposta.soci[0], spostamento: 0.5 };
  assert.ok(valida(sposta, costanti).some((m) => m.includes('spostamento fra 0 e 30%')));
  assert.ok(valida(base({ parametri: { fattore_principale: 'alto' } }), costanti).some((m) => m.includes('fattore principale «alto»')));
});

test('tutto torna: incentivi distribuiti = tariffa + contributo', () => {
  const r = calcola(base(), dati);
  const i = r.comunita.incentivi;
  quasi(i.produttori + i.consumatori + i.cer + i.fondoSociale + i.costi, r.comunita.tariffa + r.comunita.contributo, 0.005);
  assert.ok(r.comunita.condivisa > 0);
  assert.ok(r.perTe.cerAggiunge > 0, 'il consumatore riceve una quota');
  assert.equal(r.perTe.investimento, 0);
  assert.equal(r.perTe.rientroConCer, null);
  assert.equal(r.grafici.giornata.produzione.length, 12);
  assert.equal(r.grafici.giornata.produzione[6].length, 24);
});

test('un gruppo di tre famiglie vale tre famiglie singole', () => {
  const tre = base();
  tre.soci[1] = { ...tre.soci[1], numero: 3 };
  const singole = base();
  singole.soci.splice(1, 1, ...[1, 2, 3].map((k) => ({ ...tre.soci[1], id: `f${k}`, numero: 1 })));
  const r1 = calcola(tre, dati), r2 = calcola(singole, dati);
  quasi(r1.comunita.condivisa, r2.comunita.condivisa, 1e-6);
  quasi(r1.membri.famiglie.totale, r2.membri.f1.totale, 1e-9);
  quasi(r1.perTe.totale, r2.perTe.totale, 1e-9);
});

test('prosumer con impianto esistente: niente tariffa, e toglie condivisa al comune', () => {
  const nuovo = calcola(base(), dati);
  const conVecchio = base();
  conVecchio.impianti.unshift({ id: 'tuo', kwp: 6, titolare: 'io', sul_pod_del_titolare: true, per_ogni_membro: false, esistente: true });
  const r = calcola(conVecchio, dati);
  assert.equal(r.impianti[0].tariffa, 0);
  assert.ok(r.impianti[1].condivisa <= nuovo.impianti[0].condivisa + 1e-9);
  assert.ok(!r.avvisi.some((x) => x.codice === 'esistenti_oltre_soglia'), '6 kW su 46 stanno sotto il 30%');
  conVecchio.impianti[0] = { ...conVecchio.impianti[0], kwp: 30 };
  assert.ok(calcola(conVecchio, dati).avvisi.some((x) => x.codice === 'esistenti_oltre_soglia'), '30 kW su 70 no');
});

test('degrado: anno 20 al 0,995^19 e interpolazione entro lo 0,5% all\'anno 10', () => {
  const ing = base();
  ing.impianti.push({ id: 'tuo', kwp: 4.5, titolare: 'io', sul_pod_del_titolare: true, per_ogni_membro: false, esistente: false });
  const prep = prepara(ing, dati);
  assert.equal(prep.anni, 20);
  const deg = 0.005, d10 = (1 - deg) ** 9, d20 = (1 - deg) ** 19;
  const a1 = anno(prep, 1), a10 = anno(prep, d10), a20 = anno(prep, d20);
  quasi(a20.en.totali.produzione, a1.en.totali.produzione * d20, 1e-6);
  for (const id of ['io', 'famiglie', 'produttore']) {
    const f1 = flussi(a1.ec.membri[id]), f10 = flussi(a10.ec.membri[id]), f20 = flussi(a20.ec.membri[id]);
    const tot = (f) => f.impiantoDaSolo + f.cerAggiunge;
    const interp = tot(f1) + (tot(f20) - tot(f1)) * peso(10, deg, 20);
    assert.ok(Math.abs(interp - tot(f10)) <= 0.005 * Math.abs(tot(f10)) + 0.01, `${id}: ${interp} contro ${tot(f10)}`);
  }
  assert.equal(peso(1, deg, 20), 0);
  quasi(peso(20, deg, 20), 1, 1e-12);
});

test('fondatore: la costituzione verificata si divide fra i fondatori', () => {
  const r = calcola(base({ fondatore: true }), dati);
  assert.equal(r.perTe.costituzione, costanti.voci.costituzione.valore / 3);
  assert.ok(!r.avvisi.some((x) => x.codice === 'costituzione_non_verificata'));
  const r2 = calcola(base({ fondatore: true, parametri: { costituzione_eur: 300, fondatori: 3 } }), dati);
  assert.equal(r2.perTe.costituzione, 100);
  // con la costante non verificata (valore nullo) la quota manca e l'avviso lo dichiara
  const nulla = { ...costanti, voci: { ...costanti.voci, costituzione: { ...costanti.voci.costituzione, valore: null } } };
  const r3 = calcola(base({ fondatore: true }), { ...dati, costanti: nulla });
  assert.equal(r3.perTe.costituzione, null);
  assert.ok(r3.avvisi.some((x) => x.codice === 'costituzione_non_verificata'));
});

test('avvisi: senza impianti e servono consumatori', () => {
  const senza = calcola(base({ impianti: [] }), dati);
  assert.ok(senza.avvisi.some((x) => x.codice === 'senza_impianti'));
  const grande = base();
  grande.impianti[0] = { ...grande.impianti[0], kwp: 900 };
  assert.ok(calcola(grande, dati).avvisi.some((x) => x.codice === 'servono_consumatori'));
});

test('validazione: le quote predefinite vengono dalle costanti', () => {
  const copia = { ...costanti, voci: { ...costanti.voci, quote_riparto: { ...costanti.voci.quote_riparto, valore: { produttore: 0.7, consumatori: 0.4 } } } };
  const ingressi = base({ parametri: { quota_consumatori: 0.4 } });
  assert.deepEqual(valida(ingressi, costanti), []);
  assert.ok(valida(ingressi, copia).some((m) => /oltre il 100%/.test(m)));
});

test('serie fotovoltaica: la lunghezza deve essere quella dell\'asse', () => {
  assert.throws(() => calcola(base(), { ...dati, pv: dati.pv.slice(0, 100) }), /serie fotovoltaica di 100 ore/);
});

// Impianto comune della CER (spec §6.7): il risultato tiene separate la parte della CER, la quota di titolare e la finalità sociale.
const conImpiantoCer = (soci) => base({
  soci: soci ?? base().soci.filter((x) => x.id !== 'produttore'),
  impianti: [{ id: 'comune', kwp: 40, titolare: 'cer', sul_pod_del_titolare: false, per_ogni_membro: false, esistente: false }],
});

test('impianto della CER: quotaCer è il 20% della tariffa netta, titolareCer il 40%, e il fondo è la somma delle tre voci', () => {
  const r = calcola(conImpiantoCer(), dati);
  const c = r.comunita, netta = c.tariffa * (1 - c.quotaEccedentaria) * (1 - c.kappa);
  assert.ok(netta > 0);
  quasi(c.quotaCer, 0.2 * netta, 1e-9, 'quotaCer');
  quasi(c.titolareCer, 0.4 * netta, 1e-9, 'titolareCer');
  assert.equal(c.fondoSociale, 0);
  quasi(c.fondo, c.quotaCer + c.titolareCer + c.fondoSociale, 1e-9, 'fondo');
  quasi(c.venditaCer, (r.impianti[0].immessa * r.parametri.prezzo_zonale) / 1000, 1e-9, 'vendita dell\'immessa');
  quasi(c.manutenzioneCer, 40 * r.parametri.manutenzione, 1e-9, 'manutenzione');
  quasi(c.investimentoCer, 51200, 1e-6, 'investimento: 40 kWp a 1,28 €/W, senza IVA');
  // gli incentivi: la quota di titolare della CER sta con i produttori, la parte della CER da sola
  const i = c.incentivi;
  quasi(i.produttori, c.titolareCer, 1e-9, 'i produttori sono solo la CER titolare');
  quasi(i.cer, c.quotaCer, 1e-9);
  assert.equal(i.fondoSociale, 0);
  quasi(i.produttori + i.consumatori + i.cer + i.fondoSociale + i.costi, c.tariffa + c.contributo, 0.005);
  assert.equal('fondo' in i, false, 'incentivi.fondo non c\'è più: la barra legge cer e fondoSociale');
});

test('impianto della CER e soci tutte imprese: l\'eccedentaria va a finalità sociali', () => {
  const soloImprese = [
    { id: 'io', tipo: 'attivita', numero: 1, consumo_kwh_anno: 100000, archetipo: 'com_orario_apertura', spostamento: 0 },
    { id: 'attivita', tipo: 'attivita', numero: 2, consumo_kwh_anno: 100000, archetipo: 'com_orario_apertura', spostamento: 0 },
  ];
  const c = calcola(conImpiantoCer(soloImprese), dati).comunita;
  assert.ok(c.eccedentaria > 0, 'con 40 kWp e molti consumi nelle ore di sole la condivisa supera il 55% dell\'immessa');
  quasi(c.fondoSociale, c.eccedentaria, 1e-9);
  quasi(c.fondo, c.quotaCer + c.titolareCer + c.fondoSociale, 1e-9);
  quasi(c.incentivi.fondoSociale, c.eccedentaria, 1e-9);
});

test('impianto di un socio: il fondo è solo la parte della CER, titolareCer e fondoSociale sono zero', () => {
  const c = calcola(base(), dati).comunita;
  assert.equal(c.titolareCer, 0);
  assert.equal(c.manutenzioneCer, 0);
  assert.equal(c.fondoSociale, 0);
  assert.equal(c.investimentoCer, 0);
  quasi(c.fondo, c.quotaCer, 1e-9);
});
