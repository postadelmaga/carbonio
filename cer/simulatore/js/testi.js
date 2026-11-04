// Testi generati dai risultati (spec §7.3, §8): le ipotesi di questa simulazione e la scadenza della tariffa.
import { numero, euro, perc, circa } from './formato.js';
import { costoEvitato, voce } from './economia.js';

export function mesiAllaScadenza(oggi, scadenza) {
  const [a, m] = scadenza.split('-').map(Number);
  return (a - oggi.getFullYear()) * 12 + (m - 1 - oggi.getMonth());
}

const dataIt = (iso) => iso.split('-').reverse().join('/');

export function testoScadenza(oggi, costanti) {
  const scadenza = voce(costanti, 'scadenza_esercizio');
  const [a, m, g] = scadenza.split('-').map(Number);
  const data = dataIt(scadenza);
  if (oggi > new Date(a, m - 1, g, 23, 59, 59, 999)) return `La finestra della tariffa premio si è chiusa il ${data}, salvo proroghe.`;
  const mesi = mesiAllaScadenza(oggi, scadenza);
  const quando = mesi > 1 ? `mancano ${mesi} mesi` : mesi === 1 ? 'manca un mese' : 'manca meno di un mese';
  return `Per avere la tariffa premio gli impianti devono entrare in esercizio entro il ${data}, dopo la costituzione della CER: ${quando}.`;
}

// La quota eccedentaria della tariffa (statuto, art. 12): ai consumatori che non sono imprese, o a finalità sociali se non ce
// ne sono. Vuota quando non c'è eccedentaria. `com` è `comunita` del risultato del calcolo.
export function testoEccedentaria(com) {
  if (!(com.quotaEccedentaria > 0)) return '';
  const base = `La quota eccedentaria della tariffa, ${euro(com.eccedentaria)} l'anno, va ai consumatori che non sono imprese (statuto, art. 12).`;
  return com.fondoSociale > 0 ? `${base} Senza consumatori che non siano imprese, va a finalità sociali: ${euro(com.fondoSociale)} l'anno.` : base;
}

// La CO₂ evitata in italiani, con il pro capite (revisione §9.4). Senza CO₂ evitata la frase non c'è; arrotondato a 0 è
// «meno di un italiano», a 1 è al singolare.
export function testoItaliani(italiani, proCapite) {
  if (!(italiani > 0)) return '';
  const n = Math.round(italiani);
  const resto = `in un anno (${numero(proCapite, 1)} t a persona nel 2024, contando solo ciò che si emette sul territorio).`;
  if (n === 0) return `Meno delle emissioni di un italiano ${resto}`;
  return n === 1 ? `Circa come le emissioni di un italiano ${resto}` : `Circa come le emissioni di ${numero(italiani)} italiani ${resto}`;
}

// Sotto la CO₂ evitata: quale ipotesi dà il numero e quanto darebbe l'altra (revisione §9.4). Vuota senza CO₂ evitata.
export function testoStimaCo2(principale, evitataAltra, costanti) {
  if (!(evitataAltra > 0)) return '';
  const g = (id) => numero(voce(costanti, id), 1);
  const coda = 'Non è un intervallo di certezza: il valore vero dipende dall\'ora, dalla zona e da quali centrali i pannelli fermano davvero.';
  return principale === 'media'
    ? `Stima con la CO₂ media di un kWh consumato in Italia (${g('fattore_co2')} g/kWh, 2025 preliminare). Con il metodo ISPRA delle emissioni evitate, che conta le centrali fossili italiane (${g('fattore_co2_fossili')} g/kWh), sarebbero ${circa(evitataAltra)}. ${coda}`
    : `Stima con il metodo ISPRA delle emissioni evitate: ogni kWh dei pannelli sostituisce un kWh delle centrali fossili italiane (${g('fattore_co2_fossili')} g/kWh, 2025 preliminare). Con la CO₂ media di un kWh consumato in Italia (${g('fattore_co2')} g/kWh) sarebbero ${circa(evitataAltra)}. ${coda}`;
}

// La CO₂ sui 20 anni (revisione §9.2): con il metodo ISPRA il fattore di oggi, con la media il calo storico.
export function testoVentiAnniCo2(principale, ventiAnni, costanti) {
  if (!(ventiAnni > 0)) return '';
  const anni = voce(costanti, 'durata_tariffa_anni');
  return principale === 'media'
    ? `In ${anni} anni, se il fattore medio continuasse a scendere del ${perc(voce(costanti, 'calo_fattore_co2'), 1)} l'anno come in media dal 1990: ${circa(ventiAnni)}.`
    : `In ${anni} anni, se il fattore restasse quello di oggi: ${circa(ventiAnni)}.`;
}

