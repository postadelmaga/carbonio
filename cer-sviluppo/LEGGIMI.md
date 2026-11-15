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

    python3 cer-sviluppo/strumenti/servi.py

poi http://127.0.0.1:8100/cer/simulatore/ (l'indirizzo lo stampa il server; un'altra porta come argomento). Il server
manda «Cache-Control: no-cache», come il sito pubblicato su /cer/: il browser riconvalida ogni file a ogni caricamento
e non mescola moduli vecchi e nuovi. Con `python3 -m http.server`, che non manda istruzioni di cache, serve un
ricaricamento senza cache (ctrl+shift+r) dopo ogni modifica. Da Claude Code il server va lanciato fuori dalla sandbox,
perché il browser gira fuori e non vede un server avviato dentro.

## Confronto con cersim

`test/confronto_cersim.mjs` confronta il motore del sito con `cersim` (repo privato) sul caso `la_spezia_riparto`:
condivisa, condivisa per impianto, tariffa, contributo, riparto per soggetto e quota alla CER. Serve una cartella di
uscita di `cersim esegui`:

    CERSIM_USCITA=<cartella> node cer-sviluppo/test/confronto_cersim.mjs

Senza la variabile la prova si salta. Il motore riceve i prelievi e le immesse di `cersim`, con gli impianti fuori dai
POD. A parità di questi ingressi il confronto esclude errori del motore su condivisa totale e per impianto (con
l'ordine di anzianità), tariffa con il tetto attivo e il correttivo del Nord, contributo ARERA, corrispettivi del GSE e
κ, riparto per soggetto e quota alla CER.

Non esercita:

- la quota eccedentaria, nulla nel caso (la condivisa è il 21,7% dell'immessa degli impianti incentivati, contro una
  soglia del 55%);
- la parte variabile della tariffa, perché il tetto è sempre attivo (con un prezzo zonale di 50 €/MWh il confronto passa
  lo stesso);
- il calcolo dell'anzianità da una data, perché l'impianto esistente è indicato nello script.

Le righe di FV2 (tariffa) e di S_R3 (riparto) valgono zero in entrambi e non provano nulla. L'eccedentaria e la parte
variabile della tariffa si provano in `test/economia.test.mjs`, sui valori della spec. Il confronto non dice nulla
sulle semplificazioni dichiarate.
