import test from 'node:test';
import assert from 'node:assert/strict';
import { numero, euro, kwh, perc, tonnellate, circa, anni, slug } from '../../cer/simulatore/js/formato.js';

test('numeri in italiano', () => {
  assert.equal(numero(12345678), '12.345.678');
  assert.equal(numero(1234.5, 1), '1234,5'); // Intl it-IT non separa le migliaia sotto 10.000
  assert.equal(numero(-0.2), '0');
  assert.equal(numero(NaN), '—');
  assert.equal(numero(null), '—');
  assert.equal(euro(1500), '1500 €');
  assert.equal(euro(Infinity), '—');
  assert.equal(kwh(26903), '26.903 kWh');
  assert.equal(perc(0.553, 1), '55,3%');
});

test('tonnellate e anni', () => {
  assert.equal(tonnellate(0.4), '400 kg');
  assert.equal(tonnellate(10.74), '10,7 t');
  assert.equal(anni(null, 20), 'non rientra in 20 anni');
  assert.equal(anni(null, 25), 'non rientra in 25 anni');
  assert.equal(anni(1), '1 anno');
  assert.equal(anni(7), '7 anni');
});

test('circa: due cifre significative, chilogrammi sotto la tonnellata (esclude numeri più precisi dei fattori)', () => {
  assert.equal(circa(22.78), 'circa 23 t');
  assert.equal(circa(1.2377), 'circa 1,2 t');
  assert.equal(circa(0.296), 'circa 300 kg');
  assert.equal(circa(161.8), 'circa 160 t');
  assert.equal(circa(434.6), 'circa 430 t');
  assert.equal(circa(9.96), 'circa 10 t');
  assert.equal(circa(0.9996), 'circa 1,0 t');
  assert.equal(circa(12345), 'circa 12.000 t');
  assert.equal(circa(0), '0 kg');
  assert.equal(circa(NaN), '—');
});

test('nomi di file delle regioni', () => {
  assert.equal(slug("Valle d'Aosta"), 'valle-daosta');
  assert.equal(slug('Valle d’Aosta'), 'valle-daosta');
  assert.equal(slug('Trentino-Alto Adige'), 'trentino-alto-adige');
  assert.equal(slug('Friuli-Venezia Giulia'), 'friuli-venezia-giulia');
  assert.equal(slug('Emilia-Romagna'), 'emilia-romagna');
});
