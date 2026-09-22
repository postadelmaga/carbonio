# Maintenance notes

Everything you need to change a number, add a section, translate it or put it
online. English only: it is the language of whoever ends up running this.
The reader-facing README is in [five languages](README.md).

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
generated there with all five language versions: the root, which is English,
plus `/it/`, `/es/`, `/fr/` and `/zh/`.

`deploy.sh` does not publish the repository's own `index.html`: the root of
the site is the content of `en/`, copied one level up. If you run it before
`./build.py` has ever written `en/index.html` it stops and says so.

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

**Is China slowing down** ("La Cina sta rallentando?"). Two sources with two
cadences, and mixing them up is the trap. The yearly changes up to 2024 and the
2019–2024 compound averages are computed from the same GCB 2025 country
database as the section above (`co2` column of `owid-co2-data.csv`, gross of
carbonation, endpoints 2019 and 2024 so the pandemic year sits inside the
window and not at its ends). The 2025 projections by country come from the
**published** paper (Global Carbon Budget 2025, *Earth System Science Data*,
2026), not from the November 2025 press release: the two disagree, +2.5%
against +1.9% for the United States and −0.1% against +0.4% for the EU, and
the published version wins. China's 2025 (−0.3%) and the 2026 quarters (+2%,
−1%) are CREA's estimates from China's official monthly energy statistics,
published on Carbon Brief about two months after each quarter closes — the
figure carries the "observed and estimated" label for exactly this reason, and
the table note says where the estimate and the projection disagree (−0.3%
against a projected range of −0.1% to +0.9%). Update in November with the new
GCB, and after each CREA quarterly. The plateau claim is time-stamped on
purpose: twenty-one flat-or-falling months from the peak of March 2024, not
"China has peaked", which nobody has established.

The figure is HTML and CSS, not a chart in `charts.js`: two `.panel` blocks of
diverging bars, with `.panels.due` for the two-column variant (plain `.panels`
is three columns and would leave an empty third). Each panel has its own
scale; the widths are the value divided by the full span of the panel, and the
`--zero` percentage is where the zero line falls.

**Two measures that must not be confused**, and it is the mistake the earlier
version of this page fell into: the NOAA **growth rate** is the increase
between 1 January and 31 December on the deseasonalised curve; the
**difference between annual means** is a different thing and gives different
numbers (3.33 against 3.53 ppm in 2024). The page always uses the growth rate.
And **Mauna Loa is not the planet**: the global mean comes from marine
stations far from cities, weighted by latitude band. In 2024 the two give
3.33 and 3.76 ppm.

**The energy imbalance** ("Perché si scalda: il conto dell'energia"). Three
sources with three vintages, and the figure keeps them apart on purpose. The
fluxes in the top two bars — 340 arriving, 100 reflected, 240 absorbed, 239
re-emitted — are IPCC AR6 WGI figure 7.2 (adapted from Wild et al. 2015), for
early-21st-century conditions. That same figure gives the imbalance as 0.7
(0.5–0.9) W/m²; the page does **not** use it. The number in the red sliver,
1.12 [0.78 to 1.46] W/m² for 2013–2025, is the updated one from Forster et al.,
*Indicators of Global Climate Change 2025* (ESSD 18, 3889–3933, 2026), table 4,
which also has 1.04 [0.82 to 1.25] for 2006–2025 and 0.40 [−0.03 to 0.84] for
1976–1995 — the three rows of the "go deeper" table. **Update in June**, when
the IGCC annual update comes out.

Do not "close" the figure by subtracting. 240 − 239 = 1 is a rounding
coincidence: each top-of-atmosphere flux is known to a few W/m², and a
difference worth one would vanish inside that. The imbalance is measured from
the heat inventory instead, and the caption says so. It is the one sentence in
the section that must not be cut.

The split of the imbalance — ocean 89%, land 6%, cryosphere 4%, atmosphere 1%,
over 1971–2020 — is von Schuckmann et al. 2023 (ESSD 15, 1675–1709), with the
381 ± 61 ZJ total and the component values (land 21 ± 2, cryosphere 14 ± 4,
atmosphere 5 ± 1 ZJ). The ocean row in the table is the residual and the page
says so: the paper publishes the total and the three smaller terms. AR6 gives
91/5/3/1 for 1971–2018; both are quoted, neither is silently mixed with the
other.

