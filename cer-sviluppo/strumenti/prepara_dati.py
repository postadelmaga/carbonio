# /// script
# requires-python = ">=3.11"
# dependencies = ["openpyxl>=3.1"]
# ///
"""Prepara i dati del simulatore della CER per il sito (spec del simulatore del sito, §5).

    uv run cer-sviluppo/strumenti/prepara_dati.py                  # tutto, con la cache
    uv run cer-sviluppo/strumenti/prepara_dati.py --solo 011015    # solo le serie PV di alcune località
    uv run cer-sviluppo/strumenti/prepara_dati.py --controlla-cersim <seriescalc_….json.gz>

Scarica l'elenco ISTAT dei comuni, le coordinate da Wikidata, le serie PVGIS 5.3 dei capoluoghi e lo zip ARERA dei
profili domestici; tiene le risposte in una cache fuori dal repo; scrive cer/simulatore/dati/.
"""
import argparse
import csv
import gzip
import hashlib
import http.client
import io
import json
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

import openpyxl

RADICE = Path(__file__).resolve().parents[2]
USCITA = RADICE / "cer" / "simulatore" / "dati"
COSTANTI = USCITA / "costanti.json"
CACHE = RADICE.parent / "cache-simulatore-cer"
ISTAT_URL = "https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.csv"
WIKIDATA_URL = "https://query.wikidata.org/sparql"
PVGIS_URL = "https://re.jrc.ec.europa.eu/api/v5_3/seriescalc"
ARERA_URL = "https://www.arera.it/fileadmin/allegati/dati/monitoraggioretail/Dati_regione_2025.zip"
ARERA_SHA256 = "2b7e5b4dc5d61f60ad7a1935c113aafbb26d8a1b5b6a371f73dc084806e1603c"  # la stessa di cersim/data/profili/LEGGIMI.md
AGENTE = "simulatore-cer/1.0 (https://co2-info.duckdns.org/cer/simulatore/)"
ATTESE = (5, 10, 20, 40)  # secondi di pausa dopo il 1°, 2°, 3° e 4° tentativo fallito: in tutto 5 tentativi
ANNO = 2023
CLASSI = {
    "0<potenza_impegnata<=1.5": "0-1,5",
    "1.5<potenza_impegnata<=3": "1,5-3",
    "3<potenza_impegnata<=4.5": "3-4,5",
    "4.5<potenza_impegnata<=6": "4,5-6",
    "potenza_impegnata>6": "oltre_6",
}
GIORNI = {"Giorno feriale": "feriale", "Sabato": "sabato", "Domenica": "festivo"}
# Codice ISTAT → (lat, lon), solo con il motivo in un commento. Controllati su Wikidata (query.wikidata.org) il 3 novembre 2026.
COORDINATE_MANUALI: dict[str, tuple[float, float]] = {
    # Agrigento (Q13678): un solo elemento con due coordinate a meno di 300 m, entrambe di rango normale; si tiene la più precisa.
    "084001": (37.31065, 13.57661),
    # Cagliari (Q1897): un solo elemento con due coordinate a meno di 700 m, entrambe di rango normale; si tiene la più precisa.
    "092009": (39.214886, 9.109522),
    # Crotone (Q6681): il codice 101010 è scritto anche sulla frazione Papanice (Q3894683), a circa 8 km; vale il comune.
    "101010": (39.083333333, 17.116666666),
    # Nuoro (Q13649, provincia di Nuoro): su Wikidata ha il codice ISTAT 114027, non 091051 come nell'elenco ISTAT
    # (il codice è cambiato con la riforma delle province sarde); unico comune di nome Nuoro.
    "091051": (40.3200621, 9.3280792),
    # Carbonia (Q13660): unico comune di nome Carbonia. Su Wikidata ha il codice ISTAT 119003, non 111009 come nell'elenco ISTAT,
    # e la provincia del Sulcis Iglesiente, non «Sud Sardegna» come nell'elenco ISTAT: la differenza viene dalla riforma delle
    # province sarde.
    "111009": (39.1668029, 8.5219574),
}


def sha256(dati: bytes) -> str:
    return hashlib.sha256(dati).hexdigest()


