#!/usr/bin/env bash
# Aggiornamento automatico di Ocean Earth, una volta al giorno su arm_php
# (timer systemd ocean-earth.timer).
#
#   1. update.sh      scarica i nuovi istanti, ricalcola derivati, anteprime, manifest
#   2. validate.py    controlli scientifici; se falliscono NON si pubblica niente
#   3. rsync          verso il server del sito: prima i fotogrammi, il manifest per
#                     ultimo, cosi' nessuno vede un istante elencato e non arrivato
#
# La chiave ~/.ssh/oe_to_arch e' autorizzata sul server solo per rrsync dentro
# /home/arch/carbonioweb/ocean-earth/data (niente shell, solo da questo IP):
# i percorsi remoti qui sotto sono relativi a quella cartella.
#
#   ./pipeline/auto.sh             tutto
#   ./pipeline/auto.sh --pull      solo la prima volta: copia dal server i dati
#                                  gia' pubblicati (serie completa dal 1993)
set -euo pipefail
cd "$(dirname "$0")/.."
DEST="arch@150.230.157.31:"
SSH="ssh -i $HOME/.ssh/oe_to_arch -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=accept-new"
LOG=data/logs
mkdir -p "$LOG"
exec > >(tee -a "$LOG/auto.log") 2>&1
echo "=== $(date -u +%FT%TZ) inizio"

if [ "${1:-}" = "--pull" ]; then
  rsync -a --human-readable --stats -e "$SSH" --exclude '/index/' --exclude '/logs/' "$DEST" data/ | tail -n 5
  echo "=== dati copiati dal server"
  exit 0
fi

./pipeline/update.sh
if ! .venv/bin/python pipeline/validate.py > "$LOG/validate.log" 2>&1; then
  echo "=== validazione FALLITA: niente pubblicato (vedi $LOG/validate.log)"
  tail -n 20 "$LOG/validate.log"
  exit 1
fi

# --delete toglie dal server i fotogrammi usciti dalle finestre mobili (ore,
# ultimi 365 giorni); --max-delete ferma tutto se per un errore dovessero
# sparire molti file in una volta (un giorno normale ne toglie qualche decina)
OPTS=(-a --omit-dir-times --no-perms --delete --max-delete=400 -e "$SSH"
      --exclude '/index/' --exclude '/logs/' --exclude '*.tmp.*')
rsync "${OPTS[@]}" --exclude '/manifest.json' data/ "$DEST"
rsync "${OPTS[@]}" data/manifest.json "${DEST}manifest.json"
echo "=== $(date -u +%FT%TZ) pubblicato: $(python3 -c 'import json;m=json.load(open("data/manifest.json"));print(m.get("generated"))')"