Two results in that section are **computed here, not transcribed**, and the
constants are printed so a reader can redo them. The atmosphere's heat capacity
(5.15·10¹⁸ kg × 1005 J kg⁻¹ K⁻¹ = 5.2 ZJ per degree; the mass is Trenberth and
Smith 2005) equals 3.5 m of seawater (3.618·10¹⁴ m² × 1027 kg m⁻³ ×
3990 J kg⁻¹ K⁻¹ = 1.5 ZJ per degree per metre). And 381 ZJ put into the
atmosphere alone would be more than seventy degrees — labelled "un conto, non
uno scenario" on purpose, because air that hot would radiate its way out of the
imbalance long before. The −18 °C in the same block is (240/σ)^¼ = 255 K,
against an observed surface of about 288 K. The "seventeen times the energy the
world uses in a year" in the data box is 11.2 ZJ a year of ocean heat uptake
against 178 000 TWh = 0.64 ZJ of world primary energy in 2025 (OWID, by the
substitution method, traditional biomass included; without it the ratio is
nineteen, hence the round word rather than a decimal).

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

Cross-checked on 14 September 2026 against the Corriere della Sera Dataroom
investigation on war emissions: every figure matched, because both come from
the same studies. The article's «59 wars, the highest number since 1945» was
not taken up: the Global Peace Index 2026 says 61 active armed conflicts in
2024, and 59 is the 2008 value of a different indicator, the number of
countries involved in an external conflict, which has since risen to 103. When
a secondary source and a primary source disagree, go with the primary one and
say so.

Mind the period when updating the war chart: the first bar is one year, the
others are conflict totals, and part of those totals is reconstruction that
has not happened yet. It is the easiest error to introduce.

## The sources section

Each of the eighteen titles under "Fonti" is a link to the source itself,
opening in a new tab. The markup is `<li><a class="src-l" href="…"
target="_blank" rel="noopener"><b>Title</b></a><span>…</span></li>`, in that
order for a reason: with the `<a>` **outside** the `<b>`, the translation key
stays `<b>Title</b>` and the URL never enters `i18n/*.json`, so changing a link
does not invalidate four translations. Put the `<a>` inside the `<b>` and the
key becomes the whole anchor, URL included.

No blue underline: eighteen of them in a grid would be a wall. The affordance
is a `↗` drawn by `.srcs .src-l b::after`, with the colour and the underline
appearing on hover and on keyboard focus.

Prefer a DOI over a publisher page and a publisher page over an aggregator.
Every URL was opened before being committed — three of them (science.org,
unep.org, the Vision of Humanity resources page) answer 403 to `curl` because
of a Cloudflare challenge and 200 to a real browser, so check with a browser
before concluding a link is dead.

## Live data

`live.js` has two independent blocks, so a failure on one front does not take
down the other.

- **CO₂** from the NOAA Global Monitoring Laboratory: Mauna Loa annual means,
  growth rate and monthly series. When the read succeeds the curve uses the
  *measured* monthly means instead of the reconstructed seasonality, and the
  ten-year zoom takes monthlies, deseasonalised curve and growth rates from
  the same download.
- **Temperature and other gases** from NOAA NCEI and GML.
- **Ocean heat** from NOAA NCEI: the Levitus series for the top 2000 m,
  in units of 10²² J against the 1955–2006 mean (1 unit = 10 ZJ). Two files and
  **two cadences that must not be mixed**: `yearly/h22-w0-2000m.dat` is annual
  and starts in 2005, `pentad/pent_h22-w0-2000m.dat` is a five-year running
  mean and starts in 1957. The latest value and the yearly rate come from the
  annual file; the comparison with 1971 comes from the pentadal file alone, at
  both ends. Mixing them turns 0.12 °C into 0.13 °C. The conversion to degrees
  is in `live.js`: ocean area 3.618·10¹⁴ m², 2000 m, 1027 kg/m³,
  3990 J kg⁻¹ K⁻¹.

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
width at the bottom. At 1440×900 most sections fit one screen (852 px, the
viewport minus the bar); three run over — wars 1011, energy 982, China 880 —
and the row height is set by the taller of the two columns, so it is usually
the data box plus callout on the right, not the chart. Below 820px of height a
more compact variant kicks in. Below 1100px everything goes back to one column
in document order.

