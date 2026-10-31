# Ocean Earth

Interactive globe of **sea surface temperature** and **surface ocean currents**
from January 1993 to the latest published data, built on Copernicus Marine
Service products. It lives inside the CO₂·info site at
**https://co2-info.duckdns.org/ocean-earth/**.

> The text below is in English. Il resto del repository è in italiano; questa
> cartella segue le stesse convenzioni (sito statico, niente build, deploy con
> `publish.sh`).

## What it shows

| Layer | What | Unit |
|---|---|---|
| Temperature | sea surface temperature, configurable colour scale (3 palettes, min/max, intensity) | °C |
| Anomaly | difference from the 1993–2020 monthly climatology, diverging scale | °C |
| Speed | current speed as a colour field | m/s |
| Particles | GPU particles advected by the current field (U, V), coloured by speed | m/s |
| Arrows | a zoom-dependent grid of arrows, oriented along the current, colour and length by speed | m/s |
| Hotspots | months above the 1993–2020 90th percentile of the same month (monthly time step only) | — |

Time steps: **month** (1993 → last complete month), **day** (since 1 January
2024) and **hour** (last 14 days). In the daily step, the Mediterranean is drawn from the 1/16° satellite
product (about 7 km instead of 28) when the layer is on. Click a point for its values, the monthly
temperature history since 1993 (absolute or anomaly, with range selection by
dragging) and a second point to compare. Drag a box for regional statistics
(area-weighted mean, maximum, mean anomaly over time). "Compare two dates"
splits the globe with a draggable divider.

During playback the header and the time bar slide out of view and only a small
pill with the date and a pause button stays at the bottom; pausing (pill, space
bar) brings them back, and so does moving the mouse to the top edge.

## Data

All fields are re-gridded onto **one regular 0.25° grid** (1440 × 720, cell
centres at ±179.875° / ±89.875°), the native grid of the current product. A
coarse cell is ocean only if at least half of its area-weight is ocean in the
native grid; otherwise it is land.

| Time step | Variable | Dataset (Copernicus Marine) | Native | Kind | Coverage (catalogue, 30 Oct 2026) |
|---|---|---|---|---|---|
| month | SST | `cmems_mod_glo_phy_my_0.083deg_P1M-m` (GLOBAL_MULTIYEAR_PHY_001_030, GLORYS12) | 1/12°, monthly mean, `thetao` at 0.49 m | reanalysis | 1993-01 → 2026-08 |
| month | SST | `cmems_mod_glo_phy-thetao_anfc_0.083deg_P1M-m` (GLOBAL_ANALYSISFORECAST_PHY_001_024) | 1/12°, monthly mean | operational analysis | after GLORYS12 ends |
| month | U, V | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1M-m` (MULTIOBS_GLO_PHY_MYNRT_015_003) | 0.25°, monthly mean, surface | observation-based (altimetry + ERA5 Ekman + tides) | 1993-01 → 2026-03 |
| month | U, V | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_P1M-m` (same product, NRT) | 0.25° | observation-based | after the multi-year part ends |
| day | SST | `cmems_mod_glo_phy_my_0.083deg_P1D-m`, then `cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m` | 1/12°, daily mean | reanalysis → analysis | 2024-01-01 → yesterday |
| day | SST (option) | `METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2` (SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001, OSTIA) | 0.05°, daily, L4 | satellite observations | last 365 days |
| day | U, V | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1D-m`, then `…_nrt_0.25deg_P1D-m` | 0.25°, daily mean | observation-based | 2024-01-01 → yesterday |
| day | SST Mediterranean (overlay) | `SST_MED_SST_L4_NRT_OBSERVATIONS_010_004_a_V2` (SST_MED_SST_L4_NRT_OBSERVATIONS_010_004) | 1/16°, daily, L4, **kept on its native grid** | satellite observations | last 365 days |
| hour | SST | `cmems_mod_glo_phy_anfc_0.083deg_PT1H-m` | 1/12°, hourly mean | operational analysis | last 14 days |
| hour | U, V | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_PT1H-i` | 0.25°, hourly instantaneous (with tides) | observation-based | last 14 days |

Rules that keep the data honest:

- **Forecasts are cut.** Operational products extend days into the future;
  the pipeline publishes nothing later than the end of yesterday (UTC).
- **Every frame records its dataset** (`data/manifest.json`), and the interface
  always shows source, kind (model / observations), native time step and
  resolution of what is on screen.
- **No hourly data where none exists.** For the past, the finest step is the
  day; the hourly step only covers the recent window.
- **Interpolation is visual and declared.** During playback two consecutive
  frames are blended linearly on the GPU. Whenever a blended state is on
  screen the date and the source line say *interpolated*; when paused the
  slider snaps to an original frame.
