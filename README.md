# Il carbonio che resta

Sito statico a pagina singola sul bilancio globale del carbonio: quanta CO₂
emettiamo, quanta ne assorbono oceani e vegetazione, e perché nella curva di
Mauna Loa se ne vede solo la metà.

È nata per verificare una presentazione esistente ed è diventata lei la
presentazione: ogni numero è accompagnato dalla fonte e dall'incertezza.

## Struttura

```
sites/carbonio/
├── publish.sh          deploy.sh con destinazione e URL del server e8 incorporati
├── index.html          pagina unica, undici sezioni con ancore
├── 404.html
├── robots.txt
├── deploy.sh           pubblicazione su arch_php via rsync/ssh
└── assets/
    ├── style.css       token di tema chiaro/scuro, layout, stampa
    ├── charts.js       i sette grafici SVG + i dati di riserva incorporati
    ├── slides.js       navigazione a slide: frecce a schermo, tastiera, tocco
    ├── live.js         lettura in diretta da NOAA, con fallback
    └── favicon.svg
```

## Aggiornamento automatico

`live.js` ha due blocchi indipendenti, cosi' un guasto su un fronte non
travolge l'altro:

- **CO₂** — da NOAA Global Monitoring Laboratory: medie annue di Mauna Loa,
  tasso di crescita e serie mensile. Quando la lettura riesce la curva usa le
  medie mensili *misurate* invece della stagionalita' ricostruita, e lo zoom
  sugli ultimi dieci anni (`#recente`) prende mensili, destagionalizzata e
  tassi di crescita dallo stesso download.
- **Temperatura e altri gas** — anomalia globale da NOAA NCEI
  (climate-at-a-glance), metano e protossido da NOAA GML.

Tutte queste fonti servono i dati con `Access-Control-Allow-Origin: *`, quindi
il browser li prende direttamente: niente build, niente chiave, niente proxy.

Due dettagli che costano un debug se si dimenticano:

- NCEI risponde **404** se l'anno finale dell'intervallo e' nel futuro, percio'
  l'URL si costruisce con l'anno corrente e ripiega su quello prima.
- NCEI pubblica sulla base **1901–2000**, mentre l'obiettivo di 1,5 °C si
  riferisce alla media **1850–1900**. Lo scarto (−0,169 °C) viene ricalcolato
  dalla serie letta, non tenuto come costante.

Lo zoom `#recente` e' l'unico grafico alimentato da **entrambi** i blocchi:
il primo gli passa CO₂ mensile e tassi di crescita, il secondo la temperatura.
`drawRecent(monthly, gr, temp)` conserva l'ultimo valore ricevuto per ciascun
argomento (`null` = "tieni quello che hai"), cosi' l'ordine di arrivo non conta.

Il budget residuo per 1,5 °C non e' una lettura ma una **sottrazione**: 170
GtCO₂ all'1/1/2026 (Global Carbon Budget 2025) meno il tempo trascorso per 42,2
GtCO₂/anno. Si aggiorna da solo col passare dei giorni; l'incertezza sul valore
di partenza resta ampia ed e' dichiarata nel testo.

Il pallino nella striscia ha tre stati: **verde** se tutto e' stato letto in
diretta, **blu** se solo una parte, **ocra** se valgono i valori di riserva.

La regola che governa il modulo: **un valore che arriva dalla rete non deve mai
poter peggiorare la pagina.** I numeri incorporati in `charts.js` sono gia'
corretti e gia' disegnati quando `live.js` parte. Se il fetch fallisce, se il
formato cambia, o se il valore letto e' implausibile (serie troppo corta, buchi
negli anni, concentrazione fuori da una finestra plausibile rispetto al dato
incorporato), non si tocca niente e la nota dichiara la data del dato di riserva.

Senza JavaScript la pagina resta corretta: i valori di riserva sono nell'HTML e
le quattro tabelle contengono tutti i numeri. I sette grafici invece sono disegnati
da `charts.js` e non compaiono.

Il bilancio del Global Carbon Budget non e' automatizzato apposta: esce una volta
l'anno a novembre, e un parser che si rompe in silenzio servendo numeri vecchi
come se fossero freschi sarebbe peggio di un aggiornamento fatto a mano.

Nessuna build, nessuna dipendenza npm. L'unica risorsa esterna sono i font
Google (Archivo, Source Serif 4, IBM Plex Mono), che degradano su stack di
sistema se il CDN non è raggiungibile.

## Sviluppo locale

```bash
cd sites/carbonio
python3 -m http.server 8100
# poi apri http://localhost:8100
```

## Pubblicazione

`deploy.sh` va lanciato **dalla macchina locale**, non da dentro un container:
usa l'alias SSH `arch_php` di `~/.ssh/config`, lo stesso che usa
`scripts/deploy/sync-to-arch.sh`.

L'URL pubblico non è scritto nei sorgenti: `index.html` e `robots.txt` tengono
un placeholder `__CANONICAL__` che il deploy risolve al momento della
pubblicazione, e il `sitemap.xml` viene generato lì.

```bash
# 1. prova a vuoto: mostra cosa cambierebbe, non scrive niente
./deploy.sh --dest /srv/niccoweb/carbonio --url https://esempio.it/carbonio

# 2. pubblica davvero
./deploy.sh --dest /srv/niccoweb/carbonio --url https://esempio.it/carbonio --apply

# 3. rimuove anche i file orfani rimasti sul server
./deploy.sh --dest ... --url ... --apply --prune
```

