// Testi generati dai risultati (spec §7.3, §8): le ipotesi di questa simulazione e la scadenza della tariffa.
import { numero, euro, perc, circa } from './formato.js';
import { costoEvitato, voce } from './economia.js';

const dataIt = (iso) => iso.split('-').reverse().join('/');

const chiusa = (oggi, scadenza) => {
  const [a, m, g] = scadenza.split('-').map(Number);
  return oggi > new Date(a, m - 1, g, 23, 59, 59, 999);
};

// La frase della finestra aperta è una sola, scritta dall'utente (08/11/2026): la usano la nota di «Per te» e il passo
// «Tu e i fondatori».
const finestraAperta = (data) => `Per avere la tariffa premio l'impianto deve entrare in esercizio dopo la costituzione della CER ed entro il ${data}. Se entra in esercizio dopo, con le regole di oggi la tariffa non c'è: la sua energia conta lo stesso per la comunità, ma su di essa la comunità riceve solo il contributo ARERA, molto più piccolo. La data può arrivare prima, se in Italia si raggiungono 5 GW di impianti incentivati, e cambierebbe solo con una proroga, che a oggi non c'è.`;

// Nel passo «Tu e i fondatori» di «fondare», sempre: in quel percorso è l'unico posto della frase (decisione dell'utente,
// 08/11/2026). Senza più i mesi che mancano.
export function testoScadenza(oggi, costanti) {
  const scadenza = voce(costanti, 'scadenza_esercizio'), data = dataIt(scadenza);
  return chiusa(oggi, scadenza) ? `La finestra della tariffa premio si è chiusa il ${data}, salvo proroghe.` : finestraAperta(data);
}

// Sotto «Per te», solo in «entrare» e solo a chi ha un impianto nuovo, che per la tariffa deve entrare in esercizio entro
// la data (decisioni dell'utente dell'08/11/2026). Al consumatore e a chi ha l'impianto già in esercizio la nota non c'è;
// in «fondare» la frase sta nel passo «Tu e i fondatori», e chi chiama passa falso.
export function notaScadenza(impiantoNuovo, oggi, costanti) {
  if (!impiantoNuovo) return '';
  const scadenza = voce(costanti, 'scadenza_esercizio'), data = dataIt(scadenza);
  return chiusa(oggi, scadenza)
    ? `La finestra della tariffa premio si è chiusa il ${data}, salvo proroghe: su un impianto nuovo la comunità riceve solo il contributo ARERA.`
    : finestraAperta(data);
}

// Sotto il numero grande di «Per te» (decisione dell'utente, 08/11/2026): quanto della cifra è quota eccedentaria, che il
// simulatore dà tutta ai consumatori non imprese, e che la destinazione vera la decide il regolamento. Vuota senza
// eccedentaria. `quota` è la quotaEccedentaria del socio, per membro.
export function testoEccedentariaTe(quota) {
  if (!(quota > 0)) return '';
  return `Di questi, ${euro(quota)} sono la quota eccedentaria della tariffa. Il simulatore la dà tutta ai consumatori che non sono imprese, in proporzione all'energia condivisa: quanta ne va a loro e quanta a finalità sociali lo decide il regolamento della CER.`;
}

// Che cosa si toglie dalla tariffa prima della parte della CER (spec del sito §6.8-§6.9): la quota eccedentaria, che resta
// fuori dal riparto, e la parte dei costi della CER che tocca alla tariffa (κ li toglie in proporzione da tariffa e
// contributo ARERA). Senza eccedentaria la frase non la nomina. `com` è `comunita`.
export const testoTolti = (com) => (com.quotaEccedentaria > 0 ? 'tolte la quota eccedentaria e la sua parte dei costi della CER' : 'tolta la sua parte dei costi della CER');

