// CO₂ evitata dagli impianti nuovi, impronta dei prelievi e copertura dei consumi (spec §6.12). La CO₂ evitata si
// attribuisce solo al titolare di un impianto nuovo: la condivisa di un consumatore è energia di quello stesso
// impianto, e contarla due volte farebbe superare al totale dei soci quello reale.
import { voce } from './economia.js';

export const tonnellateCo2 = (kwh, gPerKwh) => (kwh * gPerKwh) / 1e6;

// Σ_{t=0}^{anni-1} ((1 − degrado)(1 − calo))^t: produzione che cala e fattore che scende, anno per anno.
export function fattoreVentiAnni(calo, degrado, anni = 20) {
  let s = 0;
  for (let t = 0; t < anni; t++) s += ((1 - degrado) * (1 - calo)) ** t;
  return s;
}

export function emissioni(en, gruppi, impianti, c, principale = 'media') {
  const fMedia = voce(c, 'fattore_co2'), fAlto = voce(c, 'fattore_co2_alto');
  const f = principale === 'termoelettrico' ? fAlto : fMedia;
  const venti = fattoreVentiAnni(voce(c, 'calo_fattore_co2'), voce(c, 'degrado'));
  const membri = Object.fromEntries(gruppi.map((g) => [g.id, { evitata: 0, evitataAlta: 0, ventiAnni: 0, impronta: 0, copertura: null }]));
  let nuovi = 0, esistenti = 0;
  impianti.forEach((k, j) => {
    const prod = en.impianti[j].produzione;
    if (k.esistente) { esistenti += prod; return; }
    nuovi += prod;
    if (k.titolare === 'cer') return;
    const m = membri[k.titolare], perMembro = prod / en.impianti[j].copie;
    m.evitata += tonnellateCo2(perMembro, f);
    m.evitataAlta += tonnellateCo2(perMembro, fAlto);
    m.ventiAnni += tonnellateCo2(perMembro, f) * venti;
  });
  for (const g of en.gruppi) {
    membri[g.id].impronta = tonnellateCo2(g.prelievo, fMedia);
    membri[g.id].copertura = g.consumo > 0 ? (g.autoconsumo + g.condivisa) / g.consumo : null;
  }
  const evitata = tonnellateCo2(nuovi, f);
  return {
    fattore: f, fattoreAlto: fAlto, principale,
    comunita: {
      evitata, evitataAlta: tonnellateCo2(nuovi, fAlto), ventiAnni: evitata * venti,
      esistenti: tonnellateCo2(esistenti, f), italiani: evitata / voce(c, 'co2_pro_capite'),
    },
    membri,
  };
}
