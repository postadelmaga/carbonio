// Dallo stato dei moduli agli ingressi del motore (spec §7.1-§7.2). «Voglio entrare»: l'utente dentro la comunità
// tipo di costanti.json. «Voglio fondarne una»: la comunità composta dall'utente, a righe (spec della composizione,
// 10/11/2026). L'ordine degli impianti è l'anzianità: prima gli esistenti fino al 15/12/2021, poi i precedenti, poi i
// nuovi; dentro ogni stato l'ordine del modulo, salvo l'impianto comune nuovo, primo fra i nuovi.
import { voce } from './economia.js';
import { numero } from './formato.js';
const RANGO = { esistente: 0, precedente: 1, nuovo: 2 };
const primoFraUguali = (k) => (k.id === 'comune' && k.stato === 'nuovo' ? 0 : 1);
const perAnzianita = (lista) => lista.map((k, i) => [k, i])
  .sort((a, b) => RANGO[a[0].stato] - RANGO[b[0].stato] || primoFraUguali(a[0]) - primoFraUguali(b[0]) || a[1] - b[1])
  .map(([k]) => k);
const famiglia = (id, numero, classe, consumo, spostamento) => ({ id, tipo: 'famiglia', numero, classe_potenza: classe, consumo_kwh_anno: consumo ?? null, spostamento: spostamento ?? 0 });
const altro = (id, tipo, numero, archetipo, consumo) => ({ id, tipo, numero, archetipo, consumo_kwh_anno: consumo ?? null, spostamento: 0 });
const impianto = (id, kwp, titolare, sulPod, perOgni, stato = 'nuovo') => ({ id, kwp, titolare, sul_pod_del_titolare: sulPod, per_ogni_membro: perOgni, stato });

// I tre profili delle righe di «fondare», nell'ordine del modulo: il tipo del socio e le parole delle etichette.
export const PROFILI = {
  famiglie: { tipo: 'famiglia', titolo: 'Famiglie', uno: 'la famiglia', alcuni: (n) => `una delle ${n} famiglie` },
  attivita: { tipo: 'attivita', titolo: 'Attività', uno: 'l\'attività', alcuni: (n) => `una delle ${n} attività` },
  enti: { tipo: 'ente', titolo: 'Enti e associazioni', uno: 'l\'ente', alcuni: (n) => `uno dei ${n} enti` },
};

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

// `stato.fondare`: per ogni profilo una lista di righe { riga, numero, kwp, stato, classe | archetipo, consumo }, più
// comune, fondatori, io e abitudini. Ogni riga con membri è un gruppo con l'id della riga; con dei kWp, il gruppo ha un
// impianto per membro, sul suo POD, con lo stato della riga.
export function ingressiFondare(stato, costanti) {
  const f = stato.fondare;
  const soci = [], lista = [];
  for (const [profilo, { tipo }] of Object.entries(PROFILI)) {
    for (const r of f[profilo] ?? []) {
      if (!(r.numero > 0)) continue;
      soci.push(tipo === 'famiglia'
        ? famiglia(r.riga, r.numero, r.classe, r.consumo, f.abitudini)
        : altro(r.riga, tipo, r.numero, r.archetipo, r.consumo));
      if (r.kwp > 0) lista.push(impianto(r.riga, r.kwp, r.riga, true, true, r.stato ?? 'nuovo'));
    }
  }
  if (f.comune.kwp > 0) {
    if (f.comune.titolare === 'produttore') soci.push(altro('produttore', 'attivita', 1, 'com_orario_apertura', 0));
    lista.push(impianto('comune', f.comune.kwp, f.comune.titolare === 'cer' ? 'cer' : 'produttore', false, false, f.comune.stato ?? 'nuovo'));
  }
  const io = soci.some((s) => s.id === f.io) ? f.io : soci[0]?.id ?? null;
  return {
    area: stato.area, soci, impianti: perAnzianita(lista),
    parametri: { ...(stato.parametri ?? {}), fondatori: f.fondatori ?? voce(costanti, 'predefiniti').fondatori },
    io, fondatore: true,
  };
}

const ORDINALI = ['prima', 'seconda', 'terza', 'quarta', 'quinta'];
const kwpTesto = (kwp) => numero(kwp, Number.isInteger(kwp) ? 0 : 1);

// Le etichette delle righe di «fondare» (spec della composizione §4): `io` per «Io sono», `socio` per la tabella dei soci.
// Sono fatte dal contenuto della riga; se una riga ha la stessa etichetta di una riga prima di lei nello stesso profilo,
// aggiunge la sua posizione, «(seconda riga)», in ciascuna delle due etichette per conto suo. `fondare` è stato().fondare.
export function etichetteRighe(fondare) {
  const etichette = {};
  for (const [profilo, p] of Object.entries(PROFILI)) {
    const visteIo = new Set(), visteSocio = new Set();
    (fondare[profilo] ?? []).forEach((r, i) => {
      const pannelli = r.kwp > 0 ? `con ${kwpTesto(r.kwp)} kWp${(r.stato ?? 'nuovo') !== 'nuovo' ? ' già in esercizio' : ''}` : 'senza pannelli';
      const posizione = ` (${ORDINALI[i]} riga)`;
      let io = `${r.numero === 1 ? p.uno : p.alcuni(numero(r.numero))} ${pannelli}`, socio = `${p.titolo} ${pannelli}`;
      if (visteIo.has(io)) io += posizione; else visteIo.add(io);
      if (visteSocio.has(socio)) socio += posizione; else visteSocio.add(socio);
      etichette[r.riga] = { io, socio };
    });
  }
  return etichette;
}

// Le voci di «Io sono» (spec della composizione §4): i soci che entrano nel calcolo, nell'ordine degli ingressi.
export const opzioniIo = (ingressi, etichette) => ingressi.soci.map((s) => ({ valore: s.id, testo: etichette[s.id]?.io ?? 'il socio produttore' }));

// Cursori del riparto (revisione §10.2): la somma resta entro 100. La parte alla CER è il resto, quindi scende per prima;
// quando è a zero scende l'altro cursore.
export const limitaQuote = (mossa, altra) => (mossa + altra > 100 ? Math.max(0, 100 - mossa) : altra);
