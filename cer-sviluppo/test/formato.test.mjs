import test from 'node:test';
import assert from 'node:assert/strict';
import { numero, euro, kwh, perc, tonnellate, anni, slug } from '../../cer/simulatore/js/formato.js';

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

test('nomi di file delle regioni', () => {
  assert.equal(slug("Valle d'Aosta"), 'valle-daosta');
  assert.equal(slug('Valle d’Aosta'), 'valle-daosta');
  assert.equal(slug('Trentino-Alto Adige'), 'trentino-alto-adige');
  assert.equal(slug('Friuli-Venezia Giulia'), 'friuli-venezia-giulia');
  assert.equal(slug('Emilia-Romagna'), 'emilia-romagna');
});
