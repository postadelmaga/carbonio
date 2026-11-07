#!/usr/bin/env python3
"""
bacheca.py — il pezzo di server del sito: le reazioni sotto ogni sezione, i
messaggi della bacheca e la chat dei lettori.

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
  - non pubblica niente da solo: ogni messaggio della bacheca resta in attesa
    finche' non viene approvato.

La chat (dal 7 nov 2026) e' l'eccezione, per scelta: i lettori si parlano e
i messaggi compaiono subito. In cambio: limiti di frequenza e lunghezza, niente
doppioni, i collegamenti restano testo, e dalla moderazione si puo' nascondere
un messaggio o bloccare chi l'ha scritto (per impronta). Dopo trenta giorni i
messaggi si cancellano del tutto.

Variabili d'ambiente:
  BACHECA_DB     percorso del file SQLite     (default /dati/bacheca.sqlite)
  BACHECA_SALT   sale per l'impronta dell'IP  (obbligatoria)
  BACHECA_TOKEN  password della moderazione   (obbligatoria)
  BACHECA_PORT   porta di ascolto             (default 8090)
  BACHECA_SMTP_HOST, BACHECA_SMTP_PORT (465), BACHECA_SMTP_USER,
  BACHECA_SMTP_PASS   account per gli avvisi delle segnalazioni della chat
  BACHECA_AVVISI_A    a chi mandarli (default: BACHECA_SMTP_USER)
                   Senza, le segnalazioni restano solo in modera.sh.
  BACHECA_ORIGINE  origine da autorizzare quando pagina e servizio stanno su
                   porte diverse: serve solo in sviluppo, in produzione sono
                   sullo stesso dominio e non serve niente.
"""

import hashlib
import http.server
import json
import os
import re
import smtplib
import socketserver
import ssl
from email.message import EmailMessage
import sqlite3
import threading
import time

DB      = os.environ.get('BACHECA_DB', '/dati/bacheca.sqlite')
SALT    = os.environ.get('BACHECA_SALT', '')
TOKEN   = os.environ.get('BACHECA_TOKEN', '')
PORT    = int(os.environ.get('BACHECA_PORT', '8090'))
ORIGINE = os.environ.get('BACHECA_ORIGINE', '')
SMTP = {k: os.environ.get('BACHECA_SMTP_' + k.upper(), '') for k in ('host', 'port', 'user', 'pass')}
AVVISI_A = os.environ.get('BACHECA_AVVISI_A', '') or SMTP['user']
SITO = os.environ.get('BACHECA_SITO', 'https://co2-info.duckdns.org')

# Le sezioni della pagina: una lista chiusa, cosi' nessuno puo' inventarsi
# chiavi nuove riempiendo il database.
SEZIONI = {'curva', 'passato', 'recenti', 'caldo', 'bilancio', 'senzapozzi',
           'pozzi', 'chi', 'crescita', 'guerra', 'kyoto', 'sintesi', 'fonti'}
# Ogni tipo appartiene a una domanda: si puo' rispondere una volta a
# «ti e' servita?» e una a «e' chiara?», non una per bottone. Cambiare idea
# sostituisce la risposta, non ne aggiunge una seconda.
GRUPPO  = {'su': 'utile', 'giu': 'utile', 'chiaro': 'chiarezza', 'confuso': 'chiarezza'}
TIPI    = set(GRUPPO)
LINGUE  = {'it', 'en', 'es', 'fr', 'zh'}

MAX_TESTO   = 1500
MAX_CHAT    = 500
GIORNI_CHAT = 30                # dopo, i messaggi della chat si cancellano
SEGNALAZIONI_NASCONDONO = 2     # da tante persone diverse: nascosto finche' non si decide
GIORNI_SEGNALAZIONI = 180       # le segnalazioni (e la loro email) si tengono sei mesi
MOTIVI = {'insulti', 'odio', 'spam', 'personali', 'illegale', 'altro'}
MAX_NOME    = 40
MAX_CORPO   = 8 * 1024          # oltre, la richiesta non viene nemmeno letta
GIORNI_SALE = 30                # dopo, l'impronta dell'IP viene cancellata

lock = threading.Lock()

# Chi e' sulla pagina adesso: la chat compare solo se ci sono almeno due
# persone. Ogni pagina aperta manda un codice casuale a ogni giro (al massimo
# ogni 20 s); qui resta solo in memoria, mai su disco, e sparisce dopo
# PRESENZA secondi. Si contano le impronte, non le schede: due schede della
# stessa persona sono una persona.
PRESENZA = 45
presenti_lock = threading.Lock()
presenti = {}                   # codice -> (impronta, ultimo segnale)


