import test from 'node:test';
import assert from 'node:assert/strict';
import { tetto, percorso, MESI, SERIE } from '../../cer/simulatore/js/grafici.js';

test('massimo tondo dell\'asse', () => {
  assert.equal(tetto(0), 1);
  assert.equal(tetto(0.7), 1);
  assert.equal(tetto(1.3), 2);
  assert.equal(tetto(37), 50);
  assert.equal(tetto(80), 100);
  assert.equal(tetto(12000), 20000);
});

test('percorsi di linea e di area', () => {
  const x = (i) => i * 10, y = (v) => 100 - v;
  assert.equal(percorso([0, 5, 10], x, y), 'M0.0,100.0L10.0,95.0L20.0,90.0');
  assert.equal(percorso([0, 5], x, y, true), 'M0.0,100.0L10.0,95.0L10.0,100.0L0.0,100.0Z');
  assert.equal(MESI.length, 12);
  assert.deepEqual(SERIE.map((s) => s.chiave), ['produzione', 'consumo', 'condivisa']);
});
