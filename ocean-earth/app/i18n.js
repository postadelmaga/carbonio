// Testi dell'interfaccia: italiano e inglese. Le altre lingue del sito
// ricadono sull'inglese.

const T = {
  it: {
    back: 'Torna a CO₂·info', about: 'Informazioni', layers: 'Livelli', mode_sst: 'Temperatura',
    mode_anom: 'Anomalia', mode_speed: 'Velocità', mode_none: 'Nessuno', particles: 'Particelle',
    arrows: 'Frecce', coast: 'Coste', hotspot: 'Hotspot (sopra il 90° percentile)',
    source: 'Fonte della temperatura', src_model: 'Rianalisi / analisi (GLORYS12, NEMO 1/12°)',
    src_ostia: 'Osservazioni satellitari (OSTIA L4)', density: 'Densità', speed: 'Velocità',
    width: 'Spessore', scale: 'Scala di colore', palette: 'Tavolozza', min: 'min', max: 'max',
    opacity: 'Intensità', tools: 'Strumenti', compare_dates: 'Confronta due date',
    region: 'Statistiche di una regione', region_hint: 'Trascina un riquadro sul globo',
    med: 'Mediterraneo', world: 'Globo', tier_monthly: 'Mese', tier_daily: 'Giorno', tier_hourly: 'Ora',
    play: 'Riproduci', pause: 'Pausa', step_back: 'Indietro', step_fwd: 'Avanti', to_start: 'All’inizio',
    to_end: 'Alla fine', fps: 'fotogrammi/s', loop: 'Ripeti', loop_year: 'Anno intero', loop_all: 'Tutto',
    from: 'da', to: 'a', year: 'Anno', date: 'Data',
    interpolated: 'interpolato', original: 'dato originale', loading: 'Carico i dati…',
    temp: 'Temperatura', anom: 'Anomalia', cur_speed: 'Corrente', direction: 'direzione',
    towards: 'verso', coords: 'Coordinate', datum: 'Istante', dataset: 'Dataset', resolution: 'Risoluzione',
    no_data: 'nessun dato (terra o ghiaccio)', history: 'Storia della temperatura (medie mensili)',
    show_anom: 'anomalia', show_abs: 'assoluta', compare_point: 'Confronta con un altro punto',
    pick_second: 'Clicca un secondo punto sul globo', remove: 'Togli', close: 'Chiudi',
    reg_mean: 'media', reg_max: 'massima', reg_anom: 'anomalia media', reg_title: 'Regione',
    reg_cells: 'celle di mare', series_from: 'Periodo', clim_base: 'climatologia',
    monthly_mean: 'media mensile', daily_mean: 'media giornaliera', hourly: 'oraria',
    hourly_inst: 'istantanea oraria', hourly_mean: 'media oraria', model: 'modello', observation: 'osservazioni',
    sst_label: 'Temperatura superficiale (°C)', anom_label: 'Anomalia (°C) rispetto al',
    speed_label: 'Velocità della corrente (m/s)', hotspot_note: 'Hotspot solo con le medie mensili',
    anom_uses_model: 'l’anomalia usa sempre il modello, coerente con la climatologia',
    ostia_missing: 'OSTIA non disponibile per questa data: mostro il modello',
    compare_label: 'Data a destra', cmp_sst_only: 'solo temperatura; correnti della data a sinistra', drag: 'Trascina per ruotare · rotella o pizzico per lo zoom · clic su un punto',
    webgl_fail: 'Questo browser non supporta WebGL2: Ocean Earth non può funzionare qui.',
    particles_fail: 'Il browser non può calcolare le particelle sulla GPU: restano le frecce.',
    particles_note: 'Le particelle mostrano il campo di velocità, non il percorso reale di masse d’acqua.',
    km: 'km', alt: 'quota', data_until: 'dati fino al', buffering: 'in caricamento',
  },
  en: {
    back: 'Back to CO₂·info', about: 'About', layers: 'Layers', mode_sst: 'Temperature',
    mode_anom: 'Anomaly', mode_speed: 'Speed', mode_none: 'None', particles: 'Particles',
    arrows: 'Arrows', coast: 'Coastlines', hotspot: 'Hotspots (above 90th percentile)',
    source: 'Temperature source', src_model: 'Reanalysis / analysis (GLORYS12, NEMO 1/12°)',
    src_ostia: 'Satellite observations (OSTIA L4)', density: 'Density', speed: 'Speed',
    width: 'Width', scale: 'Colour scale', palette: 'Palette', min: 'min', max: 'max',
    opacity: 'Intensity', tools: 'Tools', compare_dates: 'Compare two dates',
    region: 'Region statistics', region_hint: 'Drag a box on the globe',
    med: 'Mediterranean', world: 'Globe', tier_monthly: 'Month', tier_daily: 'Day', tier_hourly: 'Hour',
    play: 'Play', pause: 'Pause', step_back: 'Back', step_fwd: 'Forward', to_start: 'To start',
    to_end: 'To end', fps: 'frames/s', loop: 'Loop', loop_year: 'Whole year', loop_all: 'All',
    from: 'from', to: 'to', year: 'Year', date: 'Date',
    interpolated: 'interpolated', original: 'original data', loading: 'Loading data…',
    temp: 'Temperature', anom: 'Anomaly', cur_speed: 'Current', direction: 'direction',
    towards: 'towards', coords: 'Coordinates', datum: 'Time', dataset: 'Dataset', resolution: 'Resolution',
    no_data: 'no data (land or ice)', history: 'Temperature history (monthly means)',
    show_anom: 'anomaly', show_abs: 'absolute', compare_point: 'Compare with another point',
    pick_second: 'Click a second point on the globe', remove: 'Remove', close: 'Close',
    reg_mean: 'mean', reg_max: 'maximum', reg_anom: 'mean anomaly', reg_title: 'Region',
    reg_cells: 'ocean cells', series_from: 'Period', clim_base: 'climatology',
    monthly_mean: 'monthly mean', daily_mean: 'daily mean', hourly: 'hourly',
    hourly_inst: 'hourly instantaneous', hourly_mean: 'hourly mean', model: 'model', observation: 'observations',
    sst_label: 'Sea surface temperature (°C)', anom_label: 'Anomaly (°C) vs',
    speed_label: 'Current speed (m/s)', hotspot_note: 'Hotspots only with monthly means',
    anom_uses_model: 'the anomaly always uses the model, consistent with the climatology',
    ostia_missing: 'OSTIA not available for this date: showing the model',
    compare_label: 'Right-hand date', cmp_sst_only: 'temperature only; currents from the left-hand date', drag: 'Drag to rotate · wheel or pinch to zoom · click a point',
    webgl_fail: 'This browser does not support WebGL2: Ocean Earth cannot run here.',
    particles_fail: 'This browser cannot compute particles on the GPU: arrows remain available.',
    particles_note: 'Particles show the velocity field, not the actual path of water masses.',
    km: 'km', alt: 'altitude', data_until: 'data until', buffering: 'loading',
  },
};

