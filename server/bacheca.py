#!/usr/bin/env python3
"""
bacheca.py — il pezzo di server del sito: le reazioni sotto ogni sezione e i
messaggi della bacheca.

Scritto con la sola libreria standard, come il resto del progetto: niente
pacchetti da installare, niente catena di dipendenze da sorvegliare, un file
solo da leggere prima di fidarsi. Sta dietro Caddy, che fa TLS, timeout e
limiti di corpo; qui dentro c'e' solo la logica.

Cosa NON fa, di proposito:
  - non usa cookie e non scrive niente nel browser (lo fa la pagina, in
    localStorage, per ricordare cosa hai gia' votato);
  - non conserva indirizzi IP: ne tiene l'impronta con un sale segreto, che
    serve a contare una volta sola e a limitare gli abusi, e la cancella dopo
    trenta giorni;
  - non pubblica niente da solo: ogni messaggio resta in attesa finche' non
    viene approvato.

Variabili d'ambiente:
  BACHECA_DB     percorso del file SQLite     (default /dati/bacheca.sqlite)
  BACHECA_SALT   sale per l'impronta dell'IP  (obbligatoria)
  BACHECA_TOKEN  password della moderazione   (obbligatoria)
  BACHECA_PORT   porta di ascolto             (default 8090)
  BACHECA_ORIGINE  origine da autorizzare quando pagina e servizio stanno su
                   porte diverse: serve solo in sviluppo, in produzione sono
                   sullo stesso dominio e non serve niente.
"""

import hashlib
import http.server
import json
import os
import re
import socketserver
import sqlite3
import threading
import time

DB      = os.environ.get('BACHECA_DB', '/dati/bacheca.sqlite')
SALT    = os.environ.get('BACHECA_SALT', '')
TOKEN   = os.environ.get('BACHECA_TOKEN', '')
PORT    = int(os.environ.get('BACHECA_PORT', '8090'))
ORIGINE = os.environ.get('BACHECA_ORIGINE', '')

# Le sezioni della pagina: una lista chiusa, cosi' nessuno puo' inventarsi
# chiavi nuove riempiendo il database.
SEZIONI = {'curva', 'passato', 'recenti', 'caldo', 'bilancio', 'senzapozzi',
           'pozzi', 'chi', 'crescita', 'guerra', 'kyoto', 'sintesi', 'fonti'}
TIPI    = {'su', 'giu', 'chiaro', 'confuso'}
LINGUE  = {'it', 'en', 'es', 'zh'}

MAX_TESTO   = 1500
MAX_NOME    = 40
MAX_CORPO   = 8 * 1024          # oltre, la richiesta non viene nemmeno letta
GIORNI_SALE = 30                # dopo, l'impronta dell'IP viene cancellata

lock = threading.Lock()


