"""Le sorgenti Copernicus Marine di Ocean Earth e come si combinano nel tempo.

Ogni livello temporale (mensile, giornaliero, orario) ha una catena di dataset
per variabile: il primo che copre una data vince. Le date di fine non sono
scritte qui: si leggono dal catalogo a ogni esecuzione, perche' i prodotti
crescono (e quelli operativi contengono anche le PREVISIONI, che tagliamo:
si pubblica solo fino a ieri).
"""
import datetime as dt
import functools

import copernicusmarine as cm
import numpy as np

# id → descrizione mostrata nel pannello delle fonti
DATASETS = {
    # temperatura: rianalisi GLORYS12 (1/12°, NEMO + assimilazione di SST satellitare,
    # altimetria e profili in situ) e la sua prosecuzione operativa
    'cmems_mod_glo_phy_my_0.083deg_P1M-m': dict(
        product='GLOBAL_MULTIYEAR_PHY_001_030', name='GLORYS12 reanalysis',
        kind='model', res='1/12°', freq='P1M', var='thetao', depth=True),
    'cmems_mod_glo_phy_my_0.083deg_P1D-m': dict(
        product='GLOBAL_MULTIYEAR_PHY_001_030', name='GLORYS12 reanalysis',
        kind='model', res='1/12°', freq='P1D', var='thetao', depth=True),
    'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1M-m': dict(
        product='GLOBAL_ANALYSISFORECAST_PHY_001_024', name='Global analysis (NEMO 1/12°)',
        kind='model', res='1/12°', freq='P1M', var='thetao', depth=True),
    'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m': dict(
        product='GLOBAL_ANALYSISFORECAST_PHY_001_024', name='Global analysis (NEMO 1/12°)',
        kind='model', res='1/12°', freq='P1D', var='thetao', depth=True),
    'cmems_mod_glo_phy_anfc_0.083deg_PT1H-m': dict(
        product='GLOBAL_ANALYSISFORECAST_PHY_001_024', name='Global analysis (NEMO 1/12°), hourly mean',
        kind='model', res='1/12°', freq='PT1H', var='thetao', depth=True),
    # temperatura osservata da satellite
    'METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2': dict(
        product='SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001', name='OSTIA L4 satellite SST',
        kind='observation', res='0.05°', freq='P1D', var='analysed_sst,mask', depth=False),
    # Mediterraneo ad alta risoluzione: osservazioni da satellite, griglia nativa
    'SST_MED_SST_L4_NRT_OBSERVATIONS_010_004_a_V2': dict(
        product='SST_MED_SST_L4_NRT_OBSERVATIONS_010_004', name='Mediterranean L4 satellite SST',
        kind='observation', res='1/16°', freq='P1D', var='analysed_sst,mask', depth=False),
    # correnti: prodotto osservativo (altimetria + vento ERA5 + marea)
    'cmems_obs-mob_glo_phy-cur_my_0.25deg_P1M-m': dict(
        product='MULTIOBS_GLO_PHY_MYNRT_015_003', name='Copernicus-GlobCurrent (multi-year)',
        kind='observation', res='0.25°', freq='P1M', var='uo,vo', depth=True),
    'cmems_obs-mob_glo_phy-cur_nrt_0.25deg_P1M-m': dict(
        product='MULTIOBS_GLO_PHY_MYNRT_015_003', name='Copernicus-GlobCurrent (near real time)',
        kind='observation', res='0.25°', freq='P1M', var='uo,vo', depth=True),
    'cmems_obs-mob_glo_phy-cur_my_0.25deg_P1D-m': dict(
        product='MULTIOBS_GLO_PHY_MYNRT_015_003', name='Copernicus-GlobCurrent (multi-year)',
        kind='observation', res='0.25°', freq='P1D', var='uo,vo', depth=True),
    'cmems_obs-mob_glo_phy-cur_nrt_0.25deg_P1D-m': dict(
        product='MULTIOBS_GLO_PHY_MYNRT_015_003', name='Copernicus-GlobCurrent (near real time)',
        kind='observation', res='0.25°', freq='P1D', var='uo,vo', depth=True),
    'cmems_obs-mob_glo_phy-cur_nrt_0.25deg_PT1H-i': dict(
        product='MULTIOBS_GLO_PHY_MYNRT_015_003', name='Copernicus-GlobCurrent (near real time), hourly instantaneous',
        kind='observation', res='0.25°', freq='PT1H', var='uo,vo', depth=True),
    # ghiaccio marino dopo la fine di GLORYS12 (prima viene dallo stesso dataset
    # mensile della temperatura, con le variabili di FIELDS['ice'])
    'cmems_mod_glo_phy_anfc_0.083deg_P1M-m': dict(
        product='GLOBAL_ANALYSISFORECAST_PHY_001_024', name='Global analysis (NEMO 1/12°)',
        kind='model', res='1/12°', freq='P1M', var='siconc,mlotst', depth=False),
    # livello del mare: altimetria multi-missione DUACS, anomalia rispetto al 1993–2012
    'cmems_obs-sl_glo_phy-ssh_my_allsat-l4-duacs-0.125deg_P1M-m': dict(
        product='SEALEVEL_GLO_PHY_L4_MY_008_047', name='DUACS multi-mission altimetry (multi-year)',
        kind='observation', res='0.125°', freq='P1M', var='sla', depth=False),
    # dopo la fine della serie multi-anno: media del mese calcolata dalle mappe
    # giornaliere in tempo quasi reale (stesso sistema DUACS, stesso riferimento)
    'cmems_obs-sl_glo_phy-ssh_nrt_allsat-l4-duacs-0.125deg_P1D': dict(
        product='SEALEVEL_GLO_PHY_L4_NRT_008_046', name='DUACS multi-mission altimetry (near real time), monthly mean of daily maps',
        kind='observation', res='0.125°', freq='P1M', var='sla', depth=False, aggregate='P1M'),
    # terraferma (pipeline/land.py): Copernicus Climate Change Service, Climate
    # Data Store; non passano da copernicusmarine, il DOI e' scritto qui
    'reanalysis-era5-single-levels-monthly-means': dict(
        product='reanalysis-era5-single-levels-monthly-means', name='ERA5 reanalysis, total precipitation',
        kind='model', res='0.25°', freq='P1M', var='total_precipitation', depth=False,
        cds=True, doi='10.24381/cds.f17050d7'),
    'reanalysis-era5-land-monthly-means': dict(
        product='reanalysis-era5-land-monthly-means', name='ERA5-Land reanalysis, soil moisture 0–7 cm',
        kind='model', res='0.1°', freq='P1M', var='volumetric_soil_water_layer_1', depth=False,
        cds=True, doi='10.24381/cds.68d2bb30'),
}

