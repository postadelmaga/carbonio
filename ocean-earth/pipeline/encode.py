"""Codifica dei campi in PNG RGB senza perdita, decodificabili nel browser.

Il PNG e' l'unico formato che il server comprime gia' da se' (il blocco Caddy
del sito non comprime i binari) e che il browser decodifica in un worker con
createImageBitmap. Si usa RGB a 8 bit senza canale alfa: con l'alfa il browser
premoltiplica e i valori si rovinano.

Scalare (temperatura):  codice a 16 bit in R (alto) e G (basso), B = 0.
    codice 0 = nessun dato (terra);  valore = OFFSET + (codice - 1) * STEP
Vettore (corrente u, v): due codici a 12 bit.
    R = u >> 4, G = v >> 4, B = (u & 15) << 4 | (v & 15)
    codice 0 per entrambe = nessun dato;  valore = (codice - 2048) * STEP
"""
import numpy as np
from PIL import Image

SCALAR_OFFSET = -5.0      # °C
SCALAR_STEP = 0.01        # °C: risoluzione del dato pubblicato
# variabili con un altro zero (stesso passo): il livello del mare in cm scende
# sotto -5. Il browser somma (offset della variabile - SCALAR_OFFSET) al valore.
SCALAR_OFFSETS = {'sla': -200.0}
VECTOR_STEP = 0.002       # m/s
VECTOR_ZERO = 2048        # codice di velocita' nulla; validi 1..4095 → ±4,09 m/s


def encode_scalar(field, offset=SCALAR_OFFSET):
    f = np.asarray(field, dtype=np.float64)
    ok = np.isfinite(f)
    code = np.zeros(f.shape, dtype=np.uint32)
    code[ok] = np.clip(np.rint((f[ok] - offset) / SCALAR_STEP) + 1, 1, 65535).astype(np.uint32)
    rgb = np.zeros(f.shape + (3,), dtype=np.uint8)
    rgb[..., 0] = code >> 8
    rgb[..., 1] = code & 255
    return rgb


def decode_scalar(rgb, offset=SCALAR_OFFSET):
    rgb = np.asarray(rgb)
    code = (rgb[..., 0].astype(np.uint32) << 8) | rgb[..., 1]
    out = offset + (code.astype(np.float64) - 1) * SCALAR_STEP
    out[code == 0] = np.nan
    return out


def encode_vector(u, v):
    u = np.asarray(u, dtype=np.float64)
    v = np.asarray(v, dtype=np.float64)
    ok = np.isfinite(u) & np.isfinite(v)
    cu = np.zeros(u.shape, dtype=np.uint32)
    cv = np.zeros(u.shape, dtype=np.uint32)
    cu[ok] = np.clip(np.rint(u[ok] / VECTOR_STEP) + VECTOR_ZERO, 1, 4095).astype(np.uint32)
    cv[ok] = np.clip(np.rint(v[ok] / VECTOR_STEP) + VECTOR_ZERO, 1, 4095).astype(np.uint32)
    rgb = np.empty(u.shape + (3,), dtype=np.uint8)
    rgb[..., 0] = cu >> 4
    rgb[..., 1] = cv >> 4
    rgb[..., 2] = ((cu & 15) << 4) | (cv & 15)
    return rgb


def decode_vector(rgb):
    rgb = np.asarray(rgb).astype(np.uint32)
    cu = (rgb[..., 0] << 4) | (rgb[..., 2] >> 4)
    cv = (rgb[..., 1] << 4) | (rgb[..., 2] & 15)
    bad = (cu == 0) & (cv == 0)
    u = (cu.astype(np.float64) - VECTOR_ZERO) * VECTOR_STEP
    v = (cv.astype(np.float64) - VECTOR_ZERO) * VECTOR_STEP
    u[bad] = np.nan
    v[bad] = np.nan
    return u, v


def save_png(rgb, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp.png')
    Image.fromarray(rgb, 'RGB').save(tmp, optimize=True, compress_level=9)
    tmp.replace(path)


def load_png(path):
    with Image.open(path) as im:
        return np.asarray(im.convert('RGB'))
