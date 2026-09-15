# The carbon that stays

**English** · [Italiano](README.it.md) · [Español](README.es.md) · [中文](README.zh.md)

A single-page site about the global carbon budget: how much CO₂ we emit, how
much the oceans and vegetation absorb, and why the Mauna Loa curve shows only
half of it.

**→ [co2-info.duckdns.org](https://co2-info.duckdns.org/)** — also in
[English](https://co2-info.duckdns.org/en/),
[Spanish](https://co2-info.duckdns.org/es/) and
[Chinese](https://co2-info.duckdns.org/zh/)

It was born to fact-check an existing slide deck and ended up replacing it.
Every number carries its source and its uncertainty.

## What is unusual about it

- **It reads its own data.** The CO₂ curve, the growth rate and the
  temperature series are fetched from NOAA at every load. If the network is
  down the page shows values baked into the HTML and says so with a coloured
  dot, instead of pretending.
- **Every figure declares what kind of number it is**: `observed`,
  `observed and estimated`, `estimate`, `preliminary estimate`. A measurement
  and a model are not the same thing, and the page does not blur them.
- **It corrects itself in public.** The revision log at the bottom lists what
  changed and why, including the times the page itself was wrong.
- **No build to serve it, no cookies, no third-party requests** beyond the
  fonts and the visit counter. Fifteen screens, fourteen sections, eight
  charts drawn as inline SVG.

## Contributing

This is the useful part. If you find:

- **a wrong number** — the most valuable report of all. The revision log is
  made of these;
- **a better source**, or a more recent edition of one already used;
- **a sentence that claims more than the data support** — the page tries hard
  to avoid this and does not always succeed;
- a translation that reads badly in your language;

please [open an issue](https://github.com/postadelmaga/carbonio/issues), or
write on the [board](https://co2-info.duckdns.org/feedback.html) if you would
rather not have a GitHub account. Every section also carries a two-question
row, "was it useful?" and "is it clear?", which is the cheapest way to tell me
where the page is failing.
Pull requests are welcome too. Two rules: never transcribe a figure from an
article, go to the primary source; and if you change the Italian text,
regenerate the translations (`./build.py --extract`, translate, `./build.py`).

## How it is built

Plain HTML, CSS and JavaScript. No framework, no dependencies, nothing to
compile in order to serve it.

```
.
├── index.html          the page, in Italian: the only hand-written copy
├── en/ es/ zh/         generated translations: do not edit by hand
├── i18n/               one dictionary per language + the extracted keys
├── build.py            generates the translated pages from the Italian source
├── publish.sh          deploy.sh with destination and public URL filled in
├── deploy.sh           publishing over rsync/ssh
├── 404.html  robots.txt
└── assets/
    ├── style.css       light/dark tokens, layout, print
    ├── charts.js       the eight SVG charts + the embedded fallback data
    ├── slides.js       slide navigation: on-screen arrows, keyboard, touch
    ├── live.js         live reading from NOAA, with fallback
    └── favicon.svg
```

```bash
python3 -m http.server 8100     # then open http://localhost:8100
./build.py                      # regenerate en/, es/, zh/
./publish.sh --apply            # publish
```

The details — where each number comes from, how the translation pipeline
works, how the server chooses the language, what was measured and rejected —
are in **[MAINTENANCE.md](MAINTENANCE.md)**.

## Sources

- **Global Carbon Budget 2025** (Global Carbon Project, COP30, 13 November 2025) — sources and sinks, 2015–2024 averages
- **NOAA Global Monitoring Laboratory** — Mauna Loa since 1958 and the global mean, read live
- **NOAA Paleoclimatology** — Bereiter et al. 2015, 800,000 years of CO₂ from Antarctic ice cores
- **IPCC AR6** — palaeoclimate reference periods; pre-industrial levels of the greenhouse gases
- **Our World in Data** — emissions by country, per person and cumulative
- **UNEP Emissions Gap Report 2025** — world total of all greenhouse gases
- On military and war emissions: SGR and CEOBS; the Initiative on GHG
  Accounting of War; Neimark et al. in One Earth; the Climate and Community
  Institute

Conversion used throughout: `1 ppm = 2.124 GtC = 7.78 GtCO₂`,
`1 GtC = 3.664 GtCO₂`.

## Licence

- **Code** — [MIT](LICENSE): `assets/*.js`, `style.css`, `build.py`, the
  deploy scripts, the HTML structure.
- **Text, charts and translations** — [CC BY 4.0][cc]: reuse them, adapt them,
  sell them if you like, as long as you say where they come from and whether
  you changed anything.
- **The data are not ours.** They belong to NOAA, the Global Carbon Project,
  Our World in Data, the IPCC, UNEP and the research groups cited on the page.
  Cite the primary source, not this repository.

Details in [LICENSE-CONTENT.md](LICENSE-CONTENT.md).

[cc]: https://creativecommons.org/licenses/by/4.0/
