"""Validazione scientifica dei dati pubblicati, contro gli originali Copernicus.

    .venv/bin/python pipeline/validate.py      → tests/validation-report.md

1. Punti a caso: il valore pubblicato di una cella contro la media ricalcolata
   qui, in modo indipendente da grid.py, dai dati nativi scaricati di nuovo.
2. Intervalli fisici: nessuna temperatura impossibile in nessun fotogramma.
3. Terra: celle con dato dove la costa di Natural Earth dice terra piena.
4. Orientamento: verso delle grandi correnti note sulla media pluriennale.
5. Cuciture: mese comune fra rianalisi e analisi operativa, fra riprocessato e
   tempo quasi reale; differenza media e scarto quadratico.
6. Continuita': istanti mancanti in ogni livello.
7. Anomalie: media nulla sul periodo di base, per costruzione.
"""
import datetime as dt
import json
import pathlib
import random
import sys

import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import copernicusmarine as cm  # noqa: E402
import derived  # noqa: E402
import encode  # noqa: E402
import frames  # noqa: E402
import grid  # noqa: E402
import sources  # noqa: E402

DATA = frames.DATA
REPORT = HERE.parent / 'tests' / 'validation-report.md'
out = []
summary = {}


def log(s=''):
    print(s, flush=True)
    out.append(s)


def published(tier, var, stamp):
    rgb = encode.load_png(frames.frame_path(tier, var, stamp))
    return encode.decode_vector(rgb) if var == 'cur' else encode.decode_scalar(rgb)


def ocean_cells(field, n, seed):
    rng = random.Random(seed)
    ok = np.isfinite(field)
    # le due colonne a cavallo dell'antimeridiano usano anche la colonna di -180°
    # della griglia fine: il ricalcolo qui sotto non la vede, quel caso lo copre
    # test_twelfth_dateline_wraps in tests/test_pipeline.py
    ok[:, [0, -1]] = False
    ok = np.argwhere(ok)
    return [tuple(ok[rng.randrange(len(ok))]) for _ in range(n)]


def to_time(tier, s):
    if tier == 'monthly':
        return dt.datetime.strptime(s, '%Y-%m')
    if tier == 'daily':
        return dt.datetime.strptime(s, '%Y-%m-%d')
    return dt.datetime.strptime(s, '%Y-%m-%dT%H')


def native_cell(ds_id, var, t, r, c):
    """Media di una cella di 0,25° ricalcolata dai dati nativi (pesi di bordo 1/2)."""
    meta = sources.DATASETS[ds_id]
    lat_n = grid.LATS[r] + 0.125
    lat_s = grid.LATS[r] - 0.125
    lon_w = grid.LONS[c] - 0.125
    lon_e = grid.LONS[c] + 0.125
    kw = dict(dataset_id=ds_id, variables=meta['var'].split(','),
              minimum_latitude=lat_s - 0.01, maximum_latitude=lat_n + 0.01,
              minimum_longitude=lon_w - 0.01, maximum_longitude=lon_e + 0.01,
              # come stringa: un datetime verrebbe letto come ora locale
              start_datetime=t.strftime('%Y-%m-%dT%H:%M:%S'), end_datetime=t.strftime('%Y-%m-%dT%H:%M:%S'))
    if meta['depth']:
        kw.update(minimum_depth=0, maximum_depth=1)
    ds = cm.open_dataset(**kw)
    names = {'sst': ['thetao'], 'ostia': ['analysed_sst'], 'cur': ['uo', 'vo']}[var]
    res = []
    for name in names:
        a = ds[name].isel(time=0)
        if 'depth' in a.dims:
            a = a.isel(depth=0)
        vals = a.values.astype(np.float64)
        if var == 'ostia':
            vals = vals - 273.15
            m = np.nan_to_num(ds['mask'].isel(time=0).values, nan=2).astype(np.int64)
            vals[(m & 22) != 0] = np.nan
        la = ds.latitude.values
        lo = ds.longitude.values
        if meta['res'] == '0.25°':
            j = int(np.argmin(np.abs(la - grid.LATS[r])))
            i = int(np.argmin(np.abs(lo - grid.LONS[c])))
            res.append(vals[j, i])
            continue
        # pesi: 1 dentro la cella, 1/2 sui bordi (solo 1/12°, dove i punti cadono sui bordi)
        wl = np.where((la > lat_s + 1e-6) & (la < lat_n - 1e-6), 1.0,
                      np.where((np.abs(la - lat_s) < 1e-6) | (np.abs(la - lat_n) < 1e-6), 0.5, 0.0))
        wo = np.where((lo > lon_w + 1e-6) & (lo < lon_e - 1e-6), 1.0,
                      np.where((np.abs(lo - lon_w) < 1e-6) | (np.abs(lo - lon_e) < 1e-6), 0.5, 0.0))
        if meta['res'] == '0.05°':          # nessun punto sui bordi
            wl = ((la > lat_s) & (la < lat_n)).astype(float)
            wo = ((lo > lon_w) & (lo < lon_e)).astype(float)
        w = wl[:, None] * wo[None, :]
        ok = np.isfinite(vals) & (w > 0)
        if w[ok].sum() < 0.5 * w.sum():
            res.append(np.nan)
        else:
            res.append(float((vals[ok] * w[ok]).sum() / w[ok].sum()))
    ds.close()
    return res


