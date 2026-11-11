import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ingressiEntrare, ingressiFondare, etichetteRighe, opzioniIo, righeUguali, limitaQuote } from '../../cer/simulatore/js/scenari.js';
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

const riga = (id, x = {}) => ({ riga: id, numero: 1, kwp: 0, stato: 'nuovo', ...x });
const conPannelli = (x = {}) => riga('famiglie-2', { numero: 5, classe: '1,5-3', consumo: null, kwp: 4.5, ...x });
const fondo = (x = {}) => ({
  famiglie: [riga('famiglie-1', { numero: 30, classe: '1,5-3', consumo: null })],
  attivita: [riga('attivita-1', { numero: 2, archetipo: 'com_orario_apertura', consumo: 10000 })],
  enti: [riga('enti-1', { numero: 1, archetipo: 'com_orario_apertura', consumo: 5000 })],
  comune: { kwp: 40, titolare: 'produttore', stato: 'nuovo' }, fondatori: 3, io: 'famiglie-1', abitudini: 0, ...x,
});
const fonda = (x) => ingressiFondare({ area: 'nord', parametri: {}, fondare: fondo(x) }, costanti);

test('le cinque composizioni di oggi, scritte a righe, danno gli ingressi del motore e i numeri di prima al centesimo, a parte gli id (spec della composizione §7 punto 1; esclude un cambio di conti nel passaggio alle righe, non le composizioni con impianti nuovi su più profili, che cambiano per l\'ordine del §3)', async () => {
  const { calcola } = await import('../../cer/simulatore/js/motore.js');
  const leggi = (p) => JSON.parse(readFileSync(new URL(`../../cer/simulatore/dati/${p}`, import.meta.url), 'utf8'));
  const dati = { pv: leggi('pv/011015.json').valori, forme: leggi('consumi/domestici/liguria.json'), attivita: leggi('consumi/attivita.json'), costanti };
  const F = (id, numero, sp = 0) => ({ id, tipo: 'famiglia', numero, classe_potenza: '1,5-3', consumo_kwh_anno: null, spostamento: sp });
  const A = (id, tipo, numero, consumo) => ({ id, tipo, numero, archetipo: 'com_orario_apertura', consumo_kwh_anno: consumo, spostamento: 0 });
  const I = (id, kwp, titolare, sulPod, perOgni, stato = 'nuovo') => ({ id, kwp, titolare, sul_pod_del_titolare: sulPod, per_ogni_membro: perOgni, stato });
  const resto = [A('attivita-1', 'attivita', 2, 10000), A('enti-1', 'ente', 1, 5000), A('produttore', 'attivita', 1, 0)];
  const comune = (stato = 'nuovo') => I('comune', 40, 'produttore', false, false, stato);
  // numeri del codice a 81ddd33, con la composizione di prima (pannelli → famiglie-2, pannelli_esistenti → famiglie-2,
  // attivita → attivita-1, enti → enti-1): perTe.cerAggiunge, perTe.totale, comunita.tariffa, comunita.condivisa
  const casi = [
    { nome: 'predefinita', fondare: fondo(), soci: [F('famiglie-1', 30), ...resto], impianti: [comune()], io: 'famiglie-1', numeri: [28.42, 28.42, 3871, 29776.92] },
    { nome: 'famiglie con pannelli nuovi', fondare: fondo({ famiglie: [...fondo().famiglie, conPannelli()], io: 'famiglie-2', abitudini: 0.1 }),
      soci: [F('famiglie-1', 30, 0.1), F('famiglie-2', 5, 0.1), ...resto], impianti: [comune(), I('famiglie-2', 4.5, 'famiglie-2', true, true)], io: 'famiglie-2', numeri: [18.14, 729.79, 4536.15, 34893.5] },
    { nome: 'famiglie con pannelli precedenti', fondare: fondo({ famiglie: [...fondo().famiglie, conPannelli({ stato: 'precedente' })], io: 'famiglie-2' }),
      soci: [F('famiglie-1', 30), F('famiglie-2', 5), ...resto], impianti: [I('famiglie-2', 4.5, 'famiglie-2', true, true, 'precedente'), comune()], io: 'famiglie-2', numeri: [0.17, 697.65, 1113.95, 31557.12] },
    { nome: 'comune precedente', fondare: fondo({ comune: { kwp: 40, titolare: 'produttore', stato: 'precedente' } }),
      soci: [F('famiglie-1', 30), ...resto], impianti: [comune('precedente')], io: 'famiglie-1', numeri: [0, 0, 0, 29776.92] },
    { nome: 'attività con 10 kWp', fondare: fondo({ attivita: [riga('attivita-1', { numero: 2, archetipo: 'com_orario_apertura', consumo: 10000, kwp: 10 })], io: 'attivita-1' }),
      soci: [F('famiglie-1', 30), ...resto], impianti: [comune(), I('attivita-1', 10, 'attivita-1', true, true)], io: 'attivita-1', numeri: [30.13, 1870.33, 2639.29, 20302.25] },
  ];
  for (const c of casi) {
    const i = ingressiFondare({ area: 'nord', parametri: {}, fondare: c.fondare }, costanti);
    assert.deepEqual(i.soci, c.soci, c.nome);
    assert.deepEqual(i.impianti, c.impianti, c.nome);
    assert.equal(i.io, c.io, c.nome);
    assert.deepEqual(valida(i, costanti), [], c.nome);
    const r = calcola(i, dati);
    assert.deepEqual([r.perTe.cerAggiunge, r.perTe.totale, r.comunita.tariffa, r.comunita.condivisa].map((x) => Number(x.toFixed(2))), c.numeri, c.nome);
  }
});

