"""La griglia comune di Ocean Earth e il passaggio dalle griglie native.

Tutti i fotogrammi globali stanno sulla stessa griglia regolare di 0,25°, la
stessa del prodotto di correnti MULTIOBS_GLO_PHY_MYNRT_015_003:

    720 righe  : centri da +89.875 (riga 0, nord) a -89.875 (riga 719, sud)
    1440 colonne: centri da -179.875 (colonna 0) a +179.875

Le altre sorgenti vengono portate qui con una media pesata sull'area della
cella, che tiene conto solo dei punti di mare: una cella di 0,25° vale se
almeno meta' del suo peso e' mare, altrimenti e' terra (NaN).
"""
import numpy as np

STEP = 0.25
NLAT = 720
NLON = 1440
LATS = 90 - STEP / 2 - STEP * np.arange(NLAT)          # nord → sud
LONS = -180 + STEP / 2 + STEP * np.arange(NLON)         # ovest → est

# Una cella grossa vale solo se almeno questa frazione del suo peso e' mare.
MIN_OCEAN_FRACTION = 0.5


def _block_sum(a, axis, factor, edge_weights):
    """Somma pesata a blocchi lungo un asse.

    edge_weights=False: blocchi disgiunti di `factor` campioni (es. 0,05° → 0,25°,
    dove i centri fini cadono tutti dentro la cella grossa).
    edge_weights=True: blocchi di factor+1 campioni con peso 1/2 agli estremi,
    che si sovrappongono di un campione (es. 1/12° → 1/4°, dove i centri fini
    cadono anche SUI bordi della cella grossa e vanno divisi a meta').
    """
    a = np.moveaxis(a, axis, -1)
    if edge_weights:
        n = (a.shape[-1] - 1) // factor
        out = 0.5 * a[..., 0:n * factor:factor] + 0.5 * a[..., factor:n * factor + 1:factor]
        for k in range(1, factor):
            out = out + a[..., k:n * factor:factor]
    else:
        n = a.shape[-1] // factor
        out = a[..., :n * factor].reshape(a.shape[:-1] + (n, factor)).sum(-1)
    return np.moveaxis(out, -1, axis)


def regrid_sum(field, factor, edge_weights, wrap_lon):
    """Restituisce (somma dei valori di mare, somma dei pesi di mare, peso totale)."""
    field = np.asarray(field, dtype=np.float64)
    ok = np.isfinite(field)
    vals = np.where(ok, field, 0.0)
    wts = ok.astype(np.float64)
    if wrap_lon:
        # la colonna a +180 e' la stessa di -180: serve per chiudere l'ultima cella
        vals = np.concatenate([vals, vals[:, :1]], axis=1)
        wts = np.concatenate([wts, wts[:, :1]], axis=1)
    sv = _block_sum(_block_sum(vals, 1, factor, edge_weights), 0, factor, edge_weights)
    sw = _block_sum(_block_sum(wts, 1, factor, edge_weights), 0, factor, edge_weights)
    return sv, sw, float(factor * factor)


def _finish(sv, sw, total):
    out = np.full(sv.shape, np.nan, dtype=np.float32)
    good = sw >= MIN_OCEAN_FRACTION * total
    out[good] = (sv[good] / sw[good]).astype(np.float32)
    return out


def from_twelfth(field, lat, lon):
    """Da 1/12° (GLORYS12, analisi NEMO 001_024) a 0,25°.

    `field` ha forma (lat, lon) con lat crescente da -80 a 90 e lon da -180 a
    179.9167, come nei file Copernicus. Le righe a sud di -80° restano NaN.
    """
    lat = np.asarray(lat)
    lon = np.asarray(lon)
    assert abs(lon[0] + 180) < 1e-3 and lon.size == 4320, "longitudini inattese"
    assert abs(lat[1] - lat[0] - 1 / 12) < 1e-4, "passo di latitudine inatteso"
    start = round((lat[0] + 90) / STEP)                 # cella grossa piu' a sud
    assert abs(lat[0] - (-90 + start * STEP)) < 1e-3, "la griglia non e' allineata ai 0,25°"
    sv, sw, tot = regrid_sum(field, 3, True, wrap_lon=True)
    coarse = _finish(sv, sw, tot)                       # sud → nord
    out = np.full((NLAT, NLON), np.nan, dtype=np.float32)
    rows = coarse.shape[0]
    out_sn = out[::-1]                                  # vista sud → nord
    out_sn[start:start + rows] = coarse[: NLAT - start]
    return out


def from_twentieth(field, lat, lon):
    """Da 0,05° (OSTIA) a 0,25°: blocchi esatti di 5×5 punti."""
    lat = np.asarray(lat)
    lon = np.asarray(lon)
    assert lat.size == 3600 and lon.size == 7200, "griglia OSTIA inattesa"
    sv, sw, tot = regrid_sum(field, 5, False, wrap_lon=False)
    coarse = _finish(sv, sw, tot)
    return coarse[::-1] if lat[0] < lat[-1] else coarse


def from_quarter(field, lat, lon):
    """Prodotti gia' a 0,25° (015_003): solo verifica e orientamento nord → sud."""
    lat = np.asarray(lat)
    lon = np.asarray(lon)
    assert lat.size == NLAT and lon.size == NLON, "griglia 0,25° inattesa"
    assert abs(lon[0] - LONS[0]) < 1e-3, "longitudini non allineate"
    out = np.asarray(field, dtype=np.float32)
    return out[::-1].copy() if lat[0] < lat[-1] else out.copy()


def area_weights():
    """Peso d'area di ogni riga (proporzionale al coseno della latitudine)."""
    return np.cos(np.deg2rad(LATS))