# catene per livello e variabile: in ordine di precedenza
CHAINS = {
    ('monthly', 'sst'): ['cmems_mod_glo_phy_my_0.083deg_P1M-m', 'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1M-m'],
    ('monthly', 'cur'): ['cmems_obs-mob_glo_phy-cur_my_0.25deg_P1M-m', 'cmems_obs-mob_glo_phy-cur_nrt_0.25deg_P1M-m'],
    ('monthly', 'ice'): ['cmems_mod_glo_phy_my_0.083deg_P1M-m', 'cmems_mod_glo_phy_anfc_0.083deg_P1M-m'],
    ('monthly', 'sla'): ['cmems_obs-sl_glo_phy-ssh_my_allsat-l4-duacs-0.125deg_P1M-m',
                         'cmems_obs-sl_glo_phy-ssh_nrt_allsat-l4-duacs-0.125deg_P1D'],
    ('daily', 'sst'): ['cmems_mod_glo_phy_my_0.083deg_P1D-m', 'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m'],
    ('daily', 'cur'): ['cmems_obs-mob_glo_phy-cur_my_0.25deg_P1D-m', 'cmems_obs-mob_glo_phy-cur_nrt_0.25deg_P1D-m'],
    ('daily', 'ostia'): ['METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2'],
    ('daily', 'med'): ['SST_MED_SST_L4_NRT_OBSERVATIONS_010_004_a_V2'],
    ('hourly', 'sst'): ['cmems_mod_glo_phy_anfc_0.083deg_PT1H-m'],
    ('hourly', 'cur'): ['cmems_obs-mob_glo_phy-cur_nrt_0.25deg_PT1H-i'],
}


# variabili da scaricare quando un dataset serve per una variabile diversa da
# quella della sua scheda (GLORYS mensile: thetao per la temperatura, qui il
# ghiaccio). mlotst esiste solo sul mare: distingue "niente ghiaccio" (siconc
# vuoto sul mare) dalla terra.
FIELDS = {'ice': ('siconc,mlotst', False)}


def yesterday_end():
    """Ultimo istante pubblicabile: fine di ieri (UTC). Oltre ci sono previsioni."""
    today = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
    return dt.datetime(today.year, today.month, today.day) - dt.timedelta(hours=1)


@functools.lru_cache(maxsize=None)
def coverage(dataset_id):
    """(prima, ultima) data disponibile secondo il catalogo, ultima tagliata a ieri."""
    meta = DATASETS[dataset_id]
    kw = dict(dataset_id=dataset_id, variables=[meta['var'].split(',')[0]])
    if meta['depth']:
        kw.update(minimum_depth=0, maximum_depth=1)
    ds = cm.open_dataset(**kw)
    t = ds['time'].values
    first = _to_dt(t[0])
    last = min(_to_dt(t[-1]), yesterday_end())
    ds.close()
    return first, last


def _to_dt(x):
    return dt.datetime.utcfromtimestamp((np.datetime64(x, 's') - np.datetime64(0, 's')).astype(int))


def plan(tier, var, start, end):
    """Divide [start, end] fra i dataset della catena: lista di (dataset, da, a)."""
    out = []
    cursor = start
    for ds_id in CHAINS[(tier, var)]:
        first, last = coverage(ds_id)
        if cursor > end:
            break
        lo = max(cursor, first)
        hi = min(end, last)
        if lo <= hi:
            out.append((ds_id, lo, hi))
            cursor = hi + dt.timedelta(seconds=1)
    return out