test('fondare a righe: le righe con 0 membri non entrano, kWp 0 è un socio senza impianto, lo stato è della riga, gli id restano quelli delle righe, «io» passa al primo socio se la sua riga non c\'è (esclude righe vuote nel calcolo e un «io» che salta su un\'altra riga)', () => {
  const i = fonda({
    famiglie: [riga('famiglie-1', { numero: 0, classe: '1,5-3', consumo: null }), riga('famiglie-3', { numero: 4, classe: '3-4,5', consumo: 3000, kwp: 3, stato: 'esistente' })],
    attivita: [riga('attivita-2', { numero: 1, archetipo: 'com_carico_base', consumo: 20000, kwp: 0 })],
    enti: [], io: 'famiglie-1',
  });
  assert.deepEqual(i.soci.map((s) => s.id), ['famiglie-3', 'attivita-2', 'produttore']);
  assert.deepEqual(i.impianti.map((k) => [k.id, k.stato, k.titolare, k.per_ogni_membro]), [['famiglie-3', 'esistente', 'famiglie-3', true], ['comune', 'nuovo', 'produttore', false]]);
  const f3 = i.soci[0];
  assert.deepEqual([f3.classe_potenza, f3.consumo_kwh_anno, f3.numero], ['3-4,5', 3000, 4]);
  assert.equal(i.soci[1].archetipo, 'com_carico_base');
  assert.equal(i.io, 'famiglie-3', 'la riga di «io» non entra: si passa al primo socio');
  assert.deepEqual(valida(i, costanti), []);
  assert.equal(fonda({ io: 'produttore', comune: { kwp: 40, titolare: 'cer', stato: 'nuovo' } }).io, 'famiglie-1');
  const vuota = fonda({ famiglie: [], attivita: [], enti: [], comune: { kwp: 0, titolare: 'produttore', stato: 'nuovo' } });
  assert.deepEqual([vuota.soci, vuota.impianti, vuota.io], [[], [], null]);
  assert.equal(fonda({}).fondatore, true);
  assert.equal(fonda({}).parametri.fondatori, 3);
});