- **Anomaly baseline: 1993–2020**, from the GLORYS12 monthly means (data start
  in 1993, so 1991–2020 is not available from these products). Monthly frames
  use their month; days and hours interpolate the climatology between month
  centres. The anomaly always uses the model SST, consistent with its
  climatology; with OSTIA selected the anomaly falls back to the model and
  the interface says so.
- **Operational data are measured with the GLORYS yardstick.** The newest
  instants (last month, days from late September 2026, all hours) come from
  the operational analysis (anfc), a different system: about 0.1 °C colder
  than GLORYS12 globally (−0.07 to −0.15 °C depending on the month) and up
  to ±0.5 °C regionally. Subtracting the GLORYS climatology from anfc would
  put that model difference into the anomaly. `pipeline/bias.py` measures
  anfc − GLORYS on the 51 months both exist (June 2022 → August 2026), per
  calendar month, smoothed over ~5°; the page adds it to the baseline (and to
  the 90th percentile) only for anfc frames and says so in the source line.
  August 2023 is excluded: that anfc monthly mean is 0.6 °C colder than its
  own July and September (a defective field; the published frame for that
  month is GLORYS). Checked on a held-out year (`validate.py`, section 7):
  for 2026-08 the mean anfc − GLORYS anomaly difference goes from −0.089 to
  −0.019 °C and the local RMS from 0.41 to 0.35 °C. The ~0.35 °C left is the
  difference of that single year (eddies, fronts) that no average removes:
  it is the local uncertainty of recent anomalies.
- **Hotspots are not marine heatwaves** in the Hobday et al. sense (daily
  data, 90th percentile of a daily climatology, ≥ 5 days): they are months
  above the monthly 90th percentile, and the layer is disabled outside the
  monthly time step.
- **Land never shows as sea.** Cells are classified from each product's own
  mask (OSTIA lakes and rivers excluded); on screen a Natural Earth 1:50m
  land mask is drawn on top.

Licence and attribution: Copernicus Marine products are free and open
(Copernicus licence); the page credits "E.U. Copernicus Marine Service
Information" and lists each product with its DOI. Coastlines and land:
Natural Earth, public domain.

### Encoding

Frames are lossless RGB PNGs (the server compresses them by itself; Caddy's
`encode` does not compress raw binaries), decoded in Web Workers:

- temperature: 16-bit code in R (high) and G (low), `°C = −5 + (code − 1) × 0.01`, code 0 = no data;
- currents: two 12-bit codes, `R = u ≫ 4`, `G = v ≫ 4`, `B = (u & 15) ≪ 4 | (v & 15)`,
  `m/s = (code − 2048) × 0.002`, both codes 0 = no data (range ±4.09 m/s).

**Playback previews** (`data/p/`, built by `pipeline/preview.py` from the
exact frames). An exact instant weighs about 1.6 MB; at 4 frames/s that is
6–7 MB/s, more than the server delivers (~2 MB/s measured), so playback
stalled on "loading". While the timeline plays, the page reads lossless
WebP previews of the same instants, about 0.33 MB each:

- temperature: 8-bit grey, `°C = −2.5 + (code − 1) × 0.16`, same 0.25° grid;
- currents: 0.5° grid (2×2 mean of ocean cells), R = u, G = v,
  `m/s = sign × 4 × (|code − 128| / 127)²` (square-root spacing: 3 mm/s
  steps near zero, ~4 % relative error at 1 m/s).

Paused, on click, in charts and in comparisons the page always uses the
exact frames; the point panel stays empty while playing. Previews are a
display convenience, not data: the downloadable values are the PNGs.
Playback buffers about three seconds ahead and, once it has had to wait,
resumes only when 1.5 s of frames are in.

**Browser cache.** The web server sends `Cache-Control: no-cache`, so the
HTTP cache revalidates every file (one round trip per frame, on every
visit). Frames never change once published (`frames.py` only writes missing
instants), so the decode worker keeps them in Cache Storage
(`oe-frames-<n>`) and reads them back from disk without asking the server;
land, coasts, climatology and percentiles go to `oe-static-<hash>`, which
follows the files' sizes and dates. On start the page drops older cache
versions and instants that have left the rolling windows. Raise
`CACHE_FRAMES` in `pipeline/manifest.py` if published frames are ever
regenerated. The button under the timeline downloads the chosen range
(whole series or the Loop range) before playing, showing its size from the
average preview weights in the manifest; a thin bar under the slider marks
the instants already saved. `window.__oe.store.net` counts files read from
disk, downloaded or revalidated.

Measured with a local server that mimics production (no-cache + ETag,
shared bandwidth, latency; scripts in `tests/player/`):

| | before | after |
|---|---|---|
| same range again, same page | 250 of 264 files asked to the server (304) | 19 of 266 |
| after reloading the page | 260 of 260 asked | 0 |
| whole monthly series on a 0.7 MB/s line | 12 of 80 frames in 20 s | download 128 MB in 191 s, then 405 frames with no wait |

