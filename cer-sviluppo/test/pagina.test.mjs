// Prova statica dei nomi fra la pagina e lo script: index.html, interfaccia.js e simulatore.css si leggono come testo,
// senza DOM. Un nome rinominato da una parte sola fa fallire la prova, ed è quello che il browser mostrerebbe solo
// come un campo che non risponde o un numero che resta vuoto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leggi = (p) => readFileSync(new URL(`../../cer/simulatore/${p}`, import.meta.url), 'utf8');
const HTML = leggi('index.html'), JS = leggi('js/interfaccia.js'), CSS = leggi('simulatore.css');

const tutti = (testo, re) => [...testo.matchAll(re)].map((m) => m.slice(1).find((x) => x !== undefined));
const unici = (v) => [...new Set(v)];

// Il testo di un oggetto letterale al suo primo livello: ciò che sta fra parentesi annidate si scarta.
function primoLivello(js, inizio) {
  const da = js.indexOf(inizio);
  assert.ok(da >= 0, `«${inizio}» non c'è in interfaccia.js`);
  let livello = 0, fuori = '';
  for (let i = js.indexOf('{', da); i < js.length; i++) {
    const c = js[i];
    if ('{(['.includes(c)) { livello++; continue; }
    if ('})]'.includes(c)) { if (--livello === 0) break; continue; }
    if (livello === 1) fuori += c;
  }
  return fuori;
}
const chiaviVista = (js, inizio = 'const vista = {') => tutti(primoLivello(js, inizio), /(?:^|,)\s*([A-Za-z_]\w*)\s*(?=:|,|$)/g);
const chiaviConDuePunti = (js, inizio) => tutti(primoLivello(js, inizio), /(?:^|,)\s*(?:'([^']+)'|([A-Za-z_]\w*))\s*:/g);

function nomiMancanti(html, js) {
  const nomi = new Set(tutti(html, /\bname="([^"]+)"/g));
  const usati = [
    ...tutti(js, /\b(?:campo|scelto|numeroDi|quota)\('([^']+)'/g),
    ...tutti(js, /input\[name="([a-z][a-z0-9-]*)"\]/g),
    // le coppie [cursore, uscita] di aggiornaUscite: `tutti` prende un solo gruppo per volta, quindi una espressione per elemento
    ...tutti(js, /\['([a-z-]+)', '[a-z-]+-valore'\]/g),
    ...tutti(js, /\['[a-z-]+', '([a-z-]+-valore)'\]/g),
    ...chiaviConDuePunti(js, 'const valori = {'),
  ];
  return unici(usati).filter((n) => !nomi.has(n));
}
function idMancanti(html, js) {
  const id = new Set(tutti(html, /\bid="([^"]+)"/g));
  return unici(tutti(js, /\$\('#([A-Za-z0-9_-]+)'\)/g)).filter((n) => !id.has(n));
}
function rilegatureMancanti(html, js) {
  const prime = new Set(chiaviVista(js)), costanti = new Set(chiaviVista(js, 'cost: {'));
  return unici(tutti(html, /\bdata-r="([^"]+)"/g)).filter((r) => {
    const [primo, secondo] = r.split('.');
    return !prime.has(primo) || (primo === 'cost' && !costanti.has(secondo));
  });
}

