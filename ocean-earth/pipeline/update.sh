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
# orario: le correnti (osservazioni quasi in tempo reale) e la temperatura
# (analisi operativa, riletta nei giorni dopo: 8 nov 2026, fino a 0,06 °C)
# cambiano anche dopo giorni; --refresh riscarica i giorni i cui file d'origine
# sono cambiati (origin.py) e riscrive solo le ore diverse, altrimenti
# validate.py blocca la pubblicazione
q_temperatura() { f monthly sst && f monthly ice && f daily sst --start "$DAILY_START"; }
q_correnti() { f monthly cur && f daily cur --start "$DAILY_START" && f hourly cur --days "$HOURLY_DAYS" --refresh && f hourly sst --days "$HOURLY_DAYS" --refresh; }
q_ostia() { f daily ostia --days "$OSTIA_DAYS" && f daily med --days "$OSTIA_DAYS" && f monthly sla; }
# Su una macchina piccola le code vanno una dopo l'altra: in parallelo la
# memoria dei tre processi si somma. OE_SERIAL=1 o 0 lo forza; senza, decide la
# RAM (sotto 4 GB: in serie).
if [ -z "${OE_SERIAL:-}" ]; then
  mem_kb=$(awk '/^MemTotal/{print $2}' /proc/meminfo 2>/dev/null || echo 0)
  if [ "${mem_kb:-0}" -gt 0 ] && [ "$mem_kb" -lt 4000000 ]; then OE_SERIAL=1; else OE_SERIAL=0; fi
fi
# un 'wait' senza argomenti rende sempre 0: una coda fallita passava inosservata
# e si pubblicavano climatologia e manifest su dati incompleti
fail=0
if [ "$OE_SERIAL" = 1 ]; then
  q_temperatura > "$LOG/temperatura.log" || fail=1
  q_correnti > "$LOG/correnti.log" || fail=1
  q_ostia > "$LOG/ostia.log" || fail=1
else
  q_temperatura > "$LOG/temperatura.log" & q1=$!
  q_correnti > "$LOG/correnti.log" & q2=$!
  q_ostia > "$LOG/ostia.log" & q3=$!
  for q in $q1 $q2 $q3; do wait "$q" || fail=1; done
fi
if [ "$fail" -ne 0 ]; then
  echo "una coda di download e' fallita: vedi $LOG/*.log; niente derivati ne' manifest" >&2
  exit 1
fi
# Storico delle revisioni: quali ore la fonte ha riscritto, e in che giorno ce
# ne siamo accorti. I log delle code si riscrivono a ogni corsa, questo no.
# Serve a giudicare origin.py: una riga con INATTESO e' un'ora rivista in un
# giorno i cui file d'origine non risultavano cambiati, trovata solo dal
# ricontrollo completo settimanale. Finche' non ne compare nessuna quel
# ricontrollo (6 GB) e' una rete che non ha mai preso niente, e
# OE_FULL_REFRESH_DAYS=0 lo toglie.
{ grep -h 'rivisto dalla fonte' "$LOG"/temperatura.log "$LOG"/correnti.log "$LOG"/ostia.log || true; } \
  | sed "s/^ */$(date -u +%F) /" >> "$LOG/revisioni.log"

# terraferma (ERA5 dal Climate Data Store, ~/.cdsapirc): se il CDS non risponde
# o il token manca si pubblica lo stesso il mare, la terraferma resta com'era
if [ -f "$HOME/.cdsapirc" ]; then
  $PY pipeline/land.py 2>&1 | grep -v -E '^(INFO|WARNING)' > "$LOG/land.log" || echo "terraferma non aggiornata: vedi $LOG/land.log" >&2
fi

# aria (CAMS, Atmosphere Data Store, stessa chiave): si aggiorna poche volte l'anno
if [ -f "$HOME/.cdsapirc" ]; then
  $PY pipeline/co2.py 2>&1 | grep -v -E '^(INFO|WARNING)' > "$LOG/co2.log" || echo "aria non aggiornata: vedi $LOG/co2.log" >&2
fi

# temperatura dell'aria (ERA5, stessa chiave del CDS)
if [ -f "$HOME/.cdsapirc" ]; then
  $PY pipeline/t2m.py 2>&1 | grep -v -E '^(INFO|WARNING)' > "$LOG/t2m.log" || echo "temperatura dell'aria non aggiornata: vedi $LOG/t2m.log" >&2
fi

$PY pipeline/derived.py 2>&1 | tee "$LOG/derived.log"
$PY pipeline/bias.py 2>&1 | grep -v -E '^(INFO|WARNING)' | tee "$LOG/bias.log"
$PY pipeline/preview.py 2>&1 | tee "$LOG/preview.log"
$PY pipeline/manifest.py 2>&1 | tee "$LOG/manifest.log"
echo "aggiornamento finito: $(date -u +%FT%TZ)"