def slug(testo: str) -> str:
    """Lo stesso algoritmo di slug() in cer/simulatore/js/formato.js."""
    s = unicodedata.normalize("NFD", testo.lower())
    s = "".join(c for c in s if not unicodedata.combining(c)).replace("'", "").replace("’", "")
    out, trattino = [], False
    for c in s:
        if c.isascii() and c.isalnum():
            out.append(c); trattino = False
        elif not trattino:
            out.append("-"); trattino = True
    return "".join(out).strip("-")


def richiedi(richiesta, etichetta):
    """Fino a 5 tentativi per gli errori di connessione e le risposte HTTP 429 e 5xx; ogni altro errore HTTP ferma subito."""
    for n in range(1, len(ATTESE) + 2):
        try:
            with urllib.request.urlopen(richiesta, timeout=180) as r:
                return r.read()
        except urllib.error.HTTPError as e:  # prima di URLError, di cui è una sottoclasse
            if not (e.code == 429 or 500 <= e.code < 600):
                sys.exit(f"{etichetta}: risposta HTTP {e.code} {e.reason}")
            motivo, dettaglio = f"risposta HTTP {e.code}", str(e)
        except http.client.RemoteDisconnected as e:
            motivo, dettaglio = "connessione chiusa", str(e)
        except TimeoutError as e:
            motivo, dettaglio = "tempo scaduto", str(e)
        except (ConnectionError, urllib.error.URLError) as e:
            motivo, dettaglio = "errore di connessione", str(e)
        if n > len(ATTESE):
            sys.exit(f"{etichetta}: {motivo} anche al {n}º tentativo ({dettaglio})")
        print(f"{etichetta}: {motivo}, nuovo tentativo fra {ATTESE[n - 1]} s ({n} di {len(ATTESE) + 1})", flush=True)
        time.sleep(ATTESE[n - 1])


def scarica(url, nome, *, dati=None, intestazioni=None, etichetta=None):
    percorso, meta = CACHE / nome, CACHE / (nome + ".meta.json")
    if percorso.exists():
        return percorso.read_bytes(), json.loads(meta.read_text())["scaricato_il"]
    richiesta = urllib.request.Request(url, data=dati, headers={"User-Agent": AGENTE, **(intestazioni or {})})
    corpo = richiedi(richiesta, etichetta or nome)
    percorso.parent.mkdir(parents=True, exist_ok=True)
    percorso.write_bytes(corpo)
    giorno = time.strftime("%Y-%m-%d")
    meta.write_text(json.dumps({"url": url, "scaricato_il": giorno, "sha256": sha256(corpo)}))
    time.sleep(0.25)  # ben sotto il limite PVGIS di 30 richieste al secondo
    return corpo, giorno


def capoluoghi():
    corpo, giorno = scarica(ISTAT_URL, "istat/Elenco-comuni-italiani.csv", etichetta="ISTAT")
    righe = list(csv.reader(io.StringIO(corpo.decode("latin-1")), delimiter=";"))
    testa = [" ".join(c.split()) for c in righe[0]]
    col = lambda prefisso: next(i for i, c in enumerate(testa) if c.startswith(prefisso))
    i_cap, i_cod = col("Flag Comune capoluogo"), col("Codice Comune formato alfanumerico")
    i_nome, i_reg, i_sig = col("Denominazione in italiano"), col("Denominazione Regione"), col("Sigla automobilistica")
    elenco = [
        {"codice": r[i_cod], "nome": r[i_nome], "sigla": r[i_sig], "regione": r[i_reg].split("/")[0].strip()}
        for r in righe[1:] if len(r) > i_cap and r[i_cap].strip() == "1"
    ]
    return sorted(elenco, key=lambda x: x["codice"]), {"url": ISTAT_URL, "scaricato_il": giorno, "sha256": sha256(corpo)}