On phones (below 640px) `charts.js` draws the charts on 460 units instead of
880 (`NARROW`, `CHART_W`): narrower and taller, with shortened labels, so they
fit without horizontal scrolling. The choice is made at load time and does not
change on rotation.

## Five languages

Italian in `index.html` is the only hand-written copy — that has not changed,
even though Italian is no longer the language at the root. `build.py` extracts
the translatable units, looks them up in `i18n/<lang>.json` and writes
`it/`, `en/`, `es/`, `fr/`, `zh/`, two pages each.

Two constants at the top of `build.py` carry the whole arrangement:

- `SORGENTE = 'it'` — the hand-written language. For it nothing is substituted
  and **no `window.I18N` block is injected**, because the three JavaScript
  files fall back to their Italian literals precisely when that object is
  missing. `it/` is therefore the source with different links, nothing else.
- `RADICE = 'en'` — the language served at the site root. Its page is still
  written into `en/`, but with canonical, `og:url` and the links between the
  two pages in *root* form; `deploy.sh` then copies the contents of `en/` one
  level up and never publishes the folder itself. That is why `en/` exists in
  the repository and `/en/` does not exist on the server.

**A local `python3 -m http.server` does not show the published layout**: at
the root you get the Italian source, not English. To see what the server
actually serves, rebuild the real tree — 404, robots, assets, then
`en/index.html` and `en/feedback.html` at the top, then `it/ es/ fr/ zh/` —
and resolve `__ROOT__` yourself. It takes five lines of shell and it is the
only way to check the links between languages before publishing.

**Adding a language** touches six places and nothing else:

1. `LANG_META` and `LINGUE` in `build.py` — the flag, the two-letter chip, the
   locale and the decimal separator;
2. the `hreflang` links and the picker `<li>` in **both** `index.html` and
   `feedback.html`;
3. the `for L in …` loop and the sitemap in `deploy.sh`;
4. a `LINGUE` entry in `social.py`, then re-run it to draw the card;
5. a new `i18n/<lang>.json`;
6. an `@radice_<lang>` and a `@scelta_<lang>` block in the server Caddyfile,
   plus the new code in the cookie alternation of the four `not
   header_regexp` lines, or the new language is reachable only from the
   picker.

French, added on 15 September 2026, needed 517 hand-written units: the other
157 keys are pure numbers, and French uses the comma for decimals like Italian
and Spanish, so they carry over unchanged. Budget roughly that for any new
language, plus the README.

**Changing which language sits at the root** is a different job and touches
`RADICE` in `build.py`, the two `cp` lines in `deploy.sh`, the `hreflang` and
picker hrefs in the sources, the `(scelta === "en" ? "/" : …)` line in the
head script of `index.html`, the language of `404.html`, and the Caddyfile:
the old root language needs an `@radice_<lang>` block it did not have, the new
one loses its own, and its old folder needs a 308 to the root so existing
links survive. Publish **before** touching Caddy and **without** `--prune`, so
that no address is ever briefly missing; prune on a second pass once the
redirects are live.

```bash
./build.py --extract     # refresh i18n/_chiavi.json with the units to translate
./build.py               # generate all five; fails if an entry is missing
./build.py en            # one language only
```

**How the keys are built.** Each unit is the content of a block that holds
only text and inline tags, so the key carries its bold text and its hooks to
the live data (`<span data-from="lt-bud">`). If the Italian markup changes,
the key no longer matches and the build says so instead of leaving a stale
sentence on the page. **After every change to the Italian text, re-run
`./build.py --extract`, translate the new entries and build again**, otherwise
the other languages fall behind.

Four traps already paid for, do not repeat them:

- apply substitutions **from the longest key to the shortest**: "Italia" also
  appears inside "Italia<small>one year…</small>", and replacing it first
  would break the longer one;
- numbers are translatable units like any other, because English and Chinese
  want a decimal point: `40,9` → `40.9`. In the charts `it()` handles it,
  reading the separator from `window.I18N._dec`;
