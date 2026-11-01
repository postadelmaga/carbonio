#!/usr/bin/env bash
set -euo pipefail

##############################################################################
# deploy.sh — pubblica su arch_php il sito statico: CO2·info, la CER, Ocean Earth
#
# Va lanciato dalla macchina locale: usa l'alias SSH "arch_php" definito in
# ~/.ssh/config.
#
# Di default NON scrive niente: fa un dry-run e mostra cosa cambierebbe.
# Serve --apply per pubblicare davvero.
#
# Uso:
#   ./deploy.sh --dest /srv/niccoweb/carbonio --url https://esempio.it/carbonio
#   ./deploy.sh --dest /srv/niccoweb/carbonio --url https://esempio.it/carbonio --apply
#   ./deploy.sh --dest ... --url ... --apply --prune   # rimuove i file orfani
#
# Opzioni:
#   --dest PATH   docroot sul server remoto (obbligatorio)
#   --url  URL    URL pubblico finale, senza slash finale (obbligatorio)
#   --host NAME   alias SSH di destinazione (default: arch_php)
#   --apply       esegue davvero il trasferimento
#   --prune       aggiunge --delete: cancella sul remoto i file non piu presenti
#   --out DIR     prepara solo la build in DIR, senza collegarsi al server
#   --oe-data     sincronizza anche i dati di Ocean Earth dalla copia locale.
#                 Di norma NON serve: li pubblica ogni giorno arm_php
#                 (ocean-earth/pipeline/auto.sh) e la copia locale e' piu' vecchia.
##############################################################################

SSH_HOST="arch_php"
DEST=""
PUBLIC_URL=""
APPLY=0
PRUNE=0
OUT=""
OE_DATA_SYNC=0

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

info() { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
ok()   { echo -e "\033[1;32m[OK]\033[0m    $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
err()  { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dest)  DEST="${2:-}";       shift 2 ;;
    --url)   PUBLIC_URL="${2:-}"; shift 2 ;;
    --host)  SSH_HOST="${2:-}";   shift 2 ;;
    --apply) APPLY=1;  shift ;;
    --prune) PRUNE=1;  shift ;;
    --out)   OUT="${2:-}"; shift 2 ;;
    --oe-data) OE_DATA_SYNC=1; shift ;;
    -h|--help) sed -n '3,30p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) err "Opzione sconosciuta: $1"; exit 2 ;;
  esac
done

[[ -n "$DEST" ]]       || { err "Manca --dest (docroot sul server remoto)."; exit 2; }
[[ -n "$PUBLIC_URL" ]] || { err "Manca --url (URL pubblico del sito)."; exit 2; }
PUBLIC_URL="${PUBLIC_URL%/}"

# ── 1. Verifica che l'host risponda (non serve per --out) ───────────────────
if [[ -z "$OUT" ]]; then
  info "Verifico l'accesso a $SSH_HOST"
  if ! ssh -o BatchMode=yes -o ConnectTimeout=10 "$SSH_HOST" true 2>/dev/null; then
    err "Non riesco a connettermi a '$SSH_HOST' senza password."
    err "Controlla ~/.ssh/config e che la chiave sia caricata (ssh-add -l)."
    exit 1
  fi
  ok "Host raggiungibile"
fi

# ── 2. Build: copia con i placeholder risolti ───────────────────────────────
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT

info "Preparo la build in $BUILD_DIR"
# Il repository ha una cartella per progetto; sul server convivono cosi':
#   co2-info/     → /            "Il carbonio che resta" (radice inglese, it/ es/ fr/ zh/)
#   cer/          → /cer/        la Comunita' Energetica Rinnovabile e il suo statuto
#   ocean-earth/  → /atlante/      l'Atlante del clima (pagina e codice)
#                   /ocean-earth/  solo i dati, che arm_php aggiorna ogni giorno, e
#                                  un rinvio al nuovo indirizzo per i vecchi link
CO2="$SRC_DIR/co2-info"
cp -R "$CO2/404.html" "$CO2/robots.txt" "$CO2/assets" "$BUILD_DIR/"
# La radice del sito e' l'inglese. build.py lo genera dentro en/, ma con
# canonical e collegamenti interni gia' nella forma della radice: qui il
# contenuto di quella cartella sale di un livello, e en/ non viene pubblicata.
# L'italiano, che nel repository e' il sorgente scritto a mano, viene
# pubblicato come tutte le altre lingue, in it/.
if [ -f "$CO2/en/index.html" ]; then
  cp "$CO2/en/index.html" "$CO2/en/feedback.html" "$BUILD_DIR/"