test('fondare a righe, anzianità: prima lo stato; fra i nuovi il comune e poi le righe nell\'ordine del modulo, famiglie, attività, enti; fra i già in esercizio l\'ordine del modulo, con il comune ultimo (spec della composizione §3; esclude il vecchio ordine con le famiglie dopo attività ed enti)', () => {
  const i = fonda({
    famiglie: [...fondo().famiglie, conPannelli()],
    attivita: [riga('attivita-1', { numero: 2, archetipo: 'com_orario_apertura', consumo: 10000, kwp: 10 })],
    enti: [riga('enti-1', { numero: 1, archetipo: 'com_orario_apertura', consumo: 5000, kwp: 5, stato: 'precedente' })],
  });
  assert.deepEqual(i.impianti.map((k) => k.id), ['enti-1', 'comune', 'famiglie-2', 'attivita-1']);
  const vecchi = fonda({ famiglie: [...fondo().famiglie, conPannelli({ stato: 'precedente' })], comune: { kwp: 40, titolare: 'cer', stato: 'precedente' } });
  assert.deepEqual(vecchi.impianti.map((k) => k.id), ['famiglie-2', 'comune']);
  const comuneEsistente = fonda({ famiglie: [...fondo().famiglie, conPannelli({ stato: 'precedente' })], comune: { kwp: 40, titolare: 'cer', stato: 'esistente' } });
  assert.deepEqual(comuneEsistente.impianti.map((k) => [k.id, k.stato]), [['comune', 'esistente'], ['famiglie-2', 'precedente']]);
});

test('etichette delle righe: singolare e plurale, con e senza pannelli, già in esercizio, e le righe con la stessa etichetta di una riga prima di loro dicono la loro posizione (spec della composizione §4; esclude due voci uguali in «Io sono» o nella tabella)', () => {
  const e = etichetteRighe({
    famiglie: [riga('famiglie-1', { numero: 30 }), riga('famiglie-2', { numero: 1, kwp: 4.5 }), riga('famiglie-4', { numero: 5, kwp: 4, stato: 'precedente' }), riga('famiglie-5', { numero: 5, kwp: 4.5 })],
    attivita: [riga('attivita-1', { numero: 2, kwp: 10 }), riga('attivita-2', { numero: 1 })],
    enti: [riga('enti-1', { numero: 3 }), riga('enti-2', { numero: 1, kwp: 10 }), riga('enti-3', { numero: 3 })],
  });
  assert.deepEqual(e['famiglie-1'], { io: 'una delle 30 famiglie senza pannelli', socio: 'Famiglie senza pannelli' });
  assert.deepEqual(e['famiglie-2'], { io: 'la famiglia con 4,5 kWp', socio: 'Famiglie con 4,5 kWp' });
  assert.deepEqual(e['famiglie-4'], { io: 'una delle 5 famiglie con 4 kWp già in esercizio', socio: 'Famiglie con 4 kWp già in esercizio' });
  assert.deepEqual(e['famiglie-5'], { io: 'una delle 5 famiglie con 4,5 kWp', socio: 'Famiglie con 4,5 kWp (quarta riga)' }, 'la voce di «Io sono» è diversa, quella della tabella no');
  assert.deepEqual(e['attivita-1'], { io: 'una delle 2 attività con 10 kWp', socio: 'Attività con 10 kWp' });
  assert.deepEqual(e['attivita-2'], { io: 'l\'attività senza pannelli', socio: 'Attività senza pannelli' });
  assert.deepEqual(e['enti-1'], { io: 'uno dei 3 enti senza pannelli', socio: 'Enti e associazioni senza pannelli' });
  assert.deepEqual(e['enti-2'], { io: 'l\'ente con 10 kWp', socio: 'Enti e associazioni con 10 kWp' });
  assert.deepEqual(e['enti-3'], { io: 'uno dei 3 enti senza pannelli (terza riga)', socio: 'Enti e associazioni senza pannelli (terza riga)' });
  const vuota = etichetteRighe({ famiglie: [], attivita: [riga('attivita-1', { numero: 0 }), riga('attivita-2', { numero: 1 })], enti: [] });
  assert.equal(vuota['attivita-1'], undefined, 'una riga con 0 membri non entra nel calcolo e non ha etichetta');
  assert.deepEqual(vuota['attivita-2'], { io: 'l\'attività senza pannelli', socio: 'Attività senza pannelli' }, 'senza il suffisso dovuto alla riga vuota (revisione finale del 10/11/2026)');
});

