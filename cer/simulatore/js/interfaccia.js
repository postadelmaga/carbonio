// La pagina del simulatore (spec §7): legge i moduli, costruisce gli ingressi, chiama il motore a ogni movimento e
// mostra risultati, grafici, avvisi e ipotesi. Con grafici.js e dati.js è l'unico modulo che tocca il DOM.
import { caricaLocalita, caricaDati } from './dati.js';
import { calcola, valida, asse } from './motore.js';
import { ingressiEntrare, ingressiFondare, sceltaIo, limitaQuote } from './scenari.js';
import { voce } from './economia.js';
import { consumoMedioClasse } from './profili.js';
import { numero, euro, kwh, perc, tonnellate, anni, circa } from './formato.js';
import { giornata, anno, incentivi, vociIncentivi, scenaComunita, tabella, MESI } from './grafici.js';
import { ipotesi, testoScadenza, notaScadenza, testoEccedentaria, testoEccedentariaTe, testoTolti, testoItaliani, testoStimaCo2, testoVentiAnniCo2, testoGiaInEsercizio, testoFondatori } from './testi.js';
import { attivaInfo } from './info.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const form = $('#moduli');
const campo = (nome) => form.elements[nome];
const scelto = (nome) => document.querySelector(`input[name="${nome}"]:checked`)?.value;
const FORMATI = { euro: (v) => euro(v), eur3: (v) => euro(v, 3), euroOppure: (v) => (v == null ? 'da verificare' : euro(v)), perc: (v) => perc(v), t: tonnellate, circa, kwh, anni: (v) => anni(v, voce(dati.costanti, 'durata_tariffa_anni')), int: (v) => numero(v), g: (v) => numero(v, Number.isInteger(v) ? 0 : 1) };
const NOMI = { famiglie: 'Famiglia', pannelli: 'Famiglia con pannelli', pannelli_esistenti: 'Famiglia con pannelli già in esercizio', attivita: 'Attività', enti: 'Ente o associazione', produttore: 'Socio produttore' };
const validi = {};
let elenco = [], loc = null, dati = null, ultimo = null, scena = null, richiestaLocalita = 0, avvisiMostrati = null;

// Valore numerico di un campo: vuoto → predefinito; fuori intervallo → resta segnato e vale l'ultimo valido.
function numeroDi(nome, predefinito) {
  const e = campo(nome);
  if (!e || e.value === '') { e?.removeAttribute('aria-invalid'); return predefinito; }
  const v = Number(e.value);
  if (!e.checkValidity() || !Number.isFinite(v)) { e.setAttribute('aria-invalid', 'true'); return validi[nome] ?? predefinito; }
  e.removeAttribute('aria-invalid');
  return (validi[nome] = v);
}

function parametriEsperto() {
  const quota = (nome) => { const v = numeroDi(nome, null); return v == null ? null : v / 100; };
  return {
    prezzo_zonale: numeroDi('p-pz', null), gestione_eur_anno: numeroDi('p-gestione', null),
    costituzione_eur: numeroDi('p-costituzione', null), quota_associativa: numeroDi('p-quota', null),
    quota_produttore: quota('p-qp'), quota_consumatori: quota('p-qc'), fattore_principale: scelto('p-fattore'),
    manutenzione: numeroDi('p-om', null), prezzo_impianto_eur_w: numeroDi('p-eurw', null),
    costo_evitato: { famiglia: numeroDi('p-ce-famiglia', null), attivita: numeroDi('p-ce-attivita', null), ente: numeroDi('p-ce-ente', null) },
  };
}