// Accanto a un impianto già in esercizio (revisione §7.3). Vuota per un impianto nuovo; la frase del 30% solo per gli
// esistenti fino al 15/12/2021, gli unici a cui le Regole applicano il limite.
export function testoGiaInEsercizio(stato) {
  if (stato !== 'precedente' && stato !== 'esistente') return '';
  const base = 'Un impianto entrato in esercizio prima della costituzione della CER, con le regole di oggi, non riceve la tariffa premio: le eccezioni per gli impianti entrati in esercizio fra il 2021 e il 2024 avevano scadenze già passate. Resta nella comunità: la sua energia conta per la condivisa e riceve il contributo ARERA, e l\'energia che immette resta del titolare, che la vende con il ritiro dedicato del GSE o a un venditore. Il GSE attribuisce la condivisa prima agli impianti più vecchi: nelle ore in cui l\'energia immessa supera i consumi della comunità, un impianto già in esercizio riduce i kWh incentivati di quelli nuovi, e con loro la tariffa che arriva alla comunità. Se hai lo scambio sul posto, per entrare va chiuso.';
  return stato === 'esistente' ? `${base} Un impianto entrato in esercizio fino al 15/12/2021 è un impianto «esistente»: la comunità può averne al massimo il 30% della potenza.` : base;
}

export function ipotesi(r, loc, pvInfo, costanti) {
  const p = r.parametri, em = r.emissioni;
  const anni = voce(costanti, 'durata_tariffa_anni');
  const resa = pvInfo.valori.reduce((s, v) => s + v, 0) / 1000;
  const tipFv = r.impianti.find((k) => k.incentivato)?.tip;
  const ce = (tipo) => numero(costoEvitato(tipo, p.prezzo_zonale, costanti, p.costo_evitato ?? {}), 3);
  const media = em.principale === 'media';
  return [
    `Località: ${loc.nome} (${loc.sigla}). Produzione PVGIS dell'anno meteorologico ${pvInfo.anno_meteo}, pannelli rivolti a sud con l'inclinazione ottimale di ${numero(pvInfo.inclinazione)}°: ${numero(resa)} kWh per kWp l'anno. Un altro anno sposta la produzione di qualche punto percentuale.`,
    `Consumi delle famiglie: forme medie ARERA 2025 dei residenti in ${loc.regione}; una famiglia vera è più irregolare. Attività ed enti: profili illustrativi, non misurati.`,
    `Prezzo dell'energia: ${numero(p.prezzo_zonale, 2)} €/MWh, uguale tutto l'anno${tipFv != null ? `; tariffa premio ${numero(tipFv)} €/MWh` : ''}.`,
    `Costo evitato in bolletta per ogni kWh autoconsumato: ${ce('famiglia')} €/kWh per le famiglie, ${ce('attivita')} per le attività, ${ce('ente')} per gli enti.`,
    `Riparto: ${perc(p.quota_produttore)} della tariffa al titolare dell'impianto, ${perc(p.quota_consumatori)} ai consumatori secondo quanto consumano nelle ore di produzione, ${perc(1 - p.quota_produttore - p.quota_consumatori)} alla CER; il contributo ARERA ai consumatori. È l'esempio di CERS Eliodora, non il regolamento della nostra CER, che non è ancora scritto.`,
    `Costi della CER: ${euro(p.gestione_eur_anno)} l'anno di gestione più i corrispettivi del GSE, tolti dagli incentivi prima del riparto. La quota eccedentaria resta intera ai consumatori che non sono imprese: è la lettura prudente, perché le regole non dicono se possa coprire i costi.`,
    `Gli impianti nuovi entrano in esercizio dopo la costituzione della CER ed entro il ${dataIt(voce(costanti, 'scadenza_esercizio'))}.`,
    `${anni} anni a prezzi costanti, senza inflazione né attualizzazione; degrado dei pannelli: ${perc(voce(costanti, 'degrado'), 1)} della produzione l'anno.`,
    media
      ? `CO₂ evitata: ipotesi che ogni kWh dei pannelli valga la CO₂ media di un kWh consumato in Italia, ${numero(voce(costanti, 'fattore_co2'), 1)} g/kWh (media nazionale annua, ISPRA, 2025 preliminare); con il metodo ISPRA delle emissioni evitate sarebbe ${numero(voce(costanti, 'fattore_co2_fossili'), 1)}. Sui ${anni} anni il fattore scende del ${perc(voce(costanti, 'calo_fattore_co2'), 1)} l'anno, come in media dal 1990: è una proiezione.`
      : `CO₂ evitata: ipotesi che ogni kWh dei pannelli sostituisca un kWh delle centrali fossili italiane, ${numero(voce(costanti, 'fattore_co2_fossili'), 1)} g/kWh (metodo ISPRA, media nazionale annua, 2025 preliminare); con la CO₂ media di un kWh consumato sarebbe ${numero(voce(costanti, 'fattore_co2'), 1)}. Sui ${anni} anni il fattore resta quello di oggi: è una proiezione.`,
    'Fuori dal calcolo: imposte, agevolazioni (PNRR, detrazioni), accumuli, prezzo ora per ora, quarto d\'ora.',
  ];
}
