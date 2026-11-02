import test from 'node:test';
import assert from 'node:assert/strict';
import { asseOre, TIPI } from '../../cer/simulatore/js/calendario.js';
import { somma, formaDomestica, formaAttivita, scala, sposta, produzione, inizioGiorni, consumoMedioClasse } from '../../cer/simulatore/js/profili.js';

const asse = asseOre();
// valore = 100·(tipo+1) + mese + ora/100: ogni cella dice da dove viene
const formeFinte = () => ({
  classi: {
    '1,5-3': Object.fromEntries(TIPI.map((t, k) => [t, Array.from({ length: 12 }, (_, m) =>
      Array.from({ length: 24 }, (_, o) => 100 * (k + 1) + (m + 1) + o / 100))])),
  },
});
const sole = () => Int32Array.from({ length: asse.n }, (_, i) => (asse.ora[i] >= 8 && asse.ora[i] <= 17 ? 500 : 0));

test('forma domestica: mese, tipo di giorno e ora giusti', () => {
  const f = formaDomestica(formeFinte(), '1,5-3', asse);
  const i = 4355; // sabato 1° luglio, ore 12
  assert.equal(f[i], 100 * 2 + 7 + 12 / 100);
  assert.throws(() => formaDomestica(formeFinte(), 'oltre_6', asse), /classe/);
  assert.equal(consumoMedioClasse(formeFinte(), '1,5-3', asse), somma(f));
});

test('forma delle attività: il Lunedì dell\'Angelo è festivo, la stagionalità moltiplica', () => {
  const arch = { forme: { feriale: Array(24).fill(1), sabato: Array(24).fill(2), festivo: Array(24).fill(3) }, stagionalita: Array.from({ length: 12 }, (_, m) => m + 1) };
  const f = formaAttivita(arch, asse);
  assert.equal(f[asse.giorno.indexOf(99)], 3 * 4);  // 10 aprile, festivo, aprile
  assert.equal(f[asse.giorno.indexOf(100)], 1 * 4); // 11 aprile, feriale
});

test('scala porta la somma al consumo annuo', () => {
  const s = scala(formaDomestica(formeFinte(), '1,5-3', asse), 2700);
  assert.ok(Math.abs(somma(s) - 2700) < 1e-6);
  assert.equal(somma(scala(new Float64Array(10), 100)), 0);
});

test('spostamento: energia del giorno invariata, mai negativa, nulla a quota 0', () => {
  const c = scala(formaDomestica(formeFinte(), '1,5-3', asse), 2700);
  const pv = sole();
  assert.deepEqual(sposta(c, pv, asse, 0), Float64Array.from(c));
  const inizi = inizioGiorni(asse);
  assert.equal(inizi.length, 366);
  for (const q of [0.1, 0.2, 0.3]) {
    const s = sposta(c, pv, asse, q);
    for (let d = 0; d + 1 < inizi.length; d++) {
      let a = 0, b = 0;
      for (let h = inizi[d]; h < inizi[d + 1]; h++) { a += c[h]; b += s[h]; }
      assert.ok(Math.abs(a - b) < 1e-9, `quota ${q}, giorno ${d}`);
    }
    assert.ok(s.every((x) => x >= 0));
    assert.ok(s[4355] > c[4355], 'nelle ore di sole il consumo cresce');
    assert.ok(s[4355 + 10] < c[4355 + 10], 'alle 22 cala');
  }
});

test('produzione da kWp e fattore di degrado', () => {
  const pv = Int32Array.from({ length: asse.n }, (_, i) => (asse.ora[i] === 12 ? 800 : 0));
  const p = produzione(pv, 4.5);
  assert.ok(Math.abs(somma(p) - 365 * 0.8 * 4.5) < 1e-6);
  assert.ok(Math.abs(somma(produzione(pv, 4.5, 0.5)) - somma(p) / 2) < 1e-6);
});
