# Ocean Earth: validazione dei dati

Eseguita il 2026-10-31 07:12 UTC con `pipeline/validate.py`.

## 6. Continuita' temporale

- monthly: 1993-01 → 2026-09, 405 istanti; per variabile {'sst': 405, 'cur': 405}; mancanti 0 []
- daily: 2024-01-01 → 2026-10-29, 1033 istanti; per variabile {'sst': 1033, 'cur': 1033, 'ostia': 365, 'med': 365}; mancanti 0 []
- hourly: 2026-10-16T00 → 2026-10-29T23, 336 istanti; per variabile {'sst': 336, 'cur': 336}; mancanti 0 []

## 2. Intervalli fisici

Fuori dai limiti fisici si contano le celle e si dice dove stanno: i valori sono quelli pubblicati da Copernicus e non vengono ritoccati. Temperatura -2.2…37.5 °C, corrente fino a 3.0 m/s; la codifica taglia ogni componente a ±4.09 m/s.

- monthly/sst: 405 fotogrammi, minimo -2.84 °C, massimo 36.91 °C; fuori limite 2667 celle su 277270326 (9.62e-06); dove: 78,17 (110), 78,16 (72), -66,142 (69), -66,141 (52), -66,119 (47), -66,143 (47); tutte oltre i 40° di latitudine, nei mari con ghiaccio → **OK**
- daily/sst: 1033 fotogrammi, minimo -2.96 °C, massimo 36.97 °C; fuori limite 125997 celle su 707169870 (1.78e-04); dove: -66,142 (1036), -66,143 (1013), -66,144 (917), -66,145 (691), 63,-41 (681), -66,141 (675); tutte oltre i 40° di latitudine, nei mari con ghiaccio → **OK**
- daily/ostia: 365 fotogrammi, minimo -2.00 °C, massimo 36.94 °C; fuori limite 0 celle su 251165625 (0.00e+00) → **OK**
- daily/med: 365 fotogrammi, minimo 6.87 °C, massimo 33.52 °C; fuori limite 0 celle su 38856075 (0.00e+00) → **OK**
- hourly/sst: 336 fotogrammi, minimo -2.08 °C, massimo 34.25 °C; fuori limite 0 celle su 229636512 (0.00e+00) → **OK**
- monthly/correnti: 405 fotogrammi, massimo 5.79 m/s; oltre 3.0 m/s 3392 celle su 238534699 (1.42e-05), di cui 380 tagliate dalla codifica; dove: 2,-50 (1540), 3,-50 (848), 2,-49 (362), 1,-50 (194), 3,-51 (143), 1,-49 (116) → **OK**
- daily/correnti: 1033 fotogrammi, massimo 5.79 m/s; oltre 3.0 m/s 5946 celle su 590262308 (1.01e-05), di cui 1421 tagliate dalla codifica; dove: 2,-50 (1620), 3,-50 (993), 2,-49 (714), 1,-49 (312), 1,-50 (302), 3,-51 (299) → **OK**
- hourly/correnti: 336 fotogrammi, massimo 5.79 m/s; oltre 3.0 m/s 1622 celle su 186220128 (8.71e-06), di cui 59 tagliate dalla codifica; dove: 1,-49 (668), 2,-50 (188), 1,-50 (164), 38,126 (132), 64,-72 (96), -16,123 (76) → **OK**

## 3. Dati di mare sopra la terra

- monthly/sst 2026-09: 869 celle con dato su terra piena su 683442 (0.127%). Esempi: 83.6,-32.9, 83.6,-32.6, 83.6,-32.4, 83.6,-32.1, 83.6,-31.9, 83.6,-31.6, 83.6,-31.4, 83.6,-31.1
- monthly/cur 2026-09: 401 celle con dato su terra piena su 573474 (0.070%). Esempi: 81.9,58.4, 81.9,58.6, 81.9,58.9, 81.9,59.1, 81.4,56.9, 81.4,57.1, 81.4,57.6, 81.1,-62.4

Nel disegno la maschera di Natural Earth copre comunque la terra: queste celle non si vedono.

## 4. Orientamento delle correnti (media dei fotogrammi mensili)

| corrente | lat | lon | u medio | v medio | atteso | esito |
|---|---|---|---|---|---|---|
| Corrente del Golfo | 37.6 | -70.1 | +0.914 | +0.198 | u > 0 | **OK** |
| Kuroshio | 35.1 | 142.1 | +0.363 | +0.282 | u > 0 | **OK** |
| Agulhas | -34.6 | 27.1 | -0.520 | -0.373 | v < 0 | **OK** |
| Brasile | -27.1 | -46.1 | -0.113 | -0.233 | v < 0 | **OK** |
| Circumpolare (Drake) | -58.1 | -62.1 | +0.271 | +0.136 | u > 0 | **OK** |
| Equatoriale del Sud | -1.1 | -120.1 | -0.308 | +0.045 | u < 0 | **OK** |
| Somala (estate) | 6.1 | 51.6 | +0.033 | +0.362 | v > 0 | **OK** |