test('etichette con la stessa etichetta di base: i parametri che cambiano nel gruppo, separati per «Io sono» e per la tabella, e la posizione solo per le righe identiche (spec della composizione §11.4; esclude «(seconda riga)» dove un parametro distingue le righe)', () => {
  const e = etichetteRighe({
    famiglie: [
      riga('famiglie-1', { numero: 1, kwp: 4.5, classe: '1,5-3', consumo: null }),
      riga('famiglie-2', { numero: 1, kwp: 4.5, classe: '4,5-6', consumo: null }),
      riga('famiglie-3', { numero: 3, kwp: 4.5, classe: '1,5-3', consumo: 3000 }),
    ],
    attivita: [
      riga('attivita-1', { numero: 2, archetipo: 'com_orario_apertura', consumo: 10000 }),
      riga('attivita-2', { numero: 1, archetipo: 'com_carico_base', consumo: 10000 }),
    ],
    enti: [
      riga('enti-1', { numero: 1, kwp: 5, archetipo: 'com_orario_apertura', consumo: 5000, stato: 'precedente' }),
      riga('enti-2', { numero: 1, kwp: 5, archetipo: 'com_orario_apertura', consumo: 5000, stato: 'esistente' }),
      riga('enti-3', { numero: 1, kwp: 5, archetipo: 'com_orario_apertura', consumo: 5000, stato: 'esistente' }),
    ],
  });
  assert.deepEqual(e['famiglie-1'], { io: 'la famiglia con 4,5 kWp, contatore 3 kW', socio: 'Famiglie con 4,5 kWp, contatore 3 kW, consumo medio' });
  assert.deepEqual(e['famiglie-2'], { io: 'la famiglia con 4,5 kWp, contatore 6 kW', socio: 'Famiglie con 4,5 kWp, contatore 6 kW, consumo medio' });
  assert.deepEqual(e['famiglie-3'], { io: 'una delle 3 famiglie con 4,5 kWp', socio: 'Famiglie con 4,5 kWp, contatore 3 kW, 3000 kWh l\'anno' }, 'in «Io sono» il numero basta a distinguerla, nella tabella no');
  assert.deepEqual(e['attivita-1'], { io: 'una delle 2 attività senza pannelli', socio: 'Attività senza pannelli, con orario' });
  assert.deepEqual(e['attivita-2'], { io: 'l\'attività senza pannelli', socio: 'Attività senza pannelli, carico continuo' });
  assert.deepEqual(e['enti-1'], { io: 'l\'ente con 5 kWp già in esercizio, dopo il 15/12/2021', socio: 'Enti e associazioni con 5 kWp già in esercizio, dopo il 15/12/2021' });
  assert.deepEqual(e['enti-2'], { io: 'l\'ente con 5 kWp già in esercizio, fino al 15/12/2021', socio: 'Enti e associazioni con 5 kWp già in esercizio, fino al 15/12/2021' });
  assert.deepEqual(e['enti-3'], { io: 'l\'ente con 5 kWp già in esercizio, fino al 15/12/2021 (terza riga)', socio: 'Enti e associazioni con 5 kWp già in esercizio, fino al 15/12/2021 (terza riga)' }, 'identica alla seconda: la posizione resta');
  const sole = etichetteRighe({ famiglie: [riga('famiglie-1', { numero: 30, classe: '1,5-3', consumo: null })], attivita: [riga('attivita-1', { numero: 2, archetipo: 'com_carico_base', consumo: 20000 })], enti: [] });
  assert.deepEqual(sole['famiglie-1'], { io: 'una delle 30 famiglie senza pannelli', socio: 'Famiglie senza pannelli' }, 'una riga sola non aggiunge parametri');
  assert.deepEqual(sole['attivita-1'], { io: 'una delle 2 attività senza pannelli', socio: 'Attività senza pannelli' });
});

