"""Livelli di terraferma: precipitazioni e umidita' del suolo, mensili dal 1993.

Fonte: Copernicus Climate Change Service (Climate Data Store), non Copernicus
Marine. Credenziali in ~/.cdsapirc (token personale), MAI nel repository; le
licenze dei due dataset vanno accettate una volta sul sito del CDS.

    precip  ERA5, media mensile della precipitazione totale (griglia 0,25°)
    soil    ERA5-Land, umidita' volumetrica del primo strato di suolo, 0–7 cm (0,1°)

Ogni fotogramma e' la PERCENTUALE DEL NORMALE dello stesso mese 1993–2020:
100 = nella media, 50 = meta' della pioggia (o dell'acqua nel suolo) di un mese
tipico, 200 = il doppio. E' il modo piu' diretto di vedere siccita' ed eccessi;
la si codifica con encode_scalar come la temperatura (valori 0…600).
Dove il normale e' quasi zero (deserti nella stagione secca, ghiacciai) il
rapporto non ha senso e la cella resta senza dato.

    python land.py        scarica gli anni che mancano (uno per richiesta),
                          poi scrive i fotogrammi mancanti in data/m/precip e data/m/soil

I campi annuali gia' portati sulla griglia da 0,25° restano in
~/.cache/ocean-earth/land/<var>/<anno>.npy (float16, 12 mesi).
"""
import datetime as dt
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

CACHE = pathlib.Path.home() / '.cache' / 'ocean-earth' / 'land'
FIRST_YEAR = 1993
CLIM = (1993, 2020)
VARS = {
    'precip': dict(ds='reanalysis-era5-single-levels-monthly-means', var='total_precipitation',
                   scale=1000.0,          # m/giorno → mm/giorno
                   min_clim=0.2),         # mm/giorno: sotto, il rapporto non ha senso
    'soil': dict(ds='reanalysis-era5-land-monthly-means', var='volumetric_soil_water_layer_1',
                 scale=1.0, min_clim=0.03),  # m³/m³
}
MAX_RATIO = 600.0


def to_grid(da):
    """Da una griglia regolare lat/lon qualsiasi (ERA5 0,25°, ERA5-Land 0,1°) alle
    celle di grid.py: media dei punti che cadono in ogni cella. I punti sul bordo
    di due celle (ERA5) valgono meta' per ciascuna."""
    lat = da['latitude'].values.astype(np.float64)
    lon = ((da['longitude'].values.astype(np.float64) + 180) % 360) - 180
    v = da.values.astype(np.float64)                     # (lat, lon)
    ok = np.isfinite(v)
    val = np.where(ok, v, 0.0)
    w = ok.astype(np.float64)
    # posizione fine in unita' di cella: le celle sono [k, k+1) a partire da nord/ovest
    fy = (90.0 - lat) / grid.STEP
    fx = (lon + 180.0) / grid.STEP
    n = grid.NLAT * grid.NLON
    sv = np.zeros(n)
    sw = np.zeros(n)
    eps = 1e-6
    for ys, wy in _split(fy, grid.NLAT, eps):
        for xs, wx in _split(fx, grid.NLON, eps, wrap=True):
            ww = np.outer(wy, wx) * w
            cell = (ys[:, None] * grid.NLON + xs[None, :]).ravel()
            sv += np.bincount(cell, weights=(ww * val).ravel(), minlength=n)
            sw += np.bincount(cell, weights=ww.ravel(), minlength=n)
    sv = sv.reshape(grid.NLAT, grid.NLON)
    sw = sw.reshape(grid.NLAT, grid.NLON)
    out = np.full(sv.shape, np.nan, dtype=np.float32)
    good = sw > 0
    out[good] = (sv[good] / sw[good]).astype(np.float32)
    return out


def _split(f, n, eps, wrap=False):
    """Per ogni coordinata fine: la cella in cui cade e, se sta su un bordo, anche
    la cella accanto, ognuna con peso 1/2."""
    k = np.floor(f + eps).astype(int)
    on_edge = np.abs(f - np.round(f)) < eps
    a = k.copy()
    b = np.where(on_edge, k - 1, k)
    wa = np.where(on_edge, 0.5, 1.0)
    if wrap:
        a %= n
        b %= n
    else:
        a = np.clip(a, 0, n - 1)
        b = np.clip(b, 0, n - 1)
    return [(a, wa), (b, np.where(on_edge, 0.5, 0.0))]


def last_month():
    """Ultimo mese di cui ERA5 ha la media: di norma il mese scorso dopo il 6."""
    today = dt.date.today()
    m = dt.date(today.year, today.month, 1) - dt.timedelta(days=1)
    if today.day < 7:
        m = dt.date(m.year, m.month, 1) - dt.timedelta(days=1)
    return m.year, m.month


