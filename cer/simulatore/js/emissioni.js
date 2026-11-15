// CO₂ evitata dagli impianti nuovi, impronta dei prelievi e copertura dei consumi (spec del sito §6.12, revisione §9).
// La CO₂ evitata usa il metodo ISPRA delle emissioni evitate (centrali fossili) o, in avanzato, la media dei consumi;
// l'impronta usa sempre la media dei consumi, la CO₂ di un kWh consumato. La CO₂ evitata si attribuisce solo al titolare
// di un impianto nuovo: la condivisa di un consumatore è energia di quello stesso impianto, e contarla due volte farebbe
// superare al totale dei soci quello reale.
import { voce, giaInEsercizio } from './economia.js';

export const FATTORI = ['fossili', 'media'];
export const tonnellateCo2 = (kwh, gPerKwh) => (kwh * gPerKwh) / 1e6;

// Σ_{t=0}^{anni-1} ((1 − degrado)(1 − calo))^t: produzione che cala e fattore che scende, anno per anno.
export function fattoreVentiAnni(calo, degrado, anni) {
  let s = 0;
  for (let t = 0; t < anni; t++) s += ((1 - degrado) * (1 - calo)) ** t;
  return s;
}

export function emissioni(en, gruppi, impianti, c, principale = 'fossili') {
  const fFossili = voce(c, 'fattore_co2_fossili'), fMedia = voce(c, 'fattore_co2');
  const media = principale === 'media';
  const f = media ? fMedia : fFossili, fAltro = media ? fFossili : fMedia;
  // Con la media il fattore scende del calo storico dei consumi; quello delle centrali fossili resta quello di oggi.
  const venti = fattoreVentiAnni(media ? voce(c, 'calo_fattore_co2') : 0, voce(c, 'degrado'), voce(c, 'durata_tariffa_anni'));
  const membri = Object.fromEntries(gruppi.map((g) => [g.id, { evitata: 0, ventiAnni: 0, impronta: 0, copertura: null }]));
  let nuovi = 0, gia = 0;
  impianti.forEach((k, j) => {
    const prod = en.impianti[j].produzione;
    if (giaInEsercizio(k)) { gia += prod; return; }
    nuovi += prod;
    if (k.titolare === 'cer') return;
    const m = membri[k.titolare], perMembro = prod / en.impianti[j].copie;
    m.evitata += tonnellateCo2(perMembro, f);
    m.ventiAnni += tonnellateCo2(perMembro, f) * venti;
  });
  for (const g of en.gruppi) {
    membri[g.id].impronta = tonnellateCo2(g.prelievo, fMedia);
    membri[g.id].copertura = g.consumo > 0 ? (g.autoconsumo + g.condivisa) / g.consumo : null;
  }
  const evitata = tonnellateCo2(nuovi, f);
  return {
    fattore: f, fattoreAltro: fAltro, principale: media ? 'media' : 'fossili',
    comunita: {
      evitata, evitataAltra: tonnellateCo2(nuovi, fAltro), ventiAnni: evitata * venti,
      giaInEsercizio: tonnellateCo2(gia, f), italiani: evitata / voce(c, 'co2_pro_capite'),
    },
    membri,
  };
}
