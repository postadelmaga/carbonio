// Il calcolo completo (spec §6): validazione, profili, energia ed economia dell'anno 1 e dell'ultimo anno con il degrado,
// anni intermedi interpolati, emissioni, dati dei grafici e avvisi.
import { asseOre } from './calendario.js';
import { formaDomestica, formaAttivita, scala, sposta, produzione, somma } from './profili.js';
import { energia } from './energia.js';
import { economiaAnno, investimento, costoEvitato, voce, giaInEsercizio, STATI } from './economia.js';
import { emissioni, FATTORI } from './emissioni.js';

export const CLASSI = ['0-1,5', '1,5-3', '3-4,5', '4,5-6', 'oltre_6'];
export const TIPI_SOCIO = ['famiglia', 'attivita', 'ente'];
let asseMemo = null;
export const asse = () => (asseMemo ??= asseOre());

const fra = (x, a, b) => typeof x === 'number' && Number.isFinite(x) && x >= a && x <= b;

export function valida(ingressi, c) {
  const err = [];
  const soci = ingressi.soci ?? [], impianti = ingressi.impianti ?? [];
  const perId = new Map();
  const spMax = voce(c, 'spostamento_massimo'), quote = voce(c, 'quote_riparto');
  if (!['nord', 'centro', 'sud'].includes(ingressi.area)) err.push(`area «${ingressi.area}» non prevista`);
  for (const s of soci) {
    if (perId.has(s.id)) err.push(`socio ${s.id}: identificativo ripetuto`);
    perId.set(s.id, s);
    if (!TIPI_SOCIO.includes(s.tipo)) err.push(`socio ${s.id}: tipo «${s.tipo}» non previsto`);
    if (!Number.isInteger(s.numero) || s.numero < 1 || s.numero > 500) err.push(`socio ${s.id}: numero dei membri fra 1 e 500`);
    if (s.consumo_kwh_anno != null && !fra(s.consumo_kwh_anno, 0, 2e6)) err.push(`socio ${s.id}: consumo fra 0 e 2.000.000 kWh`);
    if (s.tipo === 'famiglia' && !CLASSI.includes(s.classe_potenza)) err.push(`socio ${s.id}: classe di potenza «${s.classe_potenza}» non prevista`);
    if (s.tipo !== 'famiglia' && s.consumo_kwh_anno == null) err.push(`socio ${s.id}: per attività ed enti serve il consumo annuo`);
    if (s.tipo !== 'famiglia' && !s.archetipo) err.push(`socio ${s.id}: manca il tipo di attività`);
    if (!fra(s.spostamento ?? 0, 0, spMax)) err.push(`socio ${s.id}: spostamento fra 0 e ${Math.round(100 * spMax)}%`);
  }
  const visti = new Set();
  for (const k of impianti) {
    if (visti.has(k.id)) err.push(`impianto ${k.id}: identificativo ripetuto`);
    visti.add(k.id);
    if (!fra(k.kwp, 0.5, 1000)) err.push(`impianto ${k.id}: potenza fra 0,5 e 1.000 kW (oltre 1 MW la tariffa non spetta)`);
    const t = k.titolare === 'cer' ? null : perId.get(k.titolare);
    if (k.titolare !== 'cer' && !t) err.push(`impianto ${k.id}: titolare «${k.titolare}» sconosciuto`);
    if (k.titolare === 'cer' && k.sul_pod_del_titolare) err.push(`impianto ${k.id}: un impianto della CER non sta sul POD di un socio`);
    if (k.per_ogni_membro && !k.sul_pod_del_titolare) err.push(`impianto ${k.id}: un impianto per ogni membro sta sul POD di ciascuno`);
    if (t && t.numero > 1 && !k.per_ogni_membro) err.push(`impianto ${k.id}: il titolare è un gruppo, l'impianto va indicato per ogni membro`);
    if ('esistente' in k) err.push(`impianto ${k.id}: «esistente» non si usa più, lo stato va in «stato»`);
    if (!STATI.includes(k.stato ?? 'nuovo')) err.push(`impianto ${k.id}: stato «${k.stato}» non previsto`);
  }
  const p = ingressi.parametri ?? {};
  for (const q of ['quota_produttore', 'quota_consumatori']) if (p[q] != null && !fra(p[q], 0, 1)) err.push(`${q} fra 0 e 100%`);
  if ((p.quota_produttore ?? quote.produttore) + (p.quota_consumatori ?? quote.consumatori) > 1 + 1e-9) err.push('quota del produttore più quota dei consumatori oltre il 100%');
  if (p.prezzo_zonale != null && !fra(p.prezzo_zonale, 0, 1000)) err.push('prezzo zonale fra 0 e 1.000 €/MWh');
  if (p.fondatori != null && !(Number.isInteger(p.fondatori) && p.fondatori >= 1)) err.push('i fondatori sono almeno 1');
  if (p.fattore_principale != null && !FATTORI.includes(p.fattore_principale)) err.push(`fattore principale «${p.fattore_principale}» non previsto`);
  return err;
}