function pick() {
  let l = null;
  try { l = new URLSearchParams(location.search).get('lang'); } catch (e) { /* niente */ }
  try { l = l || localStorage.getItem('lingua'); } catch (e) { /* niente */ }
  // chi arriva dalla pagina italiana del sito senza aver mai scelto la lingua
  try {
    const r = document.referrer && new URL(document.referrer);
    if (!l && r && r.host === location.host) l = /^\/it(\/|$)/.test(r.pathname) ? 'it' : 'en';
  } catch (e) { /* niente */ }
  l = l || (navigator.language || 'en').slice(0, 2);
  return l === 'it' ? 'it' : 'en';
}

export let LANG = pick();
export function t(k) { return (T[LANG] && T[LANG][k]) || T.en[k] || k; }
export function setLang(l) { LANG = l === 'it' ? 'it' : 'en'; applyStatic(); }

export function applyStatic(root = document) {
  document.documentElement.lang = LANG;
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); el.setAttribute('aria-label', el.title); });
  root.querySelectorAll('[data-lang-only]').forEach((el) => { el.hidden = el.dataset.langOnly !== LANG; });
}

const MONTHS = {
  it: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

// "2024-07" → "lug 2024"; "2024-07-03" → "3 lug 2024"; "2024-07-03T05" → "3 lug 2024 05:00 UTC"
export function fmtStamp(s) {
  const m = MONTHS[LANG];
  const y = s.slice(0, 4), mo = m[+s.slice(5, 7) - 1];
  if (s.length === 7) return `${mo} ${y}`;
  const d = +s.slice(8, 10);
  const base = LANG === 'it' ? `${d} ${mo} ${y}` : `${d} ${mo} ${y}`;
  if (s.length === 10) return base;
  return `${base} ${s.slice(11, 13)}:00 UTC`;
}

export function fmtNum(v, digits = 2) {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString(LANG === 'it' ? 'it-IT' : 'en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