else
  err "manca co2-info/en/index.html: lancia co2-info/build.py prima di pubblicare"
  exit 1
fi
for L in it es fr zh; do
  [ -d "$CO2/$L" ] && cp -R "$CO2/$L" "$BUILD_DIR/"
done
# La CER: pagine statiche, si copiano cosi' come sono.
cp -R "$SRC_DIR/cer" "$BUILD_DIR/cer"
# Ocean Earth: nella build vanno solo la pagina e il codice (pochi KB). I dati
# (GB di fotogrammi, generati da ocean-earth/pipeline e fuori dal repository)
# si sincronizzano a parte, direttamente dalla loro cartella, piu' sotto.
OE_DATA="$SRC_DIR/ocean-earth/data"
if [ -f "$SRC_DIR/ocean-earth/index.html" ]; then
  mkdir -p "$BUILD_DIR/atlante" "$BUILD_DIR/ocean-earth"
  cp -R "$SRC_DIR/ocean-earth/index.html" "$SRC_DIR/ocean-earth/app" "$BUILD_DIR/atlante/"
  # i dati restano dove la chiave di arm_php puo' scriverli (/ocean-earth/data/)
  sed -i 's|<meta name="data-base" content="data/">|<meta name="data-base" content="/ocean-earth/data/">|; s|<link rel="preload" href="data/manifest.json"|<link rel="preload" href="/ocean-earth/data/manifest.json"|' "$BUILD_DIR/atlante/index.html"
  grep -q 'content="/ocean-earth/data/"' "$BUILD_DIR/atlante/index.html" || { err "atlante: percorso dei dati non sostituito"; exit 1; }
  # il vecchio indirizzo porta al nuovo, con parametri e ancora
  cat > "$BUILD_DIR/ocean-earth/index.html" <<'RINVIO'
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>Atlante del clima · CO₂·info</title>
<link rel="canonical" href="__ROOT__/atlante/">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=/atlante/">
<script>location.replace('/atlante/' + location.search + location.hash);</script>
</head>
<body><p>Ocean Earth ora si chiama <a href="/atlante/">Atlante del clima</a>.</p></body>
</html>
RINVIO
fi

# I sorgenti tengono un placeholder perche' l'URL pubblico lo decide il deploy,
# non il repository.
ESCAPED_URL="${PUBLIC_URL//\//\\/}"
# Un solo segnaposto, __ROOT__, in tutte le pagine: la radice inglese e le
# altre lingue generate da build.py in it/, es/, fr/, zh/.
while IFS= read -r f; do
  sed -i.bak "s/__ROOT__/${ESCAPED_URL}/g" "$f"
done < <(find "$BUILD_DIR" -name '*.html' -o -name 'robots.txt')
find "$BUILD_DIR" -name '*.bak' -delete

cat > "$BUILD_DIR/sitemap.xml" <<SITEMAP
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
$(for L in "" it/ es/ fr/ zh/; do
cat <<UNA
  <url>
    <loc>${PUBLIC_URL}/${L}</loc>
    <lastmod>$(date -u +%Y-%m-%d)</lastmod>
    <changefreq>monthly</changefreq>
    <priority>$([ -z "$L" ] && echo 1.0 || echo 0.9)</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${PUBLIC_URL}/"/>
    <xhtml:link rel="alternate" hreflang="it" href="${PUBLIC_URL}/it/"/>
    <xhtml:link rel="alternate" hreflang="es" href="${PUBLIC_URL}/es/"/>
    <xhtml:link rel="alternate" hreflang="fr" href="${PUBLIC_URL}/fr/"/>
    <xhtml:link rel="alternate" hreflang="zh" href="${PUBLIC_URL}/zh/"/>
  </url>
UNA
done)
  <url>
    <loc>${PUBLIC_URL}/atlante/</loc>
    <lastmod>$(date -u +%Y-%m-%d)</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