function parametri(ingressi, c) {
  const q = voce(c, 'quote_riparto');
  const scelti = Object.fromEntries(Object.entries(ingressi.parametri ?? {}).filter(([, v]) => v != null));
  return {
    prezzo_zonale: voce(c, 'prezzo_zonale'), gestione_eur_anno: voce(c, 'gestione'), costituzione_eur: voce(c, 'costituzione'),
    quota_associativa: voce(c, 'quota_associativa'), quota_produttore: q.produttore, quota_consumatori: q.consumatori,
    fattore_principale: 'fossili', fondatori: voce(c, 'predefiniti').fondatori, manutenzione: voce(c, 'manutenzione'),
    prezzo_impianto_eur_w: null, costo_evitato: {},
    ...scelti, area: ingressi.area,
  };
}

export function prepara(ingressi, dati) {
  const errori = valida(ingressi, dati.costanti);
  if (errori.length) throw new Error(errori.join('; '));
  const c = dati.costanti, a = asse(), par = parametri(ingressi, c), serie = ingressi.serie ?? {};
  if (!dati.pv || dati.pv.length !== a.n) throw new Error(`serie fotovoltaica di ${dati.pv?.length ?? 0} ore invece di ${a.n}`);
  const gruppi = ingressi.soci.map((s) => {
    let consumo = serie.consumi?.[s.id];
    if (!consumo) {
      const forma = s.tipo === 'famiglia' ? formaDomestica(dati.forme, s.classe_potenza, a) : formaAttivita(dati.attivita.archetipi[s.archetipo], a);
      consumo = scala(forma, s.consumo_kwh_anno ?? somma(forma));
      if (s.tipo === 'famiglia' && s.spostamento > 0) consumo = sposta(consumo, dati.pv, a, s.spostamento);
    }
    return { id: s.id, tipo: s.tipo, numero: s.numero, consumo };
  });
  const impianti = ingressi.impianti.map((k) => ({
    id: k.id, kwp: k.kwp, titolare: k.titolare, sulPod: !!k.sul_pod_del_titolare, perOgniMembro: !!k.per_ogni_membro,
    stato: k.stato ?? 'nuovo', unitaria: serie.produzioni?.[k.id] ?? produzione(dati.pv, k.kwp),
  }));
  return { c, par, gruppi, impianti, degrado: voce(c, 'degrado'), anni: voce(c, 'durata_tariffa_anni') };
}

// d = fattore di degrado dell'anno: 1 il primo anno, (1 − degrado)^(t−1) l'anno t.
export function anno(prep, d) {
  const imp = prep.impianti.map((k) => ({ ...k, produzione: d === 1 ? k.unitaria : k.unitaria.map((x) => x * d) }));
  const en = energia(prep.gruppi, imp);
  return { imp, en, ec: economiaAnno(en, prep.gruppi, imp, prep.par, prep.c) };
}

export const flussi = (m) => ({
  impiantoDaSolo: m.risparmio + m.vendita - m.manutenzione,
  cerAggiunge: m.quotaProduttore + m.quotaTariffa + m.quotaContributo + m.quotaEccedentaria - m.quotaAssociativa,
});

// Peso dell'anno t nell'interpolazione fra il primo anno (0) e l'ultimo (1), lineare sul fattore di degrado.
export function peso(t, degrado, anni) {
  const dUltimo = (1 - degrado) ** (anni - 1);
  return dUltimo < 1 ? (1 - (1 - degrado) ** (t - 1)) / (1 - dUltimo) : 0;
}

function medieGiornaliere(valore, a) {
  const acc = Array.from({ length: 12 }, () => new Array(24).fill(0)), num = Array.from({ length: 12 }, () => new Array(24).fill(0));
  for (let h = 0; h < a.n; h++) { acc[a.mese[h] - 1][a.ora[h]] += valore(h); num[a.mese[h] - 1][a.ora[h]]++; }
  return acc.map((r, m) => r.map((v, o) => (num[m][o] ? v / num[m][o] : 0)));
}
function totaliMensili(valore, a) {
  const t = new Array(12).fill(0);
  for (let h = 0; h < a.n; h++) t[a.mese[h] - 1] += valore(h);
  return t;
}

