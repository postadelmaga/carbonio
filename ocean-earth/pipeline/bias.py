"""Differenza fra il sistema operativo (anfc) e la rianalisi GLORYS12, per mese.

La climatologia 1993–2020 viene da GLORYS12. Gli istanti piu' recenti vengono
dall'analisi operativa (anfc), che e' un altro sistema: in media globale e'
circa 0,1 °C piu' fredda e nelle singole regioni scarta di alcuni decimi.
Sottrarre a un dato anfc la climatologia GLORYS mescolerebbe l'anomalia vera
con la differenza fra i due modelli.

Qui si misura quella differenza sui mesi in cui esistono entrambi (giugno 2022
→ ultimo mese GLORYS): per ogni mese dell'anno la media di (anfc − GLORYS),
smussata su circa 5° per non portarsi dietro i singoli vortici. La pagina la
somma alla climatologia (e al 90° percentile) quando il fotogramma mostrato
viene da anfc: e' come misurare anche anfc col metro di GLORYS.

    python bias.py      scarica i mesi anfc che mancano (~6 s l'uno), poi
                        scrive data/bias/sst-MM.png e data/bias/stats.json

I campi anfc mensili restano in ~/.cache/ocean-earth/anfc-monthly/ (non si
pubblicano: il fotogramma pubblicato di quei mesi e' quello GLORYS).
"""
import datetime as dt
import json
import pathlib
import sys

import numpy as np
import xarray as xr

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import encode  # noqa: E402
import frames  # noqa: E402
import grid  # noqa: E402
import sources  # noqa: E402

ANFC = 'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1M-m'
GLORYS = 'cmems_mod_glo_phy_my_0.083deg_P1M-m'
CACHE = pathlib.Path.home() / '.cache' / 'ocean-earth' / 'anfc-monthly'
OUT = frames.DATA / 'bias'
# celle da 0,25° per lato (5,25°). Scelto con una verifica incrociata (si stima
# la differenza senza un anno e la si applica a quell'anno): lo scarto
# quadratico medio fra anfc e GLORYS scende da 0,387 a 0,341 °C con 21 celle,
# 0,346 con 5, 0,352 con 81, 0,372 con la sola media globale. Piu' fine porta
# dentro il rumore di quattro-cinque anni; il resto (~0,34 °C) e' la differenza
# dell'anno singolo (vortici, fronti) e nessuna media la puo' togliere.
SMOOTH = 21
MIN_YEARS = 2       # sotto, il mese non ha una stima
OUTLIER = 0.3       # °C dalla mediana della differenza globale: mese anfc difettoso


def overlap():
    a0, a1 = sources.coverage(ANFC)
    g0, g1 = sources.coverage(GLORYS)
    lo, hi = max(a0, g0), min(a1, g1)
    return frames.steps('monthly', lo, hi)


def fetch(months):
    """I mesi anfc che mancano nella cache, portati sulla griglia da 0,25°."""
    CACHE.mkdir(parents=True, exist_ok=True)
    todo = [t for t in months if not (CACHE / f'{frames.stamp("monthly", t)}.png').exists()]
    for k in range(0, len(todo), 6):
        block = todo[k:k + 6]
        nc = frames.download(ANFC, block[0], block[-1] + dt.timedelta(days=1), 'bias')
        try:
            with xr.open_dataset(nc) as ds:
                for i, tv in enumerate(ds['time'].values):
                    s = frames.stamp('monthly', sources._to_dt(tv))
                    if s in {frames.stamp('monthly', t) for t in block}:
                        encode.save_png(frames.process('sst', ds, i), CACHE / f'{s}.png')
        finally:
            nc.unlink(missing_ok=True)
        print(f'  anfc {frames.stamp("monthly", block[0])} … {frames.stamp("monthly", block[-1])}', flush=True)


