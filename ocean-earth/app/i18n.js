// Testi dell'interfaccia nelle cinque lingue del sito (inglese alla radice,
// italiano, spagnolo, francese e cinese su /it/ /es/ /fr/ /zh/). Una chiave
// che manca in una lingua ricade sull'inglese; tests/app.test.mjs controlla
// che non ne manchi nessuna.

export const TEXTS = {
  it: {
    mode_emis: 'Emissioni', mode_emis_s: 'Emiss.', co2_title: 'CO₂ nell’aria: dove è più alta o più bassa della media globale del mese (inversione CAMS, serie mensile)', emis_title: 'Dove la CO₂ esce dalla superficie (fossili, incendi) e dove entra (foreste, oceani) (serie mensile)', group_air: 'Aria', co2_label: 'CO₂ nell’aria (colonna media)', co2_short: 'CO₂ nell’aria', co2_abs: 'ppm', co2_rel: 'rispetto alla media globale', vs_global: 'rispetto alla media globale', flux_label: 'Flussi di CO₂ alla superficie', flux_short: 'Flussi di carbonio', flux_total: 'totale', flux_foss: 'fossili', flux_nat: 'naturali (terra e oceano)', per_day: 'al giorno', absorbs: 'assorbe', emits: 'emette', air_until: 'aria: dati CAMS fino all’ultimo anno pubblicato',
    brand_name: 'Atlante del clima',
    mode_sla: 'Livello del mare', mode_sla_s: 'Mare', mode_ice: 'Ghiaccio', mode_ice_s: 'Ghiaccio', mode_drought: 'Siccità', mode_drought_s: 'Secco', sla_title: 'Quanto il mare è più alto o più basso della media 1993–2012 (altimetria satellitare, serie mensile)', ice_title: 'Ghiaccio marino sopra l’anomalia della temperatura (serie mensile)', drought_title: 'Umidità del suolo sulla terraferma e anomalia del mare (serie mensile)', sla_label: 'Livello del mare rispetto al 1993–2012', sla_short: 'Livello del mare', sla_ref: 'rispetto alla media 1993–2012', ice_label: 'Ghiaccio marino (% di copertura)', ice_short: 'Ghiaccio marino', ice_conc: 'della superficie coperta', lower: 'più basso', higher: 'più alto', group_sea: 'Mare', group_land: 'Terra', monthly_only: 'solo nella serie mensile', to_monthly: 'Questa vista esiste solo con le medie mensili: passo alla serie mensile',
    land_label: 'Terraferma', precip_short: 'Precipitazioni', soil_short: 'Umidità del suolo', of_normal: 'del normale', drier: 'più secco', wetter: 'più umido',
    back: 'Torna a CO₂·info', about: 'Informazioni', layers: 'Livelli', mode_sst: 'Temperatura',
    mode_anom: 'Anomalia', mode_speed: 'Correnti', mode_sst_s: 'Temp.', mode_anom_s: 'Anom.', mode_speed_s: 'Corr.', mode_mix: 'Mix', mix_title: 'Temperatura, anomalia e correnti insieme: i cursori nella legenda dosano ogni livello', particles: 'Particelle',
    advanced: 'Regolazioni', p_density: 'Particelle', p_speed: 'Velocità delle particelle', p_width: 'Spessore delle particelle', a_density: 'Densità delle frecce', pal_classic: 'Classica',
    arrows: 'Frecce', coast: 'Coste', hotspot: 'Hotspot (sopra il 90° percentile)',
    source: 'Fonte della temperatura', src_model: 'Rianalisi / analisi (GLORYS12, NEMO 1/12°)',
    src_ostia: 'Osservazioni satellitari (OSTIA L4)', med_hi: 'Mediterraneo 1/16°', med_hi_long: 'Mediterraneo ad alta risoluzione (1/16°, satellite)', scale: 'Scala di colore', palette: 'Tavolozza', min: 'min', max: 'max',
    opacity: 'Intensità', auto_range: 'Adatta la scala alla vista', tools: 'Strumenti', compare_dates: 'Confronta due date',
    region: 'Statistiche di una regione', region_hint: 'Trascina un riquadro sul globo',
    med: 'Mediterraneo', world: 'Globo', tier_monthly: 'Mese', tier_daily: 'Giorno', tier_hourly: 'Ora',
    play: 'Riproduci', pause: 'Pausa', step_back: 'Indietro', step_fwd: 'Avanti', to_start: 'All’inizio',
    to_end: 'Alla fine', fps: 'fotogrammi/s', loop: 'Ripeti', loop_year: 'Anno intero', loop_all: 'Tutto',
    from: 'da', to: 'a', date: 'Data',
    interpolated: 'interpolato', original: 'dato originale', loading: 'Carico i dati…',
    dl_btn: 'Scarica per vederla senza attese', dl_stop: 'Interrompi lo scaricamento', dl_done: 'intervallo salvato nel browser',
    dl_title: "Salva nel browser i fotogrammi dell'intervallo scelto (tutta la serie o quello di Ripeti): la riproduzione li legge dal disco e alle visite successive non li riscarica",
    dl_quota: 'Spazio nel browser insufficiente: restano {n}. Scegli un intervallo piu\' corto con Ripeti.',
    dl_failed: '{n} file non scaricati: riprova piu\' tardi',
    on_globe: 'sul globo, finche\' non arriva',
    preview_note: 'in riproduzione: anteprima a 8 bit (0,16 °C; correnti a 0,5°), i dati esatti tornano in pausa',
    temp: 'Temperatura', anom: 'Anomalia', cur_speed: 'Corrente', direction: 'direzione',
    towards: 'verso', coords: 'Coordinate', datum: 'Istante', dataset: 'Dataset', resolution: 'Risoluzione',
    no_data: 'nessun dato (terra o ghiaccio)', history: 'Storia della temperatura (medie mensili)',
    show_anom: 'anomalia', show_abs: 'assoluta', compare_point: 'Confronta con un altro punto',
    pick_second: 'Clicca un secondo punto sul globo', remove: 'Togli il secondo punto', globe_aria: 'Globo interattivo', tier_aria: 'Passo temporale',
    frame_missing: 'file non disponibile per questo istante',
    bias_note: 'dato operativo: base GLORYS corretta per la differenza media fra i due sistemi (resta un\'incertezza locale di circa 0,35 °C)', anom_model_only: 'l’anomalia si calcola sul modello: passa alla fonte Modello', close: 'Chiudi',
    reg_mean: 'media', reg_max: 'massima', reg_anom: 'anomalia media', reg_title: 'Regione',
    reg_cells: 'celle di mare', series_from: 'Periodo', clim_base: 'climatologia',
    monthly_mean: 'media mensile', daily_mean: 'media giornaliera', hourly: 'oraria',
    hourly_inst: 'istantanea oraria', hourly_mean: 'media oraria', model: 'modello', observation: 'osservazioni',
    sst_label: 'Temperatura superficiale (°C)', anom_label: 'Anomalia (°C) rispetto al',
    speed_label: 'Velocità della corrente (m/s)', hotspot_note: 'Hotspot solo con le medie mensili',
    anom_uses_model: 'l’anomalia usa sempre il modello, coerente con la climatologia',
    ostia_missing: 'OSTIA non disponibile per questa data: mostro il modello',
    compare_label: 'Data a destra', cmp_sst_only: 'solo temperatura; correnti della data a sinistra', drag: 'Trascina per ruotare · rotella o pizzico per lo zoom · clic su un punto',
    webgl_fail: 'Questo browser non supporta WebGL2: l’Atlante del clima non può funzionare qui.',
    particles_fail: 'Il browser non può calcolare le particelle sulla GPU: restano le frecce.',
    particles_note: 'Le particelle mostrano il campo di velocità, non il percorso reale di masse d’acqua.',
    km: 'km', alt: 'quota', data_until: 'dati fino al', updated: 'aggiornato', buffering: 'in caricamento',
  },
  en: {
    mode_emis: 'Emissions', mode_emis_s: 'Emiss.', co2_title: 'CO₂ in the air: where it is above or below the global mean of the month (CAMS inversion, monthly series)', emis_title: 'Where CO₂ leaves the surface (fossil fuels, fires) and where it goes in (forests, oceans) (monthly series)', group_air: 'Air', co2_label: 'CO₂ in the air (column mean)', co2_short: 'CO₂ in the air', co2_abs: 'ppm', co2_rel: 'vs the global mean', vs_global: 'vs the global mean', flux_label: 'Surface CO₂ fluxes', flux_short: 'Carbon fluxes', flux_total: 'total', flux_foss: 'fossil', flux_nat: 'natural (land and ocean)', per_day: 'per day', absorbs: 'absorbs', emits: 'emits', air_until: 'air: CAMS data up to the last published year',
    brand_name: 'Climate Atlas',
    mode_sla: 'Sea level', mode_sla_s: 'Sea lvl', mode_ice: 'Sea ice', mode_ice_s: 'Ice', mode_drought: 'Drought', mode_drought_s: 'Dry', sla_title: 'How much higher or lower the sea is than its 1993–2012 mean (satellite altimetry, monthly series)', ice_title: 'Sea ice over the temperature anomaly (monthly series)', drought_title: 'Soil moisture on land and the sea anomaly (monthly series)', sla_label: 'Sea level vs 1993–2012', sla_short: 'Sea level', sla_ref: 'vs the 1993–2012 mean', ice_label: 'Sea ice (% cover)', ice_short: 'Sea ice', ice_conc: 'of the surface covered', lower: 'lower', higher: 'higher', group_sea: 'Sea', group_land: 'Land', monthly_only: 'monthly series only', to_monthly: 'This view exists only with monthly means: switching to the monthly series',
    land_label: 'Land', precip_short: 'Precipitation', soil_short: 'Soil moisture', of_normal: 'of normal', drier: 'drier', wetter: 'wetter',
    back: 'Back to CO₂·info', about: 'About', layers: 'Layers', mode_sst: 'Temperature',
    mode_anom: 'Anomaly', mode_speed: 'Currents', mode_sst_s: 'Temp', mode_anom_s: 'Anom', mode_speed_s: 'Curr.', mode_mix: 'Mix', mix_title: 'Temperature, anomaly and currents together: the sliders in the legend set each layer', particles: 'Particles',
    advanced: 'Settings', p_density: 'Particles', p_speed: 'Particle speed', p_width: 'Particle width', a_density: 'Arrow density', pal_classic: 'Classic',
    arrows: 'Arrows', coast: 'Coastlines', hotspot: 'Hotspots (above 90th percentile)',
    source: 'Temperature source', src_model: 'Reanalysis / analysis (GLORYS12, NEMO 1/12°)',
    src_ostia: 'Satellite observations (OSTIA L4)', med_hi: 'Mediterranean 1/16°', med_hi_long: 'High-resolution Mediterranean (1/16°, satellite)', scale: 'Colour scale', palette: 'Palette', min: 'min', max: 'max',
    opacity: 'Intensity', auto_range: 'Fit scale to view', tools: 'Tools', compare_dates: 'Compare two dates',
    region: 'Region statistics', region_hint: 'Drag a box on the globe',
    med: 'Mediterranean', world: 'Globe', tier_monthly: 'Month', tier_daily: 'Day', tier_hourly: 'Hour',
    play: 'Play', pause: 'Pause', step_back: 'Back', step_fwd: 'Forward', to_start: 'To start',
    to_end: 'To end', fps: 'frames/s', loop: 'Loop', loop_year: 'Whole year', loop_all: 'All',
    from: 'from', to: 'to', date: 'Date',
    interpolated: 'interpolated', original: 'original data', loading: 'Loading data…',
    dl_btn: 'Download to play without waiting', dl_stop: 'Stop downloading', dl_done: 'range saved in the browser',
    dl_title: 'Save the frames of the chosen range (the whole series or the Loop range) in the browser: playback reads them from disk and later visits do not download them again',
    dl_quota: 'Not enough browser storage: {n} left. Pick a shorter range with Loop.',
    dl_failed: '{n} files not downloaded: try again later',
    on_globe: 'on the globe until it arrives',
    preview_note: 'playing: 8-bit preview (0.16 °C; currents at 0.5°), exact data return on pause',
    temp: 'Temperature', anom: 'Anomaly', cur_speed: 'Current', direction: 'direction',
    towards: 'towards', coords: 'Coordinates', datum: 'Time', dataset: 'Dataset', resolution: 'Resolution',
    no_data: 'no data (land or ice)', history: 'Temperature history (monthly means)',
    show_anom: 'anomaly', show_abs: 'absolute', compare_point: 'Compare with another point',
    pick_second: 'Click a second point on the globe', remove: 'Remove the second point', globe_aria: 'Interactive globe', tier_aria: 'Time step',
    frame_missing: 'file not available for this instant',
    bias_note: 'operational data: GLORYS baseline corrected for the mean difference between the two systems (about 0.35 °C local uncertainty remains)', anom_model_only: 'the anomaly is computed on the model: switch the source to Model', close: 'Close',
    reg_mean: 'mean', reg_max: 'maximum', reg_anom: 'mean anomaly', reg_title: 'Region',
    reg_cells: 'ocean cells', series_from: 'Period', clim_base: 'climatology',
    monthly_mean: 'monthly mean', daily_mean: 'daily mean', hourly: 'hourly',
    hourly_inst: 'hourly instantaneous', hourly_mean: 'hourly mean', model: 'model', observation: 'observations',
    sst_label: 'Sea surface temperature (°C)', anom_label: 'Anomaly (°C) vs',
    speed_label: 'Current speed (m/s)', hotspot_note: 'Hotspots only with monthly means',
    anom_uses_model: 'the anomaly always uses the model, consistent with the climatology',
    ostia_missing: 'OSTIA not available for this date: showing the model',
    compare_label: 'Right-hand date', cmp_sst_only: 'temperature only; currents from the left-hand date', drag: 'Drag to rotate · wheel or pinch to zoom · click a point',
    webgl_fail: 'This browser does not support WebGL2: the Climate Atlas cannot run here.',
    particles_fail: 'This browser cannot compute particles on the GPU: arrows remain available.',
    particles_note: 'Particles show the velocity field, not the actual path of water masses.',
    km: 'km', alt: 'altitude', data_until: 'data until', updated: 'updated', buffering: 'loading',
  },
  es: {
    mode_emis: 'Emisiones', mode_emis_s: 'Emis.', co2_title: 'CO₂ en el aire: dónde está por encima o por debajo de la media global del mes (inversión CAMS, serie mensual)', emis_title: 'Dónde sale el CO₂ de la superficie (fósiles, incendios) y dónde entra (bosques, océanos) (serie mensual)', group_air: 'Aire', co2_label: 'CO₂ en el aire (media de la columna)', co2_short: 'CO₂ en el aire', co2_abs: 'ppm', co2_rel: 'respecto a la media global', vs_global: 'respecto a la media global', flux_label: 'Flujos de CO₂ en la superficie', flux_short: 'Flujos de carbono', flux_total: 'total', flux_foss: 'fósiles', flux_nat: 'naturales (tierra y océano)', per_day: 'al día', absorbs: 'absorbe', emits: 'emite', air_until: 'aire: datos CAMS hasta el último año publicado',
    brand_name: 'Atlas del clima',
    mode_sla: 'Nivel del mar', mode_sla_s: 'Mar', mode_ice: 'Hielo marino', mode_ice_s: 'Hielo', mode_drought: 'Sequía', mode_drought_s: 'Seco', sla_title: 'Cuánto más alto o más bajo está el mar que su media 1993–2012 (altimetría satelital, serie mensual)', ice_title: 'Hielo marino sobre la anomalía de temperatura (serie mensual)', drought_title: 'Humedad del suelo en tierra firme y anomalía del mar (serie mensual)', sla_label: 'Nivel del mar respecto a 1993–2012', sla_short: 'Nivel del mar', sla_ref: 'respecto a la media 1993–2012', ice_label: 'Hielo marino (% de cobertura)', ice_short: 'Hielo marino', ice_conc: 'de la superficie cubierta', lower: 'más bajo', higher: 'más alto', group_sea: 'Mar', group_land: 'Tierra', monthly_only: 'solo en la serie mensual', to_monthly: 'Esta vista solo existe con medias mensuales: paso a la serie mensual',
    land_label: 'Tierra firme', precip_short: 'Precipitación', soil_short: 'Humedad del suelo', of_normal: 'de lo normal', drier: 'más seco', wetter: 'más húmedo',
    back: 'Volver a CO₂·info', about: 'Información', layers: 'Capas', mode_sst: 'Temperatura',
    mode_anom: 'Anomalía', mode_speed: 'Corrientes', mode_sst_s: 'Temp.', mode_anom_s: 'Anom.', mode_speed_s: 'Corr.', mode_mix: 'Mezcla', mix_title: 'Temperatura, anomalía y corrientes juntas: los controles de la leyenda dosifican cada capa', particles: 'Partículas',
    advanced: 'Ajustes', p_density: 'Partículas', p_speed: 'Velocidad de las partículas', p_width: 'Grosor de las partículas', a_density: 'Densidad de las flechas', pal_classic: 'Clásica',
    arrows: 'Flechas', coast: 'Costas', hotspot: 'Puntos calientes (sobre el percentil 90)',
    source: 'Fuente de la temperatura', src_model: 'Reanálisis / análisis (GLORYS12, NEMO 1/12°)',
    src_ostia: 'Observaciones por satélite (OSTIA L4)', med_hi: 'Mediterráneo 1/16°', med_hi_long: 'Mediterráneo de alta resolución (1/16°, satélite)', scale: 'Escala de color', palette: 'Paleta', min: 'mín', max: 'máx',
    opacity: 'Intensidad', auto_range: 'Ajustar a la vista', tools: 'Herramientas', compare_dates: 'Comparar dos fechas',
    region: 'Estadísticas de una región', region_hint: 'Arrastra un recuadro sobre el globo',
    med: 'Mediterráneo', world: 'Globo', tier_monthly: 'Mes', tier_daily: 'Día', tier_hourly: 'Hora',
    play: 'Reproducir', pause: 'Pausa', step_back: 'Atrás', step_fwd: 'Adelante', to_start: 'Al inicio',
    to_end: 'Al final', fps: 'fotogramas/s', loop: 'Repetir', loop_year: 'Año completo', loop_all: 'Todo',
    from: 'de', to: 'a', date: 'Fecha',
    interpolated: 'interpolado', original: 'dato original', loading: 'Cargando datos…',
    dl_btn: 'Descargar para verlo sin esperas', dl_stop: 'Detener la descarga', dl_done: 'intervalo guardado en el navegador',
    dl_title: 'Guarda en el navegador los fotogramas del intervalo elegido (toda la serie o el de Repetir): la reproducción los lee del disco y en las visitas siguientes no se vuelven a descargar',
    dl_quota: 'Espacio insuficiente en el navegador: quedan {n}. Elige un intervalo más corto con Repetir.',
    dl_failed: '{n} archivos no descargados: inténtalo más tarde',
    on_globe: 'en el globo hasta que llegue',
    preview_note: 'en reproducción: vista previa de 8 bits (0,16 °C; corrientes a 0,5°), los datos exactos vuelven en pausa',
    temp: 'Temperatura', anom: 'Anomalía', cur_speed: 'Corriente', direction: 'dirección',
    towards: 'hacia', coords: 'Coordenadas', datum: 'Fecha', dataset: 'Conjunto de datos', resolution: 'Resolución',
    no_data: 'sin datos (tierra o hielo)', history: 'Historia de la temperatura (medias mensuales)',
    show_anom: 'anomalía', show_abs: 'absoluta', compare_point: 'Comparar con otro punto',
    pick_second: 'Haz clic en un segundo punto del globo', remove: 'Quitar el segundo punto', globe_aria: 'Globo interactivo', tier_aria: 'Paso temporal',
    frame_missing: 'archivo no disponible para este instante',
    bias_note: 'dato operativo: base GLORYS corregida por la diferencia media entre los dos sistemas (queda una incertidumbre local de unos 0,35 °C)', anom_model_only: 'la anomalía se calcula sobre el modelo: cambia la fuente a Modelo', close: 'Cerrar',
    reg_mean: 'media', reg_max: 'máximo', reg_anom: 'anomalía media', reg_title: 'Región',
    reg_cells: 'celdas de mar', series_from: 'Periodo', clim_base: 'climatología',
    monthly_mean: 'media mensual', daily_mean: 'media diaria', hourly: 'horario',
    hourly_inst: 'instantáneo horario', hourly_mean: 'media horaria', model: 'modelo', observation: 'observaciones',
    sst_label: 'Temperatura superficial del mar (°C)', anom_label: 'Anomalía (°C) respecto a',
    speed_label: 'Velocidad de la corriente (m/s)', hotspot_note: 'Puntos calientes solo con medias mensuales',
    anom_uses_model: 'la anomalía usa siempre el modelo, coherente con la climatología',
    ostia_missing: 'OSTIA no disponible para esta fecha: se muestra el modelo',
    compare_label: 'Fecha de la derecha', cmp_sst_only: 'solo temperatura; corrientes de la fecha de la izquierda', drag: 'Arrastra para girar · rueda o pellizco para el zoom · clic en un punto',
    webgl_fail: 'Este navegador no admite WebGL2: el Atlas del clima no puede funcionar aquí.',
    particles_fail: 'Este navegador no puede calcular las partículas en la GPU: las flechas siguen disponibles.',
    particles_note: 'Las partículas muestran el campo de velocidad, no el recorrido real de las masas de agua.',
    km: 'km', alt: 'altitud', data_until: 'datos hasta', updated: 'actualizado', buffering: 'cargando',
  },
  fr: {
    mode_emis: 'Émissions', mode_emis_s: 'Émiss.', co2_title: 'CO₂ dans l’air : où il est au-dessus ou au-dessous de la moyenne mondiale du mois (inversion CAMS, série mensuelle)', emis_title: 'Où le CO₂ sort de la surface (fossiles, incendies) et où il entre (forêts, océans) (série mensuelle)', group_air: 'Air', co2_label: 'CO₂ dans l’air (moyenne de la colonne)', co2_short: 'CO₂ dans l’air', co2_abs: 'ppm', co2_rel: 'par rapport à la moyenne mondiale', vs_global: 'par rapport à la moyenne mondiale', flux_label: 'Flux de CO₂ à la surface', flux_short: 'Flux de carbone', flux_total: 'total', flux_foss: 'fossiles', flux_nat: 'naturels (terre et océan)', per_day: 'par jour', absorbs: 'absorbe', emits: 'émet', air_until: 'air : données CAMS jusqu’à la dernière année publiée',
    brand_name: 'Atlas du climat',
    mode_sla: 'Niveau de la mer', mode_sla_s: 'Mer', mode_ice: 'Banquise', mode_ice_s: 'Glace', mode_drought: 'Sécheresse', mode_drought_s: 'Sec', sla_title: 'De combien la mer est plus haute ou plus basse que sa moyenne 1993–2012 (altimétrie satellitaire, série mensuelle)', ice_title: 'Glace de mer au-dessus de l’anomalie de température (série mensuelle)', drought_title: 'Humidité du sol sur les terres et anomalie de la mer (série mensuelle)', sla_label: 'Niveau de la mer par rapport à 1993–2012', sla_short: 'Niveau de la mer', sla_ref: 'par rapport à la moyenne 1993–2012', ice_label: 'Glace de mer (% de couverture)', ice_short: 'Glace de mer', ice_conc: 'de la surface couverte', lower: 'plus bas', higher: 'plus haut', group_sea: 'Mer', group_land: 'Terre', monthly_only: 'série mensuelle uniquement', to_monthly: 'Cette vue n’existe qu’avec les moyennes mensuelles : passage à la série mensuelle',
    land_label: 'Terres émergées', precip_short: 'Précipitations', soil_short: 'Humidité du sol', of_normal: 'de la normale', drier: 'plus sec', wetter: 'plus humide',
    back: 'Retour à CO₂·info', about: 'À propos', layers: 'Calques', mode_sst: 'Température',
    mode_anom: 'Anomalie', mode_speed: 'Courants', mode_sst_s: 'Temp.', mode_anom_s: 'Anom.', mode_speed_s: 'Cour.', mode_mix: 'Mix', mix_title: 'Température, anomalie et courants ensemble : les curseurs de la légende dosent chaque calque', particles: 'Particules',
    advanced: 'Réglages', p_density: 'Particules', p_speed: 'Vitesse des particules', p_width: 'Épaisseur des particules', a_density: 'Densité des flèches', pal_classic: 'Classique',
    arrows: 'Flèches', coast: 'Côtes', hotspot: 'Points chauds (au-dessus du 90e centile)',
    source: 'Source de la température', src_model: 'Réanalyse / analyse (GLORYS12, NEMO 1/12°)',
    src_ostia: 'Observations satellitaires (OSTIA L4)', med_hi: 'Méditerranée 1/16°', med_hi_long: 'Méditerranée haute résolution (1/16°, satellite)', scale: 'Échelle de couleurs', palette: 'Palette', min: 'min', max: 'max',
    opacity: 'Intensité', auto_range: 'Adapter à la vue', tools: 'Outils', compare_dates: 'Comparer deux dates',
    region: 'Statistiques d’une région', region_hint: 'Tracez un rectangle sur le globe',
    med: 'Méditerranée', world: 'Globe', tier_monthly: 'Mois', tier_daily: 'Jour', tier_hourly: 'Heure',
    play: 'Lecture', pause: 'Pause', step_back: 'Reculer', step_fwd: 'Avancer', to_start: 'Au début',
    to_end: 'À la fin', fps: 'images/s', loop: 'Répéter', loop_year: 'Année entière', loop_all: 'Tout',
    from: 'de', to: 'à', date: 'Date',
    interpolated: 'interpolé', original: 'donnée originale', loading: 'Chargement des données…',
    dl_btn: 'Télécharger pour regarder sans attente', dl_stop: 'Arrêter le téléchargement', dl_done: 'intervalle enregistré dans le navigateur',
    dl_title: 'Enregistre dans le navigateur les images de l’intervalle choisi (toute la série ou celui de Répéter) : la lecture les lit sur le disque et les visites suivantes ne les téléchargent plus',
    dl_quota: 'Espace insuffisant dans le navigateur : il reste {n}. Choisissez un intervalle plus court avec Répéter.',
    dl_failed: '{n} fichiers non téléchargés : réessayez plus tard',
    on_globe: 'sur le globe en attendant',
    preview_note: 'en lecture : aperçu 8 bits (0,16 °C ; courants à 0,5°), les données exactes reviennent en pause',
    temp: 'Température', anom: 'Anomalie', cur_speed: 'Courant', direction: 'direction',
    towards: 'vers', coords: 'Coordonnées', datum: 'Date', dataset: 'Jeu de données', resolution: 'Résolution',
    no_data: 'pas de données (terre ou glace)', history: 'Historique de la température (moyennes mensuelles)',
    show_anom: 'anomalie', show_abs: 'absolue', compare_point: 'Comparer avec un autre point',
    pick_second: 'Cliquez sur un second point du globe', remove: 'Retirer le second point', globe_aria: 'Globe interactif', tier_aria: 'Pas de temps',
    frame_missing: 'fichier non disponible pour cet instant',
    bias_note: 'donnée opérationnelle : base GLORYS corrigée de l’écart moyen entre les deux systèmes (il reste une incertitude locale d’environ 0,35 °C)', anom_model_only: 'l’anomalie se calcule sur le modèle : passez la source sur Modèle', close: 'Fermer',
    reg_mean: 'moyenne', reg_max: 'maximum', reg_anom: 'anomalie moyenne', reg_title: 'Région',
    reg_cells: 'cellules océaniques', series_from: 'Période', clim_base: 'climatologie',
    monthly_mean: 'moyenne mensuelle', daily_mean: 'moyenne journalière', hourly: 'horaire',
    hourly_inst: 'instantané horaire', hourly_mean: 'moyenne horaire', model: 'modèle', observation: 'observations',
    sst_label: 'Température de surface de la mer (°C)', anom_label: 'Anomalie (°C) par rapport à',
    speed_label: 'Vitesse du courant (m/s)', hotspot_note: 'Points chauds uniquement avec les moyennes mensuelles',
    anom_uses_model: 'l’anomalie utilise toujours le modèle, cohérent avec la climatologie',
    ostia_missing: 'OSTIA indisponible pour cette date : affichage du modèle',
    compare_label: 'Date de droite', cmp_sst_only: 'température seulement ; courants de la date de gauche', drag: 'Glisser pour tourner · molette ou pincement pour zoomer · cliquer sur un point',
    webgl_fail: 'Ce navigateur ne prend pas en charge WebGL2 : l’Atlas du climat ne peut pas fonctionner ici.',
    particles_fail: 'Ce navigateur ne peut pas calculer les particules sur le GPU : les flèches restent disponibles.',
    particles_note: 'Les particules montrent le champ de vitesse, pas le trajet réel des masses d’eau.',
    km: 'km', alt: 'altitude', data_until: 'données jusqu’au', updated: 'mis à jour', buffering: 'chargement',
  },
  zh: {
    mode_emis: '排放', mode_emis_s: '排放', co2_title: '空气中的二氧化碳：比当月全球平均高或低的地方（CAMS 反演，月度序列）', emis_title: '二氧化碳从哪里离开地表（化石燃料、火灾），又在哪里被吸收（森林、海洋）（月度序列）', group_air: '大气', co2_label: '空气中的二氧化碳（柱平均）', co2_short: '空气中的二氧化碳', co2_abs: 'ppm', co2_rel: '相对全球平均', vs_global: '相对全球平均', flux_label: '地表二氧化碳通量', flux_short: '碳通量', flux_total: '总计', flux_foss: '化石', flux_nat: '自然（陆地与海洋）', per_day: '每天', absorbs: '吸收', emits: '排放', air_until: '大气：CAMS 数据截至最近发布的年份',
    brand_name: '气候地图集',
    mode_sla: '海平面', mode_sla_s: '海平面', mode_ice: '海冰', mode_ice_s: '海冰', mode_drought: '干旱', mode_drought_s: '干旱', sla_title: '海平面比1993–2012年平均高或低多少（卫星测高，月度序列）', ice_title: '海冰叠加在温度距平之上（月度序列）', drought_title: '陆地土壤湿度与海洋距平（月度序列）', sla_label: '海平面（相对1993–2012年）', sla_short: '海平面', sla_ref: '相对1993–2012年平均', ice_label: '海冰（覆盖率%）', ice_short: '海冰', ice_conc: '的海面被覆盖', lower: '偏低', higher: '偏高', group_sea: '海洋', group_land: '陆地', monthly_only: '仅月度序列', to_monthly: '此视图只有月平均数据：切换到月度序列',
    land_label: '陆地', precip_short: '降水', soil_short: '土壤湿度', of_normal: '相对常年', drier: '偏干', wetter: '偏湿',
    back: '返回 CO₂·info', about: '关于', layers: '图层', mode_sst: '温度',
    mode_anom: '距平', mode_speed: '洋流', mode_sst_s: '温度', mode_anom_s: '距平', mode_speed_s: '洋流', mode_mix: '叠加', mix_title: '温度、距平和洋流叠加显示：用图例中的滑块调节每个图层', particles: '粒子',
    advanced: '设置', p_density: '粒子', p_speed: '粒子速度', p_width: '粒子粗细', a_density: '箭头密度', pal_classic: '经典',
    arrows: '箭头', coast: '海岸线', hotspot: '热点（高于第 90 百分位）',
    source: '温度数据源', src_model: '再分析 / 分析（GLORYS12，NEMO 1/12°）',
    src_ostia: '卫星观测（OSTIA L4）', med_hi: '地中海 1/16°', med_hi_long: '地中海高分辨率（1/16°，卫星）', scale: '色标', palette: '配色', min: '最小', max: '最大',
    opacity: '强度', auto_range: '按视图调整', tools: '工具', compare_dates: '比较两个日期',
    region: '区域统计', region_hint: '在地球上拖出一个方框',
    med: '地中海', world: '全球', tier_monthly: '月', tier_daily: '日', tier_hourly: '小时',
    play: '播放', pause: '暂停', step_back: '后退', step_fwd: '前进', to_start: '回到开头',
    to_end: '跳到结尾', fps: '帧/秒', loop: '循环', loop_year: '整年', loop_all: '全部',
    from: '从', to: '到', date: '日期',
    interpolated: '插值', original: '原始数据', loading: '正在加载数据…',
    dl_btn: '下载后流畅播放', dl_stop: '停止下载', dl_done: '该时段已保存在浏览器中',
    dl_title: '把所选时段（整个序列或“循环”时段）的帧保存在浏览器中：播放时从磁盘读取，以后访问不再重新下载',
    dl_quota: '浏览器存储空间不足：仅剩 {n}。请用“循环”选择更短的时段。',
    dl_failed: '{n} 个文件未能下载：请稍后再试',
    on_globe: '新数据到达前地球上显示的是',
    preview_note: '播放中：8 位预览（0.16 °C；洋流 0.5°），暂停后恢复精确数据',
    temp: '温度', anom: '距平', cur_speed: '洋流', direction: '方向',
    towards: '流向', coords: '坐标', datum: '时间', dataset: '数据集', resolution: '分辨率',
    no_data: '无数据（陆地或冰）', history: '温度历史（月平均）',
    show_anom: '距平', show_abs: '绝对值', compare_point: '与另一个点比较',
    pick_second: '在地球上点击第二个点', remove: '移除第二个点', globe_aria: '交互式地球', tier_aria: '时间步长',
    frame_missing: '该时刻的文件不可用',
    bias_note: '业务化数据：GLORYS 基准已按两个系统的平均差异校正（仍有约 0.35 °C 的局地不确定性）', anom_model_only: '距平基于模式计算：请把数据源切换为模式', close: '关闭',
    reg_mean: '平均', reg_max: '最大值', reg_anom: '平均距平', reg_title: '区域',
    reg_cells: '海洋网格数', series_from: '时段', clim_base: '气候态',
    monthly_mean: '月平均', daily_mean: '日平均', hourly: '逐时',
    hourly_inst: '逐时瞬时值', hourly_mean: '逐时平均', model: '模式', observation: '观测',
    sst_label: '海表温度（°C）', anom_label: '距平（°C），相对于',
    speed_label: '洋流速度（m/s）', hotspot_note: '热点仅适用于月平均',
    anom_uses_model: '距平始终使用模式数据，与气候态一致',
    ostia_missing: '该日期没有 OSTIA 数据：显示模式数据',
    compare_label: '右侧日期', cmp_sst_only: '仅温度；洋流为左侧日期', drag: '拖动旋转 · 滚轮或双指缩放 · 点击查看某点',
    webgl_fail: '此浏览器不支持 WebGL2：气候地图集无法在此运行。',
    particles_fail: '此浏览器无法在 GPU 上计算粒子：箭头仍可使用。',
    particles_note: '粒子显示的是速度场，而不是水团的实际路径。',
    km: '公里', alt: '高度', data_until: '数据截至', updated: '更新于', buffering: '加载中',
  },
};