export function calcola(ingressi, dati) {
  const prep = prepara(ingressi, dati);
  const { c, par, gruppi, degrado, anni } = prep;
  const a = asse();
  const a1 = anno(prep, 1), a20 = anno(prep, (1 - degrado) ** (anni - 1));
  const { en: en1, ec: ec1, imp: imp1 } = a1;
  const co2 = emissioni(en1, gruppi, imp1, c, par.fattore_principale);

  const membri = {};
  gruppi.forEach((g, gi) => {
    const f1 = flussi(ec1.membri[g.id]), f20 = flussi(a20.ec.membri[g.id]);
    const delAnno = (t, campo) => f1[campo] + (f20[campo] - f1[campo]) * peso(t, degrado, anni);
    // Un impianto già in esercizio è già pagato: si tolgono dall'investimento, non dai flussi.
    const propri = prep.impianti.filter((k) => k.titolare === g.id);
    const inv = propri.filter((k) => !giaInEsercizio(k))
      .reduce((s, k) => s + investimento(k.kwp, g.tipo, c, par.prezzo_impianto_eur_w), 0);
    const haImpianto = propri.length > 0, soloGiaInEsercizio = haImpianto && propri.every(giaInEsercizio);
    let con = 0, senza = 0, cer = 0, rientroCon = null, rientroSenza = null;
    for (let t = 1; t <= anni; t++) {
      const da = delAnno(t, 'impiantoDaSolo'), ag = delAnno(t, 'cerAggiunge');
      con += da + ag; senza += da; cer += ag;
      if (inv > 0 && rientroCon == null && con >= inv) rientroCon = t;
      if (inv > 0 && rientroSenza == null && senza >= inv) rientroSenza = t;
    }
    const e = en1.gruppi[gi];
    const ce = costoEvitato(g.tipo, par.prezzo_zonale, c, par.costo_evitato);
    const spesa = e.consumo * ce;
    membri[g.id] = {
      tipo: g.tipo, numero: g.numero, consumo: e.consumo, autoconsumo: e.autoconsumo, prelievo: e.prelievo, condivisa: e.condivisa,
      voci: ec1.membri[g.id], impiantoDaSolo: f1.impiantoDaSolo, cerAggiunge: f1.cerAggiunge, totale: f1.impiantoDaSolo + f1.cerAggiunge,
      quotaSpesa: spesa > 0 ? f1.cerAggiunge / spesa : null, costoEvitatoKwh: ce,
      haImpianto, soloGiaInEsercizio, investimento: inv, rientroConCer: rientroCon, rientroSenzaCer: rientroSenza, ventiAnni: con - inv, cerVentiAnni: cer,
      co2: co2.membri[g.id],
    };
  });

  let perTe = null;
  if (ingressi.io && membri[ingressi.io]) {
    const m = membri[ingressi.io];
    const quota = ingressi.fondatore ? (par.costituzione_eur == null ? null : par.costituzione_eur / par.fondatori) : 0;
    perTe = { id: ingressi.io, ...m, costituzione: quota, ventiAnni: m.ventiAnni - (quota ?? 0), cerVentiAnniNetto: m.cerVentiAnni - (quota ?? 0) };
  }

  const t1 = en1.totali;
  const somma1 = (campo) => gruppi.reduce((s, g) => s + g.numero * ec1.membri[g.id][campo], 0);
  // La quota di titolare è dei produttori anche quando il titolare è la CER; alla CER resta solo la sua parte del riparto.
  const incentivi = {
    produttori: somma1('quotaProduttore') + ec1.cer.titolare,
    consumatori: somma1('quotaTariffa') + somma1('quotaContributo') + somma1('quotaEccedentaria'),
    cer: ec1.cer.quotaCer, fondoSociale: ec1.cer.fondoSociale, costi: ec1.costiTolti,
  };
  const comunita = {
    produzione: t1.produzione, autoconsumo: t1.autoconsumo, immessa: t1.immessa, prelievo: t1.prelievo, consumo: t1.consumo,
    condivisa: t1.condivisa,
    contemporaneita: t1.immessa > 0 ? t1.condivisa / t1.immessa : null,
    copertura: t1.prelievo > 0 ? t1.condivisa / t1.prelievo : null,
    tariffa: ec1.tariffa, eccedentaria: ec1.eccedentaria, quotaEccedentaria: ec1.e, contributo: ec1.contributo,
    costi: ec1.costi, kappa: ec1.kappa, nonCoperti: ec1.nonCoperti, fondo: ec1.cer.fondo, quote: ec1.cer.quote,
    quotaCer: ec1.cer.quotaCer, titolareCer: ec1.cer.titolare, fondoSociale: ec1.cer.fondoSociale,
    venditaCer: ec1.cer.vendita, manutenzioneCer: ec1.cer.manutenzione,
    investimentoCer: prep.impianti.filter((k) => k.titolare === 'cer' && !giaInEsercizio(k)).reduce((s, k) => s + investimento(k.kwp, 'cer', c, par.prezzo_impianto_eur_w), 0),
    incentivi,
    costituzionePerFondatore: par.costituzione_eur == null ? null : par.costituzione_eur / par.fondatori,
    membriTotali: gruppi.reduce((s, g) => s + g.numero, 0),
  };

  const prodOra = (h) => imp1.reduce((s, k, j) => s + k.produzione[h] * en1.impianti[j].copie, 0);
  const consOra = (h) => gruppi.reduce((s, g) => s + g.numero * g.consumo[h], 0);
  const condOra = (h) => en1.S[h];
  const grafici = {
    giornata: { produzione: medieGiornaliere(prodOra, a), consumo: medieGiornaliere(consOra, a), condivisa: medieGiornaliere(condOra, a) },
    mesi: { produzione: totaliMensili(prodOra, a), consumo: totaliMensili(consOra, a), condivisa: totaliMensili(condOra, a) },
    incentivi,
  };

  const avvisi = [];
  if (!prep.impianti.length) avvisi.push({ codice: 'senza_impianti', testo: 'Senza impianti non c\'è energia da condividere.' });
  if (!(t1.prelievo > 0)) avvisi.push({ codice: 'senza_prelievi', testo: 'Senza consumi dalla rete non c\'è energia condivisa.' });
  const kw = (filtro) => prep.impianti.reduce((s, k, j) => s + (filtro(k) ? k.kwp * en1.impianti[j].copie : 0), 0);
  // Il limite del 30% vale solo per gli impianti «esistenti» delle Regole, entrati in esercizio fino al 15/12/2021.
  const kwTot = kw(() => true), kwEs = kw((k) => k.stato === 'esistente');
  if (kwTot > 0 && kwEs / kwTot > voce(c, 'limite_potenza_esistenti')) {
    avvisi.push({ codice: 'esistenti_oltre_soglia', testo: `Gli impianti esistenti, entrati in esercizio fino al 15/12/2021, sono il ${Math.round((100 * kwEs) / kwTot)}% della potenza: le Regole li ammettono fino al ${Math.round(100 * voce(c, 'limite_potenza_esistenti'))}%.` });
  }
  // Con una quota associativa già impostata l'avviso la conta: manca solo ciò che incentivi e quote insieme non coprono.
  const scoperto = par.quota_associativa > 0 ? ec1.nonCoperti - ec1.cer.quote : ec1.nonCoperti;
  if (ec1.nonCoperti > 0 && scoperto > 0) {
    avvisi.push({
      codice: 'costi_non_coperti',
      testo: par.quota_associativa > 0
        ? `Gli incentivi e le quote associative non coprono i costi della CER: mancano circa ${Math.round(scoperto)} € l'anno.`
        : `Gli incentivi non coprono i costi della CER: mancano circa ${Math.round(scoperto)} € l'anno, da coprire per esempio con una quota associativa.`,
    });
  }
  if (t1.immessa > 0 && t1.condivisa / t1.immessa < 0.3) {
    avvisi.push({ codice: 'servono_consumatori', testo: 'Meno del 30% dell\'energia immessa viene consumata nelle stesse ore dai soci: per questa produzione servono più consumatori.' });
  }
  if (ingressi.fondatore && par.costituzione_eur == null) {
    avvisi.push({ codice: 'costituzione_non_verificata', testo: 'Il costo di costituzione non è ancora verificato e non entra nel conto.' });
  }

  const impianti = imp1.map((k, j) => ({
    id: k.id, kwp: k.kwp, stato: k.stato, giaInEsercizio: giaInEsercizio(k), copie: en1.impianti[j].copie, produzione: en1.impianti[j].produzione,
    immessa: en1.impianti[j].immessa, autoconsumo: en1.impianti[j].autoconsumo, condivisa: en1.impianti[j].condivisa,
    incentivato: ec1.voci[j].incentivato, tip: ec1.voci[j].tip, tariffa: ec1.voci[j].tariffa,
  }));
  return {
    avvisi, parametri: par, comunita, membri, perTe, impianti,
    emissioni: { fattore: co2.fattore, fattoreAltro: co2.fattoreAltro, principale: co2.principale, comunita: co2.comunita },
    grafici,
  };
}
