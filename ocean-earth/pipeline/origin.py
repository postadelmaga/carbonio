"""Da quali file d'origine viene un giorno: per sapere se la fonte l'ha rivisto
SENZA riscaricarlo.

Le analisi orarie vengono riviste dalla fonte nei giorni dopo, e frames.py
--refresh le teneva allineate riscaricando ogni giorno tutta la finestra: 14
giorni di campi globali, 6,6 GB al giorno (misurato il 23 nov 2026), per
trovare quasi sempre zero fotogrammi cambiati.

Ogni dataset Copernicus Marine ha pero' anche i suoi FILE ORIGINALI in un
bucket S3 che si puo' elencare senza login, e il nome di ogni file dice a
quale giorno appartiene e quale corsa l'ha prodotto:

    glo12_rg_1h-m_20261121-20261121_2D_fcst_R20261122.nc     temperatura
    dataset-uv-nrt-hourly_20261121T0000Z_P20261122T0000.nc   correnti

Un giorno della temperatura passa per tre versioni (fcst il giorno dopo, nwct
il mercoledi' seguente, hcst quello dopo ancora) e le revisioni arrivano tutte
insieme, una volta a settimana; un giorno delle correnti viene rigenerato dopo
1, 3 e 6 giorni. Un elenco di pochi KB dice quindi quali giorni sono cambiati
dall'ultima volta: la FIRMA di un giorno e' l'insieme dei suoi file con il
loro ETag, e si riscarica solo il giorno la cui firma non e' quella salvata.

Tre cautele, perche' questa e' un'ottimizzazione e non deve poter far perdere
una revisione:

- frames.py legge dall'archivio ARCO (zarr), che la fonte ricava dai file
  originali circa un'ora dopo. La firma di un giorno si salva solo se il
  catalogo dice che ARCO e' stato aggiornato DOPO l'ultima modifica dei suoi
  file; altrimenti il giorno si riscarica anche alla corsa successiva.
- Se l'elenco non riesce (rete, bucket chiuso, nomi cambiati) plan() solleva
  un'eccezione e frames.py ricontrolla tutta la finestra, come faceva prima.
- Ogni FULL_EVERY giorni si ricontrolla comunque tutto. Un fotogramma trovato
  rivisto in un giorno la cui firma NON era cambiata viene scritto nei log
  come INATTESO (e finisce in data/logs/revisioni.log): e' la prova che la
  regola non basta. OE_FULL_REFRESH_DAYS cambia l'intervallo, 0 lo toglie;
  OE_FULL_REFRESH=1 forza un ricontrollo completo.
"""
import datetime as dt
import json
import os
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field

FULL_EVERY = int(os.environ.get('OE_FULL_REFRESH_DAYS', '7'))
_NS = '{http://s3.amazonaws.com/doc/2006-03-01/}'


def day_of(key):
    """Il giorno dei dati di un file originale: la prima data di otto cifre del
    nome. None se il nome non ne ha una (un file che non e' di un giorno)."""
    m = re.search(r'(?<!\d)(\d{4})(\d{2})(\d{2})(?!\d)', key.rsplit('/', 1)[-1])
    if not m:
        return None
    try:
        return dt.date(int(m[1]), int(m[2]), int(m[3])).isoformat()
    except ValueError:
        return None


def parse_listing(xml):
    """Una pagina di ListObjectsV2 → ([(chiave, ETag, ultima modifica)], token
    della pagina dopo o None)."""
    root = ET.fromstring(xml)
    rows = []
    for c in root.iter(f'{_NS}Contents'):
        rows.append((c.findtext(f'{_NS}Key'), c.findtext(f'{_NS}ETag').strip('"'),
                     parse_time(c.findtext(f'{_NS}LastModified'))))
    return rows, root.findtext(f'{_NS}NextContinuationToken')


def parse_time(s):
    return dt.datetime.fromisoformat(s.replace('Z', '+00:00')).astimezone(dt.timezone.utc).replace(tzinfo=None)


def signatures(rows):
    """Dalle righe dell'elenco: giorno → (firma, ultima modifica dei suoi file)."""
    by_day = {}
    for key, etag, modified in rows:
        d = day_of(key)
        if d:
            by_day.setdefault(d, []).append((key.rsplit('/', 1)[-1], etag, modified))
    return {d: (';'.join(f'{name}|{etag}' for name, etag, _ in sorted(files)), max(f[2] for f in files))
            for d, files in by_day.items()}


@dataclass
class Plan:
    redo: set                     # giorni da riscaricare
    changed: set                  # di questi, quelli con la firma cambiata (gli altri: ricontrollo completo)
    storable: dict                # giorno → firma da salvare se il giorno va a buon fine
    full: bool                    # questa corsa ricontrolla tutta la finestra
    note: str = ''
    saved: dict = field(default_factory=dict)


