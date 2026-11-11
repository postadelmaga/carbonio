// La pagina del simulatore (spec §7): legge i moduli, costruisce gli ingressi, chiama il motore a ogni movimento e
// mostra risultati, grafici, avvisi e ipotesi. Con grafici.js e dati.js è l'unico modulo che tocca il DOM.
import { caricaLocalita, caricaDati } from './dati.js';
import { calcola, valida, asse } from './motore.js';
import { ingressiEntrare, ingressiFondare, etichetteRighe, opzioniIo, righeUguali, PROFILI, limitaQuote } from './scenari.js';
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
const validi = new WeakMap();
// Valore numerico di un campo: vuoto → predefinito; fuori intervallo → resta segnato e vale l'ultimo valido.
function numeroElemento(e, predefinito) {
  if (!e || e.value === '') { e?.removeAttribute('aria-invalid'); return predefinito; }
  const v = Number(e.value);
  if (!e.checkValidity() || !Number.isFinite(v)) { e.setAttribute('aria-invalid', 'true'); return validi.get(e) ?? predefinito; }
  e.removeAttribute('aria-invalid');
  validi.set(e, v);
  return v;
}
const numeroDi = (nome, predefinito) => numeroElemento(campo(nome), predefinito);
let elenco = [], loc = null, dati = null, ultimo = null, scena = null, richiestaLocalita = 0, avvisiMostrati = null;

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
      archetipo: campo('archetipo').value, kwp: numeroDi('kwp', pred.kwp_prosumer), stato: esperto ? campo('stato-impianto').value : 'nuovo',
      abitudini: esperto ? numeroDi('abitudini-cursore', 0) : Number(scelto('abitudini')),
    },
    comunita: esperto ? {
      famiglie: numeroDi('c-famiglie', tipo.famiglie), attivita: numeroDi('c-attivita', tipo.attivita),
      consumo_attivita: numeroDi('c-consumo-attivita', tipo.consumo_attivita), enti: numeroDi('c-enti', tipo.enti),
      consumo_ente: numeroDi('c-consumo-ente', tipo.consumo_ente), kwp_comune: numeroDi('c-kwp', tipo.kwp_comune),
      abitudini_altri: numeroDi('c-abitudini', 0),
    } : {},
    fondare: {
      famiglie: righeDi('famiglie', esperto), attivita: righeDi('attivita', esperto), enti: righeDi('enti', esperto),
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
  aiuto.textContent = testoGiaInEsercizio(esperto ? campo('stato-impianto').value : 'nuovo');
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

// Righe di «fondare» (spec della composizione §2-§3): da una a cinque per profilo, ciascuna con un id che non torna
// indietro, così «Io sono» resta sulla sua riga quando se ne toglie un'altra. I campi numerici ricordano il loro
// predefinito in data-predefinito: vuoto vale quello, come i campi con nome.
const MAX_RIGHE = 5;
const contatori = { famiglie: 0, attivita: 0, enti: 0 };

function predefinitaRiga(profilo, prima) {
  const tipo = voce(dati.costanti, 'comunita_tipo'), pred = voce(dati.costanti, 'predefiniti');
  if (profilo === 'famiglie') return { numero: prima ? tipo.famiglie : 1, kwp: prima ? 0 : pred.kwp_prosumer, classe: tipo.classe, consumo: '', stato: 'nuovo' };
  // la riga nuova di attività ed enti ha i pannelli del produttore, così nasce diversa dalla prima (spec della composizione §11.3)
  if (profilo === 'attivita') return { numero: prima ? tipo.attivita : 1, consumo: tipo.consumo_attivita, kwp: prima ? 0 : pred.kwp_produttore, archetipo: tipo.archetipo_attivita, stato: 'nuovo' };
  return { numero: prima ? tipo.enti : 1, consumo: tipo.consumo_ente, kwp: prima ? 0 : pred.kwp_produttore, archetipo: tipo.archetipo_ente, stato: 'nuovo' };
}

function numeraRighe(profilo) {
  const blocco = $(`[data-profilo="${profilo}"]`), righe = [...blocco.querySelectorAll('.riga')];
  righe.forEach((r, i) => { r.setAttribute('aria-label', `${PROFILI[profilo].titolo}, riga ${i + 1}`); r.querySelector('.togli').hidden = i === 0; });
  const piena = righe.length >= MAX_RIGHE;
  blocco.querySelector('[data-aggiungi]').disabled = piena;
  blocco.querySelector('.limite').hidden = !piena;
}

function aggiungiRiga(profilo, valori) {
  const riga = $(`#modello-${profilo}`).content.firstElementChild.cloneNode(true);
  riga.dataset.riga = `${profilo}-${++contatori[profilo]}`;
  for (const [c, v] of Object.entries(valori)) {
    const e = riga.querySelector(`[data-campo="${c}"]`);
    e.value = String(v);
    if (e.type === 'number') e.dataset.predefinito = String(v);
  }
  $(`[data-profilo="${profilo}"] .righe-profilo`).append(riga);
  numeraRighe(profilo);
  return riga;
}

// All'avvio e con «Torna ai valori predefiniti»: una riga per profilo, con i valori della comunità tipo.
function preparaRighe() {
  for (const profilo of Object.keys(PROFILI)) {
    $(`[data-profilo="${profilo}"] .righe-profilo`).replaceChildren();
    contatori[profilo] = 0;
    aggiungiRiga(profilo, predefinitaRiga(profilo, true));
  }
}

// «L'impianto è» di una riga conta solo con dei kWp: senza, si disabilita. I kWp sono quelli che conta il calcolo
// (righeDi): un campo vuoto vale il predefinito, uno non valido l'ultimo valore valido. Una riga uguale a una
// precedente ha l'avviso con «Unisci», che nomina i campi visibili nella modalità (spec della composizione §11.2).
const CAMPI_UGUALI = {
  famiglie: { semplice: 'i kWp', esperto: 'contatore, kWp o kWh l\'anno' },
  altri: { semplice: 'kWp o kWh l\'anno', esperto: 'tipo, kWp o kWh l\'anno' },
};

function aggiornaRighe(fondare) {
  const conImpianto = new Set(Object.keys(PROFILI).flatMap((p) => fondare[p].filter((r) => r.kwp > 0).map((r) => r.riga)));
  const uguali = righeUguali(fondare), modo = scelto('modo');
  const membri = Object.fromEntries(Object.keys(PROFILI).flatMap((p) => fondare[p].map((r) => [r.riga, r.numero])));
  for (const r of $$('[data-profilo] .riga')) {
    r.querySelector('[data-campo="stato"]').disabled = !conImpianto.has(r.dataset.riga);
    const avviso = r.querySelector('.uguale'), verso = uguali[r.dataset.riga];
    avviso.hidden = !verso;
    if (!verso) continue;
    const profilo = r.closest('[data-profilo]').dataset.profilo;
    const n = $$(`[data-profilo="${profilo}"] .riga`).findIndex((x) => x.dataset.riga === verso) + 1;
    const testo = `Questa riga è uguale alla riga ${n}: cambia ${CAMPI_UGUALI[profilo === 'famiglie' ? 'famiglie' : 'altri'][modo]}, oppure`;
    const span = avviso.querySelector('span'), pulsante = avviso.querySelector('[data-unisci]');
    // si scrive solo se il testo cambia: l'avviso è una regione viva
    if (span.textContent !== testo) span.textContent = testo;
    if (pulsante.textContent !== `Unisci alla riga ${n}`) pulsante.textContent = `Unisci alla riga ${n}`;
    pulsante.dataset.unisci = verso;
    // oltre il massimo di «quante» il calcolo terrebbe l'ultimo valore valido, e i membri della riga tolta sparirebbero
    pulsante.disabled = membri[r.dataset.riga] + membri[verso] > Number(r.querySelector('[data-campo="numero"]').max);
  }
}

// Le righe di un profilo come le vuole ingressiFondare; in semplice i campi avanzati valgono i predefiniti.
function righeDi(profilo, esperto) {
  const tipo = voce(dati.costanti, 'comunita_tipo');
  return $$(`[data-profilo="${profilo}"] .riga`).map((r) => {
    const e = (c) => r.querySelector(`[data-campo="${c}"]`);
    const n = (c) => numeroElemento(e(c), e(c).dataset.predefinito === '' ? null : Number(e(c).dataset.predefinito));
    const base = { riga: r.dataset.riga, numero: n('numero'), kwp: n('kwp'), stato: esperto ? e('stato').value : 'nuovo' };
    if (profilo === 'famiglie') return { ...base, classe: esperto ? e('classe').value : tipo.classe, consumo: esperto ? n('consumo') : null };
    const archetipo = profilo === 'attivita' ? 'archetipo_attivita' : 'archetipo_ente';
    return { ...base, archetipo: esperto ? e('archetipo').value : tipo[archetipo], consumo: n('consumo') };
  });
}

function tabellaRuoli(r, etichette) {
  const righe = Object.entries(r.membri).map(([id, m]) => [etichette[id]?.socio ?? 'Socio produttore', numero(m.numero), euro(m.totale), euro(m.cerAggiunge), perc(m.co2.copertura)]);
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

// «Io sono» (spec della composizione §4): le voci sono i soci che entrano nel calcolo, con le etichette delle righe; si
// riscrivono solo se cambiano. La scelta è quella che il calcolo usa: la prima riga, se la propria non c'è più.
function sincronizzaIo(ingressi, etichette) {
  const selezione = campo('f-io'), voci = opzioniIo(ingressi, etichette);
  const chiave = voci.map((v) => `${v.valore}=${v.testo}`).join('|');
  if (selezione.dataset.voci !== chiave) {
    selezione.replaceChildren(...voci.map((v) => new Option(v.testo, v.valore)));
    selezione.dataset.voci = chiave;
  }
  if (selezione.value !== (ingressi.io ?? '')) selezione.value = ingressi.io ?? '';
}

function mostra(r, percorso, ingressi, etichette) {
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
  if (percorso === 'entrare') disegnaScena(ingressi); else tabellaRuoli(r, etichette);
}

function aggiorna() {
  if (!dati) return;
  aggiornaCorpo();
  aggiornaUscite();
  const s = stato(), percorso = scelto('percorso');
  aggiornaRighe(s.fondare);
  aggiornaAiuto(s);
  if (percorso === 'entrare' && s.utente.ruolo !== 'produttore' && s.utente.tipo !== 'famiglia' && s.utente.consumo == null) {
    document.body.dataset.nonAggiornato = '';
    mostraAvvisi([{ codice: 'consumo_mancante', testo: 'Per un\'attività o un ente serve il consumo annuo: lo trovi in bolletta.' }]);
    return;
  }
  try {
    const ingressi = percorso === 'entrare' ? ingressiEntrare(s, dati.costanti) : ingressiFondare(s, dati.costanti);
    const etichette = percorso === 'fondare' ? etichetteRighe(s.fondare) : null;
    if (percorso === 'fondare') sincronizzaIo(ingressi, etichette);
    const errori = valida(ingressi, dati.costanti);
    if (errori.length) { segnalaErrore(errori.join('; ')); return; }
    const t0 = performance.now();
    ultimo = calcola(ingressi, dati);
    document.body.dataset.ms = String(Math.round(performance.now() - t0));
    delete document.body.dataset.nonAggiornato;
    mostra(ultimo, percorso, ingressi, etichette);
  } catch (e) {
    console.error(e);
    segnalaErrore(e.message);
  }
}

function preimposta() {
  const c = dati.costanti, tipo = voce(c, 'comunita_tipo'), pred = voce(c, 'predefiniti'), q = voce(c, 'quote_riparto');
  const valori = {
    'c-famiglie': tipo.famiglie, 'c-attivita': tipo.attivita, 'c-consumo-attivita': tipo.consumo_attivita, 'c-enti': tipo.enti,
    'c-consumo-ente': tipo.consumo_ente, 'c-kwp': tipo.kwp_comune, 'f-comune-kwp': tipo.kwp_comune,
    'f-fondatori': pred.fondatori, 'p-pz': voce(c, 'prezzo_zonale'), 'p-gestione': voce(c, 'gestione'),
    'p-quota': voce(c, 'quota_associativa'), 'p-qp': q.produttore * 100, 'p-qc': q.consumatori * 100, 'p-om': voce(c, 'manutenzione'),
    kwp: pred.kwp_prosumer,
  };
  for (const [nome, v] of Object.entries(valori)) campo(nome).value = String(v);
  const costituzione = voce(c, 'costituzione');
  campo('p-costituzione').value = costituzione == null ? '' : String(costituzione);
  campo('p-costituzione').placeholder = costituzione == null ? 'da verificare' : '';
  preparaRighe();
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
  // «+ aggiungi», «×» e «Unisci» delle righe di «fondare»: il fuoco va al primo campo della riga nuova, al pulsante del
  // blocco o al «quante» della riga che riceve i membri.
  form.addEventListener('click', (e) => {
    const piu = e.target.closest('[data-aggiungi]'), meno = e.target.closest('.togli'), unisci = e.target.closest('[data-unisci]');
    if (!dati || (!piu && !meno && !unisci)) return;
    if (piu) {
      const profilo = piu.dataset.aggiungi;
      aggiungiRiga(profilo, predefinitaRiga(profilo, false)).querySelector('[data-campo="numero"]').focus();
    } else if (meno) {
      const riga = meno.closest('.riga'), profilo = riga.closest('[data-profilo]').dataset.profilo;
      riga.remove();
      numeraRighe(profilo);
      $(`[data-aggiungi="${profilo}"]`).focus();
    } else {
      // «Unisci alla riga N» (spec della composizione §11.2): i membri della riga uguale passano alla riga N, «Io sono»
      // la segue, e il fuoco va al suo «quante».
      const riga = unisci.closest('.riga'), profilo = riga.closest('[data-profilo]').dataset.profilo;
      const verso = $(`[data-riga="${unisci.dataset.unisci}"]`), quante = verso.querySelector('[data-campo="numero"]');
      const membri = Object.fromEntries(stato().fondare[profilo].map((r) => [r.riga, r.numero]));
      quante.value = String(membri[verso.dataset.riga] + membri[riga.dataset.riga]);
      if (campo('f-io').value === riga.dataset.riga) campo('f-io').value = verso.dataset.riga;
      riga.remove();
      numeraRighe(profilo);
      quante.focus();
    }
    aggiorna();
  });
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
    // resta sul percorso in cui si è (spec della composizione §11.5): form.reset() rimetterebbe «Voglio entrare»
    const percorso = scelto('percorso');
    form.reset();
    campo('percorso').value = percorso;
    preimposta();
    campo('localita').value = `${loc.nome} (${loc.sigla})`;
    aggiorna();
  });
  await scegliLocalita('La Spezia (SP)');
}

avvia();