function stato() {
  const c = dati.costanti, tipo = voce(c, 'comunita_tipo'), pred = voce(c, 'predefiniti');
  const esperto = scelto('modo') === 'esperto';
  return {
    area: loc.area,
    parametri: esperto ? parametriEsperto() : {},
    utente: {
      ruolo: scelto('ruolo'), tipo: scelto('tipo'), classe: campo('classe').value, consumo: numeroDi('consumo', null),
      archetipo: campo('archetipo').value, kwp: numeroDi('kwp', pred.kwp_prosumer), stato: campo('stato-impianto').value,
      abitudini: esperto ? numeroDi('abitudini-cursore', 0) : Number(scelto('abitudini')),
    },
    comunita: esperto ? {
      famiglie: numeroDi('c-famiglie', tipo.famiglie), attivita: numeroDi('c-attivita', tipo.attivita),
      consumo_attivita: numeroDi('c-consumo-attivita', tipo.consumo_attivita), enti: numeroDi('c-enti', tipo.enti),
      consumo_ente: numeroDi('c-consumo-ente', tipo.consumo_ente), kwp_comune: numeroDi('c-kwp', tipo.kwp_comune),
      abitudini_altri: numeroDi('c-abitudini', 0),
    } : {},
    fondare: {
      famiglie: { numero: numeroDi('f-famiglie', tipo.famiglie), classe: campo('f-famiglie-classe').value, consumo: esperto ? numeroDi('f-famiglie-consumo', null) : null },
      pannelli: { numero: numeroDi('f-pannelli', 0), classe: campo('f-pannelli-classe').value, consumo: null, kwp: numeroDi('f-pannelli-kwp', pred.kwp_prosumer) },
      pannelliEsistenti: esperto
        ? { numero: numeroDi('f-pannelli-es', 0), classe: campo('f-pannelli-es-classe').value, consumo: null, kwp: numeroDi('f-pannelli-es-kwp', pred.kwp_prosumer), stato: campo('f-pannelli-es-stato').value }
        : { numero: 0, classe: '1,5-3', consumo: null, kwp: pred.kwp_prosumer, stato: 'precedente' },
      attivita: { numero: numeroDi('f-attivita', tipo.attivita), archetipo: esperto ? campo('f-attivita-archetipo').value : tipo.archetipo_attivita, consumo: numeroDi('f-attivita-consumo', tipo.consumo_attivita), kwp: esperto ? numeroDi('f-attivita-kwp', 0) : 0 },
      enti: { numero: numeroDi('f-enti', tipo.enti), archetipo: esperto ? campo('f-enti-archetipo').value : tipo.archetipo_ente, consumo: numeroDi('f-enti-consumo', tipo.consumo_ente), kwp: esperto ? numeroDi('f-enti-kwp', 0) : 0 },
      comune: { kwp: numeroDi('f-comune-kwp', tipo.kwp_comune), titolare: campo('f-comune-titolare').value, stato: esperto ? campo('f-comune-stato').value : 'nuovo' },
      fondatori: numeroDi('f-fondatori', pred.fondatori), io: campo('f-io').value, abitudini: numeroDi('f-abitudini', 0),
    },
  };
}

function aggiornaCorpo() {
  const b = document.body.dataset;
  b.modo = scelto('modo'); b.percorso = scelto('percorso'); b.ruolo = scelto('ruolo'); b.tipo = scelto('tipo');
  const esperto = b.modo === 'esperto';
  campo('kwp').max = String(b.ruolo === 'produttore' ? (esperto ? 1000 : 200) : (esperto ? 50 : 20));
  const aiuto = $('#aiuto-esercizio');
  aiuto.textContent = testoGiaInEsercizio(campo('stato-impianto').value);
  aiuto.hidden = aiuto.textContent === '';
}

function aggiornaUscite() {
  campo('kwp-valore').value = `${numero(Number(campo('kwp').value), 1)} kWp`;
  for (const [c, u] of [['abitudini-cursore', 'abitudini-valore'], ['c-abitudini', 'c-abitudini-valore'], ['f-abitudini', 'f-abitudini-valore']]) {
    campo(u).value = perc(Number(campo(c).value));
  }
  campo('p-pz-valore').value = `${numero(Number(campo('p-pz').value), 2)} €/MWh`;
  const qp = Number(campo('p-qp').value), qc = Number(campo('p-qc').value);
  campo('p-qp-valore').value = `${qp}%`;
  campo('p-qc-valore').value = `${qc}%`;
  campo('p-fondo-valore').value = qp + qc <= 100 ? `${100 - qp - qc}%` : 'quote oltre il 100%';
}

