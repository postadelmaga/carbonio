// Bilanci orari della configurazione (spec §6.4-§6.5): autoconsumo, immessa e prelievo di ogni gruppo di membri,
// condivisa S(h) = min(E(h); P(h)), attribuzione della condivisa agli impianti per anzianità (ordine dell'elenco) e
// ai gruppi in proporzione al prelievo dell'ora, come fa cersim.
import { somma } from './profili.js';

export function energia(gruppi, impianti) {
  const n = (gruppi[0]?.consumo ?? impianti[0]?.produzione)?.length ?? 0;
  const numero = new Map(gruppi.map((g) => [g.id, g.numero]));
  const copie = impianti.map((k) => (k.perOgniMembro ? numero.get(k.titolare) : 1));
  const imm = impianti.map(() => new Float64Array(n));
  const auto = gruppi.map(() => new Float64Array(n));
  const prel = gruppi.map((g) => Float64Array.from(g.consumo));

  gruppi.forEach((g, gi) => {
    const propri = [];
    impianti.forEach((k, j) => { if (k.sulPod && k.titolare === g.id) propri.push(j); });
    if (!propri.length) return;
    for (let h = 0; h < n; h++) {
      let p = 0;
      for (const j of propri) p += impianti[j].produzione[h];
      const a = Math.min(p, g.consumo[h]);
      auto[gi][h] = a;
      prel[gi][h] = g.consumo[h] - a;
      for (const j of propri) {
        const pj = impianti[j].produzione[h];
        imm[j][h] = (pj - (p > 0 ? (a * pj) / p : 0)) * copie[j];
      }
    }
  });
  impianti.forEach((k, j) => {
    if (!k.sulPod) for (let h = 0; h < n; h++) imm[j][h] = k.produzione[h] * copie[j];
  });

  const E = new Float64Array(n), P = new Float64Array(n), S = new Float64Array(n);
  const Sk = impianti.map(() => new Float64Array(n));
  const da = gruppi.map(() => new Float64Array(impianti.length)); // condivisa del gruppo intero, per impianto
  for (let h = 0; h < n; h++) {
    let e = 0, p = 0;
    for (let j = 0; j < impianti.length; j++) e += imm[j][h];
    for (let gi = 0; gi < gruppi.length; gi++) p += gruppi[gi].numero * prel[gi][h];
    const s = Math.min(e, p);
    E[h] = e; P[h] = p; S[h] = s;
    if (!(s > 0)) continue;
    let resto = s;
    for (let j = 0; j < impianti.length; j++) {
      const x = Math.min(imm[j][h], resto);
      Sk[j][h] = x;
      resto -= x;
    }
    for (let gi = 0; gi < gruppi.length; gi++) {
      const quota = (gruppi[gi].numero * prel[gi][h]) / p;
      if (!(quota > 0)) continue;
      for (let j = 0; j < impianti.length; j++) if (Sk[j][h] > 0) da[gi][j] += Sk[j][h] * quota;
    }
  }

  const risImpianti = impianti.map((k, j) => {
    const produzioneTot = somma(k.produzione) * copie[j];
    const immessa = somma(imm[j]);
    return {
      id: k.id, copie: copie[j], produzione: produzioneTot, immessa, autoconsumo: produzioneTot - immessa,
      condivisa: somma(Sk[j]), serieImmessa: imm[j], serieCondivisa: Sk[j],
    };
  });
  const risGruppi = gruppi.map((g, gi) => {
    const condivisaDa = {};
    impianti.forEach((k, j) => { condivisaDa[k.id] = da[gi][j] / g.numero; });
    return {
      id: g.id, numero: g.numero, consumo: somma(g.consumo), autoconsumo: somma(auto[gi]), prelievo: somma(prel[gi]),
      condivisa: da[gi].reduce((s, x) => s + x, 0) / g.numero, condivisaDa,
      serieConsumo: g.consumo, seriePrelievo: prel[gi],
    };
  });
  return {
    n, E, P, S,
    impianti: risImpianti,
    gruppi: risGruppi,
    totali: {
      produzione: risImpianti.reduce((s, x) => s + x.produzione, 0),
      autoconsumo: risImpianti.reduce((s, x) => s + x.autoconsumo, 0),
      immessa: somma(E), prelievo: somma(P), condivisa: somma(S),
      consumo: risGruppi.reduce((s, x) => s + x.consumo * x.numero, 0),
    },
  };
}
