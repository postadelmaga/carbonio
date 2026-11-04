import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leggi = (p) => JSON.parse(readFileSync(new URL(`../../cer/simulatore/dati/${p}`, import.meta.url), 'utf8'));

test('ogni costante ha descrizione, unità, fonte e data', () => {
  const { voci } = leggi('costanti.json');
  for (const [id, v] of Object.entries(voci)) {
    for (const campo of ['descrizione', 'unita', 'fonte', 'consultato']) assert.ok(v[campo], `${id}: manca ${campo}`);
    assert.ok('valore' in v, `${id}: manca valore`);
    assert.match(v.consultato, /^\d{4}-\d{2}-\d{2}$/, `${id}: data`);
    if (v.valore === null) assert.match(v.note, /da verificare/i, `${id}: un valore nullo va dichiarato`);
  }
});

test('valori controllati sulla spec', () => {
  const { voci } = leggi('costanti.json');
  assert.equal(voci.prezzo_zonale.valore, 115.94);
  assert.equal(voci.contributo_arera.valore, 11.9);
  assert.equal(voci.fattore_co2.valore, 199.6);
  assert.equal(voci.fattore_co2_fossili.valore, 413.3);
  assert.ok(!('fattore_co2_alto' in voci), 'il termoelettrico con bioenergie non si usa più');
  assert.equal(voci.soglia_eccedentaria.valore, 0.55);
  assert.deepEqual(voci.quote_riparto.valore, { produttore: 0.4, consumatori: 0.4 });
  assert.equal(voci.comunita_tipo.valore.classe, '1,5-3');
});

test('il limite del 30% sugli impianti esistenti cita la norma che lo pone, il D.Lgs. 199/2021, art. 31 (esclude il rimando al DM 414, art. 3, che quel limite non lo contiene)', () => {
  const v = leggi('costanti.json').voci.limite_potenza_esistenti;
  assert.match(v.fonte, /^D\.Lgs\. 199\/2021, art\. 31 c\. 2 lett\. d\)/);
  assert.doesNotMatch(v.fonte, /^DM MASE 414\/2023, art\. 3;/);
  assert.match(v.fonte, /TIAD, art\. 3\.4 lett\. f/);
  assert.match(v.url, /normattiva\.it.*decreto\.legislativo:2021-11-08;199~art31/);
});

test('il corrispettivo del GSE si dichiara IVA esclusa, come lo conta il simulatore (esclude una nota che tace l\'IVA che il DM 106/2024 aggiunge in fattura)', () => {
  const v = leggi('costanti.json').voci.corrispettivo_gse;
  assert.match(v.fonte, /Allegato 2 lett\. a\)/);
  assert.match(v.note, /IVA esclusa/);
  assert.match(v.note, /«maggiorati dell'aliquota IVA»/);
  assert.match(v.note, /il simulatore non la aggiunge/);
});

test('l\'IVA al 10% sull\'impianto di una famiglia cita il DPR 633/1972, come quella dell\'ente (esclude un\'aliquota sostenuta solo da un\'indagine sui prezzi)', () => {
  const { voci } = leggi('costanti.json');
  const norma = 'DPR 633/1972, Tabella A, parte III, nn. 127-quinquies, 127-sexies e 127-septies';
  assert.ok(voci.iva_impianto.fonte.startsWith(norma), voci.iva_impianto.fonte);
  assert.ok(voci.iva_impianto_ente.fonte.startsWith(norma), voci.iva_impianto_ente.fonte);
  assert.match(voci.iva_impianto.url, /agenziaentrate\.gov\.it/);
});

test('la soglia dell\'eccedentaria dice che oltre il 55% è vincolata una parte della tariffa, non tutta (esclude la descrizione per cui oltre la soglia l\'intera tariffa va ai non imprese)', () => {
  const v = leggi('costanti.json').voci.soglia_eccedentaria;
  assert.match(v.descrizione, /^Soglia oltre la quale una parte della tariffa, la quota eccedentaria, va solo ai consumatori non imprese o a fini sociali/);
  assert.doesNotMatch(v.descrizione, /oltre la quale la tariffa va/);
});

test('archetipi: 24 ore per tipo di giorno e 12 mesi', () => {
  const { archetipi } = leggi('consumi/attivita.json');
  for (const [id, a] of Object.entries(archetipi)) {
    for (const t of ['feriale', 'sabato', 'festivo']) assert.equal(a.forme[t].length, 24, `${id} ${t}`);
    assert.equal(a.stagionalita.length, 12, id);
  }
});