// Dati sbagliati di chi usa la pagina: risultati attenuati e un avviso, senza toccare la console.
function segnalaErrore(messaggio) {
  document.body.dataset.nonAggiornato = '';
  mostraAvvisi([{ codice: 'errore', testo: `Controlla i dati: ${messaggio.replace(/(socio|impianto) [^:;]+: /g, '')}` }]);
}

// #avvisi è una regione di stato: si riscrive solo se gli avvisi cambiano, così lo stesso avviso non si ripete a ogni movimento.
function mostraAvvisi(lista) {
  const chiave = lista.map((a) => `${a.codice}:${a.testo}`).join('\n');
  if (chiave === avvisiMostrati) return;
  avvisiMostrati = chiave;
  $('#avvisi').replaceChildren(...lista.map((a) => {
    const p = document.createElement('p');
    p.textContent = a.testo;
    if (a.codice === 'errore') p.className = 'errore';
    return p;
  }));
}

// I grafici e la scena sono disegnati in pixel reali: si ridisegnano con l'ultimo risultato quando cambia la larghezza.
function tracciaGrafici() {
  if (!ultimo) return;
  giornata($('#g-giornata'), ultimo.grafici.giornata, Number($('#mese').value));
  anno($('#g-anno'), ultimo.grafici.mesi);
}

function tracciaScena() {
  if (scena) scenaComunita($('#scena'), scena);
}

function disegnaGrafici() {
  if (!ultimo) return;
  const g = ultimo.grafici, mese = Number($('#mese').value);
  tracciaGrafici();
  incentivi($('#g-incentivi'), g.incentivi);
  const voci = vociIncentivi(g.incentivi), totale = voci.reduce((s, v) => s + v.valore, 0);
  tabella($('#t-incentivi'), ['Voce', 'Euro l\'anno', 'Quota'], voci.map((v) => [v.nome, euro(v.valore), perc(totale > 0 ? v.valore / totale : NaN)]));
  const chiavi = ['produzione', 'consumo', 'condivisa'];
  tabella($('#t-giornata'), ['Ora', 'Produzione, kWh', 'Consumi, kWh', 'Condivisa, kWh'],
    Array.from({ length: 24 }, (_, h) => [`${h}-${h + 1}`, ...chiavi.map((k) => numero(g.giornata[k][mese][h], 1))]));
  tabella($('#t-anno'), ['Mese', 'Produzione', 'Consumi', 'Condivisa'], MESI.map((m, i) => [m, ...chiavi.map((k) => kwh(g.mesi[k][i]))]));
}

function disegnaScena(ingressi) {
  const n = (id) => ingressi.soci.find((s) => s.id === id)?.numero ?? 0;
  const comune = ingressi.impianti.find((k) => k.id === 'comune')?.kwp ?? 0;
  scena = { tu: true, famiglie: n('famiglie'), attivita: n('attivita'), enti: n('enti'), kwp: comune };
  tracciaScena();
  $('#descrizione-comunita').textContent = comune > 0
    ? `Intorno a te: ${n('famiglie')} ${n('famiglie') === 1 ? 'famiglia' : 'famiglie'}, ${n('attivita')} attività, ${n('enti')} ${n('enti') === 1 ? 'ente' : 'enti'} e un impianto da ${numero(comune, 1)} kWp di un socio produttore. I consumi di attività ed enti sono illustrativi.`
    : `Intorno a te: ${n('famiglie')} ${n('famiglie') === 1 ? 'famiglia' : 'famiglie'}, ${n('attivita')} attività, ${n('enti')} ${n('enti') === 1 ? 'ente' : 'enti'}, nessun impianto comune.`;
}

function tabellaRuoli(r) {
  const righe = Object.entries(r.membri).map(([id, m]) => [NOMI[id] ?? id, numero(m.numero), euro(m.totale), euro(m.cerAggiunge), perc(m.co2.copertura)]);
  tabella($('#tabella-ruoli'), ['Socio', 'Quanti', 'Ciascuno, l\'anno', 'Di cui dalla CER', 'Consumi coperti'], righe);
}

