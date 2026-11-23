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


def test_preview_roundtrip():
    import preview
    t = np.array([[-2.0, 0.0, 15.3, 31.9, np.nan]])
    back = preview.decode_sst8(preview.encode_sst8(t))
    assert np.isnan(back[0, -1])
    assert np.nanmax(np.abs(back - t)) <= preview.SST_STEP / 2 + 1e-9
    u = np.array([[0.0, 0.01, -0.05, 0.3, -1.2, 2.5, np.nan]])
    ub = preview.decode_cur8(preview.encode_cur8(u))
    assert np.isnan(ub[0, -1])
    assert ub[0, 0] == 0
    # radice: errore piccolo vicino a zero, relativo sopra
    assert abs(ub[0, 1] - 0.01) < 0.003
    assert np.all(np.abs(ub[0, 3:6] - u[0, 3:6]) / np.abs(u[0, 3:6]) < 0.04)
    assert np.all(np.sign(ub[0, 1:6]) == np.sign(u[0, 1:6]))


def test_preview_half_grid_ignores_land():
    import preview
    a = np.full((4, 4), np.nan)
    a[0, 0], a[0, 1], a[1, 0] = 1.0, 2.0, 3.0          # tre celle di mare
    a[2, 2] = 5.0                                       # una sola: troppo poco
    h = preview.half_grid(a)
    assert h[0, 0] == 2.0
    assert np.isnan(h[1, 1]) and np.isnan(h[0, 1])


def test_contiguous_blocks_never_span_gaps():
    import frames
    wanted = list(range(20))
    blocks = frames.contiguous_blocks([2, 3, 4, 10, 18, 19], wanted, 2)
    assert blocks == [[2, 3], [4], [10], [18, 19]]


def test_bias_smooth_keeps_mask_and_wraps():
    import bias
    a = np.full((10, 12), np.nan)
    a[4:7, :] = 1.0
    a[5, 0] = 4.0                      # vicino al bordo: la media usa anche l'ultima colonna
    s = bias.smooth(a, 3)
    assert np.isnan(s[0, 0]) and np.isnan(s[8, 3])          # dove non c'e' dato resta vuoto
    assert abs(s[5, 0] - (1 * 8 + 4) / 9) < 1e-12
    assert abs(s[5, 11] - (1 * 8 + 4) / 9) < 1e-12           # la colonna 0 e' vicina della 11
    assert abs(s[5, 5] - 1.0) < 1e-12


def test_derived_fingerprint_follows_the_monthly_frames(tmp_path, monkeypatch):
    # i derivati si rifanno solo se cambia un fotogramma mensile: l'impronta
    # deve restare ferma finche' nulla cambia e muoversi per un file riscritto,
    # una fonte diversa nell'indice o un mese in piu'
    import os
    import derived
    monkeypatch.setattr(frames, 'DATA', tmp_path)
    for s in ('2020-01', '2020-02'):
        p = frames.frame_path('monthly', 'sst', s)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b'x' * 10)
    idx = {'2020-01': 'A', '2020-02': 'A'}
    f0 = derived.fingerprint(['2020-01', '2020-02'], idx)
    assert derived.fingerprint(['2020-01', '2020-02'], idx) == f0
    assert derived.fingerprint(['2020-01'], idx) != f0                        # un mese in meno
    assert derived.fingerprint(['2020-01', '2020-02'], {**idx, '2020-02': 'B'}) != f0   # altra fonte
    os.utime(frames.frame_path('monthly', 'sst', '2020-02'), ns=(2_000, 2_000))
    assert derived.fingerprint(['2020-01', '2020-02'], idx) == f0             # solo la data: niente
    frames.frame_path('monthly', 'sst', '2020-02').write_bytes(b'y' * 10)
    assert derived.fingerprint(['2020-01', '2020-02'], idx) != f0             # file riscritto, stessa taglia


def test_bias_uses_only_months_published_from_glorys():
    # GLORYS si e' allungato a 2026-09, ma il fotogramma pubblicato di quel
    # mese e' ancora anfc: confrontarlo col campo anfc darebbe zero
    import bias
    index = {'2026-08': bias.GLORYS, '2026-09': bias.ANFC}
    assert bias.from_glorys(['2026-07', '2026-08', '2026-09'], index) == ['2026-08']
    assert bias.from_glorys(['2026-09'], index) == []


def test_validate_reuses_the_numbers_of_unchanged_frames(tmp_path, monkeypatch):
    # il controllo degli intervalli non rilegge un fotogramma gia' controllato;
    # rilegge quello riscritto, e solo quello
    import json
    import validate
    monkeypatch.setattr(frames, 'DATA', tmp_path)
    monkeypatch.setattr(validate, 'STATS', tmp_path / 'index' / 'validate-stats.json')
    monkeypatch.delenv('OE_VALIDATE_FULL', raising=False)
    f = np.full((720, 1440), 10.0)
    for s in ('2026-01', '2026-02'):
        encode.save_png(encode.encode_scalar(f), frames.frame_path('monthly', 'sst', s))
    frames.save_index('monthly', 'sst', {'2026-01': 'A', '2026-02': 'A'})
    seen = []

    def compute(field, var):
        seen.append(1)
        return validate.sst_stats(field, var)

    def run():
        monkeypatch.setattr(validate, '_stats_old', None)
        monkeypatch.setattr(validate, '_stats_new', {})
        seen.clear()
        got = list(validate.frame_stats('monthly', 'sst', compute))
        validate.save_frame_stats()
        return got

    first = run()
    assert len(seen) == 2 and first[0]['lo'] == pytest.approx(10.0, abs=0.01) and first[0]['out'] == 0
    assert run() == first and seen == []                       # niente e' cambiato: niente si rilegge
    encode.save_png(encode.encode_scalar(f + 40), frames.frame_path('monthly', 'sst', '2026-02'))
    again = run()
    assert len(seen) == 1 and again[0] == first[0] and again[1]['out'] > 0     # 50 °C: fuori limite
    monkeypatch.setenv('OE_VALIDATE_FULL', '1')
    assert run() == again and len(seen) == 2                   # a richiesta rilegge tutto
    assert json.loads(validate.STATS.read_text())['key'] == validate.STATS_KEY


