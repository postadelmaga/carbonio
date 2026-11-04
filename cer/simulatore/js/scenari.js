// Dallo stato dei moduli agli ingressi del motore (spec §7.1-§7.2). «Voglio entrare»: l'utente dentro la comunità
// tipo di costanti.json. «Voglio fondarne una»: la comunità composta dall'utente. L'ordine degli impianti è
// l'anzianità: prima gli esistenti, poi l'impianto comune, poi gli altri.
import { voce } from './economia.js';

const famiglia = (id, numero, classe, consumo, spostamento) => ({ id, tipo: 'famiglia', numero, classe_potenza: classe, consumo_kwh_anno: consumo ?? null, spostamento: spostamento ?? 0 });
const altro = (id, tipo, numero, archetipo, consumo) => ({ id, tipo, numero, archetipo, consumo_kwh_anno: consumo ?? null, spostamento: 0 });
const impianto = (id, kwp, titolare, sulPod, perOgni, esistente) => ({ id, kwp, titolare, sul_pod_del_titolare: sulPod, per_ogni_membro: perOgni, stato: esistente ? 'precedente' : 'nuovo' });

export function ingressiEntrare(stato, costanti) {
  const u = stato.utente;
  const cm = { ...voce(costanti, 'comunita_tipo'), ...Object.fromEntries(Object.entries(stato.comunita ?? {}).filter(([, v]) => v != null)) };
  const io = u.tipo === 'famiglia'
    ? famiglia('io', 1, u.classe, u.consumo, u.abitudini)
    : altro('io', u.tipo, 1, u.archetipo, u.consumo);
  const soci = [io];
  if (cm.famiglie > 0) soci.push(famiglia('famiglie', cm.famiglie, cm.classe, cm.consumo_famiglie, cm.abitudini_altri));
  if (cm.attivita > 0) soci.push(altro('attivita', 'attivita', cm.attivita, cm.archetipo_attivita, cm.consumo_attivita));
  if (cm.enti > 0) soci.push(altro('enti', 'ente', cm.enti, cm.archetipo_ente, cm.consumo_ente));
  const impianti = [];
  const tuo = u.ruolo === 'prosumer' || u.ruolo === 'produttore' ? impianto('tuo', u.kwp, 'io', u.ruolo === 'prosumer', false, u.esistente) : null;
  if (tuo && tuo.stato !== 'nuovo') impianti.push(tuo);
  if (cm.kwp_comune > 0) {
    soci.push(altro('produttore', 'attivita', 1, 'com_orario_apertura', 0));
    impianti.push(impianto('comune', cm.kwp_comune, 'produttore', false, false, false));
  }
  if (tuo && tuo.stato === 'nuovo') impianti.push(tuo);
  return { area: stato.area, soci, impianti, parametri: stato.parametri ?? {}, io: 'io', fondatore: false };
}

export function ingressiFondare(stato, costanti) {
  const f = stato.fondare;
  const soci = [], esistenti = [], nuovi = [];
  if (f.famiglie.numero > 0) soci.push(famiglia('famiglie', f.famiglie.numero, f.famiglie.classe, f.famiglie.consumo, f.abitudini));
  if (f.pannelli.numero > 0) {
    soci.push(famiglia('pannelli', f.pannelli.numero, f.pannelli.classe, f.pannelli.consumo, f.abitudini));
  }
  for (const [id, tipo] of [['attivita', 'attivita'], ['enti', 'ente']]) {
    if (f[id].numero > 0) soci.push(altro(id, tipo, f[id].numero, f[id].archetipo, f[id].consumo));
  }
  if (f.comune.kwp > 0) {
    if (f.comune.titolare === 'produttore') soci.push(altro('produttore', 'attivita', 1, 'com_orario_apertura', 0));
    const k = impianto('comune', f.comune.kwp, f.comune.titolare === 'cer' ? 'cer' : 'produttore', false, false, f.comune.esistente);
    (k.stato !== 'nuovo' ? esistenti : nuovi).push(k);
  }
  for (const id of ['attivita', 'enti']) {
    if (f[id].numero > 0 && f[id].kwp > 0) nuovi.push(impianto(id, f[id].kwp, id, true, true, false));
  }
  if (f.pannelli.numero > 0 && f.pannelli.kwp > 0) {
    (f.pannelli.esistenti ? esistenti : nuovi).push(impianto('pannelli', f.pannelli.kwp, 'pannelli', true, true, f.pannelli.esistenti));
  }
  const io = soci.some((s) => s.id === f.io) ? f.io : soci[0]?.id ?? null;
  return {
    area: stato.area, soci, impianti: [...esistenti, ...nuovi],
    parametri: { ...(stato.parametri ?? {}), fondatori: f.fondatori ?? voce(costanti, 'predefiniti').fondatori },
    io, fondatore: true,
  };
}

// «Io sono» nel modulo «fondare»: quali gruppi non ci sono nella comunità composta (le loro opzioni si disabilitano) e quale
// gruppo usa davvero il calcolo come «io» (quello scelto se c'è, altrimenti il primo). `ids` sono le opzioni del campo.
export function sceltaIo(ingressi, ids) {
  return { io: ingressi.io, disabilitati: ids.filter((id) => !ingressi.soci.some((s) => s.id === id)) };
}
