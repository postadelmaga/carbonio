# Maintenance notes

Everything you need to change a number, add a section, translate it or put it
online. English only: it is the language of whoever ends up running this.
The reader-facing README is in [four languages](README.md).

## Running it

```bash
python3 -m http.server 8100     # then open http://localhost:8100
```

No build step is needed to *serve* the site. A build step is needed to
*translate* it: see below.

## Publishing

```bash
./publish.sh            # dry run: shows what would change, writes nothing
./publish.sh --apply    # publishes
./publish.sh --apply --prune   # also deletes orphan files on the server
```

`publish.sh` wraps `deploy.sh` with the destination and public URL already
filled in, and runs from your own machine over SSH (alias `arch_php` in
`~/.ssh/config`), not from inside a container. The dry run is the default on
purpose: `--dest` points at a docroot.

The public URL is not written in the sources. Every HTML file and `robots.txt`
carry a `__ROOT__` placeholder that the deploy resolves, and `sitemap.xml` is
generated there with all four language versions.

## Where the numbers come from

Never transcribe a figure from an article. Go to the primary source.

**The carbon budget** (opening figures, "Where what we emit ends up", the
table, the summary) comes from the Global Carbon Budget 2025 historical CSV
(`openclimatedata.github.io/global-carbon-budget/data/global-carbon-budget-2025-historical-budget.csv`),
columns in GtC multiplied by 3.664. Convention: fossil fuels net of cement
carbonation, as in the paper's headline values. The 13 September 2026 review
found four numbers that had been transcribed by hand and were wrong.

**The remaining budget for 1.5 °C** (170 GtCO₂) is counted from the start of
2026 (`BUD_FROM` in `live.js`). It is a 50% probability, not a date.

**Country data** ("Who emits", "The growth", "Kyoto") is OWID/GCB 2025 for
2024, gross of carbonation: update by hand with each GCB edition.

**Two measures that must not be confused**, and it is the mistake the earlier
version of this page fell into: the NOAA **growth rate** is the increase
between 1 January and 31 December on the deseasonalised curve; the
**difference between annual means** is a different thing and gives different
numbers (3.33 against 3.53 ppm in 2024). The page always uses the growth rate.
And **Mauna Loa is not the planet**: the global mean comes from marine
stations far from cities, weighted by latitude band. In 2024 the two give
3.33 and 3.76 ppm.

**Palaeoclimate.** Ice cores: Bereiter et al. 2015 composite from NOAA
Paleoclimatology, embedded in `charts.js` as `ICE`, reduced from 1901 to 718
points keeping peaks and troughs (at 880 units wide one pixel is about a
thousand years). It stops at 1958; from there the chart continues with the
Mauna Loa annual means, so the tip updates itself. Reference periods: IPCC AR6
Cross-Chapter Box 2.4. The Pliocene is +2.5 to +4 °C and +5 to +25 m, not
"+5 °C and +35 m", and those are equilibria reached over millennia: the page
says so, because without that line a comparison becomes a forecast nobody
made. The last time CO₂ was this high is about 14 million years ago
(Hönisch et al., Science 2023) — the widespread "three million years" comes
from superseded reconstructions.

**Wars.** Three sources with three cadences. Peacetime military footprint:
2,750 MtCO₂e a year, range 1,600–3,500, Parkinson and Cottrell (SGR and
CEOBS, November 2022). Ukraine: the Initiative on GHG Accounting of War
publishes **every February** on the anniversary of the invasion; the current
figure is the fourth year, 311.4 MtCO₂e. Israel-Gaza: Neimark et al., One
Earth, March 2026. Iran: Climate and Community Institute with QMUL and
Lancaster, March 2026, 5.1 MtCO₂e for the first two weeks, preliminary — it
carries the preliminary label in the chart, and if a peer-reviewed version
appears it must be replaced. The percentages use the UNEP Emissions Gap
Report 2025 denominator: 57.7 GtCO₂e of all greenhouse gases in 2024.

