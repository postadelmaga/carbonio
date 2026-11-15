# Dati del simulatore della CER

File preparati da `cer-sviluppo/strumenti/prepara_dati.py`, tranne `costanti.json` e `consumi/attivita.json`, scritti a
mano con la fonte di ogni valore.

## localita.json

I 109 comuni capoluogo dell'elenco ISTAT dei comuni (https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.csv), scaricato il 2026-11-03, SHA-256 `57eaf945182fc64fa05f80f1a5fb2a84cff55ebde2af6e3947a731776e7809e0`.
Licenza CC BY 4.0. Le coordinate vengono da Wikidata (proprietà P625 cercata con il codice ISTAT P635), licenza CC0,
lette il 2026-11-03. L'area del correttivo della tariffa per il fotovoltaico (nord, centro, sud) va per regione,
come nel DM 414/2023, Allegato 1 §2.

## pv/

Una serie per capoluogo: PVGIS 5.3 `seriescalc`, banca dati PVGIS-SARAH3, anno 2023, 1 kWp, perdite del 14%, pannelli a
sud con l'inclinazione ottimale calcolata da PVGIS, montaggio libero. PVGIS © European Union, d'uso libero. Ogni valore
è l'energia in Wh dell'ora locale che inizia (Europe/Rome, ora legale compresa): l'ora locale i prende il valore
dell'ora UTC i−1. Ogni file riporta i parametri della richiesta, la data di scarico e l'impronta della risposta.
Resa annua: da 1232 a 1625 kWh per kWp.

## consumi/domestici/

Forme orarie medie dei clienti domestici residenti, per regione, classe di potenza impegnata («1,5-3» comprende i
contatori da 3 kW), mese e tipo di giorno, in kWh. Fonte: ARERA, «Analisi dei consumi dei clienti domestici», anno 2025,
file https://www.arera.it/fileadmin/allegati/dati/monitoraggioretail/Dati_regione_2025.zip, SHA-256 `2b7e5b4dc5d61f60ad7a1935c113aafbb26d8a1b5b6a371f73dc084806e1603c`, letto il 2026-11-03. **Licenza CC BY-SA 4.0**
(https://creativecommons.org/licenses/by-sa/4.0/deed.it): chi ridistribuisce questi file, anche modificati, cita ARERA e
li rilascia con la stessa licenza. Trasformazioni: righe del mercato «Tutti» e della residenza «Residente», righe
mensili; «Domenica» diventa `festivo` e vale per domeniche e festività; «Ora1» è l'ora 00-01.

## consumi/attivita.json

Archetipi illustrativi del progetto, non misurati: per le attività non esistono curve aperte. Licenza CC BY 4.0.

## costanti.json

Ogni valore con descrizione, unità, fonte, URL e data di consultazione. Del GME si cita solo la media annua del PUN
Index 2025 (Fonte: Gestore dei Mercati Energetici S.p.A.).
