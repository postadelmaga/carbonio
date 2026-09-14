#!/usr/bin/env bash
# modera.sh — leggere la coda e approvare, dalla propria macchina.
#
#   ./modera.sh coda                    elenca i messaggi in attesa
#   ./modera.sh pubblica 3              pubblica il messaggio 3
#   ./modera.sh pubblica 3 "Hai ragione, corretto."   pubblica con una risposta
#   ./modera.sh rifiuta 4               lo tiene fuori, senza cancellarlo
#   ./modera.sh cancella 4              lo elimina davvero
#
# Il token sta sul server, in /home/arch/bacheca/.env: lo si legge da li'
# passando per ssh, cosi' non serve tenerne una copia in locale.
set -euo pipefail
HOST="${BACHECA_HOST:-arch_php}"
API="${BACHECA_API:-https://co2-info.duckdns.org/api}"
TOKEN="$(ssh "$HOST" 'grep ^BACHECA_TOKEN= /home/arch/bacheca/.env | cut -d= -f2-')"
azione="${1:-coda}"

case "$azione" in
  coda)
    curl -s -H "X-Bacheca-Token: $TOKEN" "$API/coda" |
      python3 -c 'import json,sys,time
for m in json.load(sys.stdin)["coda"]:
    print("─" * 60)
    print("#%d  %s  %s  [%s]" % (m["id"], m["nome"] or "anonimo",
          time.strftime("%d/%m/%Y %H:%M", time.localtime(m["ts"])), m["lingua"]))
    print(m["testo"])'
    ;;
  pubblica|rifiuta|cancella)
    id="${2:?serve l id del messaggio}"
    risposta="${3:-}"
    curl -s -X POST -H "X-Bacheca-Token: $TOKEN" -H 'Content-Type: application/json' \
      -d "$(python3 -c 'import json,sys; print(json.dumps({"id": int(sys.argv[1]), "azione": sys.argv[2], "risposta": sys.argv[3]}))' "$id" "$azione" "$risposta")" \
      "$API/modera"
    echo
    ;;
  *) echo "azioni: coda | pubblica <id> [risposta] | rifiuta <id> | cancella <id>"; exit 2 ;;
esac