test('righe uguali: stessa chiave di contatore o tipo, kWp, consumo e stato con dei kWp; «quante» non conta, le righe con 0 membri non si confrontano, ogni riga uguale rimanda alla prima, e i profili restano separati (spec della composizione §11.1; esclude doppioni non segnalati e righe diverse segnalate)', () => {
  const F = (id, x = {}) => riga(id, { numero: 2, kwp: 4.5, classe: '1,5-3', consumo: null, ...x });
  const A = (id, x = {}) => riga(id, { numero: 1, kwp: 20, archetipo: 'com_orario_apertura', consumo: 10000, ...x });
  const u = (famiglie = [], attivita = [], enti = []) => righeUguali({ famiglie, attivita, enti });
  assert.deepEqual(u([F('famiglie-1'), F('famiglie-2', { numero: 5 })]), { 'famiglie-2': 'famiglie-1' }, '«quante» non conta');
  assert.deepEqual(u([F('famiglie-1'), F('famiglie-2', { classe: '4,5-6' })]), {}, 'contatore');
  assert.deepEqual(u([F('famiglie-1'), F('famiglie-2', { kwp: 6 })]), {}, 'kWp');
  assert.deepEqual(u([F('famiglie-1'), F('famiglie-2', { consumo: 3000 })]), {}, 'consumo');
  assert.deepEqual(u([F('famiglie-1'), F('famiglie-2', { stato: 'precedente' })]), {}, 'stato, con dei kWp');
  assert.deepEqual(u([F('famiglie-1', { kwp: 0 }), F('famiglie-2', { kwp: 0, stato: 'esistente' })]), { 'famiglie-2': 'famiglie-1' }, 'senza kWp lo stato non conta');
  assert.deepEqual(u([F('famiglie-1'), F('famiglie-2', { numero: 0 }), F('famiglie-3', { numero: 0 })]), {}, 'le righe con 0 membri non si confrontano');
  assert.deepEqual(u([F('famiglie-1', { numero: 0 }), F('famiglie-2'), F('famiglie-3')]), { 'famiglie-3': 'famiglie-2' }, 'una riga vuota prima non fa da riferimento');
  assert.deepEqual(u([F('famiglie-1', { kwp: 0 }), F('famiglie-2'), F('famiglie-4'), F('famiglie-5')]), { 'famiglie-4': 'famiglie-2', 'famiglie-5': 'famiglie-2' }, 'tre righe uguali rimandano tutte alla prima');
  assert.deepEqual(u([], [A('attivita-1'), A('attivita-2', { archetipo: 'com_carico_base' }), A('attivita-3', { consumo: 20000 }), A('attivita-4', { numero: 3 })]), { 'attivita-4': 'attivita-1' }, 'tipo e consumo di attività');
  assert.deepEqual(u([], [A('attivita-1')], [A('enti-1')]), {}, 'un\'attività e un ente con gli stessi valori non si confrontano');
  assert.deepEqual(u([F('famiglie-1', { numero: 30, kwp: 0 }), F('famiglie-2', { numero: 1 }), F('famiglie-3', { numero: 1 })]), { 'famiglie-3': 'famiglie-2' }, 'in semplice (contatore 3 kW e consumo null per tutte) le famiglie con gli stessi kWp sono uguali');
});