test('ogni nome cercato dallo script esiste come name nella pagina', () => {
  assert.deepEqual(nomiMancanti(HTML, JS), []);
});
test('ogni id cercato dallo script esiste nella pagina', () => {
  assert.deepEqual(idMancanti(HTML, JS), []);
});
test('ogni data-r della pagina comincia con una chiave di vista, e le chiavi sono quelle del vincolo «Nomi»', () => {
  assert.deepEqual(rilegatureMancanti(HTML, JS), []);
  assert.deepEqual(chiaviVista(JS).sort(), ['com', 'cost', 'emissioni', 'te']);
});
test('un nome rinominato da una parte sola non passa: la prova se ne accorge', () => {
  assert.deepEqual(nomiMancanti(HTML.replaceAll('name="kwp"', 'name="potenza"'), JS), ['kwp']);
  assert.deepEqual(idMancanti(HTML.replaceAll('id="mese"', 'id="mesi"'), JS), ['mese']);
  assert.ok(rilegatureMancanti(HTML, JS.replace('    te: { ...te,', '    tuo: { ...te,')).includes('te.cerAggiunge'));
  assert.ok(rilegatureMancanti(HTML, JS.replace('anni: voce(', 'durata: voce(')).includes('cost.anni'));
});
test('ogni cursore ha un id uguale al name e una label che lo indica con for', () => {
  const cursori = tutti(HTML, /<input\b([^>]*\btype="range"[^>]*)>/g);
  assert.equal(cursori.length, 7);
  for (const a of cursori) {
    const nome = a.match(/\bname="([^"]+)"/)[1];
    assert.equal(a.match(/\bid="([^"]+)"/)?.[1], nome, `il cursore ${nome} non ha id="${nome}"`);
    assert.match(HTML, new RegExp(`<label\\b[^>]*\\bfor="${nome}"`), `nessuna label for="${nome}"`);
  }
});
test('negli identificatori (classi, id, name, data-*, selettori, codice) non compare «clima»', () => {
  assert.deepEqual(tutti(HTML, /\s(?:class|id|name|for|data-[a-z-]+)="([^"]*clima[^"]*)"/g), []);
  assert.deepEqual(tutti(CSS, /([.#][\w-]*clima[\w-]*)/g), []);
  assert.doesNotMatch(JS, /clima/i);
});

test('aggiorna valida gli ingressi prima di calcolare: gli errori di validazione non arrivano a calcola né alla console', () => {
  const da = JS.indexOf('function aggiorna()'), a = JS.indexOf('function preimposta()');
  assert.ok(da >= 0 && a > da, 'aggiorna non si trova in interfaccia.js');
  const corpo = JS.slice(da, a);
  const valida = corpo.indexOf('valida(ingressi'), calcola = corpo.indexOf('calcola(ingressi');
  assert.ok(valida >= 0, 'aggiorna non chiama valida');
  assert.ok(calcola > valida, 'calcola viene prima di valida');
  const fra = corpo.slice(valida, calcola);
  assert.match(fra, /\breturn;/, 'fra valida e calcola manca l\'uscita');
  assert.doesNotMatch(fra, /console\.error/, 'un errore di validazione non va in console');
  assert.equal((corpo.match(/console\.error/g) ?? []).length, 1, 'console.error resta solo per le eccezioni vere');
  assert.match(corpo.slice(calcola), /catch \(e\) \{\s*console\.error\(e\);/);
});

const camel = (a) => a.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

test('ogni attributo del body che la CSS usa per mostrare o nascondere è impostato dallo script', () => {
  const attributi = unici(tutti(CSS, /body(?::not\()?\[data-([a-z-]+)/g));
  assert.ok(attributi.includes('impianto-cer'), 'la CSS non nasconde il riquadro dell\'impianto della CER');
  const mancanti = attributi.filter((a) => !new RegExp(`(?:dataset|\\bb)\\.${camel(a)}\\b`).test(JS));
  assert.deepEqual(mancanti, [], 'attributi del body che lo script non imposta');
});

test('«Per la comunità» dice che il 20% resta alla CER, senza il fondo contro la povertà energetica (scelta di Eliodora) né gli articoli dello statuto', () => {
  assert.doesNotMatch(HTML, /povertà energetica/);
  assert.doesNotMatch(HTML, /artt\. 2 e 12/);
  assert.doesNotMatch(HTML, /[Ff]ondo sociale/);
  assert.match(HTML, /della tariffa resta alla CER: in questa simulazione <b data-r="com\.quotaCer" data-f="euro"><\/b> l'anno\. L'assemblea decide come usarlo\./);
  assert.match(HTML, /<span data-r="com\.frazioneCer" data-f="perc"><\/span> della tariffa/);
  assert.match(HTML, /<dt>Alla CER<\/dt><dd data-r="com\.quotaCer"/);
  assert.match(HTML, /<p class="testo-emissioni" data-r="com\.eccedentariaTesto"><\/p>/);
  assert.match(JS, /eccedentariaTesto: testoEccedentaria\(com\)/);
  assert.match(HTML, /Alla CER: <output name="p-fondo-valore">/);
});

test('l\'impianto della CER ha il suo riquadro, che compare solo se la CER ha impianti nuovi da finanziare', () => {
  const da = HTML.indexOf('data-solo-impianto-cer');
  assert.ok(da >= 0, 'manca il riquadro con data-solo-impianto-cer');
  const riquadro = HTML.slice(HTML.lastIndexOf('<section', da), HTML.indexOf('</section>', da));
  assert.match(riquadro, /L'impianto della CER/);
  for (const r of ['com.titolareCer', 'com.venditaCer', 'com.manutenzioneCer', 'com.investimentoCer']) {
    assert.ok(riquadro.includes(`data-r="${r}"`), `il riquadro non mostra ${r}`);
  }
  assert.ok(riquadro.includes('L\'impianto va pagato dalla CER: con contributi, quote dei soci o un prestito.'));
  assert.match(JS, /com\.investimentoCer > 0/);
  assert.match(CSS, /body:not\(\[data-impianto-cer\]\) \[data-solo-impianto-cer\]/);
});

test('«Per te»: il numero grande è ciò che porta la CER, l\'impianto ha le sue righe, rientro e 20 anni con l\'impianto solo per un impianto nuovo (esclude un numero grande che sommi ciò che l\'impianto dà comunque)', () => {
  assert.match(HTML, /<p class="grande" aria-live="polite"><b data-r="te\.cerAggiunge" data-f="euro"><\/b><small>all'anno dalla CER, il primo anno<\/small><\/p>/);
  assert.doesNotMatch(HTML, /<dt>La CER aggiunge<\/dt>/);
  assert.match(HTML, /<dt>In <span data-r="cost\.anni"><\/span> anni, dalla CER<\/dt><dd data-r="te\.cerVentiAnniNetto" data-f="euro"><\/dd>/);
  assert.match(HTML, /<div data-solo-fondatore><dt>Costituzione, la tua parte, già tolta dai <span data-r="cost\.anni"><\/span> anni<\/dt>/);
  const da = HTML.indexOf('<div class="impianto-te" data-solo-impianto>');
  assert.ok(da >= 0, 'manca il gruppo «Il tuo impianto»');
  const gruppo = HTML.slice(da, HTML.indexOf('</dl>', da));
  assert.match(gruppo, /<p class="kicker">Il tuo impianto<\/p>/);
  assert.match(gruppo, /<div><dt>Da solo, all'anno<\/dt><dd data-r="te\.impiantoDaSolo" data-f="euro"><\/dd><\/div>/);
  const riga = (titolo) => gruppo.match(new RegExp(`<div([^>]*)><dt>${titolo}`))?.[1] ?? null;
  for (const t of ['Investimento</dt><dd data-r', 'Rientro con la CER', 'Rientro senza CER', 'In <span data-r="cost\\.anni"></span> anni, impianto e CER']) assert.equal(riga(t)?.trim(), 'data-solo-investimento', t);
  assert.match(gruppo, /<div data-solo-pagato><dt>Investimento<\/dt><dd>già pagato<\/dd><\/div>/);
  assert.match(HTML, /<p data-solo-investimento>Il tuo impianto: /, 'la CO₂ del tuo impianto c\'è solo con un impianto nuovo');
  assert.match(HTML, /<div class="barra-riassunto" aria-hidden="true"><b data-r="te\.cerAggiunge" data-f="euro"><\/b> l'anno dalla CER · /);
  assert.match(JS, /if \(te\.haImpianto\) b\.impianto = ''; else delete b\.impianto;/);
  assert.match(JS, /if \(te\.investimento > 0\) b\.investimento = ''; else delete b\.investimento;/);
  assert.match(JS, /if \(te\.soloGiaInEsercizio\) b\.pagato = ''; else delete b\.pagato;/);
  for (const a of ['impianto', 'investimento', 'pagato']) assert.ok(CSS.includes(`body:not([data-${a}]) [data-solo-${a}]`), `la CSS non nasconde [data-solo-${a}]`);
});

test('ogni riga di «Chi entra nella comunità» è un gruppo con il suo nome: i campi «quante», «kWp ciascuna» non sono uguali su quattro righe', () => {
  const da = HTML.indexOf('<div class="righe">');
  assert.ok(da >= 0, 'manca il modulo «fondare»');
  const modulo = HTML.slice(da, HTML.indexOf('</fieldset>', da));
  const aperture = modulo.match(/<div class="riga"/g) ?? [];
  const righe = [...modulo.matchAll(/<div class="riga"([^>]*)>\s*<b([^>]*)>([^<]+)<\/b>/g)];
  assert.equal(aperture.length, 6, 'le righe del modulo sono sei');
  assert.equal(righe.length, aperture.length, 'ogni riga comincia con il suo nome in un <b>');
  const id = [];
  for (const [, riga, titolo, testo] of righe) {
    assert.match(riga, /\brole="group"/, `«${testo}»: manca role="group"`);
    const rif = riga.match(/\baria-labelledby="([^"]+)"/)?.[1];
    assert.ok(rif, `«${testo}»: manca aria-labelledby`);
    assert.equal(titolo.match(/\bid="([^"]+)"/)?.[1], rif, `«${testo}»: il nome non ha l'id che la riga indica`);
    id.push(rif);
  }
  assert.equal(new Set(id).size, id.length, 'gli id dei nomi sono ripetuti');
});

test('lo stato dell\'impianto è un campo a tre scelte in «Voglio entrare», e in «fondare» la riga dei pannelli già in esercizio e lo stato del comune stanno in avanzato (esclude la spunta unica)', () => {
  assert.doesNotMatch(HTML, /name="esistente"|name="f-pannelli-esistenti"|name="f-comune-esistente"/);
  assert.match(HTML, /<select name="stato-impianto">\s*<option value="nuovo" selected>da costruire<\/option>\s*<option value="precedente">già in esercizio, dopo il 15\/12\/2021<\/option>\s*<option value="esistente">già in esercizio, fino al 15\/12\/2021<\/option>/);
  assert.match(HTML, /<div class="riga" role="group" aria-labelledby="riga-pannelli-es" data-solo-modo="esperto"><b id="riga-pannelli-es">Famiglie con pannelli già in esercizio<\/b>/);
  assert.match(HTML, /<option value="pannelli_esistenti">una delle famiglie con pannelli già in esercizio<\/option>/);
  assert.match(HTML, /<label data-solo-modo="esperto">in esercizio <select name="f-comune-stato">/);
  assert.match(JS, /testoGiaInEsercizio\(campo\('stato-impianto'\)\.value\)/);
});

test('i numeri della regione viva si riscrivono solo se il testo cambia, e gli avvisi sono una regione di stato', () => {
  const da = JS.indexOf('function mostra('), a = JS.indexOf('function aggiorna()');
  const corpo = JS.slice(da, a);
  assert.match(corpo, /if \(e\.textContent !== t\) e\.textContent = t;/);
  assert.doesNotMatch(corpo, /e\.textContent = e\.dataset\.f/, 'il ciclo dei data-r non scrive più senza confrontare');
  assert.match(HTML, /<div id="avvisi" class="avvisi" role="status"><\/div>/);
  assert.match(HTML, /<p class="grande" aria-live="polite"><b data-r="te\.cerAggiunge"/, 'ciò che porta la CER resta nella regione viva');
});

test('gli avvisi si riscrivono solo se cambiano: una regione di stato non ripete lo stesso avviso a ogni movimento di cursore', () => {
  const da = JS.indexOf('function mostraAvvisi('), a = JS.indexOf('// I grafici e la scena');
  const corpo = JS.slice(da, a);
  assert.match(corpo, /if \(chiave === avvisiMostrati\) return;/);
});

test('testi della CO₂: niente «fino a», stima dichiarata, italiani e 20 anni generati, abitudini corrette, «Io sono» senza gruppi assenti', () => {
  assert.doesNotMatch(HTML, /finoA|fino a \d/);
  assert.match(HTML, /<p class="grande"><b data-r="emissioni\.evitata" data-f="circa"><\/b><small>di CO₂ in meno ogni anno, una stima, dagli impianti nuovi della comunità<\/small><\/p>/);
  assert.match(HTML, /<p class="testo-emissioni" data-r="emissioni\.stimaTesto"><\/p>/);
  assert.match(HTML, /<p><span data-r="emissioni\.italianiTesto"><\/span> <span data-r="emissioni\.ventiAnniTesto"><\/span><\/p>/);
  assert.match(JS, /stimaTesto: testoStimaCo2\(r\.emissioni\.principale, em\.evitataAltra, dati\.costanti\)/);
  assert.match(JS, /italianiTesto: testoItaliani\(em\.italiani, voce\(dati\.costanti, 'co2_pro_capite'\)\)/);
  assert.match(HTML, /La comunità può aiutare a realizzarli, perché l'energia condivisa porta un incentivo; ma non sappiamo quanti impianti nascerebbero comunque senza di essa/);
  assert.doesNotMatch(HTML, /La comunità serve a farli nascere/);
  assert.match(HTML, /con un fattore annuo, come in questo calcolo, non è CO₂ in meno per il sistema/);
  assert.doesNotMatch(HTML, /In questo calcolo la CO₂ non cambia/);
  assert.match(HTML, /La CO₂ evitata dai pannelli non cambia: dipende da quanta energia producono, non da quando la consumi\./);
  assert.match(HTML, /Per avere il 50% di probabilità di restare sotto 1,5 °C restano circa <span data-r="cost\.budget" data-f="int"><\/span> miliardi di tonnellate di CO₂ dall'inizio del 2026, circa quattro anni alle emissioni attuali \(Global Carbon Budget 2025\)/);
  assert.match(HTML, /<legend>Fattore di emissione per la CO₂ evitata<\/legend>/);
  assert.match(HTML, /<input type="radio" name="p-fattore" value="fossili" checked>/);
  assert.match(HTML, /· <b data-r="emissioni\.evitata" data-f="circa"><\/b> di CO₂ in meno \(stima\)<\/div>/);
  assert.match(HTML, /<fieldset class="passo" data-solo-percorso="entrare" data-solo-tipo="famiglia">\s*<legend><span class="n">6<\/span>Le tue abitudini<\/legend>/);
  assert.match(JS, /sceltaIo\(ingressi, \[\.\.\.selezione\.options\]\.map\(\(o\) => o\.value\)\)/);
  assert.match(JS, /o\.disabled = disabilitati\.includes\(o\.value\)/);
  assert.match(JS, /if \(percorso === 'fondare'\) sincronizzaIo\(ingressi\);/);
});

test('la nota sulla scadenza sotto «Per te» è generata dal ruolo, e il testo vecchio non c\'è più (esclude la nota di prima, rimasta a mano)', () => {
  assert.match(HTML, /<p class="nota-r" data-solo-percorso="entrare" data-r="te\.notaScadenza"><\/p>/);
  assert.doesNotMatch(HTML, /la tua parte di tariffa potrebbe non esserci/);
  assert.match(JS, /notaScadenza: percorso === 'entrare' \? notaScadenza\(s\.utente\.ruolo, new Date\(\), dati\.costanti, s\.utente\.stato\) : ''/);
});

test('ogni icona «i» è un pulsante con aria-expanded, aria-controls verso un testo nascosto della pagina e aria-label, fuori dalle label (esclude testi raggiungibili solo con il mouse, pulsanti dentro una label e icone staccate dall\'etichetta)', () => {
  const pulsanti = [...HTML.matchAll(/<button type="button" class="info" aria-expanded="false" aria-controls="([^"]+)" aria-label="Spiegazione: [^"]+">i<\/button>/g)].map((m) => m[1]);
  assert.ok(pulsanti.length >= 5, `icone trovate: ${pulsanti.length}`);
  assert.equal((HTML.match(/class="info"/g) ?? []).length, pulsanti.length, 'ogni icona ha tutti gli attributi');
  for (const id of pulsanti) assert.match(HTML, new RegExp(`<span class="info-testo" id="${id}" hidden>`), id);
  for (const l of HTML.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/g)) assert.ok(!l[1].includes('class="info"'), 'un\'icona dentro una label');
  for (const id of ['info-spesa', 'info-fossili', 'info-media', 'info-fondatori', 'info-esercizio']) assert.ok(pulsanti.includes(id), id);
  // l'icona sta nello stesso contenitore della sua label, subito dopo (non dentro: un pulsante in una label non è ammesso)
  for (const [id, segno] of [['info-fossili', 'value="fossili"'], ['info-media', 'value="media"'], ['info-fondatori', 'name="f-fondatori"']]) {
    const m = HTML.match(new RegExp(`<div class="con-info">\\s*(<label[^>]*>(?:(?!</label>)[\\s\\S])*</label>)\\s*<span class="info-gruppo"><button type="button" class="info" aria-expanded="false" aria-controls="${id}"`));
    assert.ok(m, `${id}: l'icona non sta accanto alla sua label in un <div class="con-info">`);
    assert.ok(m[1].includes(segno), `${id}: la label accanto all'icona non è la sua (${segno})`);
  }
  assert.match(CSS, /\.con-info\{display:flex;/);
  assert.match(CSS, /\.info-testo::before\{content:'';position:absolute;left:0;right:0;top:-7px;height:7px\}/, 'manca il ponte fra l\'icona e il riquadro');
  assert.match(JS, /import \{ attivaInfo \} from '\.\/info\.js';/);
  assert.match(JS, /attivaInfo\(document\)/);
  assert.match(HTML, /Il contatore non limita i pannelli: serve a stimare i consumi\./);
  assert.match(HTML, /La spesa variabile è la parte della bolletta che cresce con i kWh/);
});

test('menu del simulatore come quello dello statuto, «Avanzato», cursore delle abitudini di «fondare» nella sezione 3, quote del riparto legate (esclude il menu vecchio e il cursore nella sezione dei fondatori)', () => {
  assert.match(HTML, /<nav aria-label="Sezioni">\s*<a href="\/cer\/">La comunità<\/a>\s*<a href="\/cer\/#progetti">Progetti<\/a>\s*<a href="\/cer\/simulatore\/" aria-current="page">Simulatore<\/a>\s*<a href="\/cer\/statuto\/">Statuto<\/a>\s*<\/nav>/);
  assert.doesNotMatch(HTML, /Come funziona<\/a>/);
  assert.match(HTML, /<label><input type="radio" name="modo" value="esperto"> Avanzato<\/label>/);
  assert.doesNotMatch(HTML.replace(/(name|value|data-solo-modo)="esperto"/g, ''), /[Ee]spert/);
  const sez3 = HTML.slice(HTML.indexOf('Chi entra nella comunità'), HTML.indexOf('Tu e i fondatori'));
  assert.match(sez3, /<label class="campo" for="f-abitudini">Consumi spostati nelle ore di sole, per tutte le famiglie <output name="f-abitudini-valore"><\/output>/);
  assert.match(JS, /limitaQuote\(/);
});

test('il campo del prezzo dell\'impianto dice che è IVA esclusa, come lo usa il calcolo, che aggiunge l\'IVA per famiglie ed enti (esclude un prezzo con l\'IVA inserito e poi tassato due volte)', () => {
  assert.match(HTML, /<label class="campo">Prezzo dell'impianto, €\/W, IVA esclusa <input name="p-eurw"/);
});
