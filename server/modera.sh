#!/usr/bin/env bash
# modera.sh — leggere la coda e approvare, dalla propria macchina.
#
#   ./modera.sh coda                    elenca i messaggi in attesa
#   ./modera.sh pubblica 3              pubblica il messaggio 3
#   ./modera.sh pubblica 3 "Hai ragione, corretto."   pubblica con una risposta
#   ./modera.sh rifiuta 4               lo tiene fuori, senza cancellarlo
#   ./modera.sh cancella 4              lo elimina davvero
#
# Chat (i messaggi compaiono subito; qui si toglie):
#   ./modera.sh chat                    gli ultimi 100 messaggi, con id e stato
#   ./modera.sh segnalazioni            le segnalazioni ancora da decidere
#   ./modera.sh chat-nascondi 12        toglie il messaggio 12
#   ./modera.sh chat-blocca 12          toglie tutti i messaggi di chi ha scritto
#                                       il 12 e gli impedisce di scrivere ancora
#   ./modera.sh chat-mostra 12          lo rimette (segnalazione respinta)
#   ./modera.sh chat-sblocca 12         toglie il blocco a chi ha scritto il 12
# Chi ha segnalato lasciando un'email riceve la decisione (DSA, art. 16-17).
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
  chat)
    curl -s -H "X-Bacheca-Token: $TOKEN" "$API/chat/elenco" |
      python3 -c 'import json,sys,time
S = {0: "", 1: "  [NASCOSTO]", 2: "  [SOSPESO: segnalato]"}
for m in json.load(sys.stdin)["chat"]:
    print("#%-5d %s %-20s%s%s" % (m["id"], time.strftime("%d/%m %H:%M", time.localtime(m["ts"])),
          (m["nome"] or "ospite") + " " + m["sigla"], S.get(m["nascosto"], ""), "  [BLOCCATO]" if m["bloccato"] else ""))
    print("       " + m["testo"].replace("
", "
       "))'
    ;;
  segnalazioni)
    curl -s -H "X-Bacheca-Token: $TOKEN" "$API/chat/segnalazioni" |
      python3 -c 'import json,sys,time
L = json.load(sys.stdin)["segnalazioni"]
if not L: print("nessuna segnalazione da decidere")
for s in L:
    print("─" * 60)
    print("#%d  %d segnalazioni (%s)  dal %s%s" % (s["chat_id"], s["n"], s["motivi"],
          time.strftime("%d/%m %H:%M", time.localtime(s["ts"])), "  SOSPESO" if s["nascosto"] == 2 else ""))
    print("  " + (s["testo"] or "(gia cancellato)"))
    if s["note"]: print("  note: " + s["note"])'
    ;;
  chat-nascondi|chat-mostra|chat-blocca|chat-sblocca)
    id="${2:?serve l id del messaggio}"
    curl -s -X POST -H "X-Bacheca-Token: $TOKEN" -H 'Content-Type: application/json' \
      -d "{\"id\": $((id)), \"azione\": \"${azione#chat-}\"}" "$API/chat/modera"
    echo
    ;;
  *) echo "azioni: coda | pubblica <id> [risposta] | rifiuta <id> | cancella <id>"
     echo "        chat | segnalazioni | chat-nascondi <id> | chat-blocca <id> | chat-mostra <id> | chat-sblocca <id>"; exit 2 ;;
esac
