"""Prodotti derivati dai fotogrammi mensili, piu' terra e coste.

- static/land.png       maschera delle terre emerse 4096×2048 (Natural Earth 1:50m)
- static/coast.json     linee di costa (Natural Earth 1:50m), lon/lat ×100 interi
- clim/sst-MM.png       climatologia mensile della temperatura, 1993–2020
- p90/sst-MM.png        90° percentile mensile 1993–2020 (per gli hotspot)
- series/sst/R_C.png    serie mensile per tessere di 5°: una riga per cella
                        (20×20 = 400 righe), una colonna per mese

La base climatologica e' 1993–2020 e non 1991–2020: i dati scelti cominciano
nel 1993. Lo dichiara anche l'interfaccia.

Tutto qui dipende solo dai fotogrammi MENSILI della temperatura, che cambiano
una volta al mese; la pipeline pero' gira ogni giorno. Si ricalcola quindi solo
cio' i cui ingressi sono cambiati dall'ultima corsa (fingerprint(), tenuta in
data/index/derived.json): la climatologia quando cambia un fotogramma degli
anni base — in pratica mai — e le serie quando arriva o cambia un mese. Prima
si rifaceva tutto ogni giorno: dieci minuti di CPU e una pila da 1,7 GB per
riscrivere file identici.

Niente pila di tutti i mesi: prima si decodificavano i 406 fotogrammi in un
file da 1,7 GB (mesi × 720 × 1440 in float32) da rileggere a fette, che su una
macchina da 1 GB di RAM non finisce mai (23 nov 2026, arch_db: 29 tessere su
2000 in 17 minuti). Ora la climatologia legge i 28 fotogrammi di un mese alla
volta, e le serie rileggono i fotogrammi SERIES_PASSES volte tenendo ogni volta
solo un sesto delle righe, nei due byte per cella del file.
"""
import hashlib
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
VERSION = 1                     # da alzare se cambia il MODO di calcolare climatologia o serie
STATE = DATA / 'index' / 'derived.json'      # index/ non si pubblica
SERIES_PASSES = 6               # passate sui fotogrammi per le serie: piu' passate, meno memoria
CLIM_ROWS = 60                  # righe per volta nel calcolo della climatologia
STATIC = ('land-8192.png', 'land.png', 'coast.json')
NE ='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/'


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
    land = _ne('ne_50m_land.geojson')
    # due risoluzioni: 8192 per le GPU che la reggono (coste nitide da vicino),
    # 4096 per le altre. ne_50m_land include i laghi nella terra, ed e' giusto
    # cosi': per il mare contano come terra.
    for W, name in ((8192, 'land-8192.png'), (4096, 'land.png')):
        H = W // 2
        im = Image.new('L', (W, H), 0)
        dr = ImageDraw.Draw(im)
        for feat in land['features']:
            g = feat['geometry']
            polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
            for poly in polys:
                for k, ring in enumerate(poly):
                    pts = [((x + 180) / 360 * W, (90 - y) / 180 * H) for x, y in ring]
                    dr.polygon(pts, fill=255 if k == 0 else 0)
        im.save(out / name, optimize=True)

    coast = _ne('ne_50m_coastline.geojson')
    lines = []
    for feat in coast['features']:
        for line in _rings(feat['geometry']):
            q = [v for x, y in line for v in (round(x * 100), round(y * 100))]
            if len(q) >= 4:
                lines.append(q)
    (out / 'coast.json').write_text(json.dumps(lines, separators=(',', ':')))
    print(f'terra e coste: {len(lines)} linee')


def fingerprint(stamps, idx):
    """Impronta dei fotogrammi mensili dati: per ognuno la fonte scritta
    nell'indice e il CONTENUTO del file. Cambia se un mese si aggiunge, se un
    fotogramma viene riscritto o se cambia il modo di calcolare (VERSION). Il
    contenuto e non la data del file: copiare i dati su un'altra macchina non
    deve far rifare tutto (230 MB da leggere, un paio di secondi)."""
    h = hashlib.sha256(f'{VERSION}|{CLIM_YEARS}|{TILE}\n'.encode())
    for s in stamps:
        body = hashlib.sha256(frames.frame_path('monthly', 'sst', s).read_bytes()).hexdigest()
        h.update(f'{s}|{idx.get(s)}|{body}\n'.encode())
    return h.hexdigest()


def month_bytes(s, rows=slice(None)):
    """I due byte per cella del valore di un mese, cosi' come stanno nel file."""
    return encode.load_png(frames.frame_path('monthly', 'sst', s))[rows, :, :2]


def degrees(raw):
    """Dai due byte ai gradi, in float32 come nella pila di prima."""
    return encode.decode_scalar(raw).astype(np.float32)