function aggiornaAiuto(s) {
  const a = $('#aiuto-consumo');
  if (s.utente.tipo === 'famiglia') {
    const medio = consumoMedioClasse(dati.forme, s.utente.classe, asse());
    a.textContent = `Facoltativo. Se lo lasci vuoto usiamo la media ARERA dei residenti in ${loc.regione} con questo contatore: ${kwh(medio)} l'anno.`;
    campo('consumo').placeholder = numero(medio);
  } else {
    a.textContent = 'Lo trovi in bolletta. Serve per il calcolo: ogni attività è diversa, e non c\'è un valore tipico.';
    campo('consumo').placeholder = 'es. 10000';
  }
}

// «Io sono»: i gruppi che nella comunità composta non ci sono si disabilitano, e la scelta passa al gruppo che il calcolo usa.
function sincronizzaIo(ingressi) {
  const selezione = campo('f-io');
  const { io, disabilitati } = sceltaIo(ingressi, [...selezione.options].map((o) => o.value));
  for (const o of selezione.options) o.disabled = disabilitati.includes(o.value);
  if (selezione.value !== (io ?? '')) selezione.value = io ?? '';
}

function mostra(r, percorso, ingressi) {
  const te = r.perTe ?? {}, com = r.comunita, em = r.emissioni.comunita, p = r.parametri, b = document.body.dataset;
  // tre attributi distinti: chi ha un impianto, chi lo deve ancora pagare, chi ha solo impianti già in esercizio
  if (te.haImpianto) b.impianto = ''; else delete b.impianto;
  if (te.investimento > 0) b.investimento = ''; else delete b.investimento;
  if (te.soloGiaInEsercizio) b.pagato = ''; else delete b.pagato;
  if (percorso === 'fondare') b.fondatore = ''; else delete b.fondatore;
  // senza consumi (il socio produttore) la riga dei prelievi non ha senso
  if (te.consumo > 0) b.consumo = ''; else delete b.consumo;
  // il riquadro dell'impianto della CER c'è con ogni impianto della CER; l'investimento da finanziare solo se uno è nuovo
  if (com.haImpiantoCer) b.impiantoCer = ''; else delete b.impiantoCer;
  if (com.investimentoCer > 0) b.investimentoCer = ''; else delete b.investimentoCer;
  // la nota sulla scadenza va a chi ha un impianto nuovo in «entrare»; in «fondare» la frase sta nel passo «Tu e i fondatori»
  const vista = {
    te: { ...te, notaScadenza: notaScadenza(percorso === 'entrare' && te.haImpianto && !te.soloGiaInEsercizio, new Date(), dati.costanti), eccedentariaTesto: testoEccedentariaTe(te.voci?.quotaEccedentaria) },
    emissioni: {
      ...em,
      stimaTesto: testoStimaCo2(r.emissioni.principale, em.evitataAltra, dati.costanti),
      paragrafoCo2: [testoItaliani(em.italiani, voce(dati.costanti, 'co2_pro_capite')), testoVentiAnniCo2(r.emissioni.principale, em.ventiAnni, dati.costanti)].filter(Boolean).join(' '),
      giaInEsercizioTesto: em.giaInEsercizio > 0 ? `Gli impianti già in esercizio evitano, con la stessa ipotesi, altre ${circa(em.giaInEsercizio)} l'anno: non le attribuiamo alla CER.` : '',
    },
    com: { ...com, incentivi: com.tariffa + com.contributo, frazioneCer: 1 - p.quota_produttore - p.quota_consumatori, eccedentariaTesto: testoEccedentaria(com), toltiTesto: testoTolti(com), costituzione: p.costituzione_eur, fondatoriTesto: testoFondatori(p.costituzione_eur) },
    cost: {
      g1990: voce(dati.costanti, 'fattore_co2_1990')['1990'],
      g2024: voce(dati.costanti, 'fattore_co2_1990')['2024'],
      anni: voce(dati.costanti, 'durata_tariffa_anni'),
      fattore: voce(dati.costanti, 'fattore_co2'),
      fattoreFossili: voce(dati.costanti, 'fattore_co2_fossili'),
      scadenza: voce(dati.costanti, 'scadenza_esercizio').split('-').reverse().join('/'),
      budget: voce(dati.costanti, 'budget_1_5'),
    },
  };
  for (const e of $$('[data-r]')) {
    const v = e.dataset.r.split('.').reduce((o, k) => o?.[k], vista);
    // si scrive solo se il testo cambia: input e change rifanno entrambi il calcolo, e la regione viva annuncerebbe il totale due volte
    const t = String(e.dataset.f ? FORMATI[e.dataset.f](v) : (v ?? ''));
    if (e.textContent !== t) e.textContent = t;
  }
  mostraAvvisi(r.avvisi);
  disegnaGrafici();
  $('#ipotesi').replaceChildren(...ipotesi(r, loc, dati.pvInfo, dati.costanti).map((t) => Object.assign(document.createElement('li'), { textContent: t })));
  $('#scadenza').textContent = testoScadenza(new Date(), dati.costanti);
  if (percorso === 'entrare') disegnaScena(ingressi); else tabellaRuoli(r);
}