def cache_path(v, year):
    return CACHE / v / f'{year}.npy'


def load_year(v, year):
    p = cache_path(v, year)
    return np.load(p).astype(np.float32) if p.exists() else None


def fetch(v, year, months):
    import cdsapi
    conf = VARS[v]
    c = cdsapi.Client(quiet=True, progress=False)
    with tempfile.TemporaryDirectory() as tmp:
        f = pathlib.Path(tmp) / 'x.nc'
        c.retrieve(conf['ds'], {
            'product_type': ['monthly_averaged_reanalysis'], 'variable': [conf['var']],
            'year': [str(year)], 'month': [f'{m:02d}' for m in months], 'time': ['00:00'],
            'data_format': 'netcdf', 'download_format': 'unarchived',
        }).download(str(f))
        with xr.open_dataset(f) as ds:
            da = ds[list(ds.data_vars)[0]]
            tname = 'valid_time' if 'valid_time' in da.dims else 'time'
            got = {}
            for i in range(da.sizes[tname]):
                t = np.datetime64(da[tname].values[i], 'M').astype(object)
                got[t.month] = to_grid(da.isel({tname: i}).squeeze()) * conf['scale']
    return got


def update_cache():
    ly, lm = last_month()
    for v in VARS:
        (CACHE / v).mkdir(parents=True, exist_ok=True)
        for year in range(FIRST_YEAR, ly + 1):
            want = list(range(1, 13 if year < ly else lm + 1))
            cur = load_year(v, year)
            have = set() if cur is None else {m + 1 for m in range(12) if np.isfinite(cur[m]).any()}
            missing = [m for m in want if m not in have]
            if not missing:
                continue
            print(f'  {v} {year}: mesi {missing[0]}…{missing[-1]}', flush=True)
            try:
                got = fetch(v, year, missing)
            except Exception as e:
                # l'ultimo mese puo' non essere ancora pubblicato: si riprova la volta dopo
                print(f'  ! {v} {year}: {str(e)[:200]}', flush=True)
                if year == ly:
                    continue
                raise
            arr = cur if cur is not None else np.full((12, grid.NLAT, grid.NLON), np.nan, np.float32)
            for m, field in got.items():
                arr[m - 1] = field
            tmp = cache_path(v, year).with_suffix('.tmp.npy')
            np.save(tmp, arr.astype(np.float16))
            tmp.replace(cache_path(v, year))


def climatology(v):
    """Media 1993–2020 di ogni mese dell'anno."""
    acc = np.zeros((12, grid.NLAT, grid.NLON))
    n = np.zeros((12, grid.NLAT, grid.NLON))
    for year in range(CLIM[0], CLIM[1] + 1):
        a = load_year(v, year)
        if a is None:
            raise SystemExit(f'{v}: manca il {year}, serve per la climatologia {CLIM[0]}–{CLIM[1]}')
        ok = np.isfinite(a)
        acc += np.where(ok, a, 0)
        n += ok
    with np.errstate(all='ignore'):
        return acc / n


def write_frames():
    # solo terraferma: la maschera e' quella di ERA5-Land (che sul mare non ha dati)
    land = np.isfinite(climatology('soil')).any(axis=0)
    for v, conf in VARS.items():
        clim = climatology(v)
        clim[:, ~land] = np.nan
        idx = frames.load_index('monthly', v)
        made = 0
        for p in sorted((CACHE / v).glob('[0-9][0-9][0-9][0-9].npy')):
            year = int(p.stem)
            arr = load_year(v, year)
            for m in range(12):
                if not np.isfinite(arr[m]).any():
                    continue
                s = f'{year}-{m + 1:02d}'
                out = frames.frame_path('monthly', v, s)
                if out.exists():          # mai riscritti: i browser li tengono in cache
                    idx.setdefault(s, conf['ds'])
                    continue
                c = clim[m]
                with np.errstate(all='ignore'):
                    r = np.where(c >= conf['min_clim'], 100.0 * arr[m] / c, np.nan)
                r = np.clip(r, 0, MAX_RATIO)
                out.parent.mkdir(parents=True, exist_ok=True)
                encode.save_png(encode.encode_scalar(r), out)
                idx[s] = conf['ds']
                made += 1
        frames.save_index('monthly', v, idx)
        print(f'{v}: {made} fotogrammi nuovi, {len(idx)} in tutto', flush=True)


def main():
    update_cache()
    write_frames()


if __name__ == '__main__':
    main()
