import test from 'node:test';
import assert from 'node:assert/strict';
import { asseOre, pasqua, festivi, TIPI } from '../../cer/simulatore/js/calendario.js';

const asse = asseOre();
const oreDelGiorno = () => { const o = new Array(365).fill(0); for (let i = 0; i < asse.n; i++) o[asse.giorno[i]]++; return o; };

test('8.760 ore dal primo gennaio alle 23 del 31 dicembre', () => {
  assert.equal(asse.n, 8760);
  assert.deepEqual([asse.mese[0], asse.ora[0], asse.giorno[0]], [1, 0, 0]);
  assert.deepEqual([asse.mese[8759], asse.ora[8759], asse.giorno[8759]], [12, 23, 364]);
});

test('cambi d\'ora: 26/03 di 23 ore e 29/10 di 25', () => {
  const o = oreDelGiorno();
  assert.equal(o[84], 23);   // 26 marzo
  assert.equal(o[301], 25);  // 29 ottobre
  assert.equal(o.filter((x) => x === 24).length, 363);
});

test('ora legale: le 12 del 1° luglio sono le 10 UTC', () => {
  const i = (Date.UTC(2023, 6, 1, 10) - (Date.UTC(2023, 0, 1) - 3600e3)) / 3600e3;
  assert.equal(i, 4355);
  assert.deepEqual([asse.mese[i], asse.ora[i], TIPI[asse.tipo[i]]], [7, 12, 'sabato']);
});

test('Pasqua e festivi', () => {
  assert.deepEqual(pasqua(2023), { mese: 4, giorno: 9 });
  assert.deepEqual(pasqua(2024), { mese: 3, giorno: 31 });
  assert.deepEqual(pasqua(2025), { mese: 4, giorno: 20 });
  assert.ok(festivi(2023).has('04-10'));
  const tipoDelGiorno = (g) => TIPI[asse.tipo[asse.giorno.indexOf(g)]];
  assert.equal(tipoDelGiorno(99), 'festivo');   // lunedì 10 aprile
  assert.equal(tipoDelGiorno(97), 'sabato');    // 8 aprile
  assert.equal(tipoDelGiorno(100), 'feriale');  // martedì 11 aprile
  assert.equal(tipoDelGiorno(0), 'festivo');    // 1° gennaio, domenica
});