- a string that is **both** a text node and an attribute needs both
  substitutions. `<title>` is collected as a translatable unit, but the
  board's title is byte-identical to its `twitter:title`, so the attribute
  branch won and the browser tab said «Bacheca — Il carbonio che resta» in
  all four translations. `genera()` now runs the text substitution too,
  discarding its errors, because outside the attribute the string may
  legitimately be absent;
- the decimal separator is **not** a constant. `charts.js` has `DEC`,
  `live.js` has `SEP`, both read from `window.I18N._dec`; three places used to
  hard-code the comma and the English page showed "+1,29 °C". The same trap in
  reverse: a string that never goes through `T()` stays Italian everywhere, as
  the "Come leggerlo" button in `slides.js` did;
- in `charts.js` the translation function is called `tr()` and not `T()`:
  `T` is already the top margin of the first chart. One letter, and no chart
  is drawn at all.

Chart labels and status messages go through `tr()` or `T()` in the three
JavaScript files, and the build injects them into the translated page as
`window.I18N`. In Italian that object does not exist and the functions return
the original string: one copy of the code for every language.

**Where each language lives.** **English is the site root**, and Italian sits
in `/it/` like every other translation. It moved there on 16 September 2026:
the page is read mostly outside Italy. `/en/` still answers, with a 308 to the
root, so links already in circulation keep working.

**How the language is chosen.** At the root Caddy decides by looking at
`Accept-Language`, the language the browser declares, not at IP geolocation:
an Italian in Madrid wants Italian, and reading the IP would mean a GeoIP
module and a database inside an image that also serves other sites. It
redirects **only towards a language that actually exists** — `it*`, `es*`,
`fr*`, `zh*`, each a 302 to its folder. Everything else, English included,
German and Japanese and the crawlers that send no header at all, simply stays
on the root, which is already English. Nobody is shipped to a page they did
not ask for: before the move, an unmatched language was sent to `/en/`, and
that was the wrong default dressed up as a helpful one. An explicit address
like `/es/` is never redirected. A manual choice from the selector is saved in
`localStorage` and honoured by a script in the head, but **only when you land
on the root**: otherwise a shared link would take the recipient somewhere else.

**A manual choice beats `Accept-Language`,** and it has to reach the server to
do so: `localStorage` never leaves the browser. The picker therefore also
writes a `lingua` cookie (a year, `SameSite=Lax`, nothing but `it` or `en`
inside), and the Caddyfile has a `@scelta_<lang>` block per language that
redirects on the cookie, plus a `not header_regexp Cookie` line on each
`@radice_<lang>` block so a reader who has chosen is never sorted by their
browser again. Until 22 September 2026 English was simply **unreachable** from
an Italian browser: English is the root, and it was the root itself that kept
bouncing the reader to `/it/`. The other languages hid the bug — they have an
explicit address, which is never redirected. The root also gained `Vary:
Accept-Language, Cookie`, without which a cached 302 would outlive the choice.
`lingua=en` has no `@scelta_en` block on purpose: the root is already English,
so not matching is the whole job.

**The browser cache hid the fix for an hour.** The root's `302` went out with
`public, max-age=3600`, so a reader who had already been sorted to `/it/` kept
being served that redirect by their own browser: the request never reached
Caddy, and the new cookie changed nothing. In incognito it worked, which is the
tell. Two repairs. In the Caddyfile, `header Cache-Control "public,
max-age=3600"` with no matcher followed by `header @html … "no-cache"` never
did what it read like — the one without a matcher always won, and even
`/index.html` went out cacheable. They are now two mutually exclusive matchers,
`@statici path /assets/*` (an hour) and `@pagine not path /assets/*`
(`no-cache`), so pages and language redirects are always asked for. And because
a poisoned cache survives the config change, the picker appends `?lingua=xx`
when it links to **the root** — a different cache key, so the request goes out
for real — and the head script reads it, saves it and wipes it from the address
bar with `replaceState`. Only the root needs it: it is the one address the
server may redirect.

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
path by path, and so does `/en/*`, the address English had until the root
became English itself.