// La quota eccedentaria della tariffa. Il DM 414/2023 (art. 3 c. 2 lett. g) e lo statuto (art. 12) la destinano «ai soli
// consumatori diversi dalle imprese e/o» a finalità sociali; la scelta di darla tutta ai primi, e alle finalità sociali solo
// se non ce ne sono, è del simulatore, e la frase lo dice. Vuota quando non c'è eccedentaria. `com` è `comunita` del
// risultato del calcolo.
export function testoEccedentaria(com) {
  if (!(com.quotaEccedentaria > 0)) return '';
  const importo = `La quota eccedentaria della tariffa, ${euro(com.eccedentaria)} l'anno,`;
  return com.fondoSociale > 0
    ? `${importo} va a finalità sociali. Lo statuto (art. 12) la destina ai consumatori che non sono imprese, a finalità sociali o a entrambe: qui non ci sono consumatori che non siano imprese.`
    : `${importo} va ai consumatori che non sono imprese. Lo statuto (art. 12) la destina a loro, a finalità sociali o a entrambe: qui va tutta a loro.`;
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
  const base = 'Un impianto entrato in esercizio prima della costituzione della CER, con le regole di oggi, non riceve la tariffa premio: le eccezioni per gli impianti entrati in esercizio fra il 2021 e il 2024 avevano scadenze già passate. Resta nella comunità: la sua energia conta per la condivisa, e su di essa la comunità riceve il contributo ARERA, che nel riparto d\'esempio va ai consumatori; l\'energia che immette resta del titolare, che la vende con il ritiro dedicato del GSE o a un venditore. Il GSE attribuisce la condivisa prima agli impianti più vecchi: nelle ore in cui l\'energia immessa supera i consumi della comunità, un impianto già in esercizio riduce i kWh incentivati di quelli nuovi, e con loro la tariffa che arriva alla comunità. Se hai lo scambio sul posto, per entrare va chiuso.';
  return stato === 'esistente' ? `${base} Un impianto entrato in esercizio fino al 15/12/2021 è un impianto «esistente»: la comunità può averne al massimo il 30% della potenza.` : base;
}

// L'etichetta del campo dei fondatori (revisione §8.2): l'importo che dividono, se c'è.
export const testoFondatori = (costituzione) => (costituzione == null ? 'Fondatori, che dividono la costituzione' : `Fondatori, che dividono i ${euro(costituzione)} della costituzione`);

