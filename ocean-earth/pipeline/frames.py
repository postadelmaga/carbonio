"""Scarica i dati Copernicus e genera i fotogrammi PNG, in modo incrementale.

    python frames.py monthly sst  [--start 1993-01-01] [--end ...]
    python frames.py daily   cur  --start 2024-01-01
    python frames.py hourly  sst  --days 14

Un fotogramma gia' presente non viene riscaricato: rilanciare lo stesso comando
riprende da dove si era fermato e aggiunge solo i giorni nuovi. Il NetCDF
grezzo di ogni blocco si cancella appena elaborato.
"""
import argparse
import datetime as dt
import json
import os
import pathlib
import sys
import time

import numpy as np
import xarray as xr

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import encode  # noqa: E402
import grid  # noqa: E402
import sources  # noqa: E402

DATA = HERE.parent / 'data'
RAW = pathlib.Path(os.environ.get('OCEAN_EARTH_RAW', pathlib.Path.home() / '.cache' / 'ocean-earth' / 'raw'))
TIER_DIR = {'monthly': 'm', 'daily': 'd', 'hourly': 'h'}
# quanti passi temporali per ogni download: abbastanza da ammortizzare la
# richiesta, abbastanza pochi da non riempire la memoria (7 GB, 1/12° globale)
CHUNK = {('monthly', 'sst'): 6, ('monthly', 'cur'): 24, ('daily', 'sst'): 8, ('daily', 'cur'): 31,
         ('daily', 'ostia'): 2, ('hourly', 'sst'): 12, ('hourly', 'cur'): 48}


def stamp(tier, t):
    if tier == 'monthly':
        return t.strftime('%Y-%m')
    if tier == 'daily':
        return t.strftime('%Y-%m-%d')
    return t.strftime('%Y-%m-%dT%H')


def steps(tier, lo, hi):
    """Gli istanti attesi fra lo e hi compresi."""
    out = []
    if tier == 'monthly':
        t = dt.datetime(lo.year, lo.month, 1)
        if t < lo:
            t = _add_month(t)
        while t <= hi:
            out.append(t)
            t = _add_month(t)
    else:
        delta = dt.timedelta(days=1) if tier == 'daily' else dt.timedelta(hours=1)
        t = lo.replace(minute=0, second=0, microsecond=0)
        if tier == 'daily':
            t = t.replace(hour=0)
        if t < lo:
            t += delta
        while t <= hi:
            out.append(t)
            t += delta
    return out


def _add_month(t):
    return dt.datetime(t.year + (t.month == 12), t.month % 12 + 1, 1)


def last_complete_month_start():
    today = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
    first_this = dt.datetime(today.year, today.month, 1)
    prev = first_this - dt.timedelta(days=1)
    return dt.datetime(prev.year, prev.month, 1)


def frame_path(tier, var, s):
    return DATA / TIER_DIR[tier] / var / f'{s}.png'


def index_path(tier, var):
    return DATA / 'index' / f'{tier}-{var}.json'


def load_index(tier, var):
    p = index_path(tier, var)
    return json.loads(p.read_text()) if p.exists() else {}


def save_index(tier, var, idx):
    p = index_path(tier, var)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix('.tmp')
    tmp.write_text(json.dumps(dict(sorted(idx.items())), indent=0))
    tmp.replace(p)


def download(ds_id, lo, hi, tag):
    import copernicusmarine as cm
    meta = sources.DATASETS[ds_id]
    RAW.mkdir(parents=True, exist_ok=True)
    name = f'{tag}-{lo:%Y%m%d%H}-{hi:%Y%m%d%H}.nc'
    target = RAW / name
    if target.exists():
        target.unlink()
    kw = dict(dataset_id=ds_id, variables=meta['var'].split(','),
              start_datetime=lo.strftime('%Y-%m-%dT%H:%M:%S'), end_datetime=hi.strftime('%Y-%m-%dT%H:%M:%S'),
              output_directory=str(RAW), output_filename=name, disable_progress_bar=True)
    if meta['depth']:
        kw.update(minimum_depth=0, maximum_depth=1)
    for attempt in range(4):
        try:
            cm.subset(**kw)
            return target
        except Exception as e:  # rete o servizio: riprova con pazienza
            print(f'  ! download fallito ({e}); nuovo tentativo', flush=True)
            time.sleep(20 * (attempt + 1))
    raise RuntimeError(f'download fallito: {ds_id} {lo} {hi}')


def _surface(da):
    if 'depth' in da.dims:
        da = da.isel(depth=0)
    return da