Mind the period when updating the war chart: the first bar is one year, the
others are conflict totals, and part of those totals is reconstruction that
has not happened yet. It is the easiest error to introduce.

## Live data

`live.js` has two independent blocks, so a failure on one front does not take
down the other.

- **CO₂** from the NOAA Global Monitoring Laboratory: Mauna Loa annual means,
  growth rate and monthly series. When the read succeeds the curve uses the
  *measured* monthly means instead of the reconstructed seasonality, and the
  ten-year zoom takes monthlies, deseasonalised curve and growth rates from
  the same download.
- **Temperature and other gases** from NOAA NCEI and GML.

At rest the page shows the values baked into the HTML, so it is correct with
JavaScript off or the network down. The coloured dot in each data box says
which of the two states you are looking at: read live, partly, or saved.

## What kind of number is it: the labels on the figures

Every figure carries a label declaring the nature of the data, so the reader
does not have to trust the tone of the text.

| Label | Class | Where |
|---|---|---|
| `observed` | `.tag-obs` | measurements and inventories: Mauna Loa, temperature, by country, growth, Kyoto |
| `observed and estimated` | `.tag-obs` | the global budget: fossil from inventories, the two sinks from models |
| `estimate` | `.tag-est` | calculations and models: the counterfactual without sinks, the wars |
| `preliminary estimate` | `.tag-prel` | not yet through a journal: today only the Iran panel |

**No green-yellow-red traffic light.** The coloured dots in the data boxes
already mean something else (read live / partly / saved), and two colour codes
in the same document get confused. The word does the work; the border style
does the rest: solid, dashed, dashed ochre. If you add a figure, add a label.

Wordings corrected on purpose, do not let them regress: the 1.5 °C limit is
not "measured on a decade average" (the Agreement does not prescribe how many
years, the page uses ten and the IPCC twenty); the remaining budget is a 50%
probability, not a date; Kyoto "did not reverse the growth of emissions",
not "its effect is essentially nil"; cutting "slows the rise", it is not
"not enough"; and part of the war totals is future reconstruction.

## One slide, one idea

Each section keeps one message, one figure and one short block of text in
view. Everything else (tables, chronologies, method notes, second paragraphs)
sits in a `<details class="more">` labelled "Go deeper: …", closed by default.
If you add content to a section, put it there, not in the body.

Above 1100px a section with class `slide` becomes a grid: heading and
standfirst across the top, the figure in `.slide-main` on the left, the
data box and callouts in `.slide-side` on the right, the `<details>` full
width at the bottom. At 1440×900 every section fits one screen; below 820px
of height a more compact variant kicks in. Below 1100px everything goes back
to one column in document order.

On phones (below 640px) `charts.js` draws the charts on 460 units instead of
880 (`NARROW`, `CHART_W`): narrower and taller, with shortened labels, so they
fit without horizontal scrolling. The choice is made at load time and does not
change on rotation.

## Four languages

Italian in `index.html` is the only hand-written copy. `build.py` extracts the
translatable units, looks them up in `i18n/<lang>.json` and writes
`en/index.html`, `es/index.html`, `zh/index.html`.

```bash
./build.py --extract     # refresh i18n/_chiavi.json with the units to translate
./build.py               # generate the three pages; fails if an entry is missing
./build.py en            # one language only
```

**How the keys are built.** Each unit is the content of a block that holds
only text and inline tags, so the key carries its bold text and its hooks to
the live data (`<span data-from="lt-bud">`). If the Italian markup changes,
the key no longer matches and the build says so instead of leaving a stale
sentence on the page. **After every change to the Italian text, re-run
`./build.py --extract`, translate the new entries and build again**, otherwise
the other languages fall behind.

Three traps already paid for, do not repeat them:

- apply substitutions **from the longest key to the shortest**: "Italia" also
  appears inside "Italia<small>one year…</small>", and replacing it first
  would break the longer one;
- numbers are translatable units like any other, because English and Chinese
  want a decimal point: `40,9` → `40.9`. In the charts `it()` handles it,
  reading the separator from `window.I18N._dec`;
