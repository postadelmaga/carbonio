// Testi generati dai risultati (spec §7.3, §8): le ipotesi di questa simulazione e la scadenza della tariffa.
import { numero, euro, perc } from './formato.js';
import { costoEvitato, voce } from './economia.js';

export function mesiAllaScadenza(oggi, scadenza) {
  const [a, m] = scadenza.split('-').map(Number);
  return (a - oggi.getFullYear()) * 12 + (m - 1 - oggi.getMonth());
}

export function testoScadenza(oggi, costanti) {
  const scadenza = voce(costanti, 'scadenza_esercizio');
  const data = scadenza.split('-').reverse().join('/'), mesi = mesiAllaScadenza(oggi, scadenza);
  return mesi > 0
    ? `Per avere la tariffa premio gli impianti devono entrare in esercizio entro il ${data}, dopo la costituzione della CER: mancano ${mesi} mesi.`
    : `La finestra della tariffa premio si è chiusa il ${data}, salvo proroghe.`;
}

export function ipotesi(r, loc, pvInfo, costanti) {
  const p = r.parametri, em = r.emissioni;
  const anni = voce(costanti, 'durata_tariffa_anni');
  const resa = pvInfo.valori.reduce((s, v) => s + v, 0) / 1000;
  const tipFv = r.impianti.find((k) => k.incentivato)?.tip;
  const ce = (tipo) => numero(costoEvitato(tipo, p.prezzo_zonale, costanti, p.costo_evitato ?? {}), 3);
  const media = em.principale === 'media';
  return [
    `Località: ${loc.nome} (${loc.sigla}). Produzione PVGIS dell'anno meteorologico 2023, pannelli rivolti a sud con l'inclinazione ottimale di ${numero(pvInfo.inclinazione)}°: ${numero(resa)} kWh per kWp l'anno. Un altro anno sposta la produzione di qualche punto percentuale.`,
    `Consumi delle famiglie: forme medie ARERA 2025 dei residenti in ${loc.regione}; una famiglia vera è più irregolare. Attività ed enti: profili illustrativi, non misurati.`,
    `Prezzo dell'energia: ${numero(p.prezzo_zonale, 2)} €/MWh, uguale tutto l'anno${tipFv != null ? `; tariffa premio ${numero(tipFv)} €/MWh` : ''}.`,
    `Costo evitato in bolletta per ogni kWh autoconsumato: ${ce('famiglia')} €/kWh per le famiglie, ${ce('attivita')} per le attività, ${ce('ente')} per gli enti.`,
    `Riparto: ${perc(p.quota_produttore)} della tariffa al titolare dell'impianto, ${perc(p.quota_consumatori)} ai consumatori secondo quanto consumano nelle ore di produzione, ${perc(1 - p.quota_produttore - p.quota_consumatori)} al fondo sociale; il contributo ARERA ai consumatori. È l'esempio di CERS Eliodora, non il regolamento della nostra CER, che non è ancora scritto.`,
    `Costi della CER: ${euro(p.gestione_eur_anno)} l'anno di gestione più i corrispettivi del GSE, tolti dagli incentivi prima del riparto. La quota eccedentaria resta intera ai consumatori che non sono imprese: è la lettura prudente, perché le regole non dicono se possa coprire i costi.`,
    `Gli impianti nuovi entrano in esercizio dopo la costituzione della CER ed entro il ${voce(costanti, 'scadenza_esercizio').split('-').reverse().join('/')}.`,
    `${anni} anni a prezzi costanti, senza inflazione né attualizzazione; degrado dei pannelli: ${perc(voce(costanti, 'degrado'), 1)} della produzione l'anno.`,
    `CO₂: ${numero(em.fattore, 1)} g per kWh (${media ? 'media dei consumi elettrici' : 'produzione termoelettrica'}, ISPRA, 2025 preliminare)${media ? `, fino a ${numero(em.fattoreAlto, 1)} con il termoelettrico` : ''}; sui ${anni} anni si usa la media dei consumi${media ? '' : `, ${numero(voce(costanti, 'fattore_co2'), 1)} g per kWh`}, che cala del ${perc(voce(costanti, 'calo_fattore_co2'), 1)} l'anno.`,
    'Fuori dal calcolo: imposte, agevolazioni (PNRR, detrazioni), accumuli, prezzo ora per ora, quarto d\'ora.',
  ];
}