def coordinate(codici):
    valori = " ".join(f'"{c}"' for c in codici)
    query = f"SELECT ?istat ?coord WHERE {{ VALUES ?istat {{ {valori} }} ?item wdt:P635 ?istat ; wdt:P625 ?coord . }}"
    corpo, giorno = scarica(
        WIKIDATA_URL, f"wikidata/{sha256(query.encode())[:16]}.json",
        dati=urllib.parse.urlencode({"query": query}).encode(),
        intestazioni={"Accept": "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded"},
        etichetta="Wikidata",
    )
    trovate = {}
    for b in json.loads(corpo)["results"]["bindings"]:
        lon, lat = (float(x) for x in b["coord"]["value"].removeprefix("Point(").removesuffix(")").split())
        trovate.setdefault(b["istat"]["value"], {}).setdefault((round(lat, 2), round(lon, 2)), (lat, lon))
    esito, errori = {}, []
    for c in codici:
        if c in COORDINATE_MANUALI:
            esito[c] = COORDINATE_MANUALI[c]
        elif len(trovate.get(c, {})) == 1:
            esito[c] = next(iter(trovate[c].values()))
        else:
            errori.append(f"{c}: {len(trovate.get(c, {}))} coordinate distinte")
    if errori:
        sys.exit("Wikidata: " + "; ".join(errori) + ". Controllare a mano e aggiungere COORDINATE_MANUALI con il motivo.")
    return esito, {"url": WIKIDATA_URL, "scaricato_il": giorno}


def aree():
    voce = json.loads(COSTANTI.read_text(encoding="utf-8"))["voci"]["aree_correttivo_fv"]["valore"]
    return set(voce["nord"]), set(voce["centro"])


def area(regione, nord, centro):
    return "nord" if regione in nord else "centro" if regione in centro else "sud"


def serie_pv(loc):
    parametri = {"lat": loc["lat"], "lon": loc["lon"], "peakpower": 1, "loss": 14, "aspect": 0, "optimalinclination": 1,
                 "startyear": ANNO, "endyear": ANNO, "pvcalculation": 1, "raddatabase": "PVGIS-SARAH3", "outputformat": "json"}
    url = PVGIS_URL + "?" + urllib.parse.urlencode(parametri)
    corpo, giorno = scarica(url, f"pvgis/{loc['codice']}-{sha256(url.encode())[:12]}.json", etichetta=f"PVGIS {loc['codice']}")
    r = json.loads(corpo)
    ore = r["outputs"]["hourly"]
    chi = f"PVGIS {loc['codice']} {loc['nome']}"
    if len(ore) != 8760:
        sys.exit(f"{chi}: serie di {len(ore)} ore invece di 8760")
    # Il minuto delle etichette è l'istante della scansione del satellite e cambia con la località (:10, ad Agrigento :09):
    # si controllano l'ora della prima e dell'ultima etichetta e che il minuto sia lo stesso per tutta la serie.
    if not ore[0]["time"].startswith(f"{ANNO}0101:00"):
        sys.exit(f"{chi}: la prima etichetta è {ore[0]['time']}, doveva cominciare con {ANNO}0101:00")
    if not ore[-1]["time"].startswith(f"{ANNO}1231:23"):
        sys.exit(f"{chi}: l'ultima etichetta è {ore[-1]['time']}, doveva cominciare con {ANNO}1231:23")
    minuti = sorted({o["time"][-2:] for o in ore})
    if len(minuti) != 1:
        sys.exit(f"{chi}: etichette con minuti diversi ({', '.join(minuti)})")
    # L'ora locale i inizia all'ora UTC i−1 (00:00 del 1° gennaio ora italiana = 23:00 UTC del 31 dicembre, notte):
    # spec §5.2. L'ultima ora UTC del 2023 cade nel 2024 in ora italiana e resta fuori.
    valori = [0] + [round(o["P"]) for o in ore[:8759]]
    return {
        "codice": loc["codice"], "nome": loc["nome"], "anno_meteo": ANNO,
        "inclinazione": r["inputs"]["mounting_system"]["fixed"]["slope"]["value"],
        "parametri": parametri, "scaricato_il": giorno, "sha256_risposta": sha256(corpo),
        "unita": "Wh per kWp nell'ora locale che inizia (Europe/Rome, ora legale compresa)",
        "fonte": "PVGIS 5.3 seriescalc, PVGIS-SARAH3. PVGIS © European Union", "valori": valori,
    }


