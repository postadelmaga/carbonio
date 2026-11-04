import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { energia } from '../../cer/simulatore/js/energia.js';
import { tip, quotaEccedentaria, corrispettivoGse, kappa, costoEvitato, investimento, economiaAnno } from '../../cer/simulatore/js/economia.js';

const c = JSON.parse(readFileSync(new URL('../../cer/simulatore/dati/costanti.json', import.meta.url), 'utf8'));
const quasi = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} ≠ ${b}`);
const serie = (...v) => Float64Array.from(v);

test('tariffa premio per fascia, prezzo e area', () => {
  assert.equal(tip(20, 115.94, 'nord', c), 130);
  assert.equal(tip(20, 160, 'nord', c), 110);
  assert.equal(tip(20, 180, 'nord', c), 90);
  assert.equal(tip(20, 200, 'nord', c), 90);
  assert.equal(tip(300, 115.94, 'nord', c), 120);
  assert.equal(tip(20, 115.94, 'sud', c), 120);
  assert.equal(tip(20, 115.94, 'centro', c), 124);
  assert.equal(tip(1200, 115.94, 'nord', c), 0);
});

test('eccedentaria alla lettera: l\'esempio della wiki', () => {
  quasi(quotaEccedentaria(16800, 24000, 0.55) * 2000, 300, 1e-9);
  assert.equal(quotaEccedentaria(13200, 24000, 0.55), 0);
  assert.equal(quotaEccedentaria(5, 0, 0.55), 0);
});

test('corrispettivo GSE, κ, costo evitato, investimento', () => {
  assert.equal(corrispettivoGse(3, c), 0);
  assert.equal(corrispettivoGse(4.5, c), 15);
  assert.equal(corrispettivoGse(40, c), 35);
  assert.equal(kappa(100, 400), 0.25);
  assert.equal(kappa(500, 400), 1);
  assert.equal(kappa(0, 0), 0);
  assert.equal(kappa(10, 0), 1);
  quasi(costoEvitato('famiglia', 115.94, c), 0.2179287, 1e-6);
  quasi(costoEvitato('attivita', 115.94, c), 0.188941, 1e-6);
  quasi(costoEvitato('ente', 115.94, c), 0.23050802, 1e-6);
  assert.equal(costoEvitato('famiglia', 115.94, c, { famiglia: 0.3 }), 0.3);
  quasi(investimento(4.5, 'famiglia', c), 6880.5, 1e-6);
  quasi(investimento(40, 'attivita', c), 51200, 1e-6);
  quasi(investimento(300, 'cer', c), 255000, 1e-6);
  quasi(investimento(4.5, 'attivita', c, 1.0), 4500, 1e-9);
});

function caso(gestione) {
  const gruppi = [{ id: 'f', tipo: 'famiglia', numero: 2 }, { id: 'a', tipo: 'attivita', numero: 1 }];
  const impianti = [{ id: 'k', kwp: 10, titolare: 'a', perOgniMembro: false }];
  const en = energia(
    [{ ...gruppi[0], consumo: serie(200, 200, 200, 200) }, { ...gruppi[1], consumo: serie(200, 200, 200, 200) }],
    [{ ...impianti[0], sulPod: false, produzione: serie(100, 100, 100, 100) }],
  );
  const par = { prezzo_zonale: 115.94, area: 'nord', gestione_eur_anno: gestione, quota_produttore: 0.4, quota_consumatori: 0.4, quota_associativa: 0, manutenzione: 20, costo_evitato: {} };
  return { en, gruppi, ec: economiaAnno(en, gruppi, impianti, par, c) };
}
const distribuito = ({ ec, gruppi }) => gruppi.reduce((s, g) => {
  const m = ec.membri[g.id];
  return s + g.numero * (m.quotaProduttore + m.quotaTariffa + m.quotaContributo + m.quotaEccedentaria);
}, 0) + ec.cer.fondo + ec.costiTolti;

test('riparto: tutto torna, l\'eccedentaria solo ai non imprese', () => {
  const x = caso(0);
  quasi(x.ec.e, 0.45, 1e-12, 'rapporto 1, soglia 0,55');
  quasi(x.ec.tariffa, 52, 1e-9);
  quasi(distribuito(x), x.ec.tariffa + x.ec.contributo, 0.005, 'somma');
  assert.equal(x.ec.membri.a.quotaEccedentaria, 0);
  assert.ok(x.ec.membri.f.quotaEccedentaria > 0);
  assert.ok(x.ec.kappa > 0 && x.ec.kappa < 1);
  quasi(x.ec.membri.a.vendita, (400 * 115.94) / 1000, 1e-9, 'vendita al titolare');
  quasi(x.ec.membri.a.manutenzione, 200, 1e-9);
});

test('κ non tocca l\'eccedentaria e i costi non coperti si vedono', () => {
  const x = caso(0), y = caso(1000);
  assert.equal(y.ec.kappa, 1);
  quasi(y.ec.membri.f.quotaEccedentaria, x.ec.membri.f.quotaEccedentaria, 1e-12);
  quasi(distribuito(y), y.ec.tariffa + y.ec.contributo, 0.005, 'somma con κ = 1');
  assert.ok(y.ec.nonCoperti > 900);
  assert.equal(y.ec.membri.f.quotaTariffa, 0);
});

test('il limite di 1 MW della tariffa viene da costanti.json', () => {
  const impianto = (kwp) => [{ id: 'k', kwp, titolare: 'f', perOgniMembro: false }];
  // 700 kW: nelle costanti vere ricade nell'ultima fascia (1000); con l'ultima a 500 kW non ne ha nessuna
  const gruppi = [{ id: 'f', tipo: 'famiglia', numero: 1 }];
  const par = { prezzo_zonale: 115.94, area: 'nord', gestione_eur_anno: 0, quota_produttore: 0.4, quota_consumatori: 0.4, quota_associativa: 0, manutenzione: 20, costo_evitato: {} };
  const esito = (cost) => {
    const en = energia(
      [{ ...gruppi[0], consumo: serie(200, 200, 200, 200) }],
      [{ ...impianto(700)[0], sulPod: false, produzione: serie(100, 100, 100, 100) }],
    );
    return economiaAnno(en, gruppi, impianto(700), par, cost).voci[0];
  };
  const fasceCorte = structuredClone(c);
  fasceCorte.voci.tariffa_fasce.valore.at(-1).fino_kw = 500;
  const senzaTariffa = esito(fasceCorte);
  assert.equal(senzaTariffa.incentivato, false);
  assert.equal(senzaTariffa.tariffa, 0);
  assert.equal(esito(c).incentivato, true);
});

// Impianto della CER (spec §6.7): le tre voci che finivano in un solo «fondo» restano separate.
function casoCer(gruppi, par = {}) {
  const impianti = [{ id: 'k', kwp: 10, titolare: 'cer', perOgniMembro: false }];
  const en = energia(
    gruppi.map((g) => ({ ...g, consumo: serie(200, 200, 200, 200) })),
    [{ ...impianti[0], sulPod: false, produzione: serie(100, 100, 100, 100) }],
  );
  const p = { prezzo_zonale: 115.94, area: 'nord', gestione_eur_anno: 0, quota_produttore: 0.4, quota_consumatori: 0.4, quota_associativa: 0, manutenzione: 20, costo_evitato: {}, ...par };
  return { en, gruppi, ec: economiaAnno(en, gruppi, impianti, p, c) };
}

test('impianto della CER: la parte della CER nel riparto, la quota di titolare e l\'eccedentaria restano separate, e il fondo è la loro somma', () => {
  const x = casoCer([{ id: 'f', tipo: 'famiglia', numero: 2 }, { id: 'a', tipo: 'attivita', numero: 1 }]);
  const netta = x.ec.tariffa * (1 - x.ec.e) * (1 - x.ec.kappa);
  assert.ok(netta > 0);
  quasi(x.ec.cer.quotaCer, 0.2 * netta, 1e-9, 'il 20% resta alla CER');
  quasi(x.ec.cer.titolare, 0.4 * netta, 1e-9, 'il 40% è del titolare, che qui è la CER');
  assert.equal(x.ec.cer.fondoSociale, 0, 'ci sono consumatori che non sono imprese: l\'eccedentaria va a loro');
  quasi(x.ec.cer.fondo, x.ec.cer.quotaCer + x.ec.cer.titolare + x.ec.cer.fondoSociale, 1e-9, 'fondo = somma delle tre voci');
  quasi(distribuito(x), x.ec.tariffa + x.ec.contributo, 0.005, 'i conti si chiudono');
});

test('impianto della CER, soci tutti imprese: l\'eccedentaria va a finalità sociali e non ai soci', () => {
  const x = casoCer([{ id: 'a', tipo: 'attivita', numero: 2 }]);
  assert.ok(x.ec.eccedentaria > 0);
  quasi(x.ec.cer.fondoSociale, x.ec.eccedentaria, 1e-9);
  assert.equal(x.ec.membri.a.quotaEccedentaria, 0);
  quasi(x.ec.cer.fondo, x.ec.cer.quotaCer + x.ec.cer.titolare + x.ec.cer.fondoSociale, 1e-9);
  quasi(distribuito(x), x.ec.tariffa + x.ec.contributo, 0.005, 'i conti si chiudono');
});

test('impianto di un socio: la CER ha solo la sua parte del riparto, e la quota di titolare va al socio', () => {
  const x = caso(0);
  const netta = x.ec.tariffa * (1 - x.ec.e) * (1 - x.ec.kappa);
  quasi(x.ec.cer.quotaCer, 0.2 * netta, 1e-9);
  assert.equal(x.ec.cer.titolare, 0);
  assert.equal(x.ec.cer.fondoSociale, 0);
  quasi(x.ec.cer.fondo, x.ec.cer.quotaCer, 1e-9);
  quasi(x.ec.membri.a.quotaProduttore, 0.4 * netta, 1e-9);
});
