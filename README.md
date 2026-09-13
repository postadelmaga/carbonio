# Il carbonio che resta

Sito statico a pagina singola sul bilancio globale del carbonio: quanta CO₂
emettiamo, quanta ne assorbono oceani e vegetazione, e perché nella curva di
Mauna Loa se ne vede solo la metà.

È nata per verificare una presentazione esistente ed è diventata lei la
presentazione: ogni numero è accompagnato dalla fonte e dall'incertezza.

## Struttura

```
.
├── publish.sh          deploy.sh con destinazione e URL pubblico incorporati
├── index.html          pagina unica, tredici sezioni con ancore
├── 404.html
├── robots.txt
├── deploy.sh           pubblicazione su arch_php via rsync/ssh
└── assets/
    ├── style.css       token di tema chiaro/scuro, layout, stampa
    ├── charts.js       gli otto grafici SVG + i dati di riserva incorporati
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
python3 -m http.server 8100
# poi apri http://localhost:8100
```

## Pubblicazione

`deploy.sh` va lanciato **dalla macchina locale**, non da dentro un container:
usa l'alias SSH `arch_php` di `~/.ssh/config`.

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

I numeri della sezione «Quanto pesano le guerre» sono tutti a mano e vanno
da tre fonti diverse, con cadenze diverse. Impronta degli eserciti in tempo
di pace: 2 750 MtCO₂e l'anno, forchetta 1 600–3 500, da Parkinson e Cottrell
(SGR e CEOBS, novembre 2022); la cifra è ancora la loro stima corrente, il
seguito del settembre 2025 aggiunge solo l'effetto della spesa in aumento.
Ucraina: l'Initiative on GHG Accounting of War pubblica un aggiornamento
**ogni febbraio** sull'anniversario dell'invasione, l'ultimo è il quarto anno
(311,4 MtCO₂e). Israele-Gaza: Neimark et al., One Earth, marzo 2026 (1,3
MtCO₂e di operazioni, 33,2 con barriere e ricostruzione). Iran: stima
preliminare del Climate and Community Institute con QMUL e Lancaster, marzo
2026, 5,1 MtCO₂e nelle prime due settimane, scomposta in cinque voci — è
quella che regge il messaggio della sezione, quindi se esce la versione
rivista va sostituita. Contorno (incendi nei paesi in conflitto, Siria,
pozzi del Kuwait 1991): CEOBS. Attenzione al
periodo quando si aggiorna: nel grafico la prima barra è un anno, le altre
sono totali di conflitto, ed è l'errore più facile da introdurre.

## I numeri del paleoclima

La sezione «L'ultima volta che l'aria era così» usa tre fonti distinte, e la
distinzione è il punto della sezione:

- **Carote di ghiaccio**, misura diretta dell'aria antica: composito degli
  800 mila anni di Bereiter et al. 2015, scaricato da NOAA Paleoclimatology
  (`ncei.noaa.gov/pub/data/paleo/icecore/antarctica/antarctica2015co2composite.txt`).
  La serie è incorporata in `charts.js` come `ICE`, ridotta da 1901 a 718
  punti conservando massimi e minimi: a 880 unità di larghezza un pixel vale
  circa mille anni, oltre non serve. Si ferma al 1958, poi il grafico
  prosegue con le stesse medie annue di Mauna Loa degli altri grafici, quindi
  la punta si aggiorna da sola con la lettura NOAA in diretta.
- **IPCC AR6**, riquadro 2.4 del capitolo 2, per i periodi di riferimento:
  ultimo massimo glaciale, ultimo interglaciale, Pliocene, Miocene, con
  temperatura rispetto al 1850–1900 e livello del mare. Il Pliocene è
  +2,5 a +4 °C e +5 a +25 m, non «+5 °C e +35 m»: sono valori di equilibrio
  raggiunti in millenni e la pagina lo dice esplicitamente, perché senza
  quella riga il confronto diventa una previsione che nessuno ha fatto.
- **Hönisch et al., Science 2023** (CenCO2PIP) per la scala oltre il
  ghiaccio: l'ultima volta a questi livelli è circa 14 milioni di anni fa.
  Il numero «3 milioni di anni», molto diffuso, viene da ricostruzioni
  precedenti a questa revisione: non usarlo.

## Che tipo di numero è: le etichette sulle figure

Ogni figura porta un'etichetta (`<span class="tag …">` dentro `.fig-head`)
che dichiara la natura del dato, così il lettore non deve fidarsi del tono
del testo:

| Etichetta | Classe | Dove |
|---|---|---|
| `osservato` | `.tag-obs` | misure e inventari: Mauna Loa, temperatura, per paese, crescita, Kyoto |
| `osservato e stimato` | `.tag-obs` | il bilancio globale: fossili da inventari, i due pozzi da modelli |
| `stima` | `.tag-est` | calcoli e modelli: il controfattuale senza pozzi, le guerre |
| `stima preliminare` | `.tag-prel` | non ancora passato da una rivista: oggi solo il pannello sull'Iran |

**Niente semaforo verde-giallo-rosso.** I pallini colorati dei riquadri dei
dati vogliono già dire un'altra cosa (letto ora da NOAA, in parte, valori
salvati), e due codici a colori nella stessa pagina si confondono. Qui
distingue la parola, e il bordo fa il resto: continuo, tratteggiato,
tratteggiato ocra. Se aggiungi una figura, aggiungi l'etichetta.