def choose(days, saved, sigs, arco_updated, today, full_every=FULL_EVERY, force_full=False):
    """Che cosa riscaricare. `days`: i giorni della finestra; `saved`: lo stato
    dell'ultima volta ({'days': {giorno: firma}, 'full': 'AAAA-MM-GG'}); `sigs`:
    signatures() dell'elenco di adesso; `arco_updated`: quando la fonte ha
    aggiornato l'archivio da cui si scarica (None: non si sa)."""
    old = saved.get('days', {})
    # un giorno assente dall'elenco non si sa da dove venga: si rifa' e non si salva
    changed = {d for d in days if d not in sigs or old.get(d) != sigs[d][0]}
    last_full = saved.get('full')
    full = force_full or not last_full or (
        full_every > 0 and (today - dt.date.fromisoformat(last_full)).days >= full_every)
    redo = set(days) if full else changed
    storable = {d: sigs[d][0] for d in redo
                if d in sigs and arco_updated is not None and sigs[d][1] <= arco_updated}
    waiting = sorted(d for d in redo if d in sigs and d not in storable)
    note = f'{len(changed)} giorni su {len(days)} con i file d\'origine cambiati'
    if full:
        note += '; ricontrollo completo' + ('' if last_full else ' (il primo)')
    if waiting:
        note += f'; {len(waiting)} da ricontrollare anche alla prossima corsa (ARCO non ancora aggiornato)'
    return Plan(redo=redo, changed=changed, storable=storable, full=full, note=note, saved=saved)


def finish(plan, days, done_days, today):
    """Lo stato da salvare dopo la corsa: le firme dei giorni andati a buon
    fine, quelle di prima per i giorni non toccati, niente fuori dalla finestra."""
    old = plan.saved.get('days', {})
    out = {}
    for d in days:
        if d in plan.redo:
            if d in done_days and d in plan.storable:
                out[d] = plan.storable[d]
        elif d in old:
            out[d] = old[d]
    state = {'days': dict(sorted(out.items()))}
    last_full = plan.saved.get('full')
    # un ricontrollo completo vale solo se ha davvero ricontrollato tutto
    if plan.full and set(days) <= set(done_days):
        last_full = today.isoformat()
    if last_full:
        state['full'] = last_full
    return state


# ── rete ───────────────────────────────────────────────────────────────────
def location(dataset_id):
    """(indirizzo S3, bucket, prefisso) dei file originali del dataset e la data
    dell'ultimo aggiornamento di ARCO, dal catalogo. La versione e' l'ultima,
    quella che copernicusmarine sceglie quando non gliene si chiede una."""
    import copernicusmarine as cm
    cat = cm.describe(dataset_id=dataset_id, disable_progress_bar=True)
    versions = [v for p in cat.products for d in p.datasets if d.dataset_id == dataset_id for v in d.versions]
    if not versions:
        raise RuntimeError(f'{dataset_id}: non e\' nel catalogo')
    part = max(versions, key=lambda v: v.label).parts[0]
    uri = next((s.uri for s in part.services if s.service_name == 'original-files'), None)
    if not uri:
        raise RuntimeError(f'{dataset_id}: il catalogo non dice dove sono i file originali')
    u = urllib.parse.urlparse(uri)
    bucket, _, prefix = u.path.lstrip('/').partition('/')
    updated = getattr(part, 'arco_updated_date', None)
    return f'{u.scheme}://{u.netloc}', bucket, prefix.rstrip('/') + '/', parse_time(updated) if updated else None


def listing(endpoint, bucket, prefix):
    rows, token = [], None
    while True:
        q = {'list-type': '2', 'prefix': prefix}
        if token:
            q['continuation-token'] = token
        req = urllib.request.Request(f'{endpoint}/{bucket}?{urllib.parse.urlencode(q)}',
                                     headers={'User-Agent': 'ocean-earth-pipeline'})
        with urllib.request.urlopen(req, timeout=60) as r:
            page, token = parse_listing(r.read())
        rows += page
        if not token:
            return rows


def load(path):
    return json.loads(path.read_text()) if path.exists() else {}


def save(path, state):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(state, indent=0))
    tmp.replace(path)


def plan(dataset_id, days, state_path, today=None):
    """Legge l'elenco dei file originali dei mesi della finestra e decide.
    Solleva un'eccezione se l'elenco non e' utilizzabile: chi chiama ricontrolla
    allora tutta la finestra."""
    today = today or dt.datetime.now(dt.timezone.utc).date()
    endpoint, bucket, prefix, arco_updated = location(dataset_id)
    rows = []
    for month in sorted({d[:7] for d in days}):
        rows += listing(endpoint, bucket, f'{prefix}{month[:4]}/{month[5:7]}/')
    sigs = signatures(rows)
    if not any(d in sigs for d in days):
        raise RuntimeError(f'nessun file originale riconosciuto per la finestra ({len(rows)} file elencati)')
    return choose(days, load(state_path), sigs, arco_updated, today,
                  force_full=bool(os.environ.get('OE_FULL_REFRESH')))
