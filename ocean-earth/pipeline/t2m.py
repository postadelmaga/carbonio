"""Anomalia della temperatura dell'aria a 2 m, mensile dal 1993.

Fonte: Copernicus Climate Change Service (Climate Data Store), ERA5, media
mensile della temperatura a 2 m (reanalysis-era5-single-levels-monthly-means,
2m_temperature, griglia 0,25°). Credenziali in ~/.cdsapirc, come land.py.

Ogni fotogramma e' la DIFFERENZA, in °C, dalla media 1991–2020 dello stesso
mese: e' la base che Copernicus usa nei suoi bollettini (Climate Pulse,
Global Climate Highlights), cosi' i numeri della pagina si confrontano
direttamente con i loro. Per questo si scaricano anche il 1991 e il 1992, che
servono alla climatologia ma non diventano fotogrammi (la serie parte dal 1993).

I fotogrammi stanno sulla griglia di 1° dell'aria (180 × 360, centri a ±89,5°,
come CAMS in co2.py): un'anomalia di temperatura varia lentamente nello spazio,
e a 1° un mese pesa qualche decina di kB invece del megabyte a 0,25°.
Codifica scalare con zero proprio (encode.SCALAR_OFFSETS['t2m'] = -50 °C).

    python t2m.py         scarica gli anni che mancano (uno per richiesta) e
                          scrive i fotogrammi mancanti in data/m/t2m

Cache: ~/.cache/ocean-earth/land/t2m/<anno>.npy (float32, 12 × 180 × 360, °C).
Serie per il grafico del punto e della regione: vedi write_series.
"""
import fcntl
import json
import pathlib
import sys
import tempfile

import numpy as np
import xarray as xr

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import encode  # noqa: E402
import frames  # noqa: E402
import grid  # noqa: E402
import land  # noqa: E402

CACHE = land.CACHE / 't2m'
DS = 'reanalysis-era5-single-levels-monthly-means'
SOURCE = DS + '/2t'          # chiave in sources.py (lo stesso dataset da' anche la pioggia)
FIRST_YEAR = 1991
FIRST_FRAME = 1993
CLIM = (1991, 2020)
NLAT, NLON = 180, 360
K = 4                         # celle da 0,25° per lato in una cella da 1°


def to_1deg(da):
    """ERA5 0,25° → celle di grid.py (0,25°) → blocchi 4 × 4 da 1°, pesati
    sull'area (coseno della latitudine)."""
    f = land.to_grid(da)                                  # (720, 1440), righe da nord
    w = np.cos(np.radians(grid.LATS))[:, None] * np.isfinite(f)
    v = np.where(np.isfinite(f), f, 0.0) * w
    sv = v.reshape(NLAT, K, NLON, K).sum(axis=(1, 3))
    sw = w.reshape(NLAT, K, NLON, K).sum(axis=(1, 3))
    out = np.full((NLAT, NLON), np.nan, np.float32)
    out[sw > 0] = (sv[sw > 0] / sw[sw > 0]).astype(np.float32)
    return out


def fetch(year, months):
    import cdsapi
    c = cdsapi.Client(quiet=True, progress=False)
    with tempfile.TemporaryDirectory() as tmp:
        f = pathlib.Path(tmp) / 'x.nc'
        c.retrieve(DS, {
            'product_type': ['monthly_averaged_reanalysis'], 'variable': ['2m_temperature'],
            'year': [str(year)], 'month': [f'{m:02d}' for m in months], 'time': ['00:00'],
            'data_format': 'netcdf', 'download_format': 'unarchived',
        }).download(str(f))
        with xr.open_dataset(f) as ds:
            da = ds['t2m']
            tname = 'valid_time' if 'valid_time' in da.dims else 'time'
            got = {}
            for i in range(da.sizes[tname]):
                t = np.datetime64(da[tname].values[i], 'M').astype(object)
                got[t.month] = to_1deg(da.isel({tname: i}).squeeze()) - 273.15     # K → °C
    return got


def path(year):
    return CACHE / f'{year}.npy'


def load_year(year):
    p = path(year)
    return np.load(p) if p.exists() else None


def update_cache():
    CACHE.mkdir(parents=True, exist_ok=True)
    ly, lm = land.last_month()
    for year in range(FIRST_YEAR, ly + 1):
        want = list(range(1, 13 if year < ly else lm + 1))
        cur = load_year(year)
        have = set() if cur is None else {m + 1 for m in range(12) if np.isfinite(cur[m]).any()}
        missing = [m for m in want if m not in have]
        if not missing:
            continue
        print(f'  t2m {year}: mesi {missing[0]}…{missing[-1]}', flush=True)
        try:
            got = fetch(year, missing)
        except Exception as e:
            # l'ultimo mese puo' non essere ancora pubblicato: si riprova la volta dopo
            print(f'  ! t2m {year}: {str(e)[:200]}', flush=True)
            if year == ly:
                continue
            raise
        arr = cur if cur is not None else np.full((12, NLAT, NLON), np.nan, np.float32)
        for m, field in got.items():
            arr[m - 1] = field
        tmp = path(year).with_suffix('.tmp.npy')
        np.save(tmp, arr)
        tmp.replace(path(year))