def process(var, ds, i):
    """Il campo di un istante portato sulla griglia comune; codificato in RGB."""
    if var == 'sst':
        f = _surface(ds['thetao'].isel(time=i)).values
        return encode.encode_scalar(grid.from_twelfth(f, ds.latitude.values, ds.longitude.values))
    if var == 'ostia':
        sst = ds['analysed_sst'].isel(time=i).values.astype(np.float64)
        if np.nanmean(sst) > 200:                       # kelvin → °C
            sst = sst - 273.15
        # mask OSTIA: 1 mare, 2 terra, 4 lago, 8 ghiaccio, 16 fiume. Si tiene solo il
        # mare (anche coperto dal ghiaccio): niente laghi e niente terra.
        m = ds['mask'].isel(time=i).values
        m = np.nan_to_num(m, nan=2).astype(np.int64)
        sst[(m & 22) != 0] = np.nan
        return encode.encode_scalar(grid.from_twentieth(sst, ds.latitude.values, ds.longitude.values))
    if var == 'cur':
        u = _surface(ds['uo'].isel(time=i)).values
        v = _surface(ds['vo'].isel(time=i)).values
        lat, lon = ds.latitude.values, ds.longitude.values
        return encode.encode_vector(grid.from_quarter(u, lat, lon), grid.from_quarter(v, lat, lon))
    raise ValueError(var)


def run(tier, var, start, end):
    idx = load_index(tier, var)
    todo_total = 0
    for ds_id, lo, hi in sources.plan(tier, var, start, end):
        wanted = steps(tier, lo, hi)
        missing = [t for t in wanted if not frame_path(tier, var, stamp(tier, t)).exists()]
        # un fotogramma gia' fatto con un'altra sorgente resta, ma l'indice si allinea
        for t in wanted:
            s = stamp(tier, t)
            if frame_path(tier, var, s).exists() and s not in idx:
                idx[s] = ds_id
        print(f'{tier}/{var}: {ds_id} {lo:%Y-%m-%d %H} → {hi:%Y-%m-%d %H}: '
              f'{len(wanted)} attesi, {len(missing)} da fare', flush=True)
        todo_total += len(missing)
        n = CHUNK[(tier, var)]
        for k in range(0, len(missing), n):
            block = missing[k:k + n]
            b_lo = block[0]
            b_hi = block[-1]
            if tier == 'monthly':
                b_hi = b_hi + dt.timedelta(days=1)     # basta a includere il primo del mese
            t0 = time.time()
            nc = download(ds_id, b_lo, b_hi, f'{tier}-{var}')
            try:
                with xr.open_dataset(nc) as ds:
                    for i, tv in enumerate(ds['time'].values):
                        t = sources._to_dt(tv)
                        s = stamp(tier, t)
                        if t not in block and s not in {stamp(tier, x) for x in block}:
                            continue
                        rgb = process(var, ds, i)
                        encode.save_png(rgb, frame_path(tier, var, s))
                        idx[s] = ds_id
            finally:
                nc.unlink(missing_ok=True)
            save_index(tier, var, idx)
            print(f'  {stamp(tier, block[0])} … {stamp(tier, block[-1])}  ({time.time() - t0:.0f} s)', flush=True)
    save_index(tier, var, idx)
    print(f'{tier}/{var}: fatto ({todo_total} fotogrammi nuovi)', flush=True)


def prune(tier, var, start):
    """Toglie i fotogrammi piu' vecchi della finestra (giornaliero e orario scorrono)."""
    idx = load_index(tier, var)
    first = stamp(tier, start)
    for s in list(idx):
        if s < first:
            frame_path(tier, var, s).unlink(missing_ok=True)
            del idx[s]
    save_index(tier, var, idx)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('tier', choices=['monthly', 'daily', 'hourly'])
    ap.add_argument('var', choices=['sst', 'cur', 'ostia'])
    ap.add_argument('--start')
    ap.add_argument('--end')
    ap.add_argument('--days', type=int, help='finestra mobile che finisce ieri')
    a = ap.parse_args()
    end = dt.datetime.fromisoformat(a.end) if a.end else sources.yesterday_end()
    if a.tier == 'monthly':
        end = min(end, last_complete_month_start())
    if a.days:
        y = sources.yesterday_end()
        start = dt.datetime(y.year, y.month, y.day) - dt.timedelta(days=a.days - 1)
    else:
        start = dt.datetime.fromisoformat(a.start or '1993-01-01')
    run(a.tier, a.var, start, end)
    if a.days:
        prune(a.tier, a.var, start)


if __name__ == '__main__':
    main()
