import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { energia } from '../../cer/simulatore/js/energia.js';
import { emissioni, fattoreVentiAnni, tonnellateCo2 } from '../../cer/simulatore/js/emissioni.js';

const c = JSON.parse(readFileSync(new URL('../../cer/simulatore/dati/costanti.json', import.meta.url), 'utf8'));
const serie = (...v) => Float64Array.from(v);

test('fattori', () => {
  assert.ok(Math.abs(tonnellateCo2(1000, 199.6) - 0.1996) < 1e-12);
  assert.ok(Math.abs(fattoreVentiAnni(0.029, 0.005) - 14.705) < 0.01);
  assert.equal(fattoreVentiAnni(0, 0), 20);
});

function caso() {
  const gruppi = [{ id: 'f', tipo: 'famiglia', numero: 2 }, { id: 'a', tipo: 'attivita', numero: 1 }];
  const impianti = [
    { id: 'vecchio', kwp: 3, titolare: 'a', esistente: true, perOgniMembro: false, sulPod: true, produzione: serie(1, 1, 1, 1) },
    { id: 'tetti', kwp: 3, titolare: 'f', esistente: false, perOgniMembro: true, sulPod: true, produzione: serie(0, 2, 2, 0) },
    { id: 'campo', kwp: 20, titolare: 'cer', esistente: false, perOgniMembro: false, sulPod: false, produzione: serie(0, 5, 5, 0) },
  ];
  const en = energia([{ ...gruppi[0], consumo: serie(1, 1, 1, 1) }, { ...gruppi[1], consumo: serie(3, 3, 3, 3) }], impianti);
  return { en, gruppi, impianti };
}

test('niente doppi conti: la CO₂ personale non supera il totale, gli esistenti a parte', () => {
  const { en, gruppi, impianti } = caso();
  const r = emissioni(en, gruppi, impianti, c);
  const personale = gruppi.reduce((s, g) => s + g.numero * r.membri[g.id].evitata, 0);
  assert.ok(Math.abs(r.comunita.evitata - tonnellateCo2(4 * 2 + 10, 199.6)) < 1e-12, 'solo tetti e campo');
  assert.ok(Math.abs(personale - tonnellateCo2(8, 199.6)) < 1e-12, 'il campo della CER non è di nessun socio');
  assert.ok(personale <= r.comunita.evitata);
  assert.ok(Math.abs(r.comunita.esistenti - tonnellateCo2(4, 199.6)) < 1e-12);
  assert.equal(r.membri.a.evitata, 0);
  for (const g of gruppi) assert.ok(r.membri[g.id].copertura >= 0 && r.membri[g.id].copertura <= 1);
  assert.ok(Math.abs(r.comunita.italiani - r.comunita.evitata / 5.1) < 1e-12);
});

test('il fattore principale si può cambiare', () => {
  const { en, gruppi, impianti } = caso();
  const r = emissioni(en, gruppi, impianti, c, 'termoelettrico');
  assert.equal(r.fattore, 366.5);
  assert.ok(Math.abs(r.comunita.evitata - tonnellateCo2(18, 366.5)) < 1e-12);
});
