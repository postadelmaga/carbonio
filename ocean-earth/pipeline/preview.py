"""Fotogrammi di anteprima per la riproduzione, ricavati da quelli esatti.

Un istante esatto pesa circa 1,6 MB (temperatura a 16 bit, correnti a 2×12
bit): a 4 fotogrammi al secondo servirebbero 6-7 MB/s, piu' di quanto il
server riesca a dare. L'anteprima pesa circa 0,33 MB e si usa SOLO mentre
la timeline scorre; da fermi, al clic e nei grafici si leggono i dati esatti.

  temperatura  WebP senza perdita, scala di grigi, griglia 0,25°
               0 = nessun dato; °C = -2.5 + (codice - 1) × 0.16   (fino a 38,1 °C)
  correnti     WebP senza perdita, RGB, griglia 0,5° (media 2×2 delle celle di mare)
               R = u, G = v, B = 0; 0 = nessun dato; 128 = fermo
               m/s = segno × 4 × ((|codice - 128| / 127))²   (radice: fine vicino a zero)
  pioggia,     WebP senza perdita, scala di grigi, 0,25°, solo mensili
  umidita' suolo   % del normale su scala logaritmica (come la mostra il globo):
               % = 100 × 2^(lo + (codice - 1) × step), da 6 a 600 %
  livello mare cm = -127 + (codice - 1) × 1
  ghiaccio     % = (codice - 1) × 0.5
  (tabella in META['p8'], letta dal browser: app/decode-worker.js)

    python preview.py          crea quelli che mancano o sono piu' vecchi dell'esatto
"""
import json
import pathlib
import sys
from concurrent.futures import ProcessPoolExecutor

import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import encode  # noqa: E402
import frames  # noqa: E402

SST_OFFSET, SST_STEP = -2.5, 0.16
CUR_MAX = 4.0
VARS = {'monthly': ['sst', 'cur', 'precip', 'soil', 'sla', 'ice'], 'daily': ['sst', 'cur', 'ostia'], 'hourly': ['sst', 'cur']}

# anteprime a 8 bit generiche: valore = f(offset + (codice − 1) × step), con
# f = 100·2^x per le grandezze in % del normale (log), identita' per le altre
P8 = {
    'precip': {'offset': -4.0, 'step': (np.log2(6.0) + 4.0) / 254, 'log': True},
    'soil': {'offset': -4.0, 'step': (np.log2(6.0) + 4.0) / 254, 'log': True},
    'sla': {'offset': -127.0, 'step': 1.0, 'log': False},
    'ice': {'offset': 0.0, 'step': 0.5, 'log': False},
}
SCALAR_OFFSET_OF = {'sla': encode.SCALAR_OFFSETS['sla']}


def encode_p8(var, f):
    e = P8[var]
    ok = np.isfinite(f)
    x = f[ok]
    if e['log']:
        x = np.log2(np.maximum(x, 1e-3) / 100.0)
    c = np.zeros(f.shape, np.uint8)
    c[ok] = np.clip(np.rint((x - e['offset']) / e['step']) + 1, 1, 255)
    return c


def decode_p8(var, c):
    e = P8[var]
    x = e['offset'] + (c.astype(np.float64) - 1) * e['step']
    out = 100.0 * 2.0 ** x if e['log'] else x
    out[c == 0] = np.nan
    return out


def preview_path(tier, var, stamp):
    return frames.DATA / 'p' / frames.TIER_DIR[tier] / var / f'{stamp}.webp'


def encode_sst8(f):
    ok = np.isfinite(f)
    c = np.zeros(f.shape, np.uint8)
    c[ok] = np.clip(np.rint((f[ok] - SST_OFFSET) / SST_STEP) + 1, 1, 255)
    return c


def decode_sst8(c):
    out = SST_OFFSET + (c.astype(np.float64) - 1) * SST_STEP
    out[c == 0] = np.nan
    return out


def encode_cur8(x):
    ok = np.isfinite(x)
    c = np.zeros(x.shape, np.uint8)
    a = np.sqrt(np.minimum(np.abs(x[ok]), CUR_MAX) / CUR_MAX) * 127
    c[ok] = np.clip(128 + np.sign(x[ok]) * np.rint(a), 1, 255)
    return c


def decode_cur8(c):
    d = c.astype(np.float64) - 128
    out = np.sign(d) * CUR_MAX * (np.abs(d) / 127) ** 2
    out[c == 0] = np.nan
    return out


def half_grid(a):
    """Media 2×2 dei soli valori di mare: 720×1440 → 360×720."""
    a = a.reshape(a.shape[0] // 2, 2, a.shape[1] // 2, 2)
    ok = np.isfinite(a)
    n = ok.sum(axis=(1, 3))
    s = np.where(ok, a, 0).sum(axis=(1, 3))
    out = np.full(n.shape, np.nan)
    out[n >= 2] = s[n >= 2] / n[n >= 2]
    return out


def make(job):
    tier, var, stamp = job
    src = frames.frame_path(tier, var, stamp)
    dst = preview_path(tier, var, stamp)
    dst.parent.mkdir(parents=True, exist_ok=True)
    rgb = encode.load_png(src)
    if var == 'cur':
        u, v = encode.decode_vector(rgb)
        with np.errstate(all='ignore'):
            u, v = half_grid(u), half_grid(v)
        cu, cv = encode_cur8(u), encode_cur8(v)
        im = Image.fromarray(np.dstack([cu, cv, np.zeros_like(cu)]), 'RGB')
    elif var in P8:
        f = encode.decode_scalar(rgb, offset=SCALAR_OFFSET_OF.get(var, encode.SCALAR_OFFSET))
        im = Image.fromarray(encode_p8(var, f), 'L')
    else:
        im = Image.fromarray(encode_sst8(encode.decode_scalar(rgb)), 'L')
    tmp = dst.with_suffix('.tmp.webp')
    im.save(tmp, 'WEBP', lossless=True, method=6)
    tmp.replace(dst)
    return dst.stat().st_size


def main(workers=2):
    jobs = []
    for tier, vars_ in VARS.items():
        for var in vars_:
            for stamp in frames.load_index(tier, var):
                src = frames.frame_path(tier, var, stamp)
                dst = preview_path(tier, var, stamp)
                if src.exists() and (not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime):
                    jobs.append((tier, var, stamp))
    # i fotogrammi usciti dalle finestre mobili (giorni, ore) non servono piu'
    for tier, vars_ in VARS.items():
        for var in vars_:
            d = frames.DATA / 'p' / frames.TIER_DIR[tier] / var
            if d.exists():
                idx = frames.load_index(tier, var)
                for f in d.glob('*.webp'):
                    if f.stem not in idx:
                        f.unlink()
    print(f'anteprime da creare: {len(jobs)}', flush=True)
    total = 0
    with ProcessPoolExecutor(workers) as ex:
        for k, size in enumerate(ex.map(make, jobs, chunksize=8)):
            total += size
            if (k + 1) % 500 == 0:
                print(f'  {k + 1}/{len(jobs)}', flush=True)
    print(f'anteprime: {len(jobs)} nuove, {total / 1e6:.0f} MB', flush=True)


META = {'sst': {'offset': SST_OFFSET, 'step': SST_STEP},
        'cur': {'max': CUR_MAX, 'zero': 128, 'scale': 127, 'grid': 0.5},
        'p8': P8}

if __name__ == '__main__':
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 2)
