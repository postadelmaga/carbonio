// Dallo stato dei moduli agli ingressi del motore (spec §7.1-§7.2). «Voglio entrare»: l'utente dentro la comunità
// tipo di costanti.json. «Voglio fondarne una»: la comunità composta dall'utente. L'ordine degli impianti è
// l'anzianità: prima gli esistenti fino al 15/12/2021, poi i precedenti, poi l'impianto comune nuovo, poi gli altri nuovi.
import { voce } from './economia.js';

const RANGO = { esistente: 0, precedente: 1, nuovo: 2 };
const perAnzianita = (lista) => lista.map((k, i) => [k, i]).sort((a, b) => RANGO[a[0].stato] - RANGO[b[0].stato] || a[1] - b[1]).map(([k]) => k);
const famiglia = (id, numero, classe, consumo, spostamento) => ({ id, tipo: 'famiglia', numero, classe_potenza: classe, consumo_kwh_anno: consumo ?? null, spostamento: spostamento ?? 0 });
const altro = (id, tipo, numero, archetipo, consumo) => ({ id, tipo, numero, archetipo, consumo_kwh_anno: consumo ?? null, spostamento: 0 });
const impianto = (id, kwp, titolare, sulPod, perOgni, stato = 'nuovo') => ({ id, kwp, titolare, sul_pod_del_titolare: sulPod, per_ogni_membro: perOgni, stato });

// Il produttore non ha consumi (decisione dell'utente, 08/11/2026): come il socio produttore di «fondare», l'impianto sta
// in un punto dove non si consuma, e dalla CER riceve solo la quota di titolare. Il tipo resta: decide l'IVA sull'impianto.
export function ingressiEntrare(stato, costanti) {
  const u = stato.utente;
  const cm = { ...voce(costanti, 'comunita_tipo'), ...Object.fromEntries(Object.entries(stato.comunita ?? {}).filter(([, v]) => v != null)) };
  const produttore = u.ruolo === 'produttore';
  const consumo = produttore ? 0 : u.consumo, abitudini = produttore ? 0 : u.abitudini;
  const io = u.tipo === 'famiglia'
    ? famiglia('io', 1, u.classe, consumo, abitudini)
    : altro('io', u.tipo, 1, u.archetipo, consumo);
  const soci = [io];
  if (cm.famiglie > 0) soci.push(famiglia('famiglie', cm.famiglie, cm.classe, cm.consumo_famiglie, cm.abitudini_altri));
  if (cm.attivita > 0) soci.push(altro('attivita', 'attivita', cm.attivita, cm.archetipo_attivita, cm.consumo_attivita));
  if (cm.enti > 0) soci.push(altro('enti', 'ente', cm.enti, cm.archetipo_ente, cm.consumo_ente));
  const impianti = [];
  const tuo = u.ruolo === 'prosumer' || u.ruolo === 'produttore' ? impianto('tuo', u.kwp, 'io', u.ruolo === 'prosumer', false, u.stato ?? 'nuovo') : null;
  if (tuo && tuo.stato !== 'nuovo') impianti.push(tuo);
  if (cm.kwp_comune > 0) {
    soci.push(altro('produttore', 'attivita', 1, 'com_orario_apertura', 0));
    impianti.push(impianto('comune', cm.kwp_comune, 'produttore', false, false));
  }
  if (tuo && tuo.stato === 'nuovo') impianti.push(tuo);
  return { area: stato.area, soci, impianti, parametri: stato.parametri ?? {}, io: 'io', fondatore: false };
}

export function ingressiFondare(stato, costanti) {
  const f = stato.fondare, pe = f.pannelliEsistenti;
  const soci = [], lista = [];
  if (f.famiglie.numero > 0) soci.push(famiglia('famiglie', f.famiglie.numero, f.famiglie.classe, f.famiglie.consumo, f.abitudini));
  if (f.pannelli.numero > 0) soci.push(famiglia('pannelli', f.pannelli.numero, f.pannelli.classe, f.pannelli.consumo, f.abitudini));
  if (pe?.numero > 0) soci.push(famiglia('pannelli_esistenti', pe.numero, pe.classe, pe.consumo, f.abitudini));
  for (const [id, tipo] of [['attivita', 'attivita'], ['enti', 'ente']]) {
    if (f[id].numero > 0) soci.push(altro(id, tipo, f[id].numero, f[id].archetipo, f[id].consumo));
  }
  // Nell'ordine del modulo, che dentro ogni stato è l'ordine di anzianità; il comune è il primo dei nuovi.
  if (pe?.numero > 0 && pe.kwp > 0) lista.push(impianto('pannelli_esistenti', pe.kwp, 'pannelli_esistenti', true, true, pe.stato));
  if (f.comune.kwp > 0) {
    if (f.comune.titolare === 'produttore') soci.push(altro('produttore', 'attivita', 1, 'com_orario_apertura', 0));
    lista.push(impianto('comune', f.comune.kwp, f.comune.titolare === 'cer' ? 'cer' : 'produttore', false, false, f.comune.stato ?? 'nuovo'));
  }
  for (const id of ['attivita', 'enti']) {
    if (f[id].numero > 0 && f[id].kwp > 0) lista.push(impianto(id, f[id].kwp, id, true, true));
  }
  if (f.pannelli.numero > 0 && f.pannelli.kwp > 0) lista.push(impianto('pannelli', f.pannelli.kwp, 'pannelli', true, true));
  const io = soci.some((s) => s.id === f.io) ? f.io : soci[0]?.id ?? null;
  return {
    area: stato.area, soci, impianti: perAnzianita(lista),
    parametri: { ...(stato.parametri ?? {}), fondatori: f.fondatori ?? voce(costanti, 'predefiniti').fondatori },
    io, fondatore: true,
  };
}

// «Io sono» nel modulo «fondare»: quali gruppi non ci sono nella comunità composta (le loro opzioni si disabilitano) e quale
// gruppo usa davvero il calcolo come «io» (quello scelto se c'è, altrimenti il primo). `ids` sono le opzioni del campo.
export function sceltaIo(ingressi, ids) {
  return { io: ingressi.io, disabilitati: ids.filter((id) => !ingressi.soci.some((s) => s.id === id)) };
}

// Cursori del riparto (revisione §10.2): la somma resta entro 100. La parte alla CER è il resto, quindi scende per prima;
// quando è a zero scende l'altro cursore.
export const limitaQuote = (mossa, altra) => (mossa + altra > 100 ? Math.max(0, 100 - mossa) : altra);
