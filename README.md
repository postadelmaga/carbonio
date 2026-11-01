# Comunità Energetica Rinnovabile · CO₂·info · Atlante del clima

Static website published at **https://co2-info.duckdns.org/**. One repository, one
folder per project, one deploy for all of them.

| Folder | Public URL | What it is |
|---|---|---|
| [`cer/`](cer/) | [/cer/](https://co2-info.duckdns.org/cer/) | The Renewable Energy Community (CER): what it is, its social purpose, its projects, and the [statute](https://co2-info.duckdns.org/cer/statuto/) (draft). Italian. |
| [`co2-info/`](co2-info/) | [/](https://co2-info.duckdns.org/) · [/it/](https://co2-info.duckdns.org/it/) · /es/ · /fr/ · /zh/ | *Il carbonio che resta*: the global carbon budget, in five languages. Docs: [README](co2-info/README.md), [MAINTENANCE](co2-info/MAINTENANCE.md). |
| [`ocean-earth/`](ocean-earth/) | [/atlante/](https://co2-info.duckdns.org/atlante/) | *Atlante del clima* (Climate Atlas, formerly Ocean Earth): interactive globe of sea temperature, currents, sea level, sea ice, rainfall and soil moisture since 1993 (Copernicus). Data at /ocean-earth/data/. Docs: [README](ocean-earth/README.md). |
| [`server/`](server/) | /api/ | The small message board service used by CO₂·info. |

## Publishing

```bash
./publish.sh                 # dry run: shows what would change
./publish.sh --apply         # publishes all three projects
./deploy.sh --dest x --url https://co2-info.duckdns.org --out /tmp/build   # build locally only
```

`deploy.sh` assembles the public tree: the English CO₂·info page at the root,
the other languages in their folders, `cer/` as it is, `ocean-earth/` at `/atlante/`
(with a redirect left at `/ocean-earth/`).
Ocean Earth's data (GB of frames, outside git) is synced separately, frames
first and manifest last.

## Licences

Code MIT ([LICENSE](LICENSE)); texts and charts CC BY 4.0 ([LICENSE-CONTENT.md](LICENSE-CONTENT.md)).
