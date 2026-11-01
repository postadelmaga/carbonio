#!/usr/bin/env bash
# Aggiorna tutti i dati di Ocean Earth: scarica solo cio' che manca, poi
# ricalcola climatologia, serie storiche e manifest. Si puo' rilanciare quando
# si vuole (anche da cron): un fotogramma gia' presente non viene riscaricato.
#
#   ./pipeline/update.sh            tutto
#   DAILY_START=2025-01-01 ./pipeline/update.sh
#
# Credenziali Copernicus Marine: ~/.copernicusmarine (copernicusmarine login),
# MAI nel repository.
set -euo pipefail
cd "$(dirname "$0")/.."
PY=.venv/bin/python
[ -x "$PY" ] || { uv venv -q .venv && uv pip install -q -p .venv -r pipeline/requirements.txt; }

DAILY_START="${DAILY_START:-2024-01-01}"
HOURLY_DAYS="${HOURLY_DAYS:-14}"
OSTIA_DAYS="${OSTIA_DAYS:-365}"
LOG=data/logs
mkdir -p "$LOG"

f() { $PY pipeline/frames.py "$@" 2>&1 | grep -v -E '^(INFO|WARNING)' ; }

# tre code in parallelo: la banda (~40 MB/s) e' il collo di bottiglia, la
# memoria (un campo 1/12° globale alla volta per processo) no
( f monthly sst; f monthly ice; f daily sst --start "$DAILY_START" ) > "$LOG/temperatura.log" & q1=$!
( f monthly cur; f daily cur --start "$DAILY_START"; f hourly cur --days "$HOURLY_DAYS"; f hourly sst --days "$HOURLY_DAYS" ) > "$LOG/correnti.log" & q2=$!
( f daily ostia --days "$OSTIA_DAYS"; f daily med --days "$OSTIA_DAYS"; f monthly sla ) > "$LOG/ostia.log" & q3=$!
# un 'wait' senza argomenti rende sempre 0: una coda fallita passava inosservata
# e si pubblicavano climatologia e manifest su dati incompleti
fail=0
for q in $q1 $q2 $q3; do wait "$q" || fail=1; done
if [ "$fail" -ne 0 ]; then
  echo "una coda di download e' fallita: vedi $LOG/*.log; niente derivati ne' manifest" >&2
  exit 1
fi

# terraferma (ERA5 dal Climate Data Store, ~/.cdsapirc): se il CDS non risponde
# o il token manca si pubblica lo stesso il mare, la terraferma resta com'era
if [ -f "$HOME/.cdsapirc" ]; then
  $PY pipeline/land.py 2>&1 | grep -v -E '^(INFO|WARNING)' > "$LOG/land.log" || echo "terraferma non aggiornata: vedi $LOG/land.log" >&2
fi

$PY pipeline/derived.py 2>&1 | tee "$LOG/derived.log"
$PY pipeline/bias.py 2>&1 | grep -v -E '^(INFO|WARNING)' | tee "$LOG/bias.log"
$PY pipeline/preview.py 2>&1 | tee "$LOG/preview.log"
$PY pipeline/manifest.py 2>&1 | tee "$LOG/manifest.log"
echo "aggiornamento finito: $(date -u +%FT%TZ)"
