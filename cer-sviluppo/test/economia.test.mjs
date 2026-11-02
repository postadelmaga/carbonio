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
  const impianti = [{ id: 'k', kwp: 10, titolare: 'a', esistente: false, perOgniMembro: false }];
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