def forme_arera(zip_locale=None):
    if zip_locale:  # ripiego se ARERA rifiuta lo scarico: una copia locale con la stessa impronta
        corpo, giorno = zip_locale.read_bytes(), time.strftime("%Y-%m-%d") + " da una copia locale"
    else:
        corpo, giorno = scarica(ARERA_URL, "arera/Dati_regione_2025.zip", etichetta="ARERA")
    if sha256(corpo) != ARERA_SHA256:
        sys.exit("ARERA: impronta dello zip diversa da quella registrata in cersim")
    regioni = {}
    archivio = zipfile.ZipFile(io.BytesIO(corpo))
    for nome in sorted(n for n in archivio.namelist() if "prelievo orario" in n):
        foglio = openpyxl.load_workbook(io.BytesIO(archivio.read(nome)), read_only=True).worksheets[0]
        for mese, regione, mercato, classe, residenza, giorno_t, ora, kwh in foglio.iter_rows(min_row=2, values_only=True):
            if mercato != "Tutti" or residenza.strip() != "Residente" or str(mese) == "2025":
                continue  # "2025" è la riga annuale; le mensili hanno la data del primo del mese
            tipi = regioni.setdefault(regione, {}).setdefault(CLASSI[classe], {t: [[None] * 24 for _ in range(12)] for t in GIORNI.values()})
            # "Ora1" è la prima ora del giorno, 00-01, come in cersim
            tipi[GIORNI[giorno_t]][int(str(mese)[5:7]) - 1][int(ora[3:]) - 1] = round(kwh, 6)
    for reg, classi in regioni.items():
        if set(classi) != set(CLASSI.values()):
            sys.exit(f"ARERA: classi mancanti per {reg}")
        if any(v is None for tipi in classi.values() for t in tipi.values() for r in t for v in r):
            sys.exit(f"ARERA: forme incomplete per {reg}")
    return regioni, {"url": ARERA_URL, "scaricato_il": giorno, "sha256": ARERA_SHA256}


def scrivi(percorso: Path, oggetto, compatto=False):
    percorso.parent.mkdir(parents=True, exist_ok=True)
    testo = json.dumps(oggetto, ensure_ascii=False, separators=(",", ":")) if compatto else json.dumps(oggetto, ensure_ascii=False, indent=1)
    percorso.write_text(testo + "\n", encoding="utf-8")


LEGGIMI = """# Dati del simulatore della CER

File preparati da `cer-sviluppo/strumenti/prepara_dati.py`, tranne `costanti.json` e `consumi/attivita.json`, scritti a
mano con la fonte di ogni valore.

## localita.json

I {n} comuni capoluogo dell'elenco ISTAT dei comuni ({istat_url}), scaricato il {istat_giorno}, SHA-256 `{istat_sha}`.
Licenza CC BY 4.0. Le coordinate vengono da Wikidata (proprietà P625 cercata con il codice ISTAT P635), licenza CC0,
lette il {wd_giorno}. L'area del correttivo della tariffa per il fotovoltaico (nord, centro, sud) va per regione,
come nel DM 414/2023, Allegato 1 §2.

## pv/

Una serie per capoluogo: PVGIS 5.3 `seriescalc`, banca dati PVGIS-SARAH3, anno 2023, 1 kWp, perdite del 14%, pannelli a
sud con l'inclinazione ottimale calcolata da PVGIS, montaggio libero. PVGIS © European Union, d'uso libero. Ogni valore
è l'energia in Wh dell'ora locale che inizia (Europe/Rome, ora legale compresa): l'ora locale i prende il valore
dell'ora UTC i−1. Ogni file riporta i parametri della richiesta, la data di scarico e l'impronta della risposta.
Resa annua: da {resa_min} a {resa_max} kWh per kWp.

## consumi/domestici/

Forme orarie medie dei clienti domestici residenti, per regione, classe di potenza impegnata («1,5-3» comprende i
contatori da 3 kW), mese e tipo di giorno, in kWh. Fonte: ARERA, «Analisi dei consumi dei clienti domestici», anno 2025,
file {arera_url}, SHA-256 `{arera_sha}`, letto il {arera_giorno}. **Licenza CC BY-SA 4.0**
(https://creativecommons.org/licenses/by-sa/4.0/deed.it): chi ridistribuisce questi file, anche modificati, cita ARERA e
li rilascia con la stessa licenza. Trasformazioni: righe del mercato «Tutti» e della residenza «Residente», righe
mensili; «Domenica» diventa `festivo` e vale per domeniche e festività; «Ora1» è l'ora 00-01.

## consumi/attivita.json

Archetipi illustrativi del progetto, non misurati: per le attività non esistono curve aperte. Licenza CC BY 4.0.

## costanti.json

Ogni valore con descrizione, unità, fonte, URL e data di consultazione. Del GME si cita solo la media annua del PUN
Index 2025 (Fonte: Gestore dei Mercati Energetici S.p.A.).
"""


