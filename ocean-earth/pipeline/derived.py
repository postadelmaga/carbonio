"""Prodotti derivati dai fotogrammi mensili, piu' terra e coste.

- static/land.png       maschera delle terre emerse 4096×2048 (Natural Earth 1:50m)
- static/coast.json     linee di costa (Natural Earth 1:50m), lon/lat ×100 interi
- clim/sst-MM.png       climatologia mensile della temperatura, 1993–2020
- p90/sst-MM.png        90° percentile mensile 1993–2020 (per gli hotspot)
- series/sst/R_C.png    serie mensile per tessere di 5°: una riga per cella
                        (20×20 = 400 righe), una colonna per mese

La base climatologica e' 1993–2020 e non 1991–2020: i dati scelti cominciano
nel 1993. Lo dichiara anche l'interfaccia.
"""
import json
import pathlib
import sys
import urllib.request

import numpy as np
from PIL import Image, ImageDraw

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import encode  # noqa: E402
import frames  # noqa: E402
import grid  # noqa: E402

DATA = frames.DATA
CLIM_YEARS = (1993, 2020)
TILE = 20                       # celle di 0,25° per lato di tessera (5°)
NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/'


def _ne(name):
    cache = frames.RAW.parent / 'ne'
    cache.mkdir(parents=True, exist_ok=True)
    p = cache / name
    if not p.exists():
        urllib.request.urlretrieve(NE + name, p)
    return json.loads(p.read_text())


def _rings(geom):
    t, c = geom['type'], geom['coordinates']
    if t == 'Polygon':
        return c
    if t == 'MultiPolygon':
        return [r for poly in c for r in poly]
    if t == 'LineString':
        return [c]
    if t == 'MultiLineString':
        return c
    return []


def land_and_coast():
    out = DATA / 'static'
    out.mkdir(parents=True, exist_ok=True)
    W, H = 4096, 2048
    im = Image.new('L', (W, H), 0)
    dr = ImageDraw.Draw(im)
    land = _ne('ne_50m_land.geojson')
    for feat in land['features']:
        g = feat['geometry']
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        for poly in polys:
            for k, ring in enumerate(poly):
                pts = [((x + 180) / 360 * W, (90 - y) / 180 * H) for x, y in ring]
                dr.polygon(pts, fill=255 if k == 0 else 0)
    # ne_50m_land include i laghi nella terra: per il mare contano come terra
    im.save(out / 'land.png', optimize=True)

    coast = _ne('ne_50m_coastline.geojson')
    lines = []
    for feat in coast['features']:
        for line in _rings(feat['geometry']):
            q = [v for x, y in line for v in (round(x * 100), round(y * 100))]
            if len(q) >= 4:
                lines.append(q)
    (out / 'coast.json').write_text(json.dumps(lines, separators=(',', ':')))
    print(f'terra e coste: {len(lines)} linee')


def monthly_stack():
    """Tutti i mesi in un memmap float32 (mesi, 720, 1440), decodificati una volta."""
    idx = frames.load_index('monthly', 'sst')
    stamps = sorted(idx)
    path = frames.RAW.parent / 'sst-monthly.npy'
    path.parent.mkdir(parents=True, exist_ok=True)
    stack = np.lib.format.open_memmap(path, mode='w+', dtype=np.float32,
                                      shape=(len(stamps), grid.NLAT, grid.NLON))
    for k, s in enumerate(stamps):
        stack[k] = encode.decode_scalar(encode.load_png(frames.frame_path('monthly', 'sst', s)))
    stack.flush()
    return stamps, stack


def climatology(stamps, stack):
    years = np.array([int(s[:4]) for s in stamps])
    months = np.array([int(s[5:7]) for s in stamps])
    base = (years >= CLIM_YEARS[0]) & (years <= CLIM_YEARS[1])
    for m in range(1, 13):
        sel = np.where(base & (months == m))[0]
        assert len(sel) == CLIM_YEARS[1] - CLIM_YEARS[0] + 1, f'mese {m}: anni base mancanti'
        block = np.asarray(stack[sel])
        with np.errstate(all='ignore'):
            mean = np.nanmean(block, axis=0)
            p90 = np.nanpercentile(block, 90, axis=0)
        # una cella vale solo se e' mare in tutti gli anni della base
        full = np.isfinite(block).all(axis=0)
        mean[~full] = np.nan
        p90[~full] = np.nan
        encode.save_png(encode.encode_scalar(mean), DATA / 'clim' / f'sst-{m:02d}.png')
        encode.save_png(encode.encode_scalar(p90), DATA / 'p90' / f'sst-{m:02d}.png')
    print(f'climatologia {CLIM_YEARS[0]}–{CLIM_YEARS[1]}: 12 mesi')


def series(stamps, stack):
    out = DATA / 'series' / 'sst'
    out.mkdir(parents=True, exist_ok=True)
    n = 0
    for r in range(grid.NLAT // TILE):
        band = np.asarray(stack[:, r * TILE:(r + 1) * TILE, :])          # (mesi, 20, 1440)
        for c in range(grid.NLON // TILE):
            cube = band[:, :, c * TILE:(c + 1) * TILE]                    # (mesi, 20, 20)
            if not np.isfinite(cube).any():
                (out / f'{r}_{c}.png').unlink(missing_ok=True)
                continue
            img = cube.reshape(len(stamps), TILE * TILE).T                 # (400, mesi)
            encode.save_png(encode.encode_scalar(img), out / f'{r}_{c}.png')
            n += 1
    print(f'serie mensili: {n} tessere di 5° con mare, {len(stamps)} mesi')


def main():
    land_and_coast()
    stamps, stack = monthly_stack()
    climatology(stamps, stack)
    series(stamps, stack)
    (DATA / 'series' / 'sst.json').write_text(json.dumps({'tile': TILE, 'stamps': stamps}))


if __name__ == '__main__':
    main()