Climatology (5 MB) now loads after the first frame, or at once when the
anomaly is chosen. Decoding uses code → half-float lookup tables: at 15
frames/s from disk, 271 of 300 frames instead of 209.

On the GPU, frames become half-float textures holding *value × mask* and
*mask*: with linear filtering, *value × mask / mask* averages only ocean
samples, so coastlines are never smeared with land zeros.

## Architecture

```
ocean-earth/
  index.html            the page (served at /ocean-earth/)
  app/                  ES modules, no dependencies, no build step
    main.js             wiring: data, time, globe, panels
    globe.js            WebGL2 renderer
    shaders.js          GLSL: ray-cast globe, particles, arrows, lines
    geo.js              camera, matrices, picking
    data.js             manifest, worker pool, LRU cache
    decode-worker.js    PNG → codes + half floats (off the main thread)
    timeline.js         time model, playback, climatology selection
    chart.js            SVG line charts with range brushing
    palettes.js         colour scales (LUT textures + CSS gradients)
    i18n.js             the site's five languages (en, it, es, fr, zh); dates and numbers via Intl
    style.css
  pipeline/             Python: download, re-grid, encode, derive, validate
  tests/                pytest (pipeline), node --test (app), validation report
  data/                 generated, NOT in git (~3–4 GB), synced by deploy.sh
```

**Why no CesiumJS / MapLibre / deck.gl.** The data are global raster fields on
a regular grid; a ray-cast sphere samples them directly in a fragment shader
(exact at every zoom, no tiling, no reprojection), particles live in
textures and are advected on the GPU, and the whole app is ~130 KB of code (~40 KB compressed)
instead of several MB of library. Cesium would bring terrain, imagery
providers and an access token for base maps we do not need, while its imagery
layers expect colour images: colour scales, anomalies and frame blending
would need custom primitives and shaders anyway. The site itself has no build step
and no dependencies; Ocean Earth keeps that. Everything is plain WebGL2
(supported by all current desktop and mobile browsers).

Rendering per frame: (1) a full-screen triangle ray-casts the unit sphere,
blends frames A/B, applies the colour scale or anomaly, hatches hotspots,
draws Natural Earth land on top; (2) coastlines as GL lines with horizon
culling; (3) instanced arrows whose lattice snaps to the grid and densifies
with zoom; (4) particles: an update pass (state `RGBA32F`: lon, lat, age,
speed) writes into a 10-layer ring buffer, a draw pass extrudes each trail
segment into a screen-space quad. New particles are spawned uniformly in the
visible spherical cap, so density and apparent speed stay constant across
zoom levels (level of detail without tiles).

Loading: the manifest lists every frame; frames are fetched and decoded by
2–3 workers, kept in an LRU cache (24 frames desktop, 10 phone), and
prefetched ahead of playback; playback waits for a frame rather than skipping
it. Time series for the point chart and regional statistics are 5° tiles
(20 × 20 cells × all months in one PNG), fetched only when needed.

## Pipeline

```
cd ocean-earth
copernicusmarine login                 # once; credentials stay in ~/.copernicusmarine
./pipeline/update.sh                   # incremental: downloads only what is missing
.venv/bin/python -m pytest tests       # unit tests
node --test tests/                     # app tests
.venv/bin/python pipeline/validate.py  # scientific validation → tests/validation-report.md
cd .. && ./publish.sh && ./publish.sh --apply
```

`update.sh` runs three download queues in parallel (temperature, currents,
OSTIA), then `derived.py` (land, coasts, climatology, 90th percentile, time
series tiles), `bias.py` (anfc − GLORYS baseline shift), `preview.py` and
`manifest.py`; if any download queue fails it stops before publishing derived
files. Downloads go in blocks of consecutive missing instants only. Frame
files are written atomically and the index after each frame, so an
interrupted run resumes where it stopped. The daily
and hourly windows are set with `DAILY_START`, `HOURLY_DAYS`, `OSTIA_DAYS`.

Throughput: about 6–7 s per global 1/12° frame on a 4-core desktop on a
home line, about 1.7 s on the ARM server `arm_php` (Oracle, 12 GB RAM,
datacenter bandwidth). For long back-fills run the pipeline there
(`~/ocean-earth`, its own venv via `uv`, credentials in
`~/.copernicusmarine`), then pull the frames with
`rsync -a --ignore-existing arm_php:ocean-earth/data/<tier>/<var>/ data/<tier>/<var>/`
and run `frames.py` once locally for the same range: it finds every frame,
downloads nothing and fills the index. The web server `arch_php` (1 GB RAM)
only serves files; never run the pipeline there.

