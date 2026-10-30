"""Scrive data/manifest.json: l'unico file che il browser legge per sapere
quali fotogrammi esistono, da quale dataset viene ognuno e che passo hanno.

Le sorgenti sono elencate una volta (`sources`) e ogni fotogramma ne porta
l'indice, cosi' il file resta piccolo anche con migliaia di istanti.
"""
import datetime as dt
import functools
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
import sources  # noqa: E402

TIERS = {
    'monthly': dict(step='P1M', vars=['sst', 'cur']),
    'daily': dict(step='P1D', vars=['sst', 'cur', 'ostia', 'med']),
    'hourly': dict(step='PT1H', vars=['sst', 'cur']),
}


@functools.lru_cache(maxsize=None)
def product_meta(product_id):
    """DOI e titolo del prodotto, dal catalogo Copernicus (per l'attribuzione)."""
    try:
        p = cm.describe(product_id=product_id).products[0]
        return {'doi': p.digital_object_identifier, 'title': p.title,
                'manual': p.product_user_manual, 'quality': p.quality_information_document}
    except Exception as e:  # senza rete il manifest si scrive lo stesso, senza DOI
        print(f'  ! catalogo non raggiungibile per {product_id}: {e}')
        return {}


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
        stamps = sorted(set().union(*[set(i) for i in per_var.values()]))
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
            'dir': frames.TIER_DIR[tier], 'step': conf['step'], 'vars': conf['vars'],
            'first': stamps[0], 'last': stamps[-1], 'frames': rows,
        }

    out = {
        'generated': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'),
        'grid': {'nlat': grid.NLAT, 'nlon': grid.NLON, 'step': grid.STEP,
                 'lat0': float(grid.LATS[0]), 'lon0': float(grid.LONS[0])},
        'encoding': {'scalar': {'offset': encode.SCALAR_OFFSET, 'step': encode.SCALAR_STEP},
                     'vector': {'step': encode.VECTOR_STEP, 'zero': encode.VECTOR_ZERO}},
        'climatology': {'years': list(derived.CLIM_YEARS),
                        'available': (frames.DATA / 'clim' / 'sst-01.png').exists()},
        'series': {'tile': derived.TILE,
                   'available': (frames.DATA / 'series' / 'sst.json').exists()},
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