test('«Io sono»: le voci sono i soci che entrano nel calcolo, nell\'ordine degli ingressi, con le etichette delle righe e il socio produttore (esclude voci di righe vuote o assenti)', () => {
  const f = fondo({ famiglie: [...fondo().famiglie, conPannelli()], enti: [riga('enti-1', { numero: 0, archetipo: 'com_orario_apertura', consumo: 5000 })] });
  const i = ingressiFondare({ area: 'nord', parametri: {}, fondare: f }, costanti);
  assert.deepEqual(opzioniIo(i, etichetteRighe(f)), [
    { valore: 'famiglie-1', testo: 'una delle 30 famiglie senza pannelli' },
    { valore: 'famiglie-2', testo: 'una delle 5 famiglie con 4,5 kWp' },
    { valore: 'attivita-1', testo: 'una delle 2 attività senza pannelli' },
    { valore: 'produttore', testo: 'il socio produttore' },
  ]);
});

test('quote 70% + 50% dalla pagina: gli ingressi non passano la validazione (la pagina non arriva a calcola)', () => {
  const quote = (parametri) => ingressiEntrare({ area: 'nord', parametri, utente: utente(), comunita: {} }, costanti);
  assert.deepEqual(valida(quote({ quota_produttore: 0.7, quota_consumatori: 0.3 }), costanti), []);
  assert.deepEqual(valida(quote({ quota_produttore: 0.7, quota_consumatori: 0.5 }), costanti), ['quota del produttore più quota dei consumatori oltre il 100%']);
});

test('cursori del riparto: se la somma supera 100 l\'altro cursore scende, mai sotto zero (esclude quote oltre il 100% e valori negativi)', () => {
  assert.equal(limitaQuote(50, 40), 40, 'somma 90: nulla cambia');
  assert.equal(limitaQuote(70, 40), 30, 'la parte alla CER è già a zero, scende l\'altra');
  assert.equal(limitaQuote(100, 40), 0);
  assert.equal(limitaQuote(60, 40), 40, 'somma 100: nulla cambia');
});

test('produttore: niente consumi né abitudini, qualunque cosa ci sia nei campi, e il tipo resta per l\'IVA; un\'attività produttrice senza consumo passa la validazione (esclude il produttore con i consumi di casa in un altro punto, la lettura tolta l\'08/11/2026)', () => {
  for (const tipo of ['famiglia', 'attivita', 'ente']) {
    const i = entra({ ruolo: 'produttore', tipo, consumo: 5000, abitudini: 0.2 });
    const io = i.soci.find((s) => s.id === 'io');
    assert.equal(io.consumo_kwh_anno, 0, tipo);
    assert.equal(io.spostamento, 0, tipo);
    assert.equal(io.tipo, tipo);
  }
  assert.deepEqual(valida(entra({ ruolo: 'produttore', tipo: 'attivita', consumo: null }), costanti), []);
  const prosumer = entra({ ruolo: 'prosumer', consumo: 5000, abitudini: 0.2 }).soci.find((s) => s.id === 'io');
  assert.deepEqual([prosumer.consumo_kwh_anno, prosumer.spostamento], [5000, 0.2], 'il prosumer tiene consumo e abitudini');
});

test('produttore: dalla CER solo la quota di titolare, con i dati veri della Spezia (esclude quote di tariffa o di contributo da consumatore)', async () => {
  const { calcola } = await import('../../cer/simulatore/js/motore.js');
  const leggi = (p) => JSON.parse(readFileSync(new URL(`../../cer/simulatore/dati/${p}`, import.meta.url), 'utf8'));
  const dati = { pv: leggi('pv/011015.json').valori, forme: leggi('consumi/domestici/liguria.json'), attivita: leggi('consumi/attivita.json'), costanti };
  const r = calcola(entra({ ruolo: 'produttore', kwp: 20, consumo: 5000, abitudini: 0.2 }), dati).perTe;
  assert.equal(r.consumo, 0);
  assert.equal(r.voci.quotaTariffa, 0);
  assert.equal(r.voci.quotaContributo, 0);
  assert.equal(r.voci.quotaEccedentaria, 0);
  assert.ok(r.voci.quotaProduttore > 0);
  assert.equal(r.cerAggiunge, r.voci.quotaProduttore - r.voci.quotaAssociativa);
});
