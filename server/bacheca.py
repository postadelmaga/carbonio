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
# Ogni tipo appartiene a una domanda: si puo' rispondere una volta a
# «ti e' servita?» e una a «e' chiara?», non una per bottone. Cambiare idea
# sostituisce la risposta, non ne aggiunge una seconda.
GRUPPO  = {'su': 'utile', 'giu': 'utile', 'chiaro': 'chiarezza', 'confuso': 'chiarezza'}
TIPI    = set(GRUPPO)
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
        CREATE TABLE IF NOT EXISTS voti(
            id INTEGER PRIMARY KEY,
            sezione  TEXT NOT NULL,
            gruppo   TEXT NOT NULL,
            scelta   TEXT NOT NULL,
            impronta TEXT NOT NULL,
            ts       INTEGER NOT NULL
        );
        -- Una riga per persona, sezione e domanda: e' questo indice a rendere
        -- impossibile il voto doppio, non un controllo nel codice.
        CREATE UNIQUE INDEX IF NOT EXISTS voti_uno
            ON voti(sezione, gruppo, impronta);
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


def migra():
    """Porta nella tabella dei voti le reazioni raccolte con lo schema vecchio,
    che contava una volta al giorno per bottone invece di una per domanda."""
    with db() as c:
        vecchia = c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='reazioni'").fetchone()
        if not vecchia:
            return
        righe = c.execute('SELECT sezione, tipo, impronta, MIN(ts) ts FROM reazioni '
                          'WHERE impronta IS NOT NULL GROUP BY sezione, tipo, impronta').fetchall()
        for r in righe:
            if r['tipo'] not in GRUPPO:
                continue
            try:
                c.execute('INSERT INTO voti(sezione, gruppo, scelta, impronta, ts) VALUES(?,?,?,?,?)',
                          (r['sezione'], GRUPPO[r['tipo']], r['tipo'], r['impronta'], r['ts']))
            except sqlite3.IntegrityError:
                pass
        c.execute('DROP TABLE reazioni')


def impronta(ip):
    """Impronta dell'indirizzo, non l'indirizzo: serve a contare una volta
    sola e a fermare gli abusi, non a sapere chi sei."""
    return hashlib.sha256((SALT + '|' + ip).encode()).hexdigest()[:32]


def pulizia():
    """Toglie l'impronta dai messaggi piu' vecchi di trenta giorni: li' serviva
    solo a limitare gli invii.

    Sui voti l'impronta resta: e' l'unica cosa che impedisce di votare due
    volte, e cancellarla vorrebbe dire riaprire la porta. Non e' l'indirizzo
    IP, e' la sua impronta con un sale segreto: senza il sale non si torna
    indietro, e con il sale si puo' solo verificare un indirizzo che si ha
    gia' in mano."""
    limite = int(time.time()) - GIORNI_SALE * 86400
    with lock, db() as c:
        c.execute('UPDATE messaggi SET impronta=NULL WHERE ts<? AND impronta IS NOT NULL', (limite,))


def conteggi():
    with db() as c:
        righe = c.execute('SELECT sezione, scelta, COUNT(*) n FROM voti GROUP BY sezione, scelta').fetchall()
    fuori = {}
    for r in righe:
        fuori.setdefault(r['sezione'], {})[r['scelta']] = r['n']
    return fuori


def gia_votato(imp, sezione=None):
    """Cosa ha gia' risposto questa impronta: serve alla pagina per mostrare la
    scelta anche da un altro dispositivo o dopo aver svuotato il browser."""
    with db() as c:
        if sezione:
            righe = c.execute('SELECT sezione, scelta FROM voti WHERE impronta=? AND sezione=?', (imp, sezione)).fetchall()
        else:
            righe = c.execute('SELECT sezione, scelta FROM voti WHERE impronta=?', (imp,)).fetchall()
    fuori = {}
    for r in righe:
        fuori.setdefault(r['sezione'], []).append(r['scelta'])
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
        """L'ultimo valore di X-Forwarded-For, non il primo.

        Caddy AGGIUNGE in coda l'indirizzo da cui la richiesta arriva davvero;
        quello che c'era prima puo' averlo scritto il client. Prendendo il
        primo, chiunque potrebbe mandarsi un'intestazione inventata a ogni
        clic e votare all'infinito."""
        avanti = self.headers.get('X-Forwarded-For', '')
        pezzi = [p.strip() for p in avanti.split(',') if p.strip()]
        return pezzi[-1] if pezzi else self.client_address[0]

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
            # niente cache condivisa: la risposta contiene anche i voti di chi
            # la chiede, e finirebbe servita a un altro
            return self.rispondi(200, {'reazioni': conteggi(),
                                       'tuoi': gia_votato(impronta(self.ip())),
                                       'messaggi': pubblicati()})
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
            if troppi('voti', 'impronta', imp, 80):
                return self.rispondi(429, {'errore': 'troppe reazioni'})
            # Una risposta per domanda: se ce n'e' gia' una la sostituisce, cosi'
            # cambiare idea e' permesso ma il conteggio non si gonfia mai.
            with lock, db() as c:
                c.execute('INSERT INTO voti(sezione, gruppo, scelta, impronta, ts) VALUES(?,?,?,?,?) '
                          'ON CONFLICT(sezione, gruppo, impronta) DO UPDATE SET scelta=excluded.scelta, ts=excluded.ts',
                          (sezione, GRUPPO[tipo], tipo, imp, int(time.time())))
            return self.rispondi(200, {'reazioni': conteggi().get(sezione, {}),
                                       'tuoi': gia_votato(imp, sezione).get(sezione, [])})

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
    migra()
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