def controlla_cersim(percorso: Path) -> int:
    d = json.loads(gzip.decompress(percorso.read_bytes()))
    url = PVGIS_URL + "?" + urllib.parse.urlencode(d["parametri"])
    corpo, _ = scarica(url, f"pvgis/controllo-{sha256(url.encode())[:12]}.json", etichetta="PVGIS controllo cersim")
    nuovi = [o["P"] for o in json.loads(corpo)["outputs"]["hourly"]]
    vecchi = [o["P"] for o in d["risposta"]["outputs"]["hourly"]]
    diversi = sum(1 for x, y in zip(nuovi, vecchi) if abs(x - y) > 1e-9)
    print(f"ore {len(nuovi)} contro {len(vecchi)}; valori diversi {diversi}; totale {sum(nuovi) / 1000:.0f} contro {sum(vecchi) / 1000:.0f} kWh")
    return 0 if diversi == 0 and len(nuovi) == len(vecchi) else 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--solo", nargs="*", help="codici ISTAT: rifà solo le loro serie PV")
    ap.add_argument("--controlla-cersim", type=Path, help="risposta PVGIS in cache di cersim da riprodurre")
    ap.add_argument("--arera-zip", type=Path, help="copia locale di Dati_regione_2025.zip, se lo scarico da ARERA non riesce")
    a = ap.parse_args()
    if a.controlla_cersim:
        return controlla_cersim(a.controlla_cersim)

    elenco, f_istat = capoluoghi()
    nord, centro = aree()
    regioni_istat = {x["regione"] for x in elenco}
    for nome, insieme in (("nord", nord), ("centro", centro)):
        for regione in sorted(insieme):
            if regione not in regioni_istat:
                sys.exit(f"regione dell'area {nome} non presente nell'elenco ISTAT: {regione}")
    coord, f_wd = coordinate([x["codice"] for x in elenco])
    forme, f_arera = forme_arera(a.arera_zip)
    for x in elenco:
        lat, lon = coord[x["codice"]]
        x.update(lat=round(lat, 4), lon=round(lon, 4), area=area(x["regione"], nord, centro))
        if x["regione"] not in forme:
            sys.exit(f"regione senza forme ARERA: {x['regione']} ({x['nome']})")
    scelti = [x for x in elenco if not a.solo or x["codice"] in a.solo]
    rese = {}
    for x in scelti:
        s = serie_pv(x)
        scrivi(USCITA / "pv" / f"{x['codice']}.json", s, compatto=True)
        rese[x["codice"]] = sum(s["valori"]) / 1000
        print(f"{x['codice']} {x['nome']:<28} {rese[x['codice']]:7.0f} kWh/kWp, {s['inclinazione']}°")
    if a.solo:
        return 0
    scrivi(USCITA / "localita.json", {"fonte": "ISTAT, elenco dei comuni (CC BY 4.0); coordinate Wikidata (CC0)", "localita": elenco})
    for regione, classi in sorted(forme.items()):
        scrivi(USCITA / "consumi" / "domestici" / f"{slug(regione)}.json",
               {"regione": regione, "fonte": "ARERA, Analisi dei consumi dei clienti domestici, 2025", "licenza": "CC BY-SA 4.0", "classi": classi}, compatto=True)
    (USCITA / "LEGGIMI.md").write_text(LEGGIMI.format(
        n=len(elenco), istat_url=f_istat["url"], istat_giorno=f_istat["scaricato_il"], istat_sha=f_istat["sha256"],
        wd_giorno=f_wd["scaricato_il"], resa_min=round(min(rese.values())), resa_max=round(max(rese.values())),
        arera_url=f_arera["url"], arera_sha=f_arera["sha256"], arera_giorno=f_arera["scaricato_il"]), encoding="utf-8")
    fuori = {c: round(r) for c, r in rese.items() if not 1000 <= r <= 1800}
    print(f"\n{len(elenco)} località, {len(forme)} regioni; resa da {min(rese.values()):.0f} a {max(rese.values()):.0f} kWh/kWp")
    print("fuori da 1.000-1.800 kWh/kWp:", fuori or "nessuna")
    return 0


if __name__ == "__main__":
    sys.exit(main())
