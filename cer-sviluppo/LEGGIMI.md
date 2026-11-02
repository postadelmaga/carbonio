# Sviluppo del simulatore della CER

Questa cartella non si pubblica: `deploy.sh` copia sul server solo `cer/`. Contiene lo script che prepara i dati del
simulatore (`strumenti/prepara_dati.py`) e le prove del motore (`test/`).

## Provare il motore

Dalla radice del repo:

    node --test cer-sviluppo/test/*.test.mjs

## Preparare i dati

    uv run cer-sviluppo/strumenti/prepara_dati.py

Scarica l'elenco ISTAT dei comuni, le coordinate da Wikidata, le serie PVGIS dei capoluoghi e lo zip ARERA dei profili
domestici; tiene le risposte in `../cache-simulatore-cer/` (fuori dal repo) e scrive `cer/simulatore/dati/`.

## Vedere la pagina in locale

    python3 -m http.server 8100 --bind 127.0.0.1

poi http://127.0.0.1:8100/cer/simulatore/. Da Claude Code il server va lanciato fuori dalla sandbox, perché il browser
gira fuori e non vede un server avviato dentro.