## 7. Anomalie

- media delle anomalie mensili 1993–2020, cella per cella: massimo |0.0035| °C → **OK**
- 2026-08, anomalia da anfc meno anomalia da GLORYS (stesso mese, la correzione stimata senza quell'anno, da 3 anni): senza correzione media -0.089 °C, scarto quadratico 0.410 °C; con la correzione media -0.019 °C, scarto 0.350 °C → **OK**
- anomalia media globale (60°S–60°N escluse le celle senza dato) di 2026-09: +0.762 °C

## 1. Valori pubblicati contro gli originali Copernicus

| livello | variabile | istante | dataset | lat | lon | pubblicato | originale | differenza |
|---|---|---|---|---|---|---|---|---|
| monthly | sst | 1993-01 | `cmems_mod_glo_phy_my_0.083deg_P1M-m` | -18.625 | -1.875 | 22.5100 | 22.5078 | +0.0022 |
| monthly | sst | 1993-01 | `cmems_mod_glo_phy_my_0.083deg_P1M-m` | -27.125 | -100.875 | 24.1900 | 24.1882 | +0.0018 |
| monthly | sst | 1993-01 | `cmems_mod_glo_phy_my_0.083deg_P1M-m` | 82.625 | 109.875 | -1.7900 | -1.7906 | +0.0006 |
| monthly | sst | 2009-11 | `cmems_mod_glo_phy_my_0.083deg_P1M-m` | 48.625 | -52.125 | 2.5300 | 2.5331 | -0.0031 |
| monthly | sst | 2009-11 | `cmems_mod_glo_phy_my_0.083deg_P1M-m` | -56.375 | -131.875 | 4.6800 | 4.6838 | -0.0038 |
| monthly | sst | 2009-11 | `cmems_mod_glo_phy_my_0.083deg_P1M-m` | 77.375 | -92.125 | -1.6700 | -1.6661 | -0.0039 |
| monthly | sst | 2026-09 | `cmems_mod_glo_phy-thetao_anfc_0.083deg_P1M-m` | 78.875 | 59.625 | 2.5200 | 2.5207 | -0.0007 |
| monthly | sst | 2026-09 | `cmems_mod_glo_phy-thetao_anfc_0.083deg_P1M-m` | 69.625 | 46.625 | 8.4500 | 8.4494 | +0.0006 |
| monthly | sst | 2026-09 | `cmems_mod_glo_phy-thetao_anfc_0.083deg_P1M-m` | 71.875 | -3.875 | 6.4300 | 6.4314 | -0.0014 |
| monthly | u | 1993-01 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1M-m` | -5.125 | -157.375 | -0.2320 | -0.2310 | -0.0010 |
| monthly | v | 1993-01 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1M-m` | -5.125 | -157.375 | -0.1020 | -0.1020 | +0.0000 |
| monthly | u | 1993-01 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1M-m` | -68.625 | 25.625 | -0.0360 | -0.0350 | -0.0010 |
| monthly | v | 1993-01 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1M-m` | -68.625 | 25.625 | -0.0320 | -0.0320 | +0.0000 |
| monthly | u | 1993-01 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1M-m` | 21.125 | 125.625 | -0.0420 | -0.0410 | -0.0010 |
| monthly | v | 1993-01 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1M-m` | 21.125 | 125.625 | -0.0600 | -0.0590 | -0.0010 |
| monthly | u | 2009-11 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1M-m` | 0.125 | -2.625 | -0.2800 | -0.2800 | +0.0000 |
| monthly | v | 2009-11 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1M-m` | 0.125 | -2.625 | 0.1340 | 0.1330 | +0.0010 |
| monthly | u | 2009-11 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1M-m` | -15.625 | 149.375 | -0.2640 | -0.2650 | +0.0010 |
| monthly | v | 2009-11 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1M-m` | -15.625 | 149.375 | -0.0100 | -0.0110 | +0.0010 |
| monthly | u | 2009-11 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1M-m` | 35.625 | -139.375 | 0.0960 | 0.0960 | +0.0000 |
| monthly | v | 2009-11 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1M-m` | 35.625 | -139.375 | 0.0720 | 0.0720 | +0.0000 |
| monthly | u | 2026-09 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_P1M-m` | -1.875 | 146.125 | -0.2740 | -0.2740 | +0.0000 |
| monthly | v | 2026-09 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_P1M-m` | -1.875 | 146.125 | 0.1980 | 0.1980 | +0.0000 |
| monthly | u | 2026-09 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_P1M-m` | -26.375 | 46.125 | -0.5240 | -0.5230 | -0.0010 |
| monthly | v | 2026-09 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_P1M-m` | -26.375 | 46.125 | -0.4800 | -0.4790 | -0.0010 |
| monthly | u | 2026-09 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_P1M-m` | -60.625 | 49.125 | 0.1580 | 0.1570 | +0.0010 |
| monthly | v | 2026-09 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_P1M-m` | -60.625 | 49.125 | 0.0080 | 0.0090 | -0.0010 |
| daily | sst | 2024-01-01 | `cmems_mod_glo_phy_my_0.083deg_P1D-m` | -57.125 | -0.375 | 0.6100 | 0.6146 | -0.0046 |
| daily | sst | 2024-01-01 | `cmems_mod_glo_phy_my_0.083deg_P1D-m` | 73.375 | 135.125 | -1.1300 | -1.1322 | +0.0022 |
| daily | sst | 2024-01-01 | `cmems_mod_glo_phy_my_0.083deg_P1D-m` | -40.625 | -74.625 | 14.7400 | 14.7410 | -0.0010 |
| daily | sst | 2025-05-31 | `cmems_mod_glo_phy_my_0.083deg_P1D-m` | -4.125 | 167.375 | 30.2200 | 30.2158 | +0.0042 |
| daily | sst | 2025-05-31 | `cmems_mod_glo_phy_my_0.083deg_P1D-m` | 42.125 | -172.625 | 11.8200 | 11.8200 | +0.0000 |
| daily | sst | 2025-05-31 | `cmems_mod_glo_phy_my_0.083deg_P1D-m` | -20.875 | 57.375 | 26.2700 | 26.2706 | -0.0006 |
| daily | sst | 2026-10-29 | `cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m` | 18.875 | 166.875 | 28.6000 | 28.5975 | +0.0025 |
| daily | sst | 2026-10-29 | `cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m` | -15.375 | -32.875 | 27.0300 | 27.0252 | +0.0048 |
| daily | sst | 2026-10-29 | `cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m` | -16.625 | -143.125 | 26.1900 | 26.1928 | -0.0028 |
| daily | u | 2024-01-01 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1D-m` | -51.625 | -40.125 | -0.0140 | -0.0130 | -0.0010 |
| daily | v | 2024-01-01 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1D-m` | -51.625 | -40.125 | 0.0760 | 0.0770 | -0.0010 |
| daily | u | 2024-01-01 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1D-m` | -34.625 | -146.625 | -0.0240 | -0.0230 | -0.0010 |
| daily | v | 2024-01-01 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1D-m` | -34.625 | -146.625 | -0.1240 | -0.1230 | -0.0010 |
| daily | u | 2024-01-01 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1D-m` | -9.875 | 8.625 | -0.1560 | -0.1560 | +0.0000 |
| daily | v | 2024-01-01 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1D-m` | -9.875 | 8.625 | -0.0860 | -0.0850 | -0.0010 |
| daily | u | 2025-05-31 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1D-m` | 55.125 | -27.375 | -0.0200 | -0.0210 | +0.0010 |
| daily | v | 2025-05-31 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1D-m` | 55.125 | -27.375 | -0.0980 | -0.0970 | -0.0010 |
| daily | u | 2025-05-31 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1D-m` | -47.625 | -120.625 | 0.1040 | 0.1040 | +0.0000 |
| daily | v | 2025-05-31 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1D-m` | -47.625 | -120.625 | 0.0480 | 0.0490 | -0.0010 |
| daily | u | 2025-05-31 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1D-m` | -57.375 | 144.875 | -0.0040 | -0.0050 | +0.0010 |
| daily | v | 2025-05-31 | `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1D-m` | -57.375 | 144.875 | -0.0720 | -0.0730 | +0.0010 |
| daily | u | 2026-10-29 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_P1D-m` | -49.125 | -0.125 | 0.3020 | 0.3020 | +0.0000 |
| daily | v | 2026-10-29 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_P1D-m` | -49.125 | -0.125 | -0.0540 | -0.0550 | +0.0010 |
| daily | u | 2026-10-29 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_P1D-m` | -51.625 | -44.875 | -0.0080 | -0.0090 | +0.0010 |
| daily | v | 2026-10-29 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_P1D-m` | -51.625 | -44.875 | 0.1960 | 0.1960 | +0.0000 |
| daily | u | 2026-10-29 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_P1D-m` | -49.125 | -151.625 | 0.0700 | 0.0700 | +0.0000 |
| daily | v | 2026-10-29 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_P1D-m` | -49.125 | -151.625 | -0.0300 | -0.0310 | +0.0010 |
| daily | ostia | 2025-10-30 | `METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2` | -38.125 | 73.125 | 13.2600 | 13.2592 | +0.0008 |
| daily | ostia | 2025-10-30 | `METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2` | 9.125 | -109.625 | 27.6200 | 27.6152 | +0.0048 |
| daily | ostia | 2025-10-30 | `METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2` | -48.375 | 134.375 | 9.1000 | 9.0992 | +0.0008 |
| daily | ostia | 2026-04-30 | `METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2` | 11.625 | 115.625 | 29.9400 | 29.9432 | -0.0032 |
| daily | ostia | 2026-04-30 | `METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2` | 4.125 | 172.125 | 30.1000 | 30.1048 | -0.0048 |
| daily | ostia | 2026-04-30 | `METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2` | 31.625 | -37.875 | 21.3600 | 21.3592 | +0.0008 |
| daily | ostia | 2026-10-29 | `METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2` | 60.625 | -91.375 | 2.2800 | 2.2816 | -0.0016 |
| daily | ostia | 2026-10-29 | `METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2` | -64.375 | 4.625 | -1.8000 | -1.8000 | +0.0000 |
| daily | ostia | 2026-10-29 | `METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2` | -75.125 | 174.125 | -1.8000 | -1.8000 | +0.0000 |
| hourly | sst | 2026-10-16T00 | `cmems_mod_glo_phy_anfc_0.083deg_PT1H-m` | 23.625 | -46.375 | 28.6900 | 28.6937 | -0.0037 |
| hourly | sst | 2026-10-16T00 | `cmems_mod_glo_phy_anfc_0.083deg_PT1H-m` | 87.875 | -0.625 | -1.6000 | -1.6009 | +0.0009 |
| hourly | sst | 2026-10-16T00 | `cmems_mod_glo_phy_anfc_0.083deg_PT1H-m` | -47.625 | 1.875 | 4.6000 | 4.5986 | +0.0014 |
| hourly | sst | 2026-10-23T00 | `cmems_mod_glo_phy_anfc_0.083deg_PT1H-m` | -13.375 | -147.875 | 29.4700 | 29.4731 | -0.0031 |
| hourly | sst | 2026-10-23T00 | `cmems_mod_glo_phy_anfc_0.083deg_PT1H-m` | -37.875 | -164.375 | 13.3800 | 13.3774 | +0.0026 |
| hourly | sst | 2026-10-23T00 | `cmems_mod_glo_phy_anfc_0.083deg_PT1H-m` | -39.875 | 72.375 | 12.8700 | 12.8654 | +0.0046 |
| hourly | sst | 2026-10-29T23 | `cmems_mod_glo_phy_anfc_0.083deg_PT1H-m` | -47.625 | 176.625 | 8.0100 | 8.0104 | -0.0004 |
| hourly | sst | 2026-10-29T23 | `cmems_mod_glo_phy_anfc_0.083deg_PT1H-m` | -25.875 | -86.875 | 19.5800 | 19.5765 | +0.0035 |
| hourly | sst | 2026-10-29T23 | `cmems_mod_glo_phy_anfc_0.083deg_PT1H-m` | 0.375 | -2.375 | 27.5800 | 27.5772 | +0.0028 |
| hourly | u | 2026-10-16T00 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_PT1H-i` | 12.375 | 149.875 | -0.3620 | -0.3610 | -0.0010 |
| hourly | v | 2026-10-16T00 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_PT1H-i` | 12.375 | 149.875 | -0.0240 | -0.0230 | -0.0010 |
| hourly | u | 2026-10-16T00 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_PT1H-i` | 27.875 | -135.625 | -0.0940 | -0.0940 | +0.0000 |
| hourly | v | 2026-10-16T00 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_PT1H-i` | 27.875 | -135.625 | 0.0360 | 0.0350 | +0.0010 |
| hourly | u | 2026-10-16T00 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_PT1H-i` | -47.625 | -91.125 | 0.0040 | 0.0030 | +0.0010 |
| hourly | v | 2026-10-16T00 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_PT1H-i` | -47.625 | -91.125 | -0.1720 | -0.1710 | -0.0010 |
| hourly | u | 2026-10-23T00 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_PT1H-i` | 58.625 | 172.625 | -0.0720 | -0.0720 | +0.0000 |
| hourly | v | 2026-10-23T00 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_PT1H-i` | 58.625 | 172.625 | 0.1520 | 0.1530 | -0.0010 |
| hourly | u | 2026-10-23T00 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_PT1H-i` | -62.625 | 136.875 | -0.0320 | -0.0320 | +0.0000 |
| hourly | v | 2026-10-23T00 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_PT1H-i` | -62.625 | 136.875 | 0.0760 | 0.0770 | -0.0010 |
| hourly | u | 2026-10-23T00 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_PT1H-i` | 28.375 | -117.375 | 0.0200 | 0.0200 | +0.0000 |
| hourly | v | 2026-10-23T00 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_PT1H-i` | 28.375 | -117.375 | -0.2320 | -0.2310 | -0.0010 |
| hourly | u | 2026-10-29T23 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_PT1H-i` | 18.625 | 131.375 | -0.2480 | -0.2490 | +0.0010 |
| hourly | v | 2026-10-29T23 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_PT1H-i` | 18.625 | 131.375 | -0.1160 | -0.1150 | -0.0010 |
| hourly | u | 2026-10-29T23 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_PT1H-i` | -7.625 | -136.625 | -0.1300 | -0.1310 | +0.0010 |
| hourly | v | 2026-10-29T23 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_PT1H-i` | -7.625 | -136.625 | -0.0020 | -0.0010 | -0.0010 |
| hourly | u | 2026-10-29T23 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_PT1H-i` | 33.375 | -65.625 | -0.0440 | -0.0430 | -0.0010 |
| hourly | v | 2026-10-29T23 | `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_PT1H-i` | 33.375 | -65.625 | -0.1340 | -0.1340 | +0.0000 |

- monthly/sst: differenza massima 0.0039 (tolleranza 0.0060) → **OK**
- monthly/cur: differenza massima 0.0010 (tolleranza 0.0011) → **OK**
- daily/sst: differenza massima 0.0048 (tolleranza 0.0060) → **OK**
- daily/cur: differenza massima 0.0010 (tolleranza 0.0011) → **OK**
- daily/ostia: differenza massima 0.0048 (tolleranza 0.0060) → **OK**
- hourly/sst: differenza massima 0.0046 (tolleranza 0.0060) → **OK**
- hourly/cur: differenza massima 0.0010 (tolleranza 0.0011) → **OK**

## 5. Cuciture fra i dataset (stesso istante da entrambe le fonti)

- monthly/sst 2026-08: `cmems_mod_glo_phy_my_0.083deg_P1M-m` − `cmems_mod_glo_phy-thetao_anfc_0.083deg_P1M-m`: media +0.0890 °C, scarto quadratico 0.4098 °C
- monthly/cur 2026-03: `cmems_obs-mob_glo_phy-cur_my_0.25deg_P1M-m` − `cmems_obs-mob_glo_phy-cur_nrt_0.25deg_P1M-m`: media +0.0057 m/s, scarto quadratico 0.0181 m/s (velocita' media 0.170 m/s)
- daily/sst 2026-09-22: `cmems_mod_glo_phy_my_0.083deg_P1D-m` − `cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m`: media +0.1332 °C, scarto quadratico 0.4945 °C

Una media vicina a zero vuol dire che al cambio di fonte non c'e' un salto sistematico; lo scarto quadratico misura le differenze locali (vortici, fronti), che restano.

## Riepilogo

- ✅ continuita monthly
- ✅ continuita daily
- ✅ continuita hourly
- ✅ intervallo monthly/sst
- ✅ intervallo daily/sst
- ✅ intervallo daily/ostia
- ✅ intervallo daily/med
- ✅ intervallo hourly/sst
- ✅ velocita monthly
- ✅ velocita daily
- ✅ velocita hourly
- ✅ terra monthly/sst
- ✅ terra monthly/cur
- ✅ verso Corrente del Golfo
- ✅ verso Kuroshio
- ✅ verso Agulhas
- ✅ verso Brasile
- ✅ verso Circumpolare (Drake)
- ✅ verso Equatoriale del Sud
- ✅ verso Somala (estate)
- ✅ anomalia a media nulla
- ✅ correzione anfc − GLORYS
- ✅ punti monthly/sst
- ✅ punti monthly/cur
- ✅ punti daily/sst
- ✅ punti daily/cur
- ✅ punti daily/ostia
- ✅ punti hourly/sst
- ✅ punti hourly/cur
- ✅ cucitura monthly/sst
- ✅ cucitura monthly/cur
- ✅ cucitura daily/sst