- in `charts.js` the translation function is called `tr()` and not `T()`:
  `T` is already the top margin of the first chart. One letter, and no chart
  is drawn at all.

Chart labels and status messages go through `tr()` or `T()` in the three
JavaScript files, and the build injects them into the translated page as
`window.I18N`. In Italian that object does not exist and the functions return
the original string: one copy of the code for every language.

**How the language is chosen.** At the root Caddy decides by looking at
`Accept-Language`, the language the browser declares, not at IP geolocation:
an Italian in Madrid wants Italian, and reading the IP would mean a GeoIP
module and a database inside an image that also serves other sites. Italian
stays at the root, Spanish and Chinese get a 302, everything else goes to
English; with no header (crawlers) it stays Italian. An explicit address like
`/es/` is never redirected. A manual choice from the selector is saved in
`localStorage` and honoured by a script in the head, but **only when you land
on the root**: otherwise a shared link would take the recipient somewhere else.

In the Caddyfile the first argument of `redir` is a **path matcher**, not the
destination: `redir /es/ 302` does nothing, you need `redir * /es/ 302`. Two
hours of diagnosis, written down so nobody repeats them.

## Server

The site lives at https://co2-info.duckdns.org/ (DuckDNS subdomain pointing at
the host). On the server it is the `(carbonio_site)` block of the Caddyfile,
serving the `/srv/carbonio` mount at the root of the name taken from
`CO2_SERVER_NAME` in the compose file, with both an `http://` and an
`https://` block because the DuckDNS nameservers answer intermittently and a
certificate that does not arrive would otherwise mean a dead site. The old
address `https://e8-zdemo.duckdns.org/carbonio/` redirects here with a 308,
path by path.

## Visit statistics

The page loads [Umami](https://cloud.umami.is) (free plan, no cookies, no
personal data): page views, country, referrer, browser and device, with a map
and a live view in the dashboard. The `data-website-id` is in the `<script>`
in `index.html` and `404.html`; to change account or site, replace it. Umami
ignores visits from `localhost`, so nothing shows up locally: that is normal.

## Scrolling performance

The arrow pill and the progress bar are `position:fixed` and change while you
scroll. Without a layer of their own every change repainted the whole
document, and on a phone scrolling stuttered: hence `will-change: transform`,
a progress bar that advances with `transform:scaleX` instead of `width`, and
a `slides.js` that writes to the DOM only when a value actually changes. With
real Chrome (puppeteer, 390×844, CPU throttled 4×, 60 scroll steps) paint went
from 700–1100 ms to about 100 ms and layout from 80–100 ms to 9 ms.
`content-visibility:auto` on the sections was tried and rejected: it cuts
paint but moves section layout to the moment they come into view, with 300 ms
frames.

## Slide navigation

Each section is at least one screen tall (`min-height: 100svh` minus the bar)
and lands under the top bar thanks to `scroll-padding-top`. There is no
`scroll-snap`: `slides.js` adds the controls without touching the document.
Arrows bottom right with counter and title, progress bar under the top bar,
and from the keyboard:

- `←` `→` `PageUp` `PageDown` `Home` `End` always page one section at a time;
- `↑` `↓` and space scroll *inside* a section taller than the screen and move
  on only when the current one is finished, so nothing gets skipped;
- on touch screens a decisive horizontal swipe changes section (not inside
  scrollable tables and charts, which have their own).

A section that overflows by less than a fifth of the screen counts as
finished, so the arrow does not need two clicks. The URL hash follows the
current section, so anchor links and the top bar keep working. With
JavaScript off the page is an ordinary document.

## Accessibility

Series are never distinguished by colour alone: every segment carries a direct
label, land use is hatched, and the figures that need exact numbers have a
table with the same values under "Go deeper". Each chart has an `aria-label`
describing what it shows, translated like the rest. The theme follows the
system setting, with a manual toggle saved in `localStorage`; on phones it
starts dark. Reduced motion is honoured.