Il dry-run è il comportamento predefinito proprio perché `--dest` punta a una
docroot: serve `--apply` esplicito per scrivere, e `--delete` arriva solo con
`--prune`.

## Dati e fonti

- **Global Carbon Budget 2025** (Global Carbon Project, COP30, 13 novembre 2025) — fonti e pozzi, medie 2015–2024
- **NOAA Global Monitoring Laboratory** — Mauna Loa dal 1958 e media globale, letti in diretta
- **Our World in Data** — emissioni pro capite e cumulative
- **IPCC AR6 e IEA** — livelli preindustriali dei gas; ripartizione per uso finale

Conversione usata ovunque: `1 ppm = 2,124 GtC = 7,78 GtCO₂`, `1 GtC = 3,664 GtCO₂`.

Due misure da non confondere, ed è l'errore in cui era caduta la versione
precedente di questa pagina:

- il **tasso di crescita** NOAA è l'aumento fra il 1° gennaio e il 31 dicembre
  sulla curva destagionalizzata; la **differenza fra medie annue** è un'altra
  cosa e dà numeri diversi (2024: 3,33 contro 3,53);
- **Mauna Loa non è il pianeta.** È un osservatorio; la media globale pesa
  stazioni marine remote pesate per latitudine. Nel 2024 danno 3,33 e 3,76 ppm.

Quando `live.js` riesce a leggere NOAA, la curva usa le **medie mensili
misurate**. Se non ci riesce, ricade sulla stagionalità ricostruita dalle medie
annue: va bene per la forma della curva, non per leggerci un singolo mese.

Il bilancio non chiude: lo squilibrio residuo è una voce pubblicata dal Global
Carbon Budget, e nel 2024 ha toccato −1,7 GtC (−6 GtCO₂), il valore più negativo della serie.
La pagina lo mostra invece di nasconderlo, e disegna sotto ogni voce del
diagramma di flusso il **baffo di incertezza** alla stessa scala dei blocchi:
il pozzo terrestre vale 8,7 GtCO₂ ma è noto entro ±2,9, l'oceanico entro ±1,5.

Lo zoom sugli **ultimi dieci anni** mette tre pannelli sullo stesso asse dei
tempi: concentrazione mensile, crescita annua (barre) e temperatura globale.
Tre pannelli e non un doppio asse, di proposito: due scale sovrapposte si
possono sempre stirare per far coincidere qualsiasi coppia di curve. Il punto
del grafico e' che gli anni caldi (2016, 2023, 2024) sono quelli in cui la CO₂
cresce di piu', per la stessa causa (El Niño indebolisce il pozzo terrestre).

La curva **controfattuale** somma al valore del 1959 tutte le emissioni cumulate
da allora (serie storica del GCB 2025, 2,124 GtC per ppm): senza pozzi saremmo a
574 ppm invece di 427. È un confronto contabile, non una simulazione climatica,
e la didascalia lo dichiara.

## Numeri del bilancio: da dove prenderli

Le medie 2015–2024 del bilancio (hero, sezione «Dove finisce», tabella a
scomparsa, sintesi) vengono dal CSV storico del Global Carbon Budget 2025
(`openclimatedata.github.io/global-carbon-budget/data/global-carbon-budget-2025-historical-budget.csv`),
colonne in GtC moltiplicate per 3,664. Convenzione: fossili al netto della
carbonatazione del cemento, come nei valori di testata del paper. Non
trascrivere i numeri a memoria dagli articoli: la revisione del 13 settembre
2026 ha trovato quattro errori nati esattamente così.

Il budget residuo per 1,5 °C (170 GtCO₂) è contato **dall'inizio del 2026**
(`BUD_FROM` in `live.js`). I dati per paese (sezioni «Chi emette», «La
crescita», «Kyoto») sono OWID/GCB 2025, anno 2024, al lordo della
carbonatazione: vanno aggiornati a mano a ogni edizione del GCB.

## Navigazione a slide

Ogni sezione occupa almeno una schermata (`min-height: 100svh`) e si aggancia
in alto con `scroll-snap`. `slides.js` aggiunge i comandi senza toccare il
documento: frecce in basso a destra con contatore e titolo, barra di
avanzamento sotto la barra di navigazione, e da tastiera:

- `←` `→` `PagSu` `PagGiù` `Home` `Fine` sfogliano sempre una sezione alla volta;
- `↑` `↓` e spazio scorrono *dentro* una sezione più alta dello schermo e
  passano alla successiva solo quando quella corrente è finita, così non si
  salta nulla;
- su schermo tattile uno scorrimento orizzontale deciso cambia sezione (non
  dentro tabelle e grafici scorrevoli, che hanno il loro scroll).

L'hash nell'URL segue la sezione corrente, quindi i link di ancoraggio e la
barra di navigazione in alto continuano a funzionare. Con JavaScript spento la
pagina è un documento normale, solo con sezioni alte una schermata.

Sopra i 1000 px la prosa va su **due colonne**: la riga resta entro la misura
leggibile ma la sezione si accorcia, e più contenuto entra in una schermata.

## Accessibilità

La palette dei grafici è verificata per protanopia e deuteranopia e per il
contrasto sulle superfici di entrambi i temi. Le serie non sono mai distinte
dal solo colore: ogni segmento ha l'etichetta diretta, la deforestazione usa il
tratteggio, e ogni grafico ha la tabella con gli stessi numeri.
