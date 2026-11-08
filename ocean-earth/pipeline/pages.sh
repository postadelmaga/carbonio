#!/usr/bin/env bash
# Pubblica data/ su Cloudflare Pages (progetto co2-info-atlas →
# https://co2-info-atlas.pages.dev/): CDN con banda gratuita, cosi' i
# fotogrammi non escono dal server Oracle (~2 MB/s).
#
# Su arm_php, dopo validate.py (lo chiama auto.sh). Serve:
#   ~/.cloudflare-pages   CLOUDFLARE_API_TOKEN=… e CLOUDFLARE_ACCOUNT_ID=…
#                         (token con il solo permesso Account · Cloudflare Pages · Edit;
#                         chmod 600, MAI nel repository)
#   ~/cf/node, ~/cf/node_modules/.bin/wrangler   Node 20 e wrangler 3, locali
#
# Il deploy di Pages e' atomico: fotogrammi e manifest cambiano insieme, e
# wrangler carica solo i file che il progetto non ha gia'. Limite del piano
# gratuito: 20.000 file per deploy (8 nov 2026: ~15.000).
set -euo pipefail
cd "$(dirname "$0")/.."
CF="$HOME/cf"
SITE="$CF/site"
export PATH="$CF/node/bin:$PATH" WRANGLER_SEND_METRICS=false
set -a; . "$HOME/.cloudflare-pages"; set +a

# copia con link fisici (niente spazio in piu'), senza log, indici e file a meta'
rsync -a --delete --link-dest="$PWD/data/" \
  --exclude '/logs/' --exclude '/index/' --exclude '*.tmp.*' --exclude '/_headers' \
  data/ "$SITE/"
n=$(find "$SITE" -type f | wc -l)
if [ "$n" -gt 19500 ]; then
  echo "pages: $n file, troppo vicino al limite di 20.000 per deploy" >&2
  exit 1
fi
# come il server Oracle: nessuna cache del browser (la pagina tiene la sua in
# Cache Storage, versionata dal manifest), e lettura da un'altra origine
cat > "$SITE/_headers" <<'EOF'
/*
  Access-Control-Allow-Origin: *
  Cache-Control: no-cache
EOF
"$CF/node_modules/.bin/wrangler" pages deploy "$SITE" --project-name co2-info-atlas \
  --branch main --commit-dirty=true --commit-message "dati $(date -u +%FT%TZ)" 2>&1 | tail -n 3
echo "pages: $n file pubblicati"
