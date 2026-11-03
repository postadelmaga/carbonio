// Caricamento dei file di dati, con una cache in memoria: ogni file si scarica una volta per visita, e un errore non
// resta in cache, così «Riprova» riprova davvero.
import { slug } from './formato.js';

const BASE = new URL('../dati/', import.meta.url);
const memoria = new Map();

function json(percorso) {
  if (!memoria.has(percorso)) {
    memoria.set(percorso, fetch(new URL(percorso, BASE))
      .then((r) => { if (!r.ok) throw new Error(`${percorso}: ${r.status}`); return r.json(); })
      .catch((e) => { memoria.delete(percorso); throw e; }));
  }
  return memoria.get(percorso);
}

export const caricaLocalita = () => json('localita.json');

export async function caricaDati(loc) {
  const [pv, forme, attivita, costanti] = await Promise.all([
    json(`pv/${loc.codice}.json`), json(`consumi/domestici/${slug(loc.regione)}.json`),
    json('consumi/attivita.json'), json('costanti.json'),
  ]);
  return { pv: pv.valori, pvInfo: pv, forme, attivita, costanti };
}