export const LANGS = ['en', 'it', 'es', 'fr', 'zh'];
export const LANG_NAMES = { en: 'English', it: 'Italiano', es: 'Español', fr: 'Français', zh: '中文' };
const LOCALE = { en: 'en-GB', it: 'it-IT', es: 'es-ES', fr: 'fr-FR', zh: 'zh-CN' };
const valid = (l) => (LANGS.includes(l) ? l : null);

// ?lang=, poi la scelta salvata dal sito ('lingua', la stessa chiave), poi la
// pagina del sito da cui si arriva, poi la lingua del browser
function pick() {
  let l = null;
  try { l = valid(new URLSearchParams(location.search).get('lang')); } catch (e) { /* niente */ }
  try { l = l || valid(localStorage.getItem('lingua')); } catch (e) { /* niente */ }
  try {
    const r = document.referrer && new URL(document.referrer);
    if (!l && r && r.host === location.host) l = (r.pathname.match(/^\/(it|es|fr|zh)(\/|$)/) || [, 'en'])[1];
  } catch (e) { /* niente */ }
  return l || valid((navigator.language || 'en').slice(0, 2)) || 'en';
}

export let LANG = pick();
export function t(k) { return (TEXTS[LANG] && TEXTS[LANG][k]) || TEXTS.en[k] || k; }
export function setLang(l) { LANG = valid(l) || 'en'; applyStatic(); }
// la pagina del sito nella lingua scelta
export function siteHome() { return LANG === 'en' ? '/' : `/${LANG}/`; }

