#!/usr/bin/env bash
set -euo pipefail

##############################################################################
# passa-a-eu-org.sh — sposta il sito dal nome duckdns al nome eu.org.
#
# Perche': Facebook non rende cliccabili i collegamenti a *.duckdns.org, e il
# link si incollava come testo nudo. Vedi l'issue #1.
#
# Si lancia dalla propria macchina, usa l'alias SSH "arch_php".
#
#   ./server/passa-a-eu-org.sh              guarda e basta: la delega c'e'?
#   ./server/passa-a-eu-org.sh --apply      fa il passaggio
#   ./server/passa-a-eu-org.sh --rollback   torna alla configurazione di prima
#
# Il nome chiesto e' co2-info.edu.eu.org, richiesta 20260915101153-arf-20205.
# Non e' un capriccio: eu.org scoraggia la registrazione diretta sotto eu.org
# ("try to avoid... there are intentionally more constraints") e indica di
# scegliere una delle sue sottozone. EDU e' quella per i siti divulgativi, ed e'
# neutra rispetto alla lingua: la pagina e' in quattro.
#
# Se assegnassero un nome ancora diverso, basta dirlo:
#
#   NUOVO=co2-info.it.eu.org ./server/passa-a-eu-org.sh --apply
#
# Cosa fa sul server:
#   1. mette in opera docker/Caddyfile.eu-org, gia' scritto e validato,
#      tenendo da parte quello attuale
#   2. nel compose: CO2_SERVER_NAME diventa il nome nuovo, e compare
#      CO2_OLD_SERVER_NAME col vecchio, che da li' in poi rimanda con un 308
#   3. valida la configurazione PRIMA di ricreare il container
#   4. ricrea nicoweb — 10-20 s di fermo, tocca anche gli altri siti serviti
#      dalla stessa immagine — e aspetta il certificato
#   5. verifica il nome nuovo, il rimando dal vecchio, e gli altri due siti
#
# Cosa NON fa, e va fatto dopo: lo stampa alla fine.
##############################################################################

NUOVO="${NUOVO:-co2-info.edu.eu.org}"
VECCHIO="${VECCHIO:-co2-info.duckdns.org}"
HOST="${CARBONIO_HOST:-arch_php}"

DIR=/home/arch/nicoweb
CADDY="$DIR/docker/Caddyfile"
PRONTO="$DIR/docker/Caddyfile.eu-org"
COMPOSE="$DIR/docker-compose.prod.yml"
SALVA=".prima-di-eu-org"

info() { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
ok()   { echo -e "\033[1;32m[OK]\033[0m    $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
err()  { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; }

AZIONE="${1:-guarda}"

# ── rollback ────────────────────────────────────────────────────────────────
if [[ "$AZIONE" == "--rollback" ]]; then
  info "Rimetto la configurazione di prima"
  ssh "$HOST" "
    set -e
    [ -f '$CADDY$SALVA' ] || { echo 'Non trovo $CADDY$SALVA'; exit 1; }
    cp '$CADDY$SALVA' '$CADDY'
    cp '$COMPOSE$SALVA' '$COMPOSE'
    cd '$DIR' && docker compose -f '$COMPOSE' up -d --force-recreate nicoweb
  "
  ok "Tornato indietro. Controlla: curl -sI https://$VECCHIO/"
  exit 0
fi

# ── la delega c'e'? ─────────────────────────────────────────────────────────
# Si chiede al padre, non al proprio resolver: il TTL negativo di eu.org e' di
# 7200 s, quindi una risposta «non esiste» resta in cache due ore dopo che la
# delega e' gia' viva.
# Il padre e' la zona sopra: per co2-info.edu.eu.org e' edu.eu.org, non eu.org.
# Chiedere ai nameserver di eu.org funzionerebbe per caso — i due insiemi si
# sovrappongono — ma un nameserver non autoritativo per quella zona risponde
# vuoto, e sembrerebbe che la delega non ci sia.
ZONA_PADRE="${NUOVO#*.}"
PADRE="$(dig +short NS "$ZONA_PADRE" | head -1)"
info "Chiedo di $NUOVO al padre: $ZONA_PADRE, via $PADRE"
DELEGA="$(dig +short NS "$NUOVO" @"$PADRE" | tr '\n' ' ' | sed 's/ *$//')"

if [[ -z "$DELEGA" ]]; then
  warn "La delega non c'e' ancora: eu.org non ha ancora evaso la richiesta."
  echo "  Ricontrolla con:  dig +short NS $NUOVO @$PADRE"
  exit 1
fi
ok "Delegato a: $DELEGA"

IP_NUOVO="$(dig +short A "$NUOVO" | tail -1)"
IP_VECCHIO="$(dig +short A "$VECCHIO" | tail -1)"
info "$NUOVO -> ${IP_NUOVO:-(niente)}"
info "$VECCHIO -> ${IP_VECCHIO:-(niente)}"
if [[ -z "$IP_NUOVO" || "$IP_NUOVO" != "$IP_VECCHIO" ]]; then
  err "Il nome nuovo non punta dove punta il vecchio. Non procedo."
  exit 1
fi
ok "Puntano allo stesso server"

if [[ "$AZIONE" != "--apply" ]]; then
  echo ""
  info "Tutto pronto. Per fare il passaggio davvero:"
  echo "  NUOVO=$NUOVO $0 --apply"
  exit 0
fi

# ── il compose: nome nuovo, e il vecchio che rimane per il rimando ──────────
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
scp -q "$HOST:$COMPOSE" "$TMP/compose.yml"
python3 - "$TMP/compose.yml" "$NUOVO" "$VECCHIO" <<'PY'
import re, sys
p, nuovo, vecchio = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(p, encoding='utf-8').read()
s, n = re.subn(r'- CO2_SERVER_NAME=.*', '- CO2_SERVER_NAME=%s' % nuovo, s)
assert n == 1, 'CO2_SERVER_NAME trovato %d volte' % n
if 'CO2_OLD_SERVER_NAME' not in s:
    s = s.replace(
        '      - CO2_SERVER_NAME=%s\n' % nuovo,
        '      - CO2_SERVER_NAME=%s\n'
        '      # Il vecchio nome: da qui in poi non serve piu\' il sito, rimanda.\n'
        '      - CO2_OLD_SERVER_NAME=%s\n' % (nuovo, vecchio))
open(p, 'w', encoding='utf-8').write(s)
print('  compose: CO2_SERVER_NAME=%s, CO2_OLD_SERVER_NAME=%s' % (nuovo, vecchio))
PY
scp -q "$TMP/compose.yml" "$HOST:/tmp/compose.nuovo.yml"

# ── validare prima di toccare il container ──────────────────────────────────
info "Valido la configurazione in un container usa e getta"
ssh "$HOST" "
  set -e
  docker run --rm --entrypoint frankenphp \
    -v '$PRONTO':/etc/frankenphp/Caddyfile:ro \
    -e CO2_SERVER_NAME='$NUOVO' -e CO2_OLD_SERVER_NAME='$VECCHIO' \
    -e E8_SERVER_NAME=e8-zdemo.duckdns.org -e SERVER_NAME=niccolomenegazzo.com \
    nicoweb:prod validate --config /etc/frankenphp/Caddyfile --adapter caddyfile 2>&1 |
    grep -q 'Valid configuration'
"
ok "Configurazione valida"

# ── il passaggio ────────────────────────────────────────────────────────────
info "Metto in opera e ricreo il container (10-20 s di fermo)"
ssh "$HOST" "
  set -e
  cp '$CADDY' '$CADDY$SALVA'
  cp '$COMPOSE' '$COMPOSE$SALVA'
  cp '$PRONTO' '$CADDY'
  cp /tmp/compose.nuovo.yml '$COMPOSE'
  cd '$DIR' && docker compose -f '$COMPOSE' up -d --force-recreate nicoweb
"

# ── verifica ────────────────────────────────────────────────────────────────
info "Aspetto il certificato per $NUOVO"
for i in $(seq 1 30); do
  CODICE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$NUOVO/" || true)"
  [[ "$CODICE" == "200" ]] && break
  sleep 5
done

echo ""
prova() { printf "  %-42s " "$1"; shift; curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" --max-time 15 "$@" || echo "irraggiungibile"; }
echo "── il nome nuovo ──"
prova "https://$NUOVO/"                    "https://$NUOVO/"
prova "  /en/"                             "https://$NUOVO/en/"
prova "  /feedback.html"                   "https://$NUOVO/feedback.html"
prova "  /assets/social-it.png"            "https://$NUOVO/assets/social-it.png"
prova "  Accept-Language: es -> /es/"      -H "Accept-Language: es-ES,es" "https://$NUOVO/"
echo "── il vecchio nome, che rimanda ──"
prova "http://$VECCHIO/"                   "http://$VECCHIO/"
prova "https://$VECCHIO/"                  "https://$VECCHIO/"
echo "── gli altri siti sulla stessa immagine ──"
prova "niccolomenegazzo.com"               "https://niccolomenegazzo.com/"
prova "e8-zdemo.duckdns.org"               "https://e8-zdemo.duckdns.org/"

if [[ "$CODICE" != "200" ]]; then
  echo ""
  err "Il nome nuovo non risponde 200. Il certificato puo' non essere arrivato."
  err "Per tornare indietro subito:  $0 --rollback"
  ssh "$HOST" "docker logs --tail 30 nicoweb 2>&1 | grep -i -E 'error|acme|certificate' | tail -10" || true
  exit 1
fi

ok "Passaggio fatto"
cat <<FINE

Resta da fare, dal repo:

  1. sed -i 's|co2-info.duckdns.org|$NUOVO|' publish.sh server/modera.sh
  2. cambia l'indirizzo stampato in fondo alle cartoline in social.py, poi
     python3 social.py
  3. ./publish.sh --apply      (ricalcola canonical, og:url, og:image,
                                hreflang, robots.txt e la sitemap)
  4. i quattro README e MAINTENANCE.md nominano il dominio
  5. Umami: rinomina il sito nel pannello, l'id resta valido
  6. Facebook: Sharing Debugger su https://$NUOVO/ , poi «Scrape Again»

FINE
