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

// Le voci dei select delle righe, per le etichette (spec della composizione §11.4): uguali al testo delle option.
export const CONTATORI = { '1,5-3': '3 kW', '3-4,5': '4,5 kW', '4,5-6': '6 kW', oltre_6: 'oltre 6 kW' };
export const TIPI = { com_orario_apertura: 'con orario', com_carico_base: 'carico continuo' };
const DATE_ESERCIZIO = { precedente: 'dopo il 15/12/2021', esistente: 'fino al 15/12/2021' };

// La chiave di una riga (spec della composizione §11.1): i valori che il calcolo conta, tranne quanti sono; lo stato
// conta solo con dei kWp.
export const chiaveRiga = (r) => JSON.stringify([r.classe ?? null, r.archetipo ?? null, r.kwp, r.consumo ?? null, r.kwp > 0 ? r.stato ?? 'nuovo' : null]);

// Le righe uguali a una riga precedente dello stesso profilo (§11.1): `{ [idRiga]: idPrimaRigaUguale }`. Le righe con
// 0 membri, che non entrano nel calcolo, non si confrontano. `fondare` è stato().fondare.
export function righeUguali(fondare) {
  const uguali = {};
  for (const profilo of Object.keys(PROFILI)) {
    const prime = new Map();
    for (const r of fondare[profilo] ?? []) {
      if (!(r.numero > 0)) continue;
      const k = chiaveRiga(r);
      if (prime.has(k)) uguali[r.riga] = prime.get(k); else prime.set(k, r.riga);
    }
  }
  return uguali;
}

// I parametri che possono distinguere due righe con la stessa etichetta (§11.4), in quest'ordine: contatore o
// tipo, consumo, data dell'esercizio; null se la riga non ne ha.
const parametri = (profilo, r) => [
  profilo === 'famiglie' ? (r.classe != null ? `contatore ${CONTATORI[r.classe]}` : null) : (r.archetipo != null ? TIPI[r.archetipo] : null),
  r.consumo != null ? `${numero(r.consumo)} kWh l'anno` : (profilo === 'famiglie' ? 'consumo medio' : null),
  r.kwp > 0 ? DATE_ESERCIZIO[r.stato] ?? null : null,
];

// Le etichette di un gruppo di righe con la stessa etichetta di base (`tipo` è 'io' o 'socio'): ognuna aggiunge i
// parametri che non sono uguali in tutto il gruppo; se due restano uguali, la seconda aggiunge la sua posizione.
function distingui(gruppo, tipo) {
  const variano = [0, 1, 2].filter((k) => new Set(gruppo.map((r) => r.parametri[k])).size > 1);
  const viste = new Set();
  return gruppo.map((r) => {
    let testo = [r[tipo], ...variano.map((k) => r.parametri[k]).filter(Boolean)].join(', ');
    if (viste.has(testo)) testo += ` (${ORDINALI[r.i]} riga)`; else viste.add(testo);
    return testo;
  });
}

// Le etichette delle righe di «fondare» (spec della composizione §4 e §11.4): `io` per «Io sono», `socio` per la tabella
// dei soci. La base è fatta da quanti sono e dai kWp; le righe con la stessa base, contate a parte per `io` e per
// `socio`, aggiungono i parametri che le distinguono. Le righe con 0 membri non hanno etichetta. `fondare` è
// stato().fondare.
export function etichetteRighe(fondare) {
  const etichette = {};
  for (const [profilo, p] of Object.entries(PROFILI)) {
    const righe = [];
    (fondare[profilo] ?? []).forEach((r, i) => {
      if (!(r.numero > 0)) return;
      const pannelli = r.kwp > 0 ? `con ${kwpTesto(r.kwp)} kWp${(r.stato ?? 'nuovo') !== 'nuovo' ? ' già in esercizio' : ''}` : 'senza pannelli';
      righe.push({ id: r.riga, i, parametri: parametri(profilo, r), io: `${r.numero === 1 ? p.uno : p.alcuni(numero(r.numero))} ${pannelli}`, socio: `${p.titolo} ${pannelli}` });
    });
    for (const tipo of ['io', 'socio']) {
      const gruppi = new Map();
      for (const r of righe) gruppi.set(r[tipo], [...(gruppi.get(r[tipo]) ?? []), r]);
      for (const gruppo of gruppi.values()) {
        distingui(gruppo, tipo).forEach((testo, k) => { etichette[gruppo[k].id] = { ...etichette[gruppo[k].id], [tipo]: testo }; });
      }
    }
  }
  return etichette;
}

// Le voci di «Io sono» (spec della composizione §4): i soci che entrano nel calcolo, nell'ordine degli ingressi.
export const opzioniIo = (ingressi, etichette) => ingressi.soci.map((s) => ({ valore: s.id, testo: etichette[s.id]?.io ?? 'il socio produttore' }));

// Cursori del riparto (revisione §10.2): la somma resta entro 100. La parte alla CER è il resto, quindi scende per prima;
// quando è a zero scende l'altro cursore.
export const limitaQuote = (mossa, altra) => (mossa + altra > 100 ? Math.max(0, 100 - mossa) : altra);