def climatology(stamps):
    years = np.array([int(s[:4]) for s in stamps])
    months = np.array([int(s[5:7]) for s in stamps])
    base = (years >= CLIM_YEARS[0]) & (years <= CLIM_YEARS[1])
    # un solo blocco, riusato per i dodici mesi: (anni, 720, 1440, 2)
    raw = np.empty((CLIM_YEARS[1] - CLIM_YEARS[0] + 1, grid.NLAT, grid.NLON, 2), dtype=np.uint8)
    for m in range(1, 13):
        sel = np.where(base & (months == m))[0]
        assert len(sel) == len(raw), f'mese {m}: anni base mancanti'
        for j, k in enumerate(sel):
            raw[j] = month_bytes(stamps[k])
        means, p90s = [], []
        # a fasce di righe: media e percentile sono cella per cella, il
        # risultato e' lo stesso e in memoria sta una fetta del blocco
        for r0 in range(0, grid.NLAT, CLIM_ROWS):
            block = degrees(raw[:, r0:r0 + CLIM_ROWS])
            # una cella vale solo se e' mare in tutti gli anni della base: cosi'
            # niente NaN nel calcolo, e il percentile ordinario (veloce) basta
            full = np.isfinite(block).all(axis=0)
            filled = np.where(full, block, 0.0)
            mean = filled.mean(axis=0)
            p90 = np.percentile(filled, 90, axis=0)
            mean[~full] = np.nan
            p90[~full] = np.nan
            means.append(mean)
            p90s.append(p90)
        encode.save_png(encode.encode_scalar(np.concatenate(means)), DATA / 'clim' / f'sst-{m:02d}.png')
        encode.save_png(encode.encode_scalar(np.concatenate(p90s)), DATA / 'p90' / f'sst-{m:02d}.png')
    print(f'climatologia {CLIM_YEARS[0]}–{CLIM_YEARS[1]}: 12 mesi')


def series(stamps):
    out = DATA / 'series' / 'sst'
    out.mkdir(parents=True, exist_ok=True)
    n = 0
    bands = grid.NLAT // TILE
    step = -(-bands // SERIES_PASSES)                # fasce di 5° per passata
    # i due byte del valore, cosi' come stanno nel file: (mesi, righe, 1440, 2).
    # Un solo blocco riusato a ogni passata: allocarne uno nuovo mentre il
    # vecchio e' ancora vivo raddoppiava il picco.
    raw = np.empty((len(stamps), step * TILE, grid.NLON, 2), dtype=np.uint8)
    for r0 in range(0, bands, step):
        r1 = min(r0 + step, bands)
        for k, s in enumerate(stamps):
            raw[k, :(r1 - r0) * TILE] = month_bytes(s, slice(r0 * TILE, r1 * TILE))
        for r in range(r0, r1):
            rows = raw[:, (r - r0) * TILE:(r - r0 + 1) * TILE]               # (mesi, 20, 1440, 2)
            for c in range(grid.NLON // TILE):
                cube = degrees(rows[:, :, c * TILE:(c + 1) * TILE])           # (mesi, 20, 20)
                if not np.isfinite(cube).any():
                    (out / f'{r}_{c}.png').unlink(missing_ok=True)
                    continue
                img = cube.reshape(len(stamps), TILE * TILE).T                 # (400, mesi)
                encode.save_png(encode.encode_scalar(img), out / f'{r}_{c}.png')
                n += 1
    print(f'serie mensili: {n} tessere di 5° con mare, {len(stamps)} mesi')


def main():
    # terra e coste vengono da Natural Earth a versione fissa: si fanno una volta
    if all((DATA / 'static' / n).exists() for n in STATIC):
        print('terra e coste: gia\' fatte')
    else:
        land_and_coast()

    idx = frames.load_index('monthly', 'sst')
    stamps = sorted(idx)
    base = [s for s in stamps if CLIM_YEARS[0] <= int(s[:4]) <= CLIM_YEARS[1]]
    want = {'clim': fingerprint(base, idx), 'series': fingerprint(stamps, idx)}
    have = json.loads(STATE.read_text()) if STATE.exists() else {}
    clim_files = [DATA / d / f'sst-{m:02d}.png' for d in ('clim', 'p90') for m in range(1, 13)]
    do_clim = have.get('clim') != want['clim'] or not all(p.exists() for p in clim_files)
    do_series = have.get('series') != want['series'] or not (DATA / 'series' / 'sst.json').exists()
    if not (do_clim or do_series):
        print(f'derivati: i {len(stamps)} fotogrammi mensili non sono cambiati, niente da rifare')
        return

    if do_clim:
        climatology(stamps)
    else:
        print(f'climatologia {CLIM_YEARS[0]}–{CLIM_YEARS[1]}: anni base invariati, non la rifaccio')
    if do_series:
        series(stamps)
        (DATA / 'series' / 'sst.json').write_text(json.dumps({'tile': TILE, 'stamps': stamps}))
    # per ultima: se la corsa si interrompe prima, la prossima rifa' tutto
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(want))


if __name__ == '__main__':
    main()