# ── file d'origine: sapere se un giorno e' stato rivisto senza riscaricarlo ──
LISTING = '''<?xml version="1.0" encoding="UTF-8"?><ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
<Name>b</Name><IsTruncated>true</IsTruncated><NextContinuationToken>abc==</NextContinuationToken>
<Contents><Key>native/P/D_202406/2026/11/glo12_rg_1h-m_20261121-20261121_2D_fcst_R20261122.nc</Key><LastModified>2026-11-22T02:36:10.000Z</LastModified><ETag>&quot;aa-303&quot;</ETag><Size>1</Size></Contents>
<Contents><Key>native/P/D_202406/2026/11/dataset-uv-nrt-hourly_20261120T0000Z_P20261121T0000.nc</Key><LastModified>2026-11-21T15:09:00.000Z</LastModified><ETag>&quot;bb&quot;</ETag><Size>1</Size></Contents>
<Contents><Key>native/P/D_202406/2026/11/readme.txt</Key><LastModified>2026-11-01T00:00:00.000Z</LastModified><ETag>&quot;cc&quot;</ETag><Size>1</Size></Contents>
</ListBucketResult>'''


def test_origin_reads_the_day_and_the_signature_from_a_listing():
    import origin
    rows, token = origin.parse_listing(LISTING)
    assert token == 'abc==' and len(rows) == 3
    assert origin.day_of(rows[0][0]) == '2026-11-21'          # la prima data del nome, non quella della corsa
    assert origin.day_of(rows[1][0]) == '2026-11-20'
    assert origin.day_of(rows[2][0]) is None and origin.day_of('x/1h-m_20261341.nc') is None
    sigs = origin.signatures(rows)
    assert set(sigs) == {'2026-11-21', '2026-11-20'}
    assert sigs['2026-11-21'] == ('glo12_rg_1h-m_20261121-20261121_2D_fcst_R20261122.nc|aa-303',
                                  dt.datetime(2026, 11, 22, 2, 36, 10))


def test_origin_redoes_only_what_changed_and_never_trusts_what_it_cannot_see():
    import origin
    t = dt.datetime(2026, 11, 22, 3)
    days = ['2026-11-19', '2026-11-20', '2026-11-21']
    sigs = {'2026-11-19': ('a', t), '2026-11-20': ('b2', t), '2026-11-21': ('c', t)}
    saved = {'days': {'2026-11-19': 'a', '2026-11-20': 'b'}, 'full': '2026-11-20'}
    today = dt.date(2026, 11, 22)
    p = origin.choose(days, saved, sigs, t + dt.timedelta(hours=1), today, full_every=7)
    assert p.redo == {'2026-11-20', '2026-11-21'} and not p.full          # il giorno rivisto e quello nuovo
    assert p.storable == {'2026-11-20': 'b2', '2026-11-21': 'c'}
    # ARCO non ancora aggiornato dopo i file: si riscarica lo stesso, ma la firma non si salva
    p = origin.choose(days, saved, sigs, t - dt.timedelta(hours=1), today, full_every=7)
    assert p.redo == {'2026-11-20', '2026-11-21'} and p.storable == {}
    assert origin.choose(days, saved, sigs, None, today, full_every=7).storable == {}
    # un giorno che l'elenco non mostra si rifa' sempre
    p = origin.choose(days, saved, {k: v for k, v in sigs.items() if k != '2026-11-19'}, t, today, full_every=7)
    assert '2026-11-19' in p.redo and '2026-11-19' not in p.storable
    # il ricontrollo completo: la prima volta, dopo full_every giorni, a richiesta; mai con 0
    assert origin.choose(days, {}, sigs, t, today).full
    assert origin.choose(days, {**saved, 'full': '2026-11-15'}, sigs, t, today, full_every=7).redo == set(days)
    assert not origin.choose(days, {**saved, 'full': '2026-11-15'}, sigs, t, today, full_every=0).full
    assert origin.choose(days, saved, sigs, t, today, full_every=7, force_full=True).full


def test_origin_saves_a_day_only_when_all_of_it_was_checked():
    import origin
    t = dt.datetime(2026, 11, 22, 3)
    days = ['2026-11-19', '2026-11-20', '2026-11-21']
    sigs = {d: (d + '-new', t) for d in days}
    saved = {'days': {'2026-11-18': 'vecchio', '2026-11-19': '2026-11-19-new', '2026-11-20': 'x'}, 'full': '2026-11-20'}
    today = dt.date(2026, 11, 22)
    p = origin.choose(days, saved, sigs, t, today, full_every=7)
    state = origin.finish(p, days, {'2026-11-20'}, today)                 # il 21 non e' andato a buon fine
    assert state == {'days': {'2026-11-19': '2026-11-19-new', '2026-11-20': '2026-11-20-new'}, 'full': '2026-11-20'}
    # un ricontrollo completo conta solo se ha ricontrollato tutto
    p = origin.choose(days, saved, sigs, t, today, full_every=7, force_full=True)
    assert origin.finish(p, days, {'2026-11-19', '2026-11-20'}, today)['full'] == '2026-11-20'
    assert origin.finish(p, days, set(days), today)['full'] == '2026-11-22'