export function applyStatic(root = globalThis.document) {
  if (!root) return;                       // fuori dal browser (test)
  document.documentElement.lang = LANG;
  document.title = `${t('brand_name')} · CO₂·info`;
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); el.setAttribute('aria-label', el.title); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  root.querySelectorAll('[data-lang-only]').forEach((el) => { el.hidden = el.dataset.langOnly !== LANG; });
}

// "2024-07" → "lug 2024"; "2024-07-03" → "3 lug 2024"; "2024-07-03T05" → "3 lug 2024 05:00 UTC"
// (nel formato di ogni lingua: in cinese "2024年7月3日")
export function fmtStamp(s) {
  const y = +s.slice(0, 4), mo = +s.slice(5, 7) - 1;
  const d = s.length > 7 ? +s.slice(8, 10) : 1;
  const opt = s.length === 7 ? { year: 'numeric', month: 'short' } : { year: 'numeric', month: 'short', day: 'numeric' };
  const base = new Date(Date.UTC(y, mo, d)).toLocaleDateString(LOCALE[LANG], { ...opt, timeZone: 'UTC' });
  return s.length > 10 ? `${base} ${s.slice(11, 13)}:00 UTC` : base;
}

export function fmtNum(v, digits = 2) {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString(LOCALE[LANG], { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// punti cardinali: ovest e' O in italiano, spagnolo e francese
const COMPASS = {
  en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
  it: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
  es: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
  fr: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
  zh: ['北', '东北', '东', '东南', '南', '西南', '西', '西北'],
};
export function compass(deg) { return COMPASS[LANG][Math.round(deg / 45) % 8]; }
export function fmtLat(lat) { return `${fmtNum(Math.abs(lat), 2)}° ${lat >= 0 ? 'N' : 'S'}`; }
export function fmtLon(lon) { return `${fmtNum(Math.abs(lon), 2)}° ${lon >= 0 ? 'E' : (['it', 'es', 'fr'].includes(LANG) ? 'O' : 'W')}`; }
export function fmtMonthYear(y, mo) {
  return new Date(Date.UTC(y, mo, 1)).toLocaleDateString(LOCALE[LANG], { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
