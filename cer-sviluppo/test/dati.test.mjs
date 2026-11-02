import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { slug } from '../../cer/simulatore/js/formato.js';
import { asse, calcola, prepara, anno, flussi, peso } from '../../cer/simulatore/js/motore.js';
import { consumoMedioClasse } from '../../cer/simulatore/js/profili.js';
import { ingressiEntrare } from '../../cer/simulatore/js/scenari.js';

const percorso = (p) => new URL(`../../cer/simulatore/dati/${p}`, import.meta.url);
const leggi = (p) => JSON.parse(readFileSync(percorso(p), 'utf8'));
const { localita } = leggi('localita.json');
const costanti = leggi('costanti.json'), attivita = leggi('consumi/attivita.json');
const spezia = localita.find((l) => l.codice === '011015');
const datiSpezia = { pv: leggi('pv/011015.json').valori, forme: leggi(`consumi/domestici/${slug('Liguria')}.json`), attivita, costanti };

test('località: 109 capoluoghi, codici unici, aree e coordinate plausibili', () => {
  assert.equal(localita.length, 109);
  assert.equal(new Set(localita.map((l) => l.codice)).size, 109);
  assert.deepEqual([spezia.nome, spezia.sigla, spezia.regione, spezia.area], ['La Spezia', 'SP', 'Liguria', 'nord']);
  for (const l of localita) {
    assert.ok(['nord', 'centro', 'sud'].includes(l.area), l.codice);
    assert.ok(l.lat > 35 && l.lat < 48 && l.lon > 6 && l.lon < 19, `${l.codice} ${l.lat} ${l.lon}`);
    assert.ok(existsSync(percorso(`consumi/domestici/${slug(l.regione)}.json`)), `forme di ${l.regione}`);
  }
});

test('area di ogni località: quella di aree_correttivo_fv per la sua regione', () => {
  const { nord, centro } = costanti.voci.aree_correttivo_fv.valore;
  for (const l of localita) {
    const attesa = nord.includes(l.regione) ? 'nord' : centro.includes(l.regione) ? 'centro' : 'sud';
    assert.equal(l.area, attesa, `${l.codice} ${l.nome} (${l.regione})`);
  }
});

test('serie PV: 8.760 interi, resa fra 1.000 e 1.800 kWh/kWp', () => {
  for (const l of localita) {
    const s = leggi(`pv/${l.codice}.json`);
    assert.equal(s.valori.length, 8760, l.codice);
    assert.ok(s.valori.every((v) => Number.isInteger(v) && v >= 0), l.codice);
    const resa = s.valori.reduce((x, y) => x + y, 0) / 1000;
    assert.ok(resa >= 1000 && resa <= 1800, `${l.codice}: ${resa}`);
  }
});

// Mezzogiorno solare in ora locale (ora d'orologio in ore decimali) a metà mese: 12 + fuso − longitudine/15 − equazione del tempo.
// Equazione del tempo in minuti, approssimazione di Spencer/Whitaker: 9,87 sin 2B − 7,53 cos B − 1,5 sin B, con B = 2π (giorno − 81) / 364.
const mezzogiornoSolare = (lon, giornoDellAnno, fuso) => {
  const B = (2 * Math.PI * (giornoDellAnno - 81)) / 364;
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  return 12 + fuso - lon / 15 - eot / 60;
};

test('allineamento orario: il baricentro della produzione segue il mezzogiorno solare di 0-0,6 h (esclude un errore di un\'ora)', () => {
  const a = asse(), v = datiSpezia.pv;
  // Gennaio: ora solare, UTC+1, 15 gennaio (giorno 15). Luglio: ora legale, UTC+2, 15 luglio (giorno 196).
  for (const [mese, giorno, fuso] of [[1, 15, 1], [7, 196, 2]]) {
    let num = 0, den = 0;
    for (let h = 0; h < a.n; h++) if (a.mese[h] === mese) { num += v[h] * (a.ora[h] + 0.5); den += v[h]; }
    const scarto = num / den - mezzogiornoSolare(spezia.lon, giorno, fuso);
    assert.ok(scarto >= 0 && scarto <= 0.6, `mese ${mese}: baricentro ${(num / den).toFixed(2)} h, scarto dal mezzogiorno solare ${scarto.toFixed(2)} h`);
  }
});

test('forme ARERA: classe 1,5-3 in Liguria intorno a 1.480 kWh l\'anno', () => {
  const kwh = consumoMedioClasse(datiSpezia.forme, '1,5-3', asse());
  assert.ok(kwh > 1400 && kwh < 1560, String(kwh));
});

const comunitaTipo = (u = {}) => ingressiEntrare({ area: spezia.area, parametri: {}, comunita: {},
  utente: { ruolo: 'consumatore', tipo: 'famiglia', classe: '1,5-3', consumo: null, archetipo: 'com_orario_apertura', kwp: 4.5, esistente: false, abitudini: 0, ...u } }, costanti);

test('taratura della comunità tipo sulla Spezia: contemporaneità fra 30% e 90%', () => {
  const r = calcola(comunitaTipo(), datiSpezia);
  assert.ok(r.comunita.contemporaneita >= 0.3 && r.comunita.contemporaneita <= 0.9, String(r.comunita.contemporaneita));
});

test('interpolazione entro lo 0,5% all\'anno 10, comunità tipo e impianto grande', () => {
  const deg = 0.005;
  for (const ing of [comunitaTipo({ ruolo: 'prosumer' }), comunitaTipo({ ruolo: 'produttore', kwp: 200 })]) {
    const prep = prepara(ing, datiSpezia);
    const [a1, a10, a20] = [1, (1 - deg) ** 9, (1 - deg) ** 19].map((d) => anno(prep, d));
    for (const g of prep.gruppi) {
      const tot = (x) => { const f = flussi(x.ec.membri[g.id]); return f.impiantoDaSolo + f.cerAggiunge; };
      const interp = tot(a1) + (tot(a20) - tot(a1)) * peso(10, deg, prep.anni);
      assert.ok(Math.abs(interp - tot(a10)) <= 0.005 * Math.abs(tot(a10)) + 0.01, `${g.id}: ${interp} contro ${tot(a10)}`);
    }
  }
});

test('prestazioni: un calcolo della comunità tipo sotto i 50 ms', () => {
  calcola(comunitaTipo({ ruolo: 'prosumer' }), datiSpezia);
  const t0 = performance.now();
  for (let i = 0; i < 10; i++) calcola(comunitaTipo({ ruolo: 'prosumer', abitudini: i / 50 }), datiSpezia);
  const ms = (performance.now() - t0) / 10;
  assert.ok(ms < 50, `${ms.toFixed(1)} ms`);
});