Regole di prudenza applicate nel testo, da non far regredire: il limite di
1,5 °C non «si misura sulla media di un decennio» (l'Accordo non prescrive
quanti anni, la pagina ne usa dieci, l'IPCC venti); il budget residuo è una
probabilità del 50%, non una data; di Kyoto si dice che non ha invertito la
crescita delle emissioni, non che il suo effetto è «nullo»; ridurre
«rallenta la salita», non «non basta»; e nei totali delle guerre parte è
ricostruzione futura, non ancora emessa (73 su 311 in Ucraina, 31 su 33 a
Gaza).

## Una slide, un'idea

Ogni sezione tiene in vista un messaggio, una figura e un blocco di testo
corto. Tutto il resto (tabelle, cronologie, note metodologiche, secondi
paragrafi) sta in un `<details class="more">` con etichetta «Approfondisci:
…», chiuso di default: resta a un clic, non pesa sulla prima lettura e non
entra nel conteggio delle schermate. Se aggiungi contenuto a una sezione,
mettilo lì, non nel corpo. I grafici sono limitati a poco meno di metà schermo in altezza.

Sopra i 1100px di larghezza le sezioni con classe `slide` sono una griglia a
due colonne: titolo e sommario in cima a tutta larghezza, la figura in
`.slide-main` a sinistra, il testo di accompagnamento (riquadro dei dati in
diretta, callout) in `.slide-side` a destra, e il `<details>` in fondo a tutta
larghezza. Così a 1440×900 ogni sezione sta in una schermata; sotto gli 820px
di altezza scatta una variante più compatta (meno margini, corpo più piccolo).
Sotto i 1100px tutto torna in colonna nell'ordine del documento. L'apertura
è la stessa cosa: titolo e sommario a sinistra, le quattro cifre in un
riquadro a destra. «Chi emette» è una figura sola con tre pannelli affiancati.

Sul telefono (sotto i 640px) `charts.js` disegna i grafici su 460 unità
invece di 880 (`NARROW`, `CHART_W`): più stretti e più alti, con etichette
accorciate, così entrano nello schermo senza scorrere in orizzontale. La
scelta è fatta al caricamento e non cambia alla rotazione. Le barre HTML
tengono etichetta, barra e valore su una riga sola dove i valori sono corti.
Sempre sotto i 640px: la coda dei sottotitoli dei grafici (`<span
class="fs-more">`) si apre con un pulsante «Come leggerlo» aggiunto da
`slides.js`; i blocchi `.m-only` esistono solo sul telefono e `.d-only` solo
sul desktop (il limite di Parigi è callout sul telefono e didascalia sul
desktop); la pillola delle frecce sta in basso a destra e sparisce mentre si
scorre.
Sul telefono la barra in alto tiene solo il marchio, il pulsante del tema e
un menu a hamburger con le voci (`.nav-links`, aperto con `.nav.is-open`);
ha lo sfondo sfocato, sparisce scorrendo in giù e torna scorrendo in su, con
le frecce o scegliendo una voce, così la sezione atterra sotto la barra.
Sul telefono il tema parte scuro (schermo fino a 640px o puntatore a dito),
a meno che il lettore non abbia già scelto con il pulsante: la scelta è in
`localStorage` («tema») e vale per tutte le visite successive.

## Dominio

Il sito sta su **https://co2-info.duckdns.org/** (sottodominio DuckDNS che
punta a 150.230.157.31). Sul server è il blocco `(carbonio_site)` del
Caddyfile, che serve il mount `/srv/carbonio` alla radice del nome preso da
`CO2_SERVER_NAME` nel compose, con blocco `http://` e `https://` come per e8
perché i nameserver di DuckDNS rispondono a intermittenza. Il vecchio
indirizzo `https://e8-zdemo.duckdns.org/carbonio/` rimanda qui con un 308,
percorso per percorso.

## Statistiche di visita

La pagina carica lo script di [Umami](https://cloud.umami.is) (piano
gratuito, senza cookie, nessun dato personale): pagine viste, paese,
referrer, browser e dispositivo, con mappa e tempo reale nel pannello. Il
`data-website-id` è nello `<script>` in `index.html` e `404.html`; per
cambiare account o sito basta sostituirlo. Umami ignora le visite da `localhost`,
quindi in locale non si vede nulla: è normale.

## Prestazioni dello scorrimento

La pillola delle frecce e la barra di avanzamento sono `position:fixed` e
cambiano mentre si scorre (opacità, testo «parte 1 di 2», avanzamento).
Senza un layer proprio ogni cambio ridipingeva l'intero documento, e sul
telefono lo scorrimento andava a scatti: per questo hanno `will-change:
transform`, la barra avanza con `transform:scaleX` e non con `width`, e
`slides.js` scrive nel DOM solo quando un valore cambia davvero. Con Chrome
in tempo reale (puppeteer, 390×844, CPU rallentata 4×, 60 passi di scroll)
il paint è passato da 700–1100 ms a circa 100 ms e il layout da 80–100 ms a
9 ms. `content-visibility:auto` sulle sezioni è stato provato e scartato:
riduce il paint ma sposta il layout delle sezioni nel momento in cui entrano
in vista, con fotogrammi da 300 ms. Il blur della barra sul telefono è a
10px senza `saturate`: il costo è sulla GPU e non si misura in headless.

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
