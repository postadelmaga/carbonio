"""CO₂ nell'aria e flussi di carbonio alla superficie, mensili dal 1993.

Fonte: Copernicus Atmosphere Monitoring Service (Atmosphere Data Store),
inversione CAMS dei gas serra (cams-global-greenhouse-gas-inversion, versione
"latest", osservazioni da stazioni al suolo: la serie piu' lunga e omogenea).
L'inversione usa un modello dei venti per risalire, dalle concentrazioni
misurate, ai flussi che le hanno prodotte. Griglia nativa 1° (180 × 360):
i fotogrammi restano a 1°, la pagina li interpola sulla GPU.

    co2      colonna media di CO₂ (XCO2), media del mese dei campi ogni 3 ore, ppm
    co2foss  emissioni fossili, g di carbonio per m² al giorno (media del mese)
    co2nat   scambio naturale netto (terra, con gli incendi, e oceano), g C/m² al giorno:
             positivo = la superficie emette, negativo = assorbe

Credenziali: la stessa chiave personale del Climate Data Store (~/.cdsapirc),
che vale anche per l'Atmosphere Data Store; licenza del dataset e condizioni
del sito accettate una volta sul sito ADS.

    python co2.py                 scarica i mesi che mancano e scrive i fotogrammi
    python co2.py 1993 2000       solo quegli anni (il servizio mette in coda ogni
                                  richiesta: piu' processi su anni diversi vanno piu' veloci)
"""
import datetime as dt
import fcntl
import time
import os
import pathlib
import re
import sys
import tempfile
import zipfile

import numpy as np
import xarray as xr

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import encode  # noqa: E402
import frames  # noqa: E402

ADS = 'https://ads.atmosphere.copernicus.eu/api'
DATASET = 'cams-global-greenhouse-gas-inversion'
FIRST_YEAR = 1993
VARS = ['co2', 'co2foss', 'co2nat']
NLAT, NLON = 180, 360


def client():
    import cdsapi
    key = re.search(r'key:\s*(\S+)', (pathlib.Path.home() / '.cdsapirc').read_text()).group(1)
    return cdsapi.Client(url=ADS, key=key, quiet=True, progress=False)


def fetch(c, quantity, aggregation, year, months, tmp):
    """Un anno (o i mesi chiesti) in una richiesta sola: il servizio mette in coda
    ogni richiesta e ne rifiuta di parallele. Restituisce i file NetCDF per mese."""
    f = pathlib.Path(tmp) / f'{quantity}.dl'
    req = {
        'variable': 'carbon_dioxide', 'quantity': quantity, 'input_observations': 'surface',
        'time_aggregation': aggregation, 'version': 'latest', 'year': str(year),
        'month': [f'{m:02d}' for m in months],
    }
    for attempt in range(40):
        try:
            c.retrieve(DATASET, req).download(str(f))
            break
        except Exception as e:
            # coda piena (un'altra richiesta nostra o del servizio): si aspetta
            if 'queued requests' not in str(e) or attempt == 39:
                raise
            print(f'  coda piena, riprovo fra 3 minuti', flush=True)
            time.sleep(180)
    out = {}
    if zipfile.is_zipfile(f):
        z = zipfile.ZipFile(f)
        for name in z.namelist():
            z.extract(name, tmp)
            m = re.search(r'_(\d{4})(\d{2})\.nc$', name)
            out[int(m.group(2))] = pathlib.Path(tmp) / name
        f.unlink()
    else:
        assert len(months) == 1
        out[months[0]] = f
    return out


def north_up(a, lat):
    """Righe dal nord al sud, come tutti i fotogrammi; verifica la griglia."""
    lat = np.asarray(lat)
    assert a.shape == (NLAT, NLON) and abs(abs(lat[0]) - 89.5) < 1e-3, 'griglia CAMS inattesa'
    return a[::-1] if lat[0] < lat[-1] else a


