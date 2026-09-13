#!/usr/bin/env bash
set -euo pipefail

##############################################################################
# deploy.sh — pubblica il sito statico "Il carbonio che resta" su arch_php
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
##############################################################################

SSH_HOST="arch_php"
DEST=""
PUBLIC_URL=""
APPLY=0
PRUNE=0

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
    -h|--help) sed -n '3,26p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) err "Opzione sconosciuta: $1"; exit 2 ;;
  esac
done

[[ -n "$DEST" ]]       || { err "Manca --dest (docroot sul server remoto)."; exit 2; }
[[ -n "$PUBLIC_URL" ]] || { err "Manca --url (URL pubblico del sito)."; exit 2; }
PUBLIC_URL="${PUBLIC_URL%/}"

# ── 1. Verifica che l'host risponda ─────────────────────────────────────────
info "Verifico l'accesso a $SSH_HOST"
if ! ssh -o BatchMode=yes -o ConnectTimeout=10 "$SSH_HOST" true 2>/dev/null; then
  err "Non riesco a connettermi a '$SSH_HOST' senza password."
  err "Controlla ~/.ssh/config e che la chiave sia caricata (ssh-add -l)."
  exit 1
fi
ok "Host raggiungibile"

# ── 2. Build: copia con i placeholder risolti ───────────────────────────────
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT

info "Preparo la build in $BUILD_DIR"
cp -R "$SRC_DIR/index.html" "$SRC_DIR/404.html" "$SRC_DIR/robots.txt" "$SRC_DIR/assets" "$BUILD_DIR/"

# I sorgenti tengono un placeholder perche' l'URL pubblico lo decide il deploy,
# non il repository.
ESCAPED_URL="${PUBLIC_URL//\//\\/}"
sed -i.bak "s/__CANONICAL__/${ESCAPED_URL}\//g"     "$BUILD_DIR/index.html"
sed -i.bak "s/__CANONICAL_ROOT__/${ESCAPED_URL}/g"  "$BUILD_DIR/robots.txt"
rm -f "$BUILD_DIR"/*.bak

cat > "$BUILD_DIR/sitemap.xml" <<SITEMAP
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${PUBLIC_URL}/</loc>
    <lastmod>$(date -u +%Y-%m-%d)</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
SITEMAP

if grep -rq '__CANONICAL' "$BUILD_DIR"; then
  err "Sono rimasti dei placeholder non risolti nella build:"
  grep -rn '__CANONICAL' "$BUILD_DIR" >&2
  exit 1
fi
ok "Build pronta ($(du -sh "$BUILD_DIR" | cut -f1))"

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
rsync "${RSYNC_OPTS[@]}" "$BUILD_DIR"/ "$SSH_HOST:$DEST/"

if [[ $APPLY -eq 1 ]]; then
  ok "Pubblicato"
  info "URL: $PUBLIC_URL/"
  info "Verifica: curl -sI $PUBLIC_URL/ | head -1"
else
  echo ""
  warn "Era un dry-run. Per pubblicare davvero:"
  echo "  $0 --dest '$DEST' --url '$PUBLIC_URL' --apply"
fi