function aggiorna() {
  if (!dati) return;
  aggiornaCorpo();
  aggiornaUscite();
  const s = stato(), percorso = scelto('percorso');
  aggiornaAiuto(s);
  if (percorso === 'entrare' && s.utente.ruolo !== 'produttore' && s.utente.tipo !== 'famiglia' && s.utente.consumo == null) {
    document.body.dataset.nonAggiornato = '';
    mostraAvvisi([{ codice: 'consumo_mancante', testo: 'Per un\'attività o un ente serve il consumo annuo: lo trovi in bolletta.' }]);
    return;
  }
  try {
    const ingressi = percorso === 'entrare' ? ingressiEntrare(s, dati.costanti) : ingressiFondare(s, dati.costanti);
    if (percorso === 'fondare') sincronizzaIo(ingressi);
    const errori = valida(ingressi, dati.costanti);
    if (errori.length) { segnalaErrore(errori.join('; ')); return; }
    const t0 = performance.now();
    ultimo = calcola(ingressi, dati);
    document.body.dataset.ms = String(Math.round(performance.now() - t0));
    delete document.body.dataset.nonAggiornato;
    mostra(ultimo, percorso, ingressi);
  } catch (e) {
    console.error(e);
    segnalaErrore(e.message);
  }
}

function preimposta() {
  const c = dati.costanti, tipo = voce(c, 'comunita_tipo'), pred = voce(c, 'predefiniti'), q = voce(c, 'quote_riparto');
  const valori = {
    'c-famiglie': tipo.famiglie, 'c-attivita': tipo.attivita, 'c-consumo-attivita': tipo.consumo_attivita, 'c-enti': tipo.enti,
    'c-consumo-ente': tipo.consumo_ente, 'c-kwp': tipo.kwp_comune, 'f-famiglie': tipo.famiglie, 'f-pannelli': 0,
    'f-pannelli-kwp': pred.kwp_prosumer, 'f-pannelli-es': 0, 'f-pannelli-es-kwp': pred.kwp_prosumer, 'f-attivita': tipo.attivita, 'f-attivita-consumo': tipo.consumo_attivita, 'f-attivita-kwp': 0,
    'f-enti': tipo.enti, 'f-enti-consumo': tipo.consumo_ente, 'f-enti-kwp': 0, 'f-comune-kwp': tipo.kwp_comune,
    'f-fondatori': pred.fondatori, 'p-pz': voce(c, 'prezzo_zonale'), 'p-gestione': voce(c, 'gestione'),
    'p-quota': voce(c, 'quota_associativa'), 'p-qp': q.produttore * 100, 'p-qc': q.consumatori * 100, 'p-om': voce(c, 'manutenzione'),
    kwp: pred.kwp_prosumer,
  };
  for (const [nome, v] of Object.entries(valori)) campo(nome).value = String(v);
  const costituzione = voce(c, 'costituzione');
  campo('p-costituzione').value = costituzione == null ? '' : String(costituzione);
  campo('p-costituzione').placeholder = costituzione == null ? 'da verificare' : '';
}

