// Il server di prova del sito (cer-sviluppo/strumenti/servi.py): serve la radice del repository come il sito pubblicato,
// con «Cache-Control: no-cache», come fa Caddy su /cer/ (verificato il 12/11/2026 su co2-info.duckdns.org).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('il server di prova serve i moduli dalla radice del repository con «Cache-Control: no-cache», anche nelle risposte 304 (esclude la cache euristica del browser che l\'08/11/2026, con python3 -m http.server, mescolava moduli vecchi e nuovi)', async () => {
  const server = spawn('python3', [fileURLToPath(new URL('../strumenti/servi.py', import.meta.url)), '0'], { stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    const indirizzo = await new Promise((ok, ko) => {
      server.stdout.once('data', (d) => ok(String(d).trim()));
      server.once('error', ko);
      server.once('exit', (c) => ko(new Error(`il server è uscito con ${c}`)));
    });
    assert.match(indirizzo, /^http:\/\/127\.0\.0\.1:\d+\/cer\/simulatore\/$/);
    const modulo = new URL('js/scenari.js', indirizzo);
    const r = await fetch(modulo);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'no-cache');
    assert.match(r.headers.get('content-type'), /javascript/);
    assert.match(await r.text(), /export function righeUguali/);
    const ancora = await fetch(modulo, { headers: { 'If-Modified-Since': r.headers.get('last-modified') } });
    assert.equal(ancora.status, 304, 'il browser riconvalida e, se il file non è cambiato, non lo riscarica');
    assert.equal(ancora.headers.get('cache-control'), 'no-cache');
  } finally {
    server.kill();
  }
});
