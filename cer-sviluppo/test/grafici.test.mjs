import test from 'node:test';
import assert from 'node:assert/strict';
import { tetto, percorso, MESI, SERIE, larghezzaDisegno, mesiEtichettati, figureMassime, disposizioneScena } from '../../cer/simulatore/js/grafici.js';

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

test('la larghezza del disegno è quella misurata, 640 se manca (Node, elemento nascosto)', () => {
  assert.equal(larghezzaDisegno(279.4), 279);
  assert.equal(larghezzaDisegno(1098), 1098);
  for (const nulla of [0, -3, NaN, undefined, null]) assert.equal(larghezzaDisegno(nulla), 640);
});

test('sotto i 480 px un\'etichetta ogni due mesi, le barre restano dodici', () => {
  assert.deepEqual(mesiEtichettati(360), [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(mesiEtichettati(479), [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(mesiEtichettati(480), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(mesiEtichettati(640).length, 12);
  assert.equal(mesiEtichettati(1098).length, 12);
  assert.deepEqual(mesiEtichettati(360).map((i) => MESI[i].slice(0, 3)), ['gen', 'mar', 'mag', 'lug', 'set', 'nov']);
});

test('sotto i 480 px al più 10 figure per gruppo, altrimenti 30', () => {
  assert.equal(figureMassime(275), 10);
  assert.equal(figureMassime(479), 10);
  assert.equal(figureMassime(480), 30);
  assert.equal(figureMassime(640), 30);
});

// Larghezza di un testo di prova: sette pixel per carattere, come stima prudente di 12 px Archivo.
const sette = (t) => t.length * 7;
const comunitaTipo = [
  { n: 1, etichetta: 'tu' }, { n: 30, etichetta: '30 famiglie' }, { n: 2, etichetta: '2 attività' },
  { n: 1, etichetta: '1 ente' }, { fisso: 34, etichetta: '40,0 kWp' },
];

test('la scena a 275 px: al più 10 figure per gruppo, il resto in «+N», nessun gruppo oltre il bordo', () => {
  const { posti, righe } = disposizioneScena(comunitaTipo, 275, sette);
  assert.deepEqual(posti.map((p) => p.disegnate), [1, 10, 2, 1, 0]);
  assert.deepEqual(posti.map((p) => p.resto), [0, 20, 0, 0, 0]);
  assert.ok(righe >= 2, 'a 275 px la comunità tipo non sta in una riga');
  for (const p of posti) assert.ok(p.x >= 0 && p.x + p.larghezza <= 275, `gruppo oltre il bordo: x ${p.x}, larghezza ${p.larghezza}`);
});

test('la scena a 640 px: fino a 30 figure e una riga sola', () => {
  const { posti, righe } = disposizioneScena(comunitaTipo, 640, sette);
  assert.deepEqual(posti.map((p) => p.disegnate), [1, 30, 2, 1, 0]);
  assert.equal(righe, 1);
});

test('i gruppi della scena non si sovrappongono, a qualunque larghezza e con qualunque etichetta', () => {
  const grandi = [{ n: 500, etichetta: '500 famiglie' }, { n: 40, etichetta: '40 attività' }, { n: 12, etichetta: '12 enti' }, { fisso: 34, etichetta: '1.000,0 kWp' }];
  for (const W of [240, 275, 360, 479, 480, 640, 1098]) {
    for (const gruppi of [comunitaTipo, grandi]) {
      const { posti, righe } = disposizioneScena(gruppi, W, sette);
      posti.forEach((p, k) => {
        assert.ok(p.riga >= 0 && p.riga < righe);
        assert.ok(p.x >= 0 && p.x + p.larghezza <= W, `W ${W}, gruppo ${k}: oltre il bordo`);
        const prima = posti[k - 1];
        if (prima && prima.riga === p.riga) assert.ok(p.x >= prima.x + prima.larghezza + 8, `W ${W}, gruppi ${k - 1} e ${k} si toccano`);
      });
    }
  }
});

test('la larghezza di un gruppo copre le figure, il «+N» e l\'etichetta: vince la più larga', () => {
  const { posti } = disposizioneScena([{ n: 30, etichetta: '30 famiglie' }, { n: 1, etichetta: 'un\'etichetta molto lunga' }], 275, sette);
  assert.ok(posti[0].larghezza >= 5 * 14 - 2 + 4 + sette('+20'));
  assert.ok(posti[0].larghezza >= sette('30 famiglie'));
  assert.ok(posti[1].larghezza >= sette('un\'etichetta molto lunga'));
});