async function scegliLocalita(etichetta) {
  const trovata = elenco.find((l) => `${l.nome} (${l.sigla})` === etichetta);
  if (!trovata) { campo('localita').setAttribute('aria-invalid', 'true'); return; }
  campo('localita').removeAttribute('aria-invalid');
  const mia = ++richiestaLocalita;
  $('#info-localita').textContent = 'Carico i dati…';
  try {
    const nuovi = await caricaDati(trovata);
    if (mia !== richiestaLocalita) return;
    const primo = dati == null;
    dati = nuovi; loc = trovata;
    campo('localita').value = `${loc.nome} (${loc.sigla})`;
    campo('localita').removeAttribute('aria-invalid');
    if (primo) preimposta();
    const resa = dati.pv.reduce((s, v) => s + v, 0) / 1000;
    $('#info-localita').textContent = `${trovata.regione}: ${numero(resa)} kWh per kWp l'anno (PVGIS, ${dati.pvInfo.anno_meteo}), pannelli a sud inclinati di ${numero(dati.pvInfo.inclinazione)}°.`;
    aggiorna();
  } catch (e) {
    console.error(e);
    if (mia !== richiestaLocalita) return;
    if (loc) campo('localita').value = `${loc.nome} (${loc.sigla})`;
    const bottone = Object.assign(document.createElement('button'), { type: 'button', className: 'btn', textContent: 'Riprova' });
    bottone.addEventListener('click', () => scegliLocalita(etichetta));
    $('#info-localita').replaceChildren(`Non riesco a caricare i dati di ${trovata.nome}. `, bottone);
  }
}

// Quando cambia la larghezza di un grafico o della scena si ridisegna (senza rifare il calcolo), una volta per fotogramma.
function osservaLarghezze() {
  if (typeof ResizeObserver !== 'function') return;
  const larghezze = new Map();
  let atteso = false;
  const ridisegna = () => { atteso = false; tracciaGrafici(); tracciaScena(); };
  const osservatore = new ResizeObserver((voci) => {
    let cambiata = false;
    for (const v of voci) {
      const w = Math.round(v.contentRect.width);
      if (w > 0 && larghezze.get(v.target) !== w) { larghezze.set(v.target, w); cambiata = true; }
    }
    if (cambiata && !atteso) { atteso = true; requestAnimationFrame(ridisegna); }
  });
  for (const e of $$('#g-giornata, #g-anno, #scena')) osservatore.observe(e);
}

async function avvia() {
  try {
    elenco = (await caricaLocalita()).localita;
  } catch (e) {
    console.error(e);
    $('#avvisi').textContent = 'Non riesco a caricare l\'elenco delle località: ricarica la pagina.';
    return;
  }
  $('#elenco-localita').replaceChildren(...elenco.map((l) => new Option(`${l.nome} (${l.sigla})`)));
  $('#mese').replaceChildren(...MESI.map((m, i) => new Option(m, String(i), i === 6, i === 6)));
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('input', (e) => {
    if (e.target.name === 'p-qp' || e.target.name === 'p-qc') {
      const altro = campo(e.target.name === 'p-qp' ? 'p-qc' : 'p-qp');
      altro.value = String(limitaQuote(Number(e.target.value), Number(altro.value)));
    }
    if (e.target.name !== 'localita') aggiorna();
  });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'localita') { scegliLocalita(e.target.value); return; }
    if (e.target.name === 'ruolo' && dati) {
      const pred = voce(dati.costanti, 'predefiniti');
      aggiornaCorpo();
      campo('kwp').value = String(e.target.value === 'produttore' ? pred.kwp_produttore : pred.kwp_prosumer);
    }
    aggiorna();
  });
  for (const r of $$('input[name="modo"]')) r.addEventListener('change', aggiorna);
  $('#mese').addEventListener('change', disegnaGrafici);
  osservaLarghezze();
  $('#info-esercizio').textContent = testoGiaInEsercizio('esistente');
  attivaInfo(document);
  $('#ripristina').addEventListener('click', () => {
    if (!dati) return;
    form.reset();
    preimposta();
    campo('localita').value = `${loc.nome} (${loc.sigla})`;
    aggiorna();
  });
  await scegliLocalita('La Spezia (SP)');
}

avvia();