**The Caddyfile has `admin off`**, so there is no hot reload: `frankenphp
reload` fails with `connection refused` on port 2019 and the only way to apply
a change is `docker restart nicoweb`, about three seconds of downtime for all
three sites on that container, not just this one. The sequence that worked,
and the one to repeat:

1. back up with a timestamped copy next to the file, the convention that
   config already follows (`Caddyfile.bak-fr-<epoch>`);
2. edit, then `diff` against the backup and read it — the whole point of the
   backup is being able to see exactly what changed;
3. `docker exec nicoweb frankenphp validate --config /etc/frankenphp/Caddyfile
   --adapter caddyfile`. It must end with `Valid configuration`. The mount is
   live, so this validates the file you just edited. A pre-existing
   "input is not formatted" warning about line 6 is not yours;
4. record what the three sites answer *before* restarting;
5. `docker restart nicoweb`, then check all three again — this host also
   serves niccolomenegazzo.com and e8-zdemo, and the board's `/api/` too.

The Caddyfile belongs to the **nicoweb** project, not this one. Do not edit it
from here without being asked: it is the one file where the two projects
touch.

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

## The board and the reactions

Under every section there is a row with two questions ("was it useful?",
"is it clear?"), and `/feedback.html` carries the message board. Both talk to
one small service that runs on the same server.

**The service** is `server/bacheca.py`: the standard library only, no
packages to install, one file to read before trusting it. It stores everything
in SQLite, behind Caddy at `/api/`, and it lives in its own container
(`server/docker-compose.yml`, stack in `/home/arch/bacheca`) so that a fault
there cannot touch the static site. It publishes no port: Caddy reaches it on
the `edge` network, the same one Umami uses.

**Privacy.** No cookies: what you have already voted lives in `localStorage`,
which is yours and never travels. IP addresses are not stored: a salted
fingerprint is kept for thirty days, only to count a person once and to stop
abuse, then it is erased. The salt and the moderation token are in
`/home/arch/bacheca/.env` on the server, never in this repository.

**Nothing is published on its own.** Every message waits for approval:

```bash
./server/modera.sh coda                 # what is waiting
./server/modera.sh pubblica 3           # publish message 3
./server/modera.sh pubblica 3 "Fixed, thanks."   # publish with a reply
./server/modera.sh rifiuta 4            # keep it out
./server/modera.sh cancella 4           # delete it
```

The script reads the token over SSH, so there is no copy of it on your
machine. Moderation is not there to censor: a blunt criticism gets published
as written. It is there so that spam never reaches the page.

**One vote per question.** The table `voti` has a unique index on
`(sezione, gruppo, impronta)`: it is the index that makes a double vote
impossible, not a check in the code. Each section asks two questions, "was it
useful?" and "is it clear?", and a person has one answer for each. Changing
your mind replaces the previous answer, so a count never inflates. The page
shows what you already answered from two sources: the server, which knows by
fingerprint, and `localStorage`, which survives a change of address. Clearing
the browser does not buy a second vote.

**The fingerprint on votes is not purged**, unlike the one on messages. It is
the only thing standing between the counters and a refresh loop. It is not the
IP address: it is a SHA-256 of the address with a secret salt, so without the
salt there is no way back, and with the salt you can only check an address you
already hold.

**The client's real address is the LAST value of `X-Forwarded-For`, not the
first.** Caddy appends the address the request actually arrives from; whatever
came before it may have been written by the client. Reading the first element
would let anyone send an invented header on every click and vote forever. This
was a real hole in the first version, fixed on 14 September 2026.

**Limits already in place**: three messages a day per fingerprint, one vote
per section, type and day, eighty votes a day, a honeypot field that bots
fill in and humans never see, 1500 characters per message, 8 KB per request.
If spam still gets through, the next step is a delay between loading the page
and posting.

**In development** the page and the service sit on different ports, so the
browser blocks the requests. Set `BACHECA_ORIGINE=http://127.0.0.1:8100` when
starting the service, and `window.BACHECA_API` in the page. In production they
share a domain and neither is needed.

## Licence

Code MIT, text and charts CC BY 4.0: see [LICENSE](LICENSE) and
[LICENSE-CONTENT.md](LICENSE-CONTENT.md). The line in the page footer says so
too, in all five languages, so a reader who wants to reuse a chart does not
have to go looking for the repository first.
