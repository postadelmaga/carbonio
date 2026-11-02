"""Scrive data/manifest.json: l'unico file che il browser legge per sapere
quali fotogrammi esistono, da quale dataset viene ognuno e che passo hanno.

Le sorgenti sono elencate una volta (`sources`) e ogni fotogramma ne porta
l'indice, cosi' il file resta piccolo anche con migliaia di istanti.
"""
import datetime as dt
import functools
import hashlib
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import copernicusmarine as cm  # noqa: E402
import derived  # noqa: E402
import encode  # noqa: E402
import frames  # noqa: E402
import grid  # noqa: E402
import land  # noqa: E402
import preview  # noqa: E402
import sources  # noqa: E402

TIERS = {
    # precip e soil: terraferma da ERA5 (pipeline/land.py), percentuale del normale
    # sla: livello del mare (altimetria), ice: ghiaccio marino (GLORYS12 → analisi)
    # co2, co2foss, co2nat: aria (pipeline/co2.py), griglia 1°
    'monthly': dict(step='P1M', vars=['sst', 'cur', 'precip', 'soil', 'sla', 'ice', 'co2', 'co2foss', 'co2nat']),
    'daily': dict(step='P1D', vars=['sst', 'cur', 'ostia', 'med']),
    'hourly': dict(step='PT1H', vars=['sst', 'cur']),
}


@functools.lru_cache(maxsize=None)
def product_meta(product_id):
    """DOI e titolo del prodotto, dal catalogo Copernicus (per l'attribuzione)."""
    if sources.DATASETS.get(product_id, {}).get('cds'):
        return {}                        # Climate Data Store: il DOI e' gia' in sources.py
    try:
        p = cm.describe(product_id=product_id).products[0]
        return {'doi': p.digital_object_identifier, 'title': p.title,
                'manual': p.product_user_manual, 'quality': p.quality_information_document}
    except Exception as e:  # senza rete il manifest si scrive lo stesso, senza DOI
        print(f'  ! catalogo non raggiungibile per {product_id}: {e}')
        return {}


def bias_meta():
    p = frames.DATA / 'bias' / 'stats.json'
    if not p.exists():
        return {'available': False}
    st = json.loads(p.read_text())
    return {'available': True, 'from': st['from'], 'to': st['to'], 'smooth_deg': st['smooth_deg']}


# da alzare se si rigenerano fotogrammi gia' pubblicati (nuova codifica,
# correzione): i browser buttano quelli salvati e li riscaricano
CACHE_FRAMES = 1


def build():
    used = []

    def src(ds_id):
        if ds_id not in used:
            used.append(ds_id)
        return used.index(ds_id)

    tiers = {}
    for tier, conf in TIERS.items():
        per_var = {v: frames.load_index(tier, v) for v in conf['vars']}
        # tengo solo gli istanti per cui il file c'e' davvero
        for v, idx in per_var.items():
            per_var[v] = {s: d for s, d in idx.items() if frames.frame_path(tier, v, s).exists()}
        # gli istanti della serie sono quelli del mare (temperatura, correnti): un
        # mese che ha solo il livello del mare o la pioggia aspetta gli altri
        base = [v for v in conf['vars'] if v in ('sst', 'cur', 'ostia', 'med')]
        stamps = sorted(set().union(*[set(per_var[v]) for v in base]))
        if not stamps:
            continue
        rows = []
        for s in stamps:
            row = {'t': s}
            for v in conf['vars']:
                if s in per_var[v]:
                    row[v] = src(per_var[v][s])
            rows.append(row)
        tiers[tier] = {
            # solo le variabili che hanno fotogrammi: la pagina nasconde le altre
            'dir': frames.TIER_DIR[tier], 'step': conf['step'], 'vars': [v for v in conf['vars'] if per_var[v]],
            'first': stamps[0], 'last': stamps[-1], 'frames': rows,
        }

    # peso medio delle anteprime per livello e variabile: la pagina lo usa per
    # dire quanto pesa scaricare una serie prima di guardarla
    prev_bytes = {}
    for tier, conf in tiers.items():
        for v in conf['vars']:
            d = frames.DATA / 'p' / conf['dir'] / v
            files = list(d.glob('*.webp')) if d.exists() else []
            if not files:                    # il Mediterraneo non ha anteprime: e' gia' leggero
                d = frames.DATA / conf['dir'] / v
                files = list(d.glob('*.png')) if d.exists() else []
            if files:
                prev_bytes.setdefault(tier, {})[v] = round(sum(f.stat().st_size for f in files) / len(files))
    # versione dei file fissi (terra, coste, climatologia, percentili) per la
    # cache del browser: dal contenuto, perche' derived.py li riscrive a ogni
    # aggiornamento anche quando sono identici
    h = hashlib.sha1()
    for d in ['static', 'clim', 'p90', 'bias']:
        for f in sorted((frames.DATA / d).glob('*')):
            h.update(f.name.encode() + hashlib.sha1(f.read_bytes()).digest())
    # i fotogrammi non cambiano mai; le anteprime dipendono anche dalla codifica
    frames_v = f'{CACHE_FRAMES}-' + hashlib.sha1(json.dumps({k: preview.META[k] for k in ('sst', 'cur')}, sort_keys=True).encode()).hexdigest()[:6]

    out = {
        'generated': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'),
        'grid': {'nlat': grid.NLAT, 'nlon': grid.NLON, 'step': grid.STEP,
                 'lat0': float(grid.LATS[0]), 'lon0': float(grid.LONS[0])},
        'encoding': {'scalar': {'offset': encode.SCALAR_OFFSET, 'step': encode.SCALAR_STEP,
                                'offsets': encode.SCALAR_OFFSETS},
                     'vector': {'step': encode.VECTOR_STEP, 'zero': encode.VECTOR_ZERO}},
        # anteprime per la riproduzione (pipeline/preview.py): stessi istanti,
        # meno bit; ci sono solo se la cartella p/ e' stata generata
        'preview': dict(preview.META, available=(frames.DATA / 'p').exists(), bytes=prev_bytes),
        # cache del browser (app/decode-worker.js): i fotogrammi non cambiano mai
        # una volta scritti (frames.py crea solo quelli mancanti), quindi restano
        # validi finche' non si alza 'frames'; i file fissi seguono 'static'
        'cache': {'frames': frames_v, 'static': h.hexdigest()[:12]},
        'climatology': {'years': list(derived.CLIM_YEARS),
                        'available': (frames.DATA / 'clim' / 'sst-01.png').exists(),
                        # differenza anfc − GLORYS per mese (pipeline/bias.py): si somma
                        # alla climatologia quando la temperatura viene da anfc
                        'bias': bias_meta()},
        'series': {'tile': derived.TILE,
                   'available': (frames.DATA / 'series' / 'sst.json').exists()},
        # terraferma: percentuale del normale dello stesso mese (pipeline/land.py)
        'land': {'clim_years': list(land.CLIM), 'encoding': 'percent'},
        'regional': {n: json.loads((frames.DATA / 'index' / f'{n}-grid.json').read_text())
                     for n in ['med'] if (frames.DATA / 'index' / f'{n}-grid.json').exists()},
        'sources': [dict(id=d, **sources.DATASETS[d], **product_meta(sources.DATASETS[d]['product'])) for d in used],
        'tiers': tiers,
    }
    p = frames.DATA / 'manifest.json'
    p.write_text(json.dumps(out, separators=(',', ':')))
    for t, c in tiers.items():
        print(f"{t}: {len(c['frames'])} istanti, {c['first']} → {c['last']}")
    return out


if __name__ == '__main__':
    build()