export function ipotesi(r, loc, pvInfo, costanti) {
  const p = r.parametri, em = r.emissioni;
  const anni = voce(costanti, 'durata_tariffa_anni');
  const resa = pvInfo.valori.reduce((s, v) => s + v, 0) / 1000;
  const tipFv = r.impianti.find((k) => k.incentivato)?.tip;
  const ce = (tipo) => numero(costoEvitato(tipo, p.prezzo_zonale, costanti, p.costo_evitato ?? {}), 3);
  const media = em.principale === 'media';
  // Il prezzo dell'energia è un solo numero per tutta Italia: il PUN Index medio del 2025. Se in avanzato è stato cambiato, la riga lo dice.
  const prezzoDelFile = Math.abs(p.prezzo_zonale - voce(costanti, 'prezzo_zonale')) < 1e-9;
  const prezzo = prezzoDelFile
    ? `Prezzo dell'energia: ${numero(p.prezzo_zonale, 2)} €/MWh, la media nazionale del 2025 (PUN Index), uguale tutto l'anno: nella tua zona di mercato il prezzo può essere diverso`
    : `Prezzo dell'energia: ${numero(p.prezzo_zonale, 2)} €/MWh, scelto in modalità Avanzato, uguale tutto l'anno`;
  // Le quote dell'esempio vengono dal regolamento di CERS Eliodora (art. 3, fonte in costanti.json); la pagina non lo
  // nomina e con quote cambiate in avanzato non parla di esempio (testi dell'utente del 10/11/2026).
  const q = voce(costanti, 'quote_riparto');
  const esempio = Math.abs(p.quota_produttore - q.produttore) < 1e-9 && Math.abs(p.quota_consumatori - q.consumatori) < 1e-9;
  const fonteRiparto = esempio ? 'È un esempio.' : 'Le quote vengono stabilite dal regolamento della CER.';
  return [
    `Località: ${loc.nome} (${loc.sigla}). Produzione PVGIS dell'anno meteorologico ${pvInfo.anno_meteo}, pannelli rivolti a sud con l'inclinazione ottimale di ${numero(pvInfo.inclinazione)}°: ${numero(resa)} kWh per kWp l'anno. Un altro anno sposta la produzione di qualche punto percentuale.`,
    'La produzione è calcolata sui kWp dei pannelli, con un inverter della stessa potenza e una connessione che permette di immettere tutto: non contiamo tagli dell\'inverter né limiti di immissione, e il costo della connessione è escluso.',
    `Consumi delle famiglie: forme medie ARERA 2025 dei residenti in ${loc.regione}; una famiglia vera è più irregolare. Attività ed enti: profili illustrativi, non misurati.`,
    `${prezzo}${tipFv != null ? `; tariffa premio ${numero(tipFv)} €/MWh` : ''}.`,
    `Costo evitato in bolletta per ogni kWh autoconsumato: ${ce('famiglia')} €/kWh per le famiglie, ${ce('attivita')} per le attività, ${ce('ente')} per gli enti.`,
    `Riparto: ${perc(p.quota_produttore)} della tariffa al titolare dell'impianto, ${perc(p.quota_consumatori)} ai consumatori secondo quanto consumano nelle ore di produzione, ${perc(1 - p.quota_produttore - p.quota_consumatori)} alla CER; il contributo ARERA ai consumatori. ${fonteRiparto}`,
    `Costi della CER: ${euro(p.gestione_eur_anno)} l'anno di gestione più i corrispettivi del GSE, tolti dagli incentivi prima del riparto. La quota eccedentaria non copre i costi della CER: resta intera a chi la riceve (i consumatori che non sono imprese o, senza di loro, le finalità sociali). È la lettura prudente, perché le regole non dicono se possa coprirli.`,
    ...(r.impianti.some((k) => !k.giaInEsercizio) ? [`Gli impianti nuovi entrano in esercizio dopo la costituzione della CER ed entro il ${dataIt(voce(costanti, 'scadenza_esercizio'))}.`] : []),
    ...(r.impianti.some((k) => k.giaInEsercizio) ? ['Gli impianti già in esercizio sono entrati in esercizio prima della costituzione della CER: niente tariffa premio, solo il contributo ARERA sulla loro condivisa.'] : []),
    `${anni} anni a prezzi costanti, senza inflazione né attualizzazione; degrado dei pannelli: ${perc(voce(costanti, 'degrado'), 1)} della produzione l'anno.`,
    media
      ? `CO₂ evitata: ipotesi che ogni kWh dei pannelli valga la CO₂ media di un kWh consumato in Italia, ${numero(voce(costanti, 'fattore_co2'), 1)} g/kWh (media nazionale annua, ISPRA, 2025 preliminare); con il metodo ISPRA delle emissioni evitate sarebbe ${numero(voce(costanti, 'fattore_co2_fossili'), 1)}. Sui ${anni} anni il fattore scende del ${perc(voce(costanti, 'calo_fattore_co2'), 1)} l'anno, come in media dal 1990: è una proiezione.`
      : `CO₂ evitata: ipotesi che ogni kWh dei pannelli sostituisca un kWh delle centrali fossili italiane, ${numero(voce(costanti, 'fattore_co2_fossili'), 1)} g/kWh (metodo ISPRA, media nazionale annua, 2025 preliminare); con la CO₂ media di un kWh consumato sarebbe ${numero(voce(costanti, 'fattore_co2'), 1)}. Sui ${anni} anni il fattore resta quello di oggi: è una proiezione.`,
    'Fuori dal calcolo: imposte sui redditi, agevolazioni (PNRR, detrazioni), accumuli, prezzo ora per ora, quarto d\'ora, sostituzione dell\'inverter, assicurazione.',
  ];
}