def smooth(a, n=SMOOTH):
    """Media mobile n×n dei soli valori validi (con la longitudine che si chiude)."""
    ok = np.isfinite(a)
    v = np.where(ok, a, 0.0)
    w = ok.astype(np.float64)
    r = n // 2
    vp = np.pad(v, ((r, r), (0, 0)))
    wp = np.pad(w, ((r, r), (0, 0)))
    vp = np.concatenate([vp[:, -r:], vp, vp[:, :r]], axis=1)
    wp = np.concatenate([wp[:, -r:], wp, wp[:, :r]], axis=1)
    cs = lambda x: np.cumsum(np.cumsum(np.pad(x, ((1, 0), (1, 0))), 0), 1)
    sv, sw = cs(vp), cs(wp)
    box = lambda s: s[n:, n:] - s[:-n, n:] - s[n:, :-n] + s[:-n, :-n]
    num, den = box(sv), box(sw)
    out = np.full(a.shape, np.nan)
    good = ok & (den > 0)
    out[good] = num[good] / den[good]
    return out


def main():
    months = overlap()
    print(f'mesi in comune fra anfc e GLORYS: {len(months)} '
          f'({frames.stamp("monthly", months[0])} → {frames.stamp("monthly", months[-1])})', flush=True)
    fetch(months)
    w = np.cos(np.radians(grid.LATS))[:, None] * np.ones((1, grid.NLON))
    diffs_all = {}
    for t in months:
        s = frames.stamp('monthly', t)
        g = frames.frame_path('monthly', 'sst', s)
        if g.exists():
            diffs_all[s] = (encode.decode_scalar(encode.load_png(CACHE / f'{s}.png'))
                            - encode.decode_scalar(encode.load_png(g)))
    # Un mese anfc difettoso si riconosce dalla media globale: agosto 2023 e'
    # 0,79 °C piu' freddo di GLORYS (e 0,6 °C piu' freddo di luglio e settembre
    # dello stesso anfc), mentre gli altri mesi stanno fra -0,06 e -0,18 °C.
    # Si escludono i mesi lontani piu' di OUTLIER dalla mediana.
    gmean = {}
    for s, d in diffs_all.items():
        ok = np.isfinite(d)
        gmean[s] = float((d[ok] * w[ok]).sum() / w[ok].sum())
    med = float(np.median(list(gmean.values())))
    excluded = sorted(s for s, v in gmean.items() if abs(v - med) > OUTLIER)
    for s in excluded:
        print(f'  escluso {s}: differenza globale {gmean[s]:+.3f} °C (mediana {med:+.3f})', flush=True)
    by_month = {m: [] for m in range(1, 13)}
    for s, d in diffs_all.items():
        if s not in excluded:
            by_month[int(s[5:7])].append(d)
    OUT.mkdir(parents=True, exist_ok=True)
    stats = {'from': frames.stamp('monthly', months[0]), 'to': frames.stamp('monthly', months[-1]),
             'smooth_deg': SMOOTH * grid.STEP, 'excluded': excluded,
             'global_by_month': {k: round(v, 3) for k, v in sorted(gmean.items())}, 'months': {}}
    for m, diffs in by_month.items():
        if len(diffs) < MIN_YEARS:
            raise SystemExit(f'mese {m}: solo {len(diffs)} anni in comune, troppo pochi')
        with np.errstate(all='ignore'):
            d = np.nanmean(np.stack(diffs), axis=0)
            # stesso segno ogni anno: e' un'abitudine del sistema, non un caso
            agree = np.abs(np.nanmean(np.sign(np.stack(diffs)), axis=0))
        d = smooth(d)
        ok = np.isfinite(d)
        stats['months'][f'{m:02d}'] = {
            'years': len(diffs),
            'global_mean': round(float((d[ok] * w[ok]).sum() / w[ok].sum()), 3),
            'abs_p95': round(float(np.nanpercentile(np.abs(d), 95)), 3),
            'same_sign_share': round(float(np.nanmean(agree[ok] == 1)), 3),
        }
        encode.save_png(encode.encode_scalar(d), OUT / f'sst-{m:02d}.png')
    (OUT / 'stats.json').write_text(json.dumps(stats, indent=1))
    for m, s in stats['months'].items():
        print(f'  {m}: {s["years"]} anni, media globale {s["global_mean"]:+.3f} °C, '
              f'95° percentile di |differenza| {s["abs_p95"]:.2f} °C, stesso segno ogni anno nel {s["same_sign_share"]:.0%}')


if __name__ == '__main__':
    main()
