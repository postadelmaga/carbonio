import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { energia } from '../../cer/simulatore/js/energia.js';
import { emissioni, fattoreVentiAnni, tonnellateCo2 } from '../../cer/simulatore/js/emissioni.js';

const c = JSON.parse(readFileSync(new URL('../../cer/simulatore/dati/costanti.json', import.meta.url), 'utf8'));
const serie = (...v) => Float64Array.from(v);

test('fattori', () => {
  assert.ok(Math.abs(tonnellateCo2(1000, 199.6) - 0.1996) < 1e-12);
  assert.ok(Math.abs(fattoreVentiAnni(0.029, 0.005, 20) - 14.705) < 0.01);
  assert.ok(Math.abs(fattoreVentiAnni(0, 0.005, 20) - 19.078) < 0.001);
});

function caso() {
  const gruppi = [{ id: 'f', tipo: 'famiglia', numero: 2 }, { id: 'a', tipo: 'attivita', numero: 1 }];
  const impianti = [
    { id: 'vecchio', kwp: 3, titolare: 'a', stato: 'precedente', perOgniMembro: false, sulPod: true, produzione: serie(1, 1, 1, 1) },
    { id: 'tetti', kwp: 3, titolare: 'f', perOgniMembro: true, sulPod: true, produzione: serie(0, 2, 2, 0) },
    { id: 'campo', kwp: 20, titolare: 'cer', perOgniMembro: false, sulPod: false, produzione: serie(0, 5, 5, 0) },
  ];
  const en = energia([{ ...gruppi[0], consumo: serie(1, 1, 1, 1) }, { ...gruppi[1], consumo: serie(3, 3, 3, 3) }], impianti);
  return { en, gruppi, impianti };
}

test('niente doppi conti: la CO₂ personale non supera il totale, gli impianti già in esercizio a parte, metodo ISPRA come predefinito', () => {
  const { en, gruppi, impianti } = caso();
  const r = emissioni(en, gruppi, impianti, c);
  assert.equal(r.principale, 'fossili');
  assert.equal(r.fattore, 413.3);
  assert.equal(r.fattoreAltro, 199.6);
  const personale = gruppi.reduce((s, g) => s + g.numero * r.membri[g.id].evitata, 0);
  assert.ok(Math.abs(r.comunita.evitata - tonnellateCo2(18, 413.3)) < 1e-12, 'solo tetti e campo');
  assert.ok(Math.abs(r.comunita.evitataAltra - tonnellateCo2(18, 199.6)) < 1e-12);
  assert.ok(Math.abs(personale - tonnellateCo2(8, 413.3)) < 1e-12, 'il campo della CER non è di nessun socio');
  assert.ok(personale <= r.comunita.evitata);
  assert.ok(Math.abs(r.comunita.giaInEsercizio - tonnellateCo2(4, 413.3)) < 1e-12);
  assert.equal(r.membri.a.evitata, 0);
  for (const g of gruppi) assert.ok(r.membri[g.id].copertura >= 0 && r.membri[g.id].copertura <= 1);
  assert.ok(Math.abs(r.comunita.italiani - r.comunita.evitata / 5.1) < 1e-12);
});

test('l\'impronta dei prelievi usa sempre la media dei consumi, con tutti e due i fattori (esclude l\'impronta calcolata con il fattore delle evitate)', () => {
  const { en, gruppi, impianti } = caso();
  for (const p of ['fossili', 'media']) {
    const r = emissioni(en, gruppi, impianti, c, p);
    for (const g of en.gruppi) assert.ok(Math.abs(r.membri[g.id].impronta - tonnellateCo2(g.prelievo, 199.6)) < 1e-12, `${p}, ${g.id}`);
  }
});

test('i 20 anni: con il metodo ISPRA il fattore resta quello di oggi, con la media scende del 2,9% l\'anno (esclude il calo dei consumi applicato alle centrali fossili)', () => {
  const { en, gruppi, impianti } = caso();
  const durata = c.voci.durata_tariffa_anni.valore, degrado = c.voci.degrado.valore;
  const f = emissioni(en, gruppi, impianti, c, 'fossili'), m = emissioni(en, gruppi, impianti, c, 'media');
  assert.ok(Math.abs(f.comunita.ventiAnni - f.comunita.evitata * fattoreVentiAnni(0, degrado, durata)) < 1e-12);
  assert.ok(Math.abs(m.comunita.ventiAnni - m.comunita.evitata * fattoreVentiAnni(c.voci.calo_fattore_co2.valore, degrado, durata)) < 1e-12);
  assert.ok(Math.abs(f.membri.f.ventiAnni - f.membri.f.evitata * fattoreVentiAnni(0, degrado, durata)) < 1e-12);
  assert.equal(m.fattore, 199.6);
  assert.equal(m.fattoreAltro, 413.3);
});
