#!/usr/bin/env python3
"""Server di prova del sito, solo su 127.0.0.1.

    python3 cer-sviluppo/strumenti/servi.py          # porta 8100
    python3 cer-sviluppo/strumenti/servi.py 8200     # un'altra porta; 0 ne sceglie una libera

Serve la radice del repository come il sito pubblicato e manda «Cache-Control: no-cache», come Caddy su /cer/: il
browser riconvalida ogni file a ogni caricamento (304 se non è cambiato) e non mescola moduli vecchi e nuovi.
`python3 -m http.server` non manda istruzioni di cache, e il 10/11/2026 Chrome ha usato un modulo vecchio insieme a
uno nuovo. Stampa l'indirizzo della pagina del simulatore.
"""
import functools
import http.server
import sys
from pathlib import Path

RADICE = Path(__file__).resolve().parents[2]


class SenzaCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


def main():
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8100
    gestore = functools.partial(SenzaCache, directory=str(RADICE))
    with http.server.ThreadingHTTPServer(('127.0.0.1', porta), gestore) as server:
        print(f'http://127.0.0.1:{server.server_address[1]}/cer/simulatore/', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