Sizes on 30 Oct 2026 (3.5 GB of exact frames plus 0.7 GB of playback previews): monthly SST 228 MB, monthly currents
417 MB, daily SST 664 MB, daily currents 1.1 GB, OSTIA 231 MB, Mediterranean
36 MB, hourly SST 209 MB, hourly currents 354 MB, time-series tiles 240 MB,
climatology and percentiles 12 MB, land and coasts 0.9 MB.

## Deploy

**Code** (`index.html`, `app/`): `publish.sh` → `deploy.sh` from the repository
root, like the rest of the site. The main rsync excludes `/ocean-earth/data/`,
so `--prune` on the site never deletes the data.

**Data**: published every day by **arm_php**, not from the local copy.
`pipeline/auto.sh`, started by the systemd timer in `pipeline/systemd/`
(06:30 UTC), runs `update.sh`, then `validate.py`; only if validation passes
it rsyncs `data/` to the server, frames first and `manifest.json` last, with
`--delete --max-delete=400` so that frames leaving the rolling windows go away
but a mistake cannot empty the server. The key `~/.ssh/oe_to_arch` on arm_php
is authorized on the server only for `rrsync` inside
`/home/arch/carbonioweb/ocean-earth/data`, only from arm_php's address.
Log: `~/ocean-earth/data/logs/auto.log` on arm_php. `deploy.sh --oe-data`
still pushes the local copy, for emergencies only: it is normally older than
the server's.

First setup on arm_php (once): pipeline code and `data/index/` copied from
the repository, `./pipeline/auto.sh --pull` to take the published series from
the server, then the two unit files into `/etc/systemd/system/` and
`systemctl enable --now ocean-earth.timer`.

No server configuration change is needed: Caddy already serves the folder
statically (`no-cache` revalidation for everything outside `/assets/`).

Rollback: the page is two static paths. `git revert` + `./publish.sh --apply
--prune` restores the previous code; removing `/home/arch/carbonioweb/ocean-earth`
on the server removes the app entirely without touching the rest of the site.

## Languages

The page speaks the site's five languages: English, Italian, Spanish, French
and Chinese. It picks `?lang=`, then the choice saved by the site
(`localStorage` and cookie `lingua`, shared with the home page), then the
language of the site page the reader came from, then the browser's. Changing
it on the page saves the choice for the whole site, and "back" leads to the
home page in that language. Dataset names stay as Copernicus publishes them.
`tests/app.test.mjs` fails if a language misses a key, a placeholder differs
or the page uses a key that does not exist; `tests/browser.mjs` opens the
page in each language on a phone-sized screen.

## Known limits

- 0.25° is the shared global grid: GLORYS12 (1/12°) and OSTIA (0.05°) are
  averaged down. Only the Mediterranean has a higher-resolution layer (1/16°,
  daily, last 365 days, temperature only); there are no Mediterranean
  currents at higher resolution, nor monthly Mediterranean means.
- "Fit scale to view" sets the colour range to the 2nd–98th percentile of the
  values on screen; the legend always shows the range in use.
- Hourly coverage is a rolling 14-day window; daily coverage starts 2024-01-01
  (set by `DAILY_START`, can be extended backwards at ~3.4 GB per decade).
- The point chart uses monthly means only.
- The current product's multi-year version 202411 is announced for retirement
  on 2026-11-24; the pipeline uses the default (latest) version, so the next
  update after the switch picks the new one automatically.
- Values are published as Copernicus distributes them, including two known
  source artefacts that `pipeline/validate.py` counts and locates:
  GLORYS12 surface temperatures below the freezing point of sea water
  (down to −2.96 °C) under sea ice and next to glacier fronts (Antarctic
  coast, SE Greenland, Svalbard, and in winter the seasonal-ice seas: Okhotsk,
  Hudson Bay, Labrador, Peter the Great Bay, the Antarctic pack edge;
  0.018 % of daily cells, none equatorward of 43°), and monthly/daily currents above 3 m/s on the Amazon shelf near
  the equator, where the geostrophic part of GlobCurrent breaks down
  (e.g. 3.96 m/s in June 1993, matching the original). Hourly currents above
  3 m/s are real tides in macrotidal bays (Gyeonggi Bay, King Sound, Ungava).
  Components beyond ±4.09 m/s are clipped by the encoding (380 of 239 million
  monthly cells).
- Recent operational and near-real-time frames are written once. Mercator
  re-runs recent days with a weekly hindcast and NRT currents are
  reprocessed, so the last few days on the page can differ slightly from what
  Copernicus serves a week later; frames are never rewritten in place (the
  browser cache relies on it), so refreshing them would need a new
  `CACHE_FRAMES`.
- Hourly SST is the mean over [HH:00, HH+1:00) while hourly currents are
  instantaneous at HH:00: the two layers are half an hour apart.
- Particles need `EXT_color_buffer_float` (all desktop browsers, iOS ≥ 15);
  without it the page says so and arrows remain.
