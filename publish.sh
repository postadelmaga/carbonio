#!/usr/bin/env bash
set -euo pipefail

##############################################################################
# publish.sh — deploy.sh con la destinazione reale gia' incorporata.
#
# Il sito e' servito dal container "nicoweb" (Caddy) su arch_php, che monta
# in sola lettura /home/arch/carbonioweb come /srv/carbonio e lo espone su
#   https://e8-zdemo.duckdns.org/carbonio/
# (blocco (e8_site) in /home/arch/nicoweb/docker/Caddyfile).
#
# Uso:
#   ./publish.sh            dry-run: mostra cosa cambierebbe, non scrive
#   ./publish.sh --apply    pubblica davvero
#   ./publish.sh --apply --prune   e cancella sul server i file non piu' presenti
#
# Ogni altra opzione viene passata a deploy.sh cosi' com'e'.
##############################################################################

DEST="/home/arch/carbonioweb"
URL="https://e8-zdemo.duckdns.org/carbonio"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$HERE/deploy.sh" --dest "$DEST" --url "$URL" "$@"
