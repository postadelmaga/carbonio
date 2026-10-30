"""Test della pipeline: griglia, codifica, passi temporali. Non usano la rete.

    .venv/bin/python -m pytest tests
"""
import datetime as dt
import pathlib
import sys

import numpy as np
import pytest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'pipeline'))
import encode  # noqa: E402
import frames  # noqa: E402
import grid  # noqa: E402

TWELFTH_LAT = -80 + np.arange(2041) / 12
TWELFTH_LON = -180 + np.arange(4320) / 12
OSTIA_LAT = -89.975 + 0.05 * np.arange(3600)
OSTIA_LON = -179.975 + 0.05 * np.arange(7200)
QUARTER_LAT = -89.875 + 0.25 * np.arange(720)       # sud → nord, come nei file 015_003
QUARTER_LON = -179.875 + 0.25 * np.arange(1440)


def cell(lat, lon):
    return int((90 - lat) // 0.25), int((lon + 180) // 0.25)


# ── griglia ────────────────────────────────────────────────────────────────
def test_grid_centres():
    assert grid.LATS[0] == pytest.approx(89.875) and grid.LATS[-1] == pytest.approx(-89.875)
    assert grid.LONS[0] == pytest.approx(-179.875) and grid.LONS[-1] == pytest.approx(179.875)


def test_twelfth_linear_field_is_centred():
    # su un campo lineare la media pesata deve cadere esattamente al centro della cella
    f = TWELFTH_LAT[:, None] * 1.0 + TWELFTH_LON[None, :] * 0.01
    out = grid.from_twelfth(f, TWELFTH_LAT, TWELFTH_LON)
    r, c = cell(45.1, 10.1)
    assert out[r, c] == pytest.approx(grid.LATS[r] + grid.LONS[c] * 0.01, abs=1e-4)
    # a sud di -80° la rianalisi non c'e'
    assert np.isnan(out[cell(-85, 0)]).all()


def test_twelfth_dateline_wraps():
    f = np.cos(np.deg2rad(TWELFTH_LON))[None, :] * np.ones((2041, 1))
    out = grid.from_twelfth(f, TWELFTH_LAT, TWELFTH_LON)
    r, c = cell(0, 179.9)
    # la cella 179.75..180 usa anche la colonna di -180: il valore resta vicino a -1
    assert out[r, c] == pytest.approx(np.cos(np.deg2rad(179.875)), abs=1e-3)


def test_land_fraction_rule():
    f = np.full((2041, 4320), 20.0)
    r, c = cell(10.1, 10.1)
    lat0 = 90 - (r + 1) * 0.25          # bordo sud della cella
    lon0 = -180 + c * 0.25
    j0 = int(round((lat0 + 80) * 12))
    i0 = int(round((lon0 + 180) * 12))
    # tre righe su quattro della cella sono terra: meno di meta' del peso e' mare → NaN
    f[j0:j0 + 3, i0:i0 + 4] = np.nan
    out = grid.from_twelfth(f, TWELFTH_LAT, TWELFTH_LON)
    assert np.isnan(out[r, c])
    # una sola riga di terra (peso 0,5 su 3): la cella resta mare e vale 20
    f2 = np.full((2041, 4320), 20.0)
    f2[j0, i0:i0 + 4] = np.nan
    assert grid.from_twelfth(f2, TWELFTH_LAT, TWELFTH_LON)[r, c] == pytest.approx(20.0)


def test_ostia_blocks_and_orientation():
    f = np.broadcast_to(OSTIA_LAT[:, None], (3600, 7200)).copy()
    out = grid.from_twentieth(f, OSTIA_LAT, OSTIA_LON)
    assert out.shape == (720, 1440)
    assert out[0, 0] == pytest.approx(89.875, abs=1e-6)      # riga 0 = nord
    assert out[-1, 0] == pytest.approx(-89.875, abs=1e-6)


def test_quarter_flip():
    f = np.broadcast_to(QUARTER_LAT[:, None], (720, 1440))
    out = grid.from_quarter(f, QUARTER_LAT, QUARTER_LON)
    assert out[0, 0] == pytest.approx(89.875) and out[-1, 0] == pytest.approx(-89.875)


# ── codifica ───────────────────────────────────────────────────────────────
def test_scalar_roundtrip(tmp_path):
    rng = np.random.default_rng(1)
    f = rng.uniform(-2.5, 36, (720, 1440)).astype(np.float32)
    f[rng.random((720, 1440)) < 0.3] = np.nan
    p = tmp_path / 's.png'
    encode.save_png(encode.encode_scalar(f), p)
    back = encode.decode_scalar(encode.load_png(p))
    assert np.array_equal(np.isnan(back), np.isnan(f))
    assert np.nanmax(np.abs(back - f)) <= encode.SCALAR_STEP / 2 + 1e-6


def test_vector_roundtrip_and_sign(tmp_path):
    rng = np.random.default_rng(2)
    u = rng.uniform(-3, 3, (720, 1440))
    v = rng.uniform(-3, 3, (720, 1440))
    u[:10] = np.nan
    v[:10] = np.nan
    u[20, 20], v[20, 20] = 0.5, -0.25          # verso est-sud-est
    p = tmp_path / 'c.png'
    encode.save_png(encode.encode_vector(u, v), p)
    bu, bv = encode.decode_vector(encode.load_png(p))
    assert np.isnan(bu[:10]).all() and np.isnan(bv[:10]).all()
    assert np.nanmax(np.abs(bu - u)) <= encode.VECTOR_STEP / 2 + 1e-9
    assert bu[20, 20] > 0 and bv[20, 20] < 0
    # una corrente nulla non deve confondersi con l'assenza di dato
    z = encode.encode_vector(np.zeros((2, 2)), np.zeros((2, 2)))
    zu, _ = encode.decode_vector(z)
    assert np.isfinite(zu).all()


def test_vector_clipping():
    u = np.array([[9.0, -9.0]])
    bu, _ = encode.decode_vector(encode.encode_vector(u, np.zeros_like(u)))
    assert bu[0, 0] == pytest.approx((4095 - 2048) * encode.VECTOR_STEP)
    assert bu[0, 1] == pytest.approx((1 - 2048) * encode.VECTOR_STEP)


# ── tempo ──────────────────────────────────────────────────────────────────
def test_steps_monthly_and_daily():
    m = frames.steps('monthly', dt.datetime(1993, 1, 1), dt.datetime(1993, 12, 31))
    assert len(m) == 12 and m[0] == dt.datetime(1993, 1, 1)
    # un inizio a meta' mese salta al mese successivo
    m2 = frames.steps('monthly', dt.datetime(1993, 1, 1, 0, 0, 1), dt.datetime(1993, 3, 1))
    assert m2 == [dt.datetime(1993, 2, 1), dt.datetime(1993, 3, 1)]
    d = frames.steps('daily', dt.datetime(2024, 2, 27), dt.datetime(2024, 3, 1, 23))
    assert [x.day for x in d] == [27, 28, 29, 1]          # 2024 e' bisestile
    h = frames.steps('hourly', dt.datetime(2026, 10, 1), dt.datetime(2026, 10, 1, 23))
    assert len(h) == 24


def test_stamps():
    t = dt.datetime(2026, 10, 3, 7)
    assert frames.stamp('monthly', t) == '2026-10'
    assert frames.stamp('daily', t) == '2026-10-03'
    assert frames.stamp('hourly', t) == '2026-10-03T07'