def presenza(codice, imp):
    ora = time.time()
    with presenti_lock:
        if codice:
            if len(presenti) > 5000 and codice not in presenti:
                codice = None           # tetto contro chi inventa codici a raffica
            else:
                presenti[codice] = (imp, ora)
        for k in [k for k, (_, t) in presenti.items() if ora - t > PRESENZA]:
            del presenti[k]
        return len({i for i, _ in presenti.values()})


def assenza(codice):
    with presenti_lock:
        presenti.pop(codice, None)


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
        -- chat: si legge «tutto dopo l'id n», quindi basta la chiave primaria
        CREATE TABLE IF NOT EXISTS chat(
            id INTEGER PRIMARY KEY,
            testo TEXT NOT NULL,
            nome  TEXT,
            sigla TEXT NOT NULL,
            impronta TEXT NOT NULL,
            ts INTEGER NOT NULL,
            nascosto INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS chat_impronta ON chat(impronta, ts);
        -- nascosto: 0 visibile, 1 tolto dalla moderazione, 2 sospeso dalle
        -- segnalazioni in attesa di decisione
        CREATE TABLE IF NOT EXISTS segnalazioni(
            id INTEGER PRIMARY KEY,
            chat_id INTEGER NOT NULL,
            motivo TEXT NOT NULL,
            nota TEXT,
            email TEXT,
            impronta TEXT NOT NULL,
            ts INTEGER NOT NULL,
            decisione TEXT,
            UNIQUE(chat_id, impronta)
        );
        CREATE TABLE IF NOT EXISTS bloccati(
            impronta TEXT PRIMARY KEY,
            ts INTEGER NOT NULL
        );
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
        c.execute('DELETE FROM chat WHERE ts<?', (int(time.time()) - GIORNI_CHAT * 86400,))
        c.execute('DELETE FROM segnalazioni WHERE ts<?', (int(time.time()) - GIORNI_SEGNALAZIONI * 86400,))


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


def sigla(imp):
    """Quattro lettere per distinguere chi scrive senza nome («ospite 3fa2»):
    da un'impronta all'altra non si risale all'indirizzo."""
    return hashlib.sha256(('chat|' + imp).encode()).hexdigest()[:4]


def chat_dopo(dopo, limite=100):
    """I messaggi visibili con id > dopo (gli ultimi cento al primo giro), e
    gli id nascosti dalla moderazione fra quelli che il lettore puo' avere."""
    with db() as c:
        if dopo <= 0:
            righe = c.execute('SELECT id, testo, nome, sigla, ts FROM chat WHERE nascosto=0 '
                              'ORDER BY id DESC LIMIT ?', (limite,)).fetchall()[::-1]
        else:
            righe = c.execute('SELECT id, testo, nome, sigla, ts FROM chat WHERE nascosto=0 AND id>? '
                              'ORDER BY id LIMIT ?', (dopo, limite)).fetchall()
        via = [r['id'] for r in c.execute('SELECT id FROM chat WHERE nascosto>0 AND ts>? ORDER BY id DESC LIMIT 200',
                                         (int(time.time()) - GIORNI_CHAT * 86400,)).fetchall()]
        ultimo = c.execute('SELECT MAX(id) m FROM chat').fetchone()['m'] or 0
    return {'messaggi': [dict(r) for r in righe], 'nascosti': via, 'ultimo': ultimo}


def chat_limite(imp, testo):
    """None se si puo' scrivere, altrimenti il motivo."""
    ora = int(time.time())
    with db() as c:
        if c.execute('SELECT 1 FROM bloccati WHERE impronta=?', (imp,)).fetchone():
            return 'bloccato'
        tempi = [r['ts'] for r in c.execute('SELECT ts FROM chat WHERE impronta=? AND ts>? ORDER BY ts DESC',
                                            (imp, ora - 86400)).fetchall()]
        if tempi and ora - tempi[0] < 4:
            return 'piano'                       # uno ogni 4 secondi
        if sum(1 for t in tempi if ora - t < 600) >= 20 or len(tempi) >= 150:
            return 'troppi'                      # 20 ogni 10 minuti, 150 al giorno
        if c.execute('SELECT 1 FROM chat WHERE impronta=? AND testo=? AND ts>?', (imp, testo, ora - 600)).fetchone():
            return 'doppio'
    return None


def email(a, oggetto, testo, rispondi=None):
    """Manda un'email in un thread a parte: se il server di posta e' lento o
    giu', la chat non se ne accorge."""
    if not (SMTP['host'] and SMTP['user'] and SMTP['pass'] and a):
        return False
    def manda():
        try:
            m = EmailMessage()
            m['From'] = SMTP['user']
            m['To'] = a
            m['Subject'] = oggetto
            if rispondi:
                m['Reply-To'] = rispondi
            m.set_content(testo)
            porta = int(SMTP['port'] or 465)
            if porta == 465:
                with smtplib.SMTP_SSL(SMTP['host'], porta, context=ssl.create_default_context(), timeout=20) as srv:
                    srv.login(SMTP['user'], SMTP['pass']); srv.send_message(m)
            else:
                with smtplib.SMTP(SMTP['host'], porta, timeout=20) as srv:
                    srv.starttls(context=ssl.create_default_context())
                    srv.login(SMTP['user'], SMTP['pass']); srv.send_message(m)
        except Exception as e:
            print('email non partita:', type(e).__name__, flush=True)
    threading.Thread(target=manda, daemon=True).start()
    return True


DECISIONI = {'nascondi': 'rimosso', 'blocca': 'rimosso, e chi l\'ha scritto non puo\' piu\' scrivere',
             'mostra': 'lasciato visibile: non viola le regole della chat'}


def avvisa_segnalanti(c, chat_id, azione):
    """DSA, art. 16-17: chi ha segnalato lasciando un'email sa cosa si e' deciso."""
    if azione not in DECISIONI:
        return
    righe = c.execute('SELECT id, email FROM segnalazioni WHERE chat_id=? AND decisione IS NULL', (chat_id,)).fetchall()
    for r in righe:
        if r['email']:
            email(r['email'], 'La tua segnalazione sulla chat di CO2·info',
                  f'Grazie per la segnalazione del messaggio n. {chat_id}.\n\n'
                  f'Decisione: il messaggio e\' stato {DECISIONI[azione]}.\n\n'
                  f'Regole della chat e contatti: {SITO}/privacy.html\n'
                  f'(Messaggio automatico. Per contestare la decisione rispondi a questa email.)',
                  rispondi=AVVISI_A)
    c.execute('UPDATE segnalazioni SET decisione=? WHERE chat_id=? AND decisione IS NULL', (azione, chat_id))


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
        if percorso == '/api/chat':
            q = self.path.partition('?')[2]
            m = re.search(r'(?:^|&)dopo=(\d+)', q)
            c = re.search(r'(?:^|&)s=([0-9a-z]{8,32})(?:&|$)', q)
            fuori = chat_dopo(int(m.group(1)) if m else 0)
            fuori['presenti'] = presenza(c.group(1) if c else None, impronta(self.ip()))
            return self.rispondi(200, fuori)
        if percorso == '/api/chat/elenco':
            # per la moderazione: anche i nascosti, con l'impronta abbreviata
            if not self.autorizzato():
                return self.rispondi(403, {'errore': 'token'})
            with db() as c:
                righe = c.execute('SELECT c.id, c.testo, c.nome, c.sigla, c.ts, c.nascosto, '
                                  '(b.impronta IS NOT NULL) bloccato FROM chat c '
                                  'LEFT JOIN bloccati b ON b.impronta=c.impronta ORDER BY c.id DESC LIMIT 100').fetchall()
            return self.rispondi(200, {'chat': [dict(r) for r in righe][::-1]})
        if percorso == '/api/chat/segnalazioni':
            if not self.autorizzato():
                return self.rispondi(403, {'errore': 'token'})
            with db() as c:
                righe = c.execute('SELECT s.chat_id, c.testo, c.nome, c.sigla, c.nascosto, '
                                  'GROUP_CONCAT(s.motivo) motivi, GROUP_CONCAT(s.nota, \' | \') note, COUNT(*) n, '
                                  'SUM(s.email IS NOT NULL) con_email, MIN(s.ts) ts FROM segnalazioni s '
                                  'LEFT JOIN chat c ON c.id=s.chat_id WHERE s.decisione IS NULL '
                                  'GROUP BY s.chat_id ORDER BY MIN(s.ts)').fetchall()
            return self.rispondi(200, {'segnalazioni': [dict(r) for r in righe]})
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

        if percorso == '/api/chat':
            if str(dati.get('trappola', '')).strip():
                return self.rispondi(200, {'ok': True})          # bot: finto successo
            # spazi in fila e righe vuote in fila si accorciano; i caratteri di
            # controllo (tranne l'a capo) si tolgono
            testo = re.sub(r'[\x00-\x09\x0b-\x1f\x7f]', '', str(dati.get('testo', '')))
            testo = re.sub(r'\n{3,}', '\n\n', re.sub(r'[ \t]+', ' ', testo)).strip()
            nome = re.sub(r'\s+', ' ', re.sub(r'[\x00-\x1f\x7f]', '', str(dati.get('nome', '')))).strip()[:MAX_NOME]
            if not (1 <= len(testo) <= MAX_CHAT):
                return self.rispondi(400, {'errore': 'lunghezza'})
            if len(re.findall(r'https?://|www\.', testo, re.I)) > 2:
                return self.rispondi(400, {'errore': 'collegamenti'})
            motivo = chat_limite(imp, testo)
            if motivo:
                return self.rispondi(403 if motivo == 'bloccato' else 429, {'errore': motivo})
            with lock, db() as c:
                cur = c.execute('INSERT INTO chat(testo, nome, sigla, impronta, ts) VALUES(?,?,?,?,?)',
                                (testo, nome or None, sigla(imp), imp, int(time.time())))
                nuovo = cur.lastrowid
            return self.rispondi(200, {'ok': True, 'id': nuovo})

        if percorso == '/api/chat/via':
            # la pagina si chiude (sendBeacon): non contarla piu' fra i presenti
            c = str(dati.get('s', ''))
            if re.fullmatch(r'[0-9a-z]{8,32}', c):
                assenza(c)
            return self.rispondi(200, {'ok': True})

        if percorso == '/api/chat/segnala':
            try:
                ident = int(dati.get('id'))
            except (TypeError, ValueError):
                return self.rispondi(400, {'errore': 'id'})
            motivo = str(dati.get('motivo', ''))
            if motivo not in MOTIVI:
                return self.rispondi(400, {'errore': 'motivo'})
            nota = re.sub(r'\s+', ' ', str(dati.get('nota', ''))).strip()[:300] or None
            mail = str(dati.get('email', '')).strip()[:120] or None
            if mail and not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', mail):
                return self.rispondi(400, {'errore': 'email'})
            if troppi('segnalazioni', 'impronta', imp, 30):
                return self.rispondi(429, {'errore': 'troppe'})
            with lock, db() as c:
                r = c.execute('SELECT testo, nome, sigla, nascosto FROM chat WHERE id=?', (ident,)).fetchone()
                if not r:
                    return self.rispondi(404, {'errore': 'id'})
                try:
                    c.execute('INSERT INTO segnalazioni(chat_id, motivo, nota, email, impronta, ts) VALUES(?,?,?,?,?,?)',
                              (ident, motivo, nota, mail, imp, int(time.time())))
                except sqlite3.IntegrityError:
                    return self.rispondi(200, {'ok': True, 'gia': True})
                n = c.execute('SELECT COUNT(*) n FROM segnalazioni WHERE chat_id=? AND decisione IS NULL', (ident,)).fetchone()['n']
                sospeso = r['nascosto'] == 0 and n >= SEGNALAZIONI_NASCONDONO
                if sospeso:
                    c.execute('UPDATE chat SET nascosto=2 WHERE id=?', (ident,))
            email(AVVISI_A, f'[chat CO2·info] segnalazione: {motivo} (messaggio {ident})',
                  f'Messaggio {ident} di «{r["nome"] or "ospite " + r["sigla"]}»:\n\n{r["testo"]}\n\n'
                  f'Motivo: {motivo}\nNota: {nota or "-"}\nEmail di chi segnala: {"si" if mail else "no"}\n'
                  f'Segnalazioni aperte: {n}{" - SOSPESO in attesa di decisione" if sospeso else ""}\n\n'
                  f'Decidere (dal repo):\n  ./server/modera.sh chat-nascondi {ident}\n'
                  f'  ./server/modera.sh chat-blocca {ident}\n  ./server/modera.sh chat-mostra {ident}\n')
            return self.rispondi(200, {'ok': True})

        if percorso == '/api/chat/modera':
            if not self.autorizzato():
                return self.rispondi(403, {'errore': 'token'})
            try:
                ident = int(dati.get('id'))
            except (TypeError, ValueError):
                return self.rispondi(400, {'errore': 'id'})
            azione = str(dati.get('azione', ''))
            if azione not in ('nascondi', 'mostra', 'blocca', 'sblocca'):
                return self.rispondi(400, {'errore': 'azione'})
            with lock, db() as c:
                r = c.execute('SELECT impronta FROM chat WHERE id=?', (ident,)).fetchone()
                if not r:
                    return self.rispondi(404, {'errore': 'id'})
                if azione in ('nascondi', 'mostra'):
                    c.execute('UPDATE chat SET nascosto=? WHERE id=?', (1 if azione == 'nascondi' else 0, ident))
                    avvisa_segnalanti(c, ident, azione)
                elif azione == 'blocca':
                    # chi viene bloccato sparisce con tutto quello che ha scritto
                    c.execute('INSERT OR IGNORE INTO bloccati(impronta, ts) VALUES(?,?)', (r['impronta'], int(time.time())))
                    c.execute('UPDATE chat SET nascosto=1 WHERE impronta=?', (r['impronta'],))
                    avvisa_segnalanti(c, ident, azione)
                else:
                    c.execute('DELETE FROM bloccati WHERE impronta=?', (r['impronta'],))
            return self.rispondi(200, {'ok': True})

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