$(for P in cer/ cer/statuto/; do
cat <<UNA
  <url>
    <loc>${PUBLIC_URL}/${P}</loc>
    <lastmod>$(date -u +%Y-%m-%d)</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
UNA
done)
</urlset>
SITEMAP

if grep -rq '__ROOT__' "$BUILD_DIR"; then
  err "Sono rimasti dei placeholder non risolti nella build:"
  grep -rn '__ROOT__' "$BUILD_DIR" >&2
  exit 1
fi
ok "Build pronta ($(du -sh "$BUILD_DIR" | cut -f1))"
if [[ -n "$OUT" ]]; then rm -rf "$OUT"; cp -R "$BUILD_DIR" "$OUT"; ok "Build copiata in $OUT"; exit 0; fi

# ── 3. Trasferimento ────────────────────────────────────────────────────────
RSYNC_OPTS=(-az --human-readable --itemize-changes --omit-dir-times --no-perms)
[[ $PRUNE -eq 1 ]] && RSYNC_OPTS+=(--delete)
[[ $APPLY -eq 1 ]] || RSYNC_OPTS+=(--dry-run)

if [[ $APPLY -eq 1 ]]; then
  info "Creo la destinazione se non esiste: $SSH_HOST:$DEST"
  ssh "$SSH_HOST" "mkdir -p '$DEST'"
else
  warn "DRY-RUN: nessun file verra' scritto. Aggiungi --apply per pubblicare."
fi

info "Sincronizzo verso $SSH_HOST:$DEST"
# i dati di Ocean Earth non sono nella build: --delete non deve toccarli
rsync "${RSYNC_OPTS[@]}" --exclude '/ocean-earth/data/' "$BUILD_DIR"/ "$SSH_HOST:$DEST/"

# ── 4. Dati di Ocean Earth ──────────────────────────────────────────────────
# Prima i fotogrammi, poi il manifest: chi apre la pagina durante il
# trasferimento non trova mai un istante elencato e non ancora arrivato.
# Indici e log della pipeline restano in locale.
if [[ $OE_DATA_SYNC -eq 0 ]]; then
  info "Ocean Earth: i dati li pubblica arm_php ogni giorno, qui non si toccano (--oe-data per forzare)"
elif [ -f "$OE_DATA/manifest.json" ]; then
  info "Ocean Earth: sincronizzo i dati ($(du -sh "$OE_DATA" | cut -f1) in locale)"
  [[ $APPLY -eq 1 ]] && ssh "$SSH_HOST" "mkdir -p '$DEST/ocean-earth/data'"
  OE_OPTS=(-a --human-readable --omit-dir-times --no-perms --exclude '/index/' --exclude '/logs/' --exclude '*.tmp.*')
  [[ $PRUNE -eq 1 ]] && OE_OPTS+=(--delete)
  [[ $APPLY -eq 1 ]] || OE_OPTS+=(--dry-run --stats)
  rsync "${OE_OPTS[@]}" --exclude '/manifest.json' "$OE_DATA"/ "$SSH_HOST:$DEST/ocean-earth/data/" | tail -n 20
  rsync "${OE_OPTS[@]}" "$OE_DATA/manifest.json" "$SSH_HOST:$DEST/ocean-earth/data/manifest.json"
else
  warn "Ocean Earth: nessun manifest in $OE_DATA, i dati non vengono pubblicati (lancia ocean-earth/pipeline/update.sh)"
fi

if [[ $APPLY -eq 1 ]]; then
  ok "Pubblicato"
  info "URL: $PUBLIC_URL/"
  info "Verifica: curl -sI $PUBLIC_URL/ | head -1"
else
  echo ""
  warn "Era un dry-run. Per pubblicare davvero:"
  echo "  $0 --dest '$DEST' --url '$PUBLIC_URL' --apply"
fi
