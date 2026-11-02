// Voci economiche di un anno (spec §6.6-§6.9): tariffa premio dei soli impianti nuovi, eccedentaria alla lettera,
// contributo ARERA, costi della CER tolti prima del riparto con κ (mai dall'eccedentaria: scelta prudente sul punto
// di R-23), riparto per quote, vendita dell'immessa, risparmio dell'autoconsumo e manutenzione.
export const NON_IMPRESE = new Set(['famiglia', 'ente']);

export function voce(costanti, id) {
  const v = costanti.voci[id];
  if (!v || !('valore' in v)) throw new Error(`costante mancante: ${id}`);
  return v.valore;
}

export function tip(kwp, pz, area, c) {
  const fascia = voce(c, 'tariffa_fasce').find((f) => kwp <= f.fino_kw);
  if (!fascia) return 0;
  const variabile = Math.max(0, voce(c, 'tariffa_prezzo_riferimento') - pz);
  return Math.min(fascia.tetto, fascia.base + variabile) + voce(c, 'correttivo_fv')[area];
}

export const quotaEccedentaria = (condivisa, immessa, soglia) => (immessa > 0 ? Math.max(0, condivisa / immessa - soglia) : 0);

export function corrispettivoGse(kwp, c) {
  const r = voce(c, 'corrispettivo_gse');
  return kwp <= r.esente_fino_kw ? 0 : r.fisso + Math.max(0, kwp - r.oltre_kw) * r.per_kw;
}

export const kappa = (costi, voci) => (voci > 0 ? Math.min(1, costi / voci) : costi > 0 ? 1 : 0);

// Prezzo con le perdite, rete e oneri, accisa; IVA per chi la paga davvero (famiglie ed enti, non le attività).
export function costoEvitato(tipo, pz, c, sostituti = {}) {
  if (sostituti[tipo] != null) return sostituti[tipo];
  const energiaKwh = (pz / 1000) * (1 + voce(c, 'perdite_rete'));
  if (tipo === 'famiglia') {
    return (energiaKwh + voce(c, 'rete_oneri_domestico') + voce(c, 'accisa_domestico')) * (1 + voce(c, 'iva_domestico'));
  }
  const netto = energiaKwh + voce(c, 'rete_oneri_altri') + voce(c, 'accisa_altri');
  return tipo === 'ente' ? netto * (1 + voce(c, 'iva_altri')) : netto;
}

export function investimento(kwp, tipo, c, eurW = null) {
  const fasce = voce(c, 'prezzo_impianto');
  const prezzo = eurW ?? (fasce.find((f) => kwp <= f.fino_kw) ?? fasce.at(-1)).eur_w;
  const netto = kwp * 1000 * prezzo;
  if (tipo === 'famiglia') return netto * (1 + voce(c, 'iva_impianto'));
  if (tipo === 'ente') return netto * (1 + voce(c, 'iva_impianto_ente'));
  return netto;
}

export function economiaAnno(en, gruppi, impianti, par, c) {
  const pz = par.prezzo_zonale;
  const tipoDi = Object.fromEntries(gruppi.map((g) => [g.id, g.tipo]));
  const membri = Object.fromEntries(gruppi.map((g) => [g.id, {
    quotaProduttore: 0, quotaTariffa: 0, quotaContributo: 0, quotaEccedentaria: 0,
    vendita: 0, risparmio: 0, manutenzione: 0, quotaAssociativa: par.quota_associativa,
  }]));
  const cer = { fondo: 0, vendita: 0, manutenzione: 0, quote: 0 };

  const voci = impianti.map((k, j) => {
    const x = en.impianti[j];
    const incentivato = !k.esistente && k.kwp <= 1000;
    const unitaria = incentivato ? tip(k.kwp, pz, par.area, c) : 0;
    return { id: k.id, incentivato, tip: unitaria, tariffa: (unitaria * x.condivisa) / 1000, condivisa: x.condivisa, immessa: x.immessa, copie: x.copie };
  });
  const inc = voci.filter((v) => v.incentivato);
  const e = quotaEccedentaria(inc.reduce((s, v) => s + v.condivisa, 0), inc.reduce((s, v) => s + v.immessa, 0), voce(c, 'soglia_eccedentaria'));
  const tariffa = voci.reduce((s, v) => s + v.tariffa, 0);
  const eccedentaria = e * tariffa;
  const contributo = (voce(c, 'contributo_arera') * en.totali.condivisa) / 1000;
  const costi = par.gestione_eur_anno + impianti.reduce((s, k, j) => s + corrispettivoGse(k.kwp, c) * voci[j].copie, 0);
  const lorde = tariffa * (1 - e) + contributo;
  const k = kappa(costi, lorde);
  const qp = par.quota_produttore, qc = par.quota_consumatori;

  const alTitolare = (imp, j, campo, importo) => {
    if (imp.titolare === 'cer') cer[campo === 'quotaProduttore' ? 'fondo' : campo] += importo;
    else membri[imp.titolare][campo] += importo / voci[j].copie;
  };
  impianti.forEach((imp, j) => {
    const v = voci[j];
    const netta = v.tariffa * (1 - e) * (1 - k);
    alTitolare(imp, j, 'quotaProduttore', qp * netta);
    if (v.condivisa > 0) {
      for (const g of en.gruppi) membri[g.id].quotaTariffa += (qc * netta * g.condivisaDa[imp.id]) / v.condivisa;
    }
    cer.fondo += (1 - qp - qc) * netta;
    alTitolare(imp, j, 'vendita', (v.immessa * pz) / 1000);
    alTitolare(imp, j, 'manutenzione', imp.kwp * par.manutenzione * v.copie);
  });

  const S = en.totali.condivisa;
  if (S > 0) for (const g of en.gruppi) membri[g.id].quotaContributo += (contributo * (1 - k) * g.condivisa) / S;
  const nonImprese = en.gruppi.filter((g) => NON_IMPRESE.has(tipoDi[g.id]));
  const base = nonImprese.reduce((s, g) => s + g.condivisa * g.numero, 0);
  if (base > 0) for (const g of nonImprese) membri[g.id].quotaEccedentaria += (eccedentaria * g.condivisa) / base;
  else cer.fondo += eccedentaria;

  for (const g of en.gruppi) membri[g.id].risparmio = g.autoconsumo * costoEvitato(tipoDi[g.id], pz, c, par.costo_evitato ?? {});
  cer.quote = gruppi.reduce((s, g) => s + g.numero * par.quota_associativa, 0);

  return {
    e, tariffa, eccedentaria, contributo, costi, lorde, kappa: k,
    costiTolti: Math.min(costi, lorde), nonCoperti: Math.max(0, costi - lorde),
    voci, membri, cer,
  };
}
