# Il carbonio che resta

[English](README.md) · **Italiano** · [Español](README.es.md) · [中文](README.zh.md)

Sito a pagina singola sul bilancio globale del carbonio: quanta CO₂ emettiamo,
quanta ne assorbono oceani e vegetazione, e perché nella curva di Mauna Loa se
ne vede solo la metà.

**→ [co2-info.duckdns.org](https://co2-info.duckdns.org/)** — anche in
[inglese](https://co2-info.duckdns.org/en/),
[spagnolo](https://co2-info.duckdns.org/es/) e
[cinese](https://co2-info.duckdns.org/zh/)

È nato per verificare una presentazione esistente ed è finito col prenderne il
posto. Ogni numero porta con sé la fonte e la sua incertezza.

## Cosa ha di insolito

- **Legge i propri dati.** La curva della CO₂, il tasso di crescita, la serie
  delle temperature e il calore accumulato negli oceani vengono presi da NOAA a
  ogni caricamento. Se la rete non
  risponde la pagina mostra i valori salvati nell'HTML e lo dichiara con un
  pallino colorato, invece di far finta di niente.
- **Ogni figura dichiara che tipo di numero mostra**: `osservato`,
  `osservato e stimato`, `stima`, `stima preliminare`. Una misura e un modello
  non sono la stessa cosa, e la pagina non li confonde.
- **Si corregge in pubblico.** Il registro delle revisioni in fondo elenca cosa
  è cambiato e perché, comprese le volte in cui la pagina aveva torto.
- **Nessuna compilazione per servirla, nessun cookie, nessuna richiesta a
  terzi** oltre ai caratteri e al contatore di visite. Sedici schermate,
  quindici sezioni, nove grafici disegnati come SVG in pagina.

## Collaborare

È la parte utile. Se trovi:

- **un numero sbagliato** — la segnalazione più preziosa di tutte: il registro
  delle revisioni è fatto di queste;
- **una fonte migliore**, o un'edizione più recente di una già usata;
- **una frase che dice più di quanto i dati sostengano** — la pagina prova a
  evitarlo e non sempre ci riesce;
- una traduzione che nella tua lingua suona male;

[apri una segnalazione](https://github.com/postadelmaga/carbonio/issues) o
scrivi sulla [bacheca](https://co2-info.duckdns.org/feedback.html), se preferisci
non avere un account GitHub. Sotto ogni sezione c'è anche una riga con due
domande, «ti è servita?» e «è chiara?»: è il modo più economico per dirmi dove
la pagina non funziona. Anche le proposte di modifica sono benvenute. Due regole: mai trascrivere una cifra
da un articolo, si va alla fonte primaria; e se cambi il testo italiano,
rigenera le traduzioni (`./build.py --extract`, tradurre, `./build.py`).

## Com'è fatto

HTML, CSS e JavaScript scritti a mano. Nessun framework, nessuna dipendenza,
niente da compilare per servirlo.

```
.
├── index.html          la pagina, in italiano: l'unica copia scritta a mano
├── en/ es/ zh/         traduzioni generate: non modificarle a mano
├── i18n/               un dizionario per lingua + le chiavi estratte
├── build.py            genera le pagine tradotte dal sorgente italiano
├── publish.sh          deploy.sh con destinazione e URL pubblico incorporati
├── deploy.sh           pubblicazione via rsync/ssh
├── 404.html  robots.txt
└── assets/
    ├── style.css       token di tema chiaro/scuro, layout, stampa
    ├── charts.js       gli otto grafici SVG + i dati di riserva incorporati
    ├── slides.js       navigazione a slide: frecce, tastiera, tocco
    ├── live.js         lettura in diretta da NOAA, con ripiego
    └── favicon.svg
```

```bash
python3 -m http.server 8100     # poi apri http://localhost:8100
./build.py                      # rigenera en/, es/, zh/
./publish.sh --apply            # pubblica
```

Il dettaglio — da dove viene ogni numero, come funziona la pipeline delle
traduzioni, come il server sceglie la lingua, cosa è stato misurato e scartato
— sta in **[MAINTENANCE.md](MAINTENANCE.md)**, in inglese.

## Fonti

- **Global Carbon Budget 2025** (Global Carbon Project, COP30, 13 novembre 2025) — fonti e pozzi, medie 2015–2024
- **NOAA Global Monitoring Laboratory** — Mauna Loa dal 1958 e media globale, letti in diretta
- **NOAA Paleoclimatology** — Bereiter et al. 2015, 800 mila anni di CO₂ dalle carote antartiche
- **IPCC AR6** — periodi di riferimento del paleoclima; livelli preindustriali dei gas serra
- **Our World in Data** — emissioni per paese, per abitante e cumulative
- **UNEP Emissions Gap Report 2025** — totale mondiale di tutti i gas serra
- Su eserciti e guerre: SGR e CEOBS; Initiative on GHG Accounting of War;
  Neimark et al. su One Earth; Climate and Community Institute

Conversione usata ovunque: `1 ppm = 2,124 GtC = 7,78 GtCO₂`,
`1 GtC = 3,664 GtCO₂`.

## Licenza

- **Codice** — [MIT](LICENSE): `assets/*.js`, `style.css`, `build.py`, gli
  script di pubblicazione, la struttura HTML.
- **Testi, grafici e traduzioni** — [CC BY 4.0][cc]: riusali, adattali,
  vendili pure, a una condizione: dire da dove vengono e se hai cambiato
  qualcosa.
- **I dati non sono nostri.** Sono di NOAA, Global Carbon Project, Our World
  in Data, IPCC, UNEP e dei gruppi di ricerca citati in pagina. Cita la fonte
  primaria, non questo repository.

Il dettaglio in [LICENSE-CONTENT.md](LICENSE-CONTENT.md).

[cc]: https://creativecommons.org/licenses/by/4.0/deed.it
