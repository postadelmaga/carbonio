import test from 'node:test';
import assert from 'node:assert/strict';
import { energia } from '../../cer/simulatore/js/energia.js';

const serie = (...v) => Float64Array.from(v);
const quasi = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ''} ${a} ≠ ${b}`);

test('prosumer: autoconsumo, immessa, prelievo e condivisa ora per ora', () => {
  const en = energia(
    [{ id: 'p', numero: 1, consumo: serie(1, 1, 3, 0) }, { id: 'c', numero: 1, consumo: serie(0, 2, 2, 2) }],
    [{ id: 'k', titolare: 'p', sulPod: true, perOgniMembro: false, produzione: serie(0, 4, 2, 5) }],
  );
  assert.deepEqual([...en.S], [0, 2, 0, 2]);
  assert.equal(en.impianti[0].autoconsumo, 3);
  assert.equal(en.impianti[0].immessa, 8);
  assert.equal(en.gruppi[0].prelievo, 2);
  assert.equal(en.gruppi[0].condivisa, 0);
  assert.equal(en.gruppi[1].condivisa, 4);
});

test('bilanci in ogni ora', () => {
  const gruppi = [
    { id: 'f', numero: 3, consumo: serie(0.5, 1, 2, 0.2, 0.8) },
    { id: 'a', numero: 1, consumo: serie(0, 3, 4, 1, 0) },
  ];
  const impianti = [
    { id: 'tetti', titolare: 'f', sulPod: true, perOgniMembro: true, produzione: serie(0, 1.5, 3, 0.1, 0) },
    { id: 'campo', titolare: 'cer', sulPod: false, perOgniMembro: false, produzione: serie(0, 4, 6, 2, 0) },
  ];
  const en = energia(gruppi, impianti);
  for (let h = 0; h < 5; h++) {
    assert.ok(en.S[h] <= Math.min(en.E[h], en.P[h]) + 1e-12);
    quasi(en.impianti[0].serieCondivisa[h] + en.impianti[1].serieCondivisa[h], en.S[h], `ora ${h}`);
  }
  quasi(en.gruppi.reduce((s, g) => s + g.condivisa * g.numero, 0), en.totali.condivisa, 'quote dei gruppi');
  quasi(en.impianti[0].autoconsumo + en.impianti[0].immessa, en.impianti[0].produzione, 'impianto');
  quasi(en.gruppi[0].autoconsumo + en.gruppi[0].prelievo, en.gruppi[0].consumo, 'gruppo');
  quasi(en.impianti[0].autoconsumo, en.gruppi[0].autoconsumo * 3, 'autoconsumo dei tetti');
});

test('anzianità: il primo impianto prende la condivisa per primo', () => {
  const g = [{ id: 'c', numero: 1, consumo: serie(3, 3, 3, 3) }];
  const k = (id) => ({ id, titolare: 'cer', sulPod: false, perOgniMembro: false, produzione: serie(2, 2, 2, 2) });
  const en = energia(g, [k('vecchio'), k('nuovo')]);
  assert.equal(en.impianti[0].condivisa, 8);
  assert.equal(en.impianti[1].condivisa, 4);
  assert.equal(en.gruppi[0].condivisaDa.vecchio, 8);
});

test('un gruppo di n membri vale n soci uguali', () => {
  const c = serie(1, 2, 0.5, 3), pr = serie(0, 3, 4, 1);
  const altro = { id: 'x', numero: 1, consumo: serie(2, 2, 2, 2) };
  const a = energia([{ id: 'f', numero: 3, consumo: c }, altro], [{ id: 'k', titolare: 'f', sulPod: true, perOgniMembro: true, produzione: pr }]);
  const b = energia([...[1, 2, 3].map((i) => ({ id: `f${i}`, numero: 1, consumo: c })), altro],
    [1, 2, 3].map((i) => ({ id: `k${i}`, titolare: `f${i}`, sulPod: true, perOgniMembro: false, produzione: pr })));
  quasi(a.totali.condivisa, b.totali.condivisa);
  quasi(a.totali.immessa, b.totali.immessa);
  quasi(a.gruppi[0].condivisa, b.gruppi[0].condivisa);
  quasi(a.gruppi[1].condivisa, b.gruppi[3].condivisa);
});