def climatology():
    """Media 1991–2020 di ogni mese dell'anno."""
    acc = np.zeros((12, NLAT, NLON))
    for year in range(CLIM[0], CLIM[1] + 1):
        a = load_year(year)
        if a is None or not np.isfinite(a).all():
            raise SystemExit(f't2m: manca (in parte) il {year}, serve per la climatologia {CLIM[0]}–{CLIM[1]}')
        acc += a
    return acc / (CLIM[1] - CLIM[0] + 1)


def write_frames():
    clim = climatology()
    idx = frames.load_index('monthly', 't2m')
    made = 0
    for year in range(FIRST_FRAME, 9999):
        arr = load_year(year)
        if arr is None:
            break
        for m in range(12):
            if not np.isfinite(arr[m]).any():
                continue
            s = f'{year}-{m + 1:02d}'
            out = frames.frame_path('monthly', 't2m', s)
            if out.exists():              # mai riscritti: i browser li tengono in cache
                idx.setdefault(s, SOURCE)
                continue
            out.parent.mkdir(parents=True, exist_ok=True)
            encode.save_png(encode.encode_scalar(arr[m] - clim[m], encode.SCALAR_OFFSETS['t2m']), out)
            idx[s] = SOURCE
            made += 1
    frames.save_index('monthly', 't2m', idx)
    print(f't2m: {made} fotogrammi nuovi, {len(idx)} in tutto', flush=True)


SERIES_TILE = 10              # celle di 1° per lato di tessera (10°)
SERIES_OFFSET = -100.0        # zero delle serie: le medie dell'Antartide scendono sotto -60 °C


def write_series():
    """series/t2m/R_C.png: per ogni tessera di 10° una riga per cella di 1°
    (100 righe) e una colonna per mese dal 1993 (l'anomalia, °C), piu' 12
    colonne finali con la media 1991–2020 di ogni mese: la pagina ricava la
    temperatura assoluta come anomalia + media. series/t2m.json elenca i mesi.
    Si riscrivono solo quando arriva un mese nuovo."""
    clim = climatology()
    stamps, rows = [], []
    for year in range(FIRST_FRAME, 9999):
        arr = load_year(year)
        if arr is None:
            break
        for m in range(12):
            if np.isfinite(arr[m]).all():
                stamps.append(f'{year}-{m + 1:02d}')
                rows.append(arr[m] - clim[m])
    meta_p = frames.DATA / 'series' / 't2m.json'
    meta = {'tile': SERIES_TILE, 'grid': 1.0, 'offset': SERIES_OFFSET, 'clim': list(CLIM), 'stamps': stamps}
    out = frames.DATA / 'series' / 't2m'
    if meta_p.exists() and json.loads(meta_p.read_text()) == meta and out.exists():
        print('t2m: serie gia\' aggiornate', flush=True)
        return
    out.mkdir(parents=True, exist_ok=True)
    stack = np.stack(rows)                                   # (mesi, 180, 360)
    T = SERIES_TILE
    for r in range(NLAT // T):
        for c in range(NLON // T):
            a = stack[:, r * T:(r + 1) * T, c * T:(c + 1) * T].reshape(len(stamps), T * T).T
            cl = clim[:, r * T:(r + 1) * T, c * T:(c + 1) * T].reshape(12, T * T).T
            encode.save_png(encode.encode_scalar(np.concatenate([a, cl], axis=1), SERIES_OFFSET), out / f'{r}_{c}.png')
    tmp = meta_p.with_suffix('.tmp')
    tmp.write_text(json.dumps(meta))
    tmp.replace(meta_p)                                      # per ultimo: le tessere ci sono gia'
    print(f't2m: serie di {len(stamps)} mesi in {(NLAT // T) * (NLON // T)} tessere', flush=True)


def main():
    # un processo alla volta: lo scaricamento iniziale (36 anni) dura ore e il
    # timer giornaliero non deve scrivere la stessa cache insieme
    frames.DATA.joinpath('logs').mkdir(parents=True, exist_ok=True)
    lock = open(frames.DATA / 'logs' / 't2m.lock', 'w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print('t2m: un altro scaricamento e\' gia\' in corso, salto', flush=True)
        return
    update_cache()
    write_frames()
    write_series()


if __name__ == '__main__':
    main()