def year_frames(c, year, months):
    """{mese: {'co2': ..., 'co2foss': ..., 'co2nat': ...}} per i mesi chiesti."""
    res = {}
    with tempfile.TemporaryDirectory() as tmp:
        cols = fetch(c, 'mean_column', 'instantaneous', year, months, tmp)
        fluxes = fetch(c, 'surface_flux', 'monthly_mean', year, months, tmp)
        for month in sorted(set(cols) & set(fluxes)):
            with xr.open_dataset(cols[month]) as ds:
                x = ds['XCO2']
                assert x.sizes['time'] >= 28 * 8 * 0.9, f'pochi campi nel mese: {x.sizes["time"]}'
                co2 = north_up(x.mean('time').values * 1e6, ds.latitude.values)       # mol/mol → ppm
            cols[month].unlink()
            with xr.open_dataset(fluxes[month]) as ds:
                lat = ds.latitude.values
                days = (dt.date(year + month // 12, month % 12 + 1, 1) - dt.date(year, month, 1)).days
                # kg C/m² nel mese → g C/m² al giorno (la citta' piu' intensa sta sotto i 50)
                g = lambda v: north_up(np.asarray(ds[v].values, dtype=np.float64).squeeze() * 1000 / days, lat)
                res[month] = {'co2': co2, 'co2foss': g('flux_foss'), 'co2nat': g('flux_apos_bio') + g('flux_apos_ocean')}
    return res


def last_month():
    """L'inversione si aggiorna una o poche volte l'anno: si prova fino al mese scorso."""
    t = dt.date.today().replace(day=1) - dt.timedelta(days=1)
    return t.year, t.month


def write_index():
    """L'indice si ricostruisce dai file presenti: piu' processi in parallelo non
    si sovrascrivono le voci a vicenda."""
    for v in VARS:
        d = frames.DATA / frames.TIER_DIR['monthly'] / v
        frames.save_index('monthly', v, {p.stem: DATASET for p in sorted(d.glob('[0-9][0-9][0-9][0-9]-[0-9][0-9].png'))} if d.exists() else {})


def main(y0=FIRST_YEAR, y1=None):
    # un processo alla volta: il servizio rifiuta richieste parallele, e il
    # timer giornaliero non deve disturbare uno scaricamento lungo gia' in corso
    frames.DATA.joinpath('logs').mkdir(parents=True, exist_ok=True)
    lock = open(frames.DATA / 'logs' / 'co2.lock', 'w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        # l'indice si rifa' comunque dai file gia' scritti: il manifest del
        # giorno pubblica i mesi pronti mentre lo scaricamento lungo continua
        write_index()
        print('co2: un altro scaricamento e\' gia\' in corso, salto (indice aggiornato)', flush=True)
        return
    c = client()
    ly, lm = last_month()
    y1 = min(y1 or ly, ly)
    made = 0
    for year in range(y0, y1 + 1):
        months = [m for m in range(1, 13 if year < ly else lm + 1)
                  if not all(frames.frame_path('monthly', v, f'{year}-{m:02d}').exists() for v in VARS)]
        if not months:
            continue
        try:
            got = year_frames(c, year, months)
        except Exception as e:
            msg = str(e)
            # oltre l'ultimo anno pubblicato il servizio rifiuta la richiesta: ci si ferma
            if 'valid combination' in msg or 'not available' in msg.lower():
                print(f'  {year}: non ancora pubblicato, mi fermo', flush=True)
                break
            raise
        for month, fields in sorted(got.items()):
            s = f'{year}-{month:02d}'
            for v in VARS:
                out = frames.frame_path('monthly', v, s)
                out.parent.mkdir(parents=True, exist_ok=True)
                encode.save_png(encode.encode_scalar(fields[v], offset=encode.SCALAR_OFFSETS.get(v, encode.SCALAR_OFFSET)), out)
            made += 1
            print(f'  {s}: CO₂ {np.nanmean(fields["co2"]):.1f} ppm', flush=True)
        write_index()
    write_index()
    print(f'co2: {made} mesi nuovi', flush=True)


if __name__ == '__main__':
    main(*[int(a) for a in sys.argv[1:3]])