def check_points():
    log('## 1. Valori pubblicati contro gli originali Copernicus\n')
    log('| livello | variabile | istante | dataset | lat | lon | pubblicato | originale | differenza |')
    log('|---|---|---|---|---|---|---|---|---|')
    worst = {}
    cases = []
    for tier, var in [('monthly', 'sst'), ('monthly', 'cur'), ('daily', 'sst'), ('daily', 'cur'),
                      ('daily', 'ostia'), ('hourly', 'sst'), ('hourly', 'cur')]:
        idx = frames.load_index(tier, var)
        if not idx:
            continue
        stamps = sorted(idx)
        # il primo, l'ultimo e uno nel mezzo: anche ai cambi di sorgente
        picks = sorted({stamps[0], stamps[len(stamps) // 2], stamps[-1]})
        for s in picks:
            cases.append((tier, var, s, idx[s]))
    for k, (tier, var, s, ds_id) in enumerate(cases):
        pub = published(tier, var, s)
        field = pub[0] if var == 'cur' else pub
        for r, c in ocean_cells(field, 3, seed=k):
            orig = native_cell(ds_id, var, to_time(tier, s), r, c)
            vals = [pub[0][r, c], pub[1][r, c]] if var == 'cur' else [pub[r, c]]
            for comp, (p, o) in enumerate(zip(vals, orig)):
                d = p - o
                key = f'{tier}/{var}'
                worst[key] = max(worst.get(key, 0), abs(d) if np.isfinite(d) else 9e9)
                name = var if var != 'cur' else ('u' if comp == 0 else 'v')
                log(f'| {tier} | {name} | {s} | `{ds_id}` | {grid.LATS[r]:.3f} | {grid.LONS[c]:.3f} | {p:.4f} | {o:.4f} | {d:+.4f} |')
    log('')
    for key, w in worst.items():
        tol = encode.VECTOR_STEP / 2 + 1e-4 if key.endswith('cur') else encode.SCALAR_STEP / 2 + 1e-3
        ok = w <= tol
        log(f'- {key}: differenza massima {w:.4f} (tolleranza {tol:.4f}) → **{"OK" if ok else "FALLITO"}**')
        summary[f'punti {key}'] = ok
    log('')


def scan(tier, var):
    idx = frames.load_index(tier, var)
    for s in sorted(idx):
        yield s, published(tier, var, s)


# limiti fisici: l'acqua di mare in superficie gela intorno a -1,9 °C (-2,2 con
# salinita' 40); le lagune del Golfo Persico toccano 36-37 °C. Le correnti oltre
# 3 m/s esistono solo nelle maree dei bacini macrotidali.
SST_PHYS = (-2.2, 37.5)
SPEED_PHYS = 3.0


def check_ranges():
    log('## 2. Intervalli fisici\n')
    log(f'Fuori dai limiti fisici si contano le celle e si dice dove stanno: i valori sono quelli '
        f'pubblicati da Copernicus e non vengono ritoccati. Temperatura {SST_PHYS[0]}…{SST_PHYS[1]} °C, '
        f'corrente fino a {SPEED_PHYS} m/s; la codifica taglia ogni componente a ±{2047 * encode.VECTOR_STEP:.2f} m/s.\n')
    for tier, var in [('monthly', 'sst'), ('daily', 'sst'), ('daily', 'ostia'), ('daily', 'med'), ('hourly', 'sst')]:
        lo, hi, n, out_n, tot, where = np.inf, -np.inf, 0, 0, 0, {}
        for s, f in scan(tier, var):
            lo = min(lo, np.nanmin(f))
            hi = max(hi, np.nanmax(f))
            bad = (f < SST_PHYS[0]) | (f > SST_PHYS[1])
            out_n += int(bad.sum())
            tot += int(np.isfinite(f).sum())
            if var != 'med':
                for r, c in np.argwhere(bad)[:400]:
                    key = f'{round(grid.LATS[r])},{round(grid.LONS[c])}'
                    where[key] = where.get(key, 0) + 1
            n += 1
        if not n:
            continue
        frac = out_n / max(tot, 1)
        # sotto il punto di congelamento GLORYS12 va solo sotto il ghiaccio marino
        # (anche stagionale: Okhotsk, baia di Hudson, Labrador, golfo di Pietro il
        # Grande a 43° N, bordo del pack antartico) e davanti ai ghiacciai.
        # Fallisce se succede dove il mare non gela mai, a meno di 40° di latitudine.
        nonpolar = [k for k in where if abs(int(k.split(',')[0])) < 40]
        ok = not nonpolar
        top = ', '.join(f'{k} ({v})' for k, v in sorted(where.items(), key=lambda x: -x[1])[:6])
        log(f'- {tier}/{var}: {n} fotogrammi, minimo {lo:.2f} °C, massimo {hi:.2f} °C; fuori limite '
            f'{out_n} celle su {tot} ({frac:.2e}){"; dove: " + top if top else ""}'
            f'{"; a meno di 40° di latitudine: " + ", ".join(nonpolar) if nonpolar else ("; tutte oltre i 40° di latitudine, nei mari con ghiaccio" if out_n else "")} → **{"OK" if ok else "FALLITO"}**')
        summary[f'intervallo {tier}/{var}'] = ok
    for tier in ['monthly', 'daily', 'hourly']:
        top, n, fast, clipped, tot, where = 0, 0, 0, 0, 0, {}
        lim = 2047 * encode.VECTOR_STEP - 1e-9
        for s, (u, v) in scan(tier, 'cur'):
            sp = np.hypot(u, v)
            top = max(top, np.nanmax(sp))
            b = sp > SPEED_PHYS
            fast += int(b.sum())
            clipped += int(((np.abs(u) >= lim) | (np.abs(v) >= lim)).sum())
            tot += int(np.isfinite(sp).sum())
            for r, c in np.argwhere(b)[:20]:
                key = f'{round(grid.LATS[r])},{round(grid.LONS[c])}'
                where[key] = where.get(key, 0) + 1
            n += 1
        if n:
            frac = fast / max(tot, 1)
            ok = frac < 1e-4
            w = ', '.join(f'{k} ({v})' for k, v in sorted(where.items(), key=lambda x: -x[1])[:6])
            log(f"- {tier}/correnti: {n} fotogrammi, massimo {top:.2f} m/s; oltre {SPEED_PHYS} m/s {fast} celle su {tot} "
                f"({frac:.2e}), di cui {clipped} tagliate dalla codifica; dove: {w or 'nessuna'} → **{'OK' if ok else 'FALLITO'}**")
            summary[f'velocita {tier}'] = ok
    log('')


def check_land():
    log('## 3. Dati di mare sopra la terra\n')
    land = np.asarray(Image.open(DATA / 'static' / 'land.png')) > 127          # 2048×4096
    # una cella e' "terra piena" se lo sono tutti i pixel della maschera che contiene
    H, W = land.shape
    rows = (np.arange(H) * 720) // H
    cols = (np.arange(W) * 1440) // W
    cnt = np.zeros((720, 1440))
    tot = np.zeros((720, 1440))
    np.add.at(cnt, (rows[:, None], cols[None, :]), land)
    np.add.at(tot, (rows[:, None], cols[None, :]), 1)
    solid = cnt == tot
    for tier, var in [('monthly', 'sst'), ('monthly', 'cur')]:
        s = sorted(frames.load_index(tier, var))[-1]
        f = published(tier, var, s)
        f = f[0] if var == 'cur' else f
        bad = np.isfinite(f) & solid
        where = [f'{grid.LATS[r]:.1f},{grid.LONS[c]:.1f}' for r, c in np.argwhere(bad)[:8]]
        log(f'- {tier}/{var} {s}: {int(bad.sum())} celle con dato su terra piena su {int(np.isfinite(f).sum())} '
            f'({100 * bad.sum() / np.isfinite(f).sum():.3f}%). Esempi: {", ".join(where) or "nessuno"}')
        summary[f'terra {tier}/{var}'] = bad.sum() / np.isfinite(f).sum() < 0.002
    log('\nNel disegno la maschera di Natural Earth copre comunque la terra: queste celle non si vedono.\n')


CURRENTS = [  # nome, lat, lon, componente attesa, segno
    ('Corrente del Golfo', 37.6, -70.1, 'u', +1), ('Kuroshio', 35.1, 142.1, 'u', +1),
    ('Agulhas', -34.6, 27.1, 'v', -1), ('Brasile', -27.1, -46.1, 'v', -1),
    ('Circumpolare (Drake)', -58.1, -62.1, 'u', +1), ('Equatoriale del Sud', -1.1, -120.1, 'u', -1),
    ('Somala (estate)', 6.1, 51.6, 'v', +1),
]


def check_orientation():
    log('## 4. Orientamento delle correnti (media dei fotogrammi mensili)\n')
    sums = None
    n = 0
    sel = []
    for s, (u, v) in scan('monthly', 'cur'):
        sel_cells = [(int((90 - la) // 0.25), int((lo + 180) // 0.25)) for _, la, lo, _, _ in CURRENTS]
        vals = np.array([[u[r, c], v[r, c]] for r, c in sel_cells])
        if s[5:7] in ('07', '08'):
            sel.append(vals[6])                  # la corrente somala va a nord col monsone estivo
        sums = vals if sums is None else sums + np.nan_to_num(vals)
        n += 1
    mean = sums / n
    log('| corrente | lat | lon | u medio | v medio | atteso | esito |')
    log('|---|---|---|---|---|---|---|')
    for k, (name, la, lo, comp, sign) in enumerate(CURRENTS):
        u, v = (np.nanmean(sel, axis=0) if k == 6 else mean[k])
        val = u if comp == 'u' else v
        ok = np.sign(val) == sign
        log(f'| {name} | {la} | {lo} | {u:+.3f} | {v:+.3f} | {comp} {"> 0" if sign > 0 else "< 0"} | **{"OK" if ok else "FALLITO"}** |')
        summary[f'verso {name}'] = bool(ok)
    log('')


def overlap(tier, var, chain_a, chain_b, stamp):
    """Lo stesso istante da due dataset della catena: differenza media e RMS."""
    t = to_time(tier, stamp)
    res = []
    for ds_id in (chain_a, chain_b):
        tmp_idx = frames.download(ds_id, t, t + (dt.timedelta(days=1) if tier == 'monthly' else dt.timedelta(0)), 'val')
        try:
            import xarray as xr
            with xr.open_dataset(tmp_idx) as ds:
                rgb = frames.process(var, ds, 0)
        finally:
            tmp_idx.unlink(missing_ok=True)
        res.append(encode.decode_vector(rgb) if var == 'cur' else encode.decode_scalar(rgb))
    if var == 'cur':
        d = np.hypot(res[0][0] - res[1][0], res[0][1] - res[1][1])
        sp = np.hypot(*res[0])
        return float(np.nanmean(res[0][0] - res[1][0])), float(np.sqrt(np.nanmean(d ** 2))), float(np.nanmean(sp))
    d = res[0] - res[1]
    w = grid.area_weights()[:, None] * np.isfinite(d)
    return float(np.nansum(d * w) / w.sum()), float(np.sqrt(np.nansum(d ** 2 * w) / w.sum())), None


def check_seams():
    log('## 5. Cuciture fra i dataset (stesso istante da entrambe le fonti)\n')
    tests = [
        ('monthly', 'sst', 'cmems_mod_glo_phy_my_0.083deg_P1M-m', 'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1M-m'),
        ('monthly', 'cur', 'cmems_obs-mob_glo_phy-cur_my_0.25deg_P1M-m', 'cmems_obs-mob_glo_phy-cur_nrt_0.25deg_P1M-m'),
        ('daily', 'sst', 'cmems_mod_glo_phy_my_0.083deg_P1D-m', 'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m'),
    ]
    for tier, var, a, b in tests:
        _, last_a = sources.coverage(a)
        if tier == 'monthly':
            t = dt.datetime(last_a.year, last_a.month, 1)
        else:
            t = dt.datetime(last_a.year, last_a.month, last_a.day)
        s = frames.stamp(tier, t)
        bias, rms, ref = overlap(tier, var, a, b, s)
        unit = 'm/s' if var == 'cur' else '°C'
        extra = f' (velocita\' media {ref:.3f} m/s)' if ref else ''
        log(f'- {tier}/{var} {s}: `{a}` − `{b}`: media {bias:+.4f} {unit}, scarto quadratico {rms:.4f} {unit}{extra}')
        summary[f'cucitura {tier}/{var}'] = abs(bias) < (0.05 if var == 'cur' else 0.25)
    log('\nUna media vicina a zero vuol dire che al cambio di fonte non c\'e\' un salto sistematico; '
        'lo scarto quadratico misura le differenze locali (vortici, fronti), che restano.\n')


def check_continuity():
    log('## 6. Continuita\' temporale\n')
    m = json.loads((DATA / 'manifest.json').read_text())
    for name, tier in m['tiers'].items():
        stamps = [f['t'] for f in tier['frames']]
        first, last = to_time(name, stamps[0]), to_time(name, stamps[-1])
        expected = frames.steps(name, first, last)
        missing = sorted(set(frames.stamp(name, t) for t in expected) - set(stamps))
        per_var = {v: sum(1 for f in tier['frames'] if v in f) for v in tier['vars']}
        log(f'- {name}: {stamps[0]} → {stamps[-1]}, {len(stamps)} istanti; per variabile {per_var}; '
            f'mancanti {len(missing)} {missing[:6]}')
        summary[f'continuita {name}'] = not missing
    log('')


def check_anomaly():
    log('## 7. Anomalie\n')
    idx = sorted(frames.load_index('monthly', 'sst'))
    base = [s for s in idx if derived.CLIM_YEARS[0] <= int(s[:4]) <= derived.CLIM_YEARS[1]]
    clim = {m: encode.decode_scalar(encode.load_png(DATA / 'clim' / f'sst-{m:02d}.png')) for m in range(1, 13)}
    acc = np.zeros((720, 1440))
    cnt = np.zeros((720, 1440))
    for s in base:
        f = published('monthly', 'sst', s)
        a = f - clim[int(s[5:7])]
        ok = np.isfinite(a)
        acc[ok] += a[ok]
        cnt[ok] += 1
    with np.errstate(all='ignore'):
        mean = acc / cnt
    worst = float(np.nanmax(np.abs(mean)))
    ok = worst < 0.01
    log(f'- media delle anomalie mensili {derived.CLIM_YEARS[0]}–{derived.CLIM_YEARS[1]}, cella per cella: '
        f'massimo |{worst:.4f}| °C → **{"OK" if ok else "FALLITO"}**')
    summary['anomalia a media nulla'] = ok
    last = idx[-1]
    f = published('monthly', 'sst', last) - clim[int(last[5:7])]
    w = grid.area_weights()[:, None] * np.isfinite(f)
    log(f'- anomalia media globale (60°S–60°N escluse le celle senza dato) di {last}: '
        f'{np.nansum(np.where(np.abs(grid.LATS)[:, None] < 60, f * w, 0)) / np.sum(np.where(np.abs(grid.LATS)[:, None] < 60, w, 0)):+.3f} °C')
    log('')


def main():
    log(f'# Ocean Earth: validazione dei dati\n\nEseguita il {dt.datetime.now(dt.timezone.utc):%Y-%m-%d %H:%M} UTC '
        f'con `pipeline/validate.py`.\n')
    for fn in (check_continuity, check_ranges, check_land, check_orientation, check_anomaly, check_points, check_seams):
        try:
            fn()
        except Exception as e:  # una verifica che non parte e' un fallimento, non un silenzio
            log(f'\n**{fn.__name__}: ERRORE {e!r}**\n')
            summary[fn.__name__] = False
    log('## Riepilogo\n')
    for k, v in summary.items():
        log(f'- {"✅" if v else "❌"} {k}')
    REPORT.write_text('\n'.join(out) + '\n')
    print(f'\n→ {REPORT}')
    return all(summary.values())


if __name__ == '__main__':
    sys.exit(0 if main() else 1)