def db():
    c = sqlite3.connect(DB, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA journal_mode=WAL')
    return c


def prepara():
    os.makedirs(os.path.dirname(DB) or '.', exist_ok=True)
    with db() as c:
        c.executescript('''
        CREATE TABLE IF NOT EXISTS reazioni(
            id INTEGER PRIMARY KEY,
            sezione TEXT NOT NULL,
            tipo    TEXT NOT NULL,
            giorno  TEXT NOT NULL,
            impronta TEXT,
            ts      INTEGER NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS reazioni_una
            ON reazioni(sezione, tipo, giorno, impronta);
        CREATE TABLE IF NOT EXISTS messaggi(
            id INTEGER PRIMARY KEY,
            testo TEXT NOT NULL,
            nome  TEXT,
            lingua TEXT,
            stato TEXT NOT NULL DEFAULT 'attesa',
            impronta TEXT,
            ts INTEGER NOT NULL,
            risposta TEXT
        );
        CREATE INDEX IF NOT EXISTS messaggi_stato ON messaggi(stato, ts);
        ''')


def impronta(ip):
    """Impronta dell'indirizzo, non l'indirizzo: serve a contare una volta
    sola e a fermare gli abusi, non a sapere chi sei."""
    return hashlib.sha256((SALT + '|' + ip).encode()).hexdigest()[:32]


def pulizia():
    """Toglie le impronte piu' vecchie di trenta giorni. I conteggi restano."""
    limite = int(time.time()) - GIORNI_SALE * 86400
    with lock, db() as c:
        c.execute('UPDATE reazioni SET impronta=NULL WHERE ts<? AND impronta IS NOT NULL', (limite,))
        c.execute('UPDATE messaggi SET impronta=NULL WHERE ts<? AND impronta IS NOT NULL', (limite,))


def conteggi():
    with db() as c:
        righe = c.execute('SELECT sezione, tipo, COUNT(*) n FROM reazioni GROUP BY sezione, tipo').fetchall()
    fuori = {}
    for r in righe:
        fuori.setdefault(r['sezione'], {})[r['tipo']] = r['n']
    return fuori


def pubblicati(limite=200):
    with db() as c:
        righe = c.execute(
            "SELECT id, testo, nome, lingua, ts, risposta FROM messaggi "
            "WHERE stato='pubblicato' ORDER BY ts DESC LIMIT ?", (limite,)).fetchall()
    return [dict(r) for r in righe]


def troppi(tavola, campo, imp, limite, finestra=86400):
    da = int(time.time()) - finestra
    with db() as c:
        n = c.execute(f'SELECT COUNT(*) n FROM {tavola} WHERE {campo}=? AND ts>?', (imp, da)).fetchone()['n']
    return n >= limite


class Gestore(http.server.BaseHTTPRequestHandler):
    server_version = 'bacheca'
    protocol_version = 'HTTP/1.1'

    # ── utilita' ──────────────────────────────────────────────────────────
    def rispondi(self, codice, dati, cache=False):
        corpo = json.dumps(dati, ensure_ascii=False).encode()
        self.send_response(codice)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(corpo)))
        self.send_header('Cache-Control', 'public, max-age=60' if cache else 'no-store')
        if ORIGINE:
            self.send_header('Access-Control-Allow-Origin', ORIGINE)
        self.end_headers()
        self.wfile.write(corpo)

    def ip(self):
        avanti = self.headers.get('X-Forwarded-For', '')
        return (avanti.split(',')[0].strip() or self.client_address[0])

    def corpo(self):
        n = int(self.headers.get('Content-Length', '0') or 0)
        if n <= 0 or n > MAX_CORPO:
            return None
        try:
            return json.loads(self.rfile.read(n).decode('utf-8'))
        except (ValueError, UnicodeDecodeError):
            return None

    def autorizzato(self):
        t = self.headers.get('X-Bacheca-Token', '')
        return bool(TOKEN) and t == TOKEN

    def log_message(self, *a):
        pass    # i log li tiene Caddy

    # ── rotte ─────────────────────────────────────────────────────────────
    def do_OPTIONS(self):
        self.send_response(204)
        if ORIGINE:
            self.send_header('Access-Control-Allow-Origin', ORIGINE)
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Bacheca-Token')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        percorso = self.path.split('?')[0].rstrip('/')
        if percorso == '/api/stato':
            return self.rispondi(200, {'reazioni': conteggi(), 'messaggi': pubblicati()}, cache=True)
        if percorso == '/api/coda':
            if not self.autorizzato():
                return self.rispondi(403, {'errore': 'token'})
            with db() as c:
                righe = c.execute("SELECT id, testo, nome, lingua, ts FROM messaggi "
                                  "WHERE stato='attesa' ORDER BY ts").fetchall()
            return self.rispondi(200, {'coda': [dict(r) for r in righe]})
        if percorso == '/api/salute':
            return self.rispondi(200, {'ok': True})
        return self.rispondi(404, {'errore': 'niente qui'})

    def do_POST(self):
        percorso = self.path.split('?')[0].rstrip('/')
        dati = self.corpo()
        if dati is None:
            return self.rispondi(400, {'errore': 'corpo non valido'})
        imp = impronta(self.ip())

        if percorso == '/api/reazione':
            sezione = str(dati.get('sezione', ''))
            tipo    = str(dati.get('tipo', ''))
            if sezione not in SEZIONI or tipo not in TIPI:
                return self.rispondi(400, {'errore': 'sezione o tipo sconosciuti'})
            if troppi('reazioni', 'impronta', imp, 80):
                return self.rispondi(429, {'errore': 'troppe reazioni'})
            giorno = time.strftime('%Y-%m-%d')
            with lock, db() as c:
                try:
                    c.execute('INSERT INTO reazioni(sezione, tipo, giorno, impronta, ts) VALUES(?,?,?,?,?)',
                              (sezione, tipo, giorno, imp, int(time.time())))
                except sqlite3.IntegrityError:
                    pass    # gia' votato oggi: si risponde lo stesso, senza contare due volte
            return self.rispondi(200, {'reazioni': conteggi().get(sezione, {})})

        if percorso == '/api/messaggio':
            if str(dati.get('trappola', '')).strip():
                return self.rispondi(200, {'stato': 'attesa'})   # bot: finto successo
            testo = re.sub(r'\s+\n', '\n', str(dati.get('testo', '')).strip())
            nome  = str(dati.get('nome', '')).strip()[:MAX_NOME]
            lingua = str(dati.get('lingua', 'it'))
            if lingua not in LINGUE:
                lingua = 'it'
            if not (5 <= len(testo) <= MAX_TESTO):
                return self.rispondi(400, {'errore': 'lunghezza'})
            if troppi('messaggi', 'impronta', imp, 3):
                return self.rispondi(429, {'errore': 'troppi messaggi'})
            with lock, db() as c:
                c.execute('INSERT INTO messaggi(testo, nome, lingua, impronta, ts) VALUES(?,?,?,?,?)',
                          (testo, nome or None, lingua, imp, int(time.time())))
            return self.rispondi(200, {'stato': 'attesa'})

        if percorso == '/api/modera':
            if not self.autorizzato():
                return self.rispondi(403, {'errore': 'token'})
            try:
                ident = int(dati.get('id'))
            except (TypeError, ValueError):
                return self.rispondi(400, {'errore': 'id'})
            azione = str(dati.get('azione', ''))
            if azione not in ('pubblica', 'rifiuta', 'cancella'):
                return self.rispondi(400, {'errore': 'azione'})
            risposta = str(dati.get('risposta', '')).strip()[:MAX_TESTO] or None
            with lock, db() as c:
                if azione == 'cancella':
                    c.execute('DELETE FROM messaggi WHERE id=?', (ident,))
                else:
                    c.execute('UPDATE messaggi SET stato=?, risposta=? WHERE id=?',
                              ('pubblicato' if azione == 'pubblica' else 'rifiutato', risposta, ident))
            return self.rispondi(200, {'ok': True})

        return self.rispondi(404, {'errore': 'niente qui'})


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    if not SALT or not TOKEN:
        raise SystemExit('BACHECA_SALT e BACHECA_TOKEN sono obbligatorie')
    prepara()
    pulizia()
    def spazzino():
        while True:
            time.sleep(6 * 3600)
            try: pulizia()
            except Exception: pass
    threading.Thread(target=spazzino, daemon=True).start()
    with Server(('0.0.0.0', PORT), Gestore) as s:
        s.serve_forever()


if __name__ == '__main__':
    main()
