// Prova dei numeri del testo di «Come calcoliamo» contro costanti.json. La pagina si legge come testo, senza DOM: i valori
// restano scritti nel testo, quindi un cambio di costante fa fallire la suite finché il testo non si aggiorna.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { numero, perc } from '../../cer/simulatore/js/formato.js';

const leggi = (p) => readFileSync(new URL(`../../cer/simulatore/${p}`, import.meta.url), 'utf8');
const HTML = leggi('metodo/index.html');
const C = JSON.parse(leggi('dati/costanti.json')).voci;
const PV = JSON.parse(leggi('dati/pv/011015.json'));
const v = (voce) => C[voce].valore;

test('i numeri del testo di «Come calcoliamo» coincidono con costanti.json (esclude un testo rimasto indietro dopo un cambio di costante)', () => {
  const durata = v('durata_tariffa_anni');
  const riparto = v('quote_riparto');
  const fasce = v('tariffa_fasce');
  const sogliaPrezzo = v('tariffa_prezzo_riferimento') - (fasce[0].tetto - fasce[0].base);
  const scadenza = v('scadenza_esercizio').split('-').reverse().join('/');
  const fondo = 1 - riparto.produttore - riparto.consumatori;

  const frasi = [
    `Il ${perc(v('spostamento_massimo'))} massimo`,
    `per ${durata} anni`,
    `supera il ${perc(v('soglia_eccedentaria'))}`,
    `Il ${perc(riparto.produttore)} della tariffa va al titolare`,
    `il ${perc(riparto.consumatori)} ai consumatori`,
    `il ${perc(fondo)} resta alla CER, che ne decide l'uso`,
    `lo ${perc(v('degrado'), 1)} di produzione l'anno`,
    `Sui ${durata} anni`,
    `entro il ${scadenza}`,
    `supera i ${numero(sogliaPrezzo)} €/MWh`,
    `l'anno meteorologico ${PV.anno_meteo}`,
    `perdite del ${PV.parametri.loss}%`,
    `non oltre ${fasce.at(-1).fino_kw / 1000} MW di potenza, per ${durata} anni`,
    'se non ce ne sono, va a finalità sociali',
    'Se i costi superano gli incentivi, il simulatore lo segnala: vanno coperti in altro modo, per esempio con una quota associativa.',
    'Sui 20 anni il fattore delle centrali fossili resta quello di oggi; con la media dei consumi scende come ha fatto in media dal 1990 al 2024.',
    'per chi entra nella comunità dopo quella data la condivisa dovrebbe contare ancora, ma le regole non lo scrivono',
    'non contiamo tagli dell\'inverter né limiti di immissione',
    'gli impianti di attività ed enti sono sempre nuovi',
    'ha la tariffa ma è già pagato, e il simulatore non lo distingue',
  ];
  const mancanti = frasi.filter((f) => !HTML.includes(f));
  assert.deepEqual(mancanti, [], 'frasi da aggiornare in cer/simulatore/metodo/index.html');
  // il fondo contro la povertà energetica è una scelta del regolamento di Eliodora, non della nostra CER
  assert.ok(!HTML.includes('fondo sociale'), 'nella pagina c\'è ancora «fondo sociale»');
  assert.ok(!HTML.includes('povertà energetica'), 'nella pagina c\'è ancora «povertà energetica»');
  assert.ok(!HTML.includes('fondo della comunità'), '«fondo della comunità» si confonde con il 20% che resta alla CER: la quota eccedentaria senza consumatori non imprese va a finalità sociali');

  // «Venti anni» e «il ventesimo anno» sono scritti a parole: valgono solo finché la durata è 20.
  // Se la durata cambia, vanno riscritte anche queste parole nella pagina.
  assert.equal(durata, 20, 'durata_tariffa_anni non è più 20: vanno riscritte in pagina anche «Venti anni» e «il ventesimo anno»');
  assert.ok(HTML.includes('Venti anni'), 'nella pagina manca «Venti anni»');
  assert.ok(HTML.includes('il ventesimo anno'), 'nella pagina manca «il ventesimo anno»');
});

test('la pagina dice che sui 20 anni il fattore delle centrali fossili resta quello di oggi e come si leggono le fonti (esclude una pagina che dice il contrario del calcolo)', () => {
  assert.ok(HTML.includes('resta quello di oggi'), 'nella pagina manca «resta quello di oggi»');
  assert.ok(!HTML.includes('che è ciò che un kWh solare toglie oggi soprattutto'), 'frase senza fonte ufficiale');
  assert.ok(HTML.includes("unita === 'data'"), 'lo script non scrive le date in GG/MM/AAAA');
  assert.ok(HTML.includes("join(', ')"), 'le liste della tabella non si uniscono con «, »');
  assert.ok(HTML.includes('console.error(e)'), 'il ramo di errore non registra l\'errore');
  assert.equal(C.correttivo_fv.note, 'Le regioni di ciascuna area sono nella riga seguente.');
  assert.ok(leggi('simulatore.css').includes('.metodo .tabella th{text-align:left}'), 'manca lo stile delle intestazioni della tabella');
});

test('«Come calcoliamo» dice quando sono stati scaricati i dati, leggendo la data da un file dei dati, e ha i tag og: della pagina del simulatore', () => {
  assert.match(PV.scaricato_il, /^\d{4}-\d{2}-\d{2}$/);
  const tutte = readdirSync(new URL('../../cer/simulatore/dati/pv/', import.meta.url)).filter((f) => f.endsWith('.json'));
  const date = new Set(tutte.map((f) => JSON.parse(leggi(`dati/pv/${f}`)).scaricato_il));
  assert.deepEqual([...date], [PV.scaricato_il], 'le serie PVGIS non sono state scaricate tutte lo stesso giorno: una sola data non basta');
  assert.ok(HTML.includes("fetch('/cer/simulatore/dati/pv/011015.json')"), 'lo script non legge il file PV');
  assert.ok(HTML.includes('scaricato_il'), 'lo script non legge scaricato_il');
  assert.ok(HTML.includes('id="data-dati"'), 'manca il punto in cui scrivere la data');
  const [a, m, g] = PV.scaricato_il.split('-');
  assert.ok(!HTML.includes(PV.scaricato_il) && !HTML.includes(`${g}/${m}/${a}`), 'la data dei dati è scritta a mano nella pagina');
  const og = (p) => HTML.match(new RegExp(`<meta property="og:${p}" content="([^"]+)">`))?.[1];
  const sim = leggi('index.html');
  const ogSim = (p) => sim.match(new RegExp(`<meta property="og:${p}" content="([^"]+)">`))?.[1];
  assert.equal(og('type'), ogSim('type'));
  assert.equal(og('image'), ogSim('image'));
  assert.equal(og('url'), 'https://co2-info.duckdns.org/cer/simulatore/metodo/');
  assert.equal(og('title'), 'Come calcoliamo · Simulatore della CER');
  assert.ok(og('description')?.length > 20, 'manca og:description');
});

test('il menu di «Come calcoliamo» è quello del simulatore, senza «Come funziona» (esclude due pagine con menu diversi)', () => {
  assert.match(HTML, /<nav aria-label="Sezioni">\s*<a href="\/cer\/">La comunità<\/a>\s*<a href="\/cer\/#progetti">Progetti<\/a>\s*<a href="\/cer\/simulatore\/">Simulatore<\/a>\s*<a href="\/cer\/statuto\/">Statuto<\/a>\s*<\/nav>/);
  assert.ok(!/[Ee]spert/.test(HTML), 'nella pagina c\'è ancora «esperto»');
});

test('«Come calcoliamo» dice che decreto e statuto destinano l\'eccedentaria ai consumatori non imprese o a finalità sociali, e che il rapporto conta la condivisa dei soli impianti incentivati (esclude la scelta del simulatore presentata come la regola)', () => {
  assert.ok(HTML.includes('la parte in più della tariffa va, per il decreto e per lo statuto, ai soli consumatori che non sono imprese o a finalità sociali: qui va ai consumatori che non sono imprese; se non ce ne sono, va a finalità sociali'), 'frase della destinazione');
  assert.ok(HTML.includes('Quando l\'energia condivisa attribuita agli impianti incentivati supera il 55% di quella che immettono'), 'rapporto della soglia');
  assert.ok(!HTML.includes('la parte in più della tariffa va solo ai consumatori che non sono imprese'), 'la scelta del simulatore detta come regola');
});

test('«Come calcoliamo» dichiara che soci e impianti stanno sotto la stessa cabina primaria (esclude un perimetro della condivisa taciuto, che decide se tariffa e contributo spettano)', () => {
  const fuori = HTML.slice(HTML.indexOf('<h2>Che cosa resta fuori</h2>'), HTML.indexOf('<h2>Le fonti di ogni valore</h2>'));
  assert.ok(fuori.includes('<li>La cabina primaria: il calcolo assume che soci e impianti siano tutti sotto la stessa, come chiedono le regole per la tariffa premio e per il contributo ARERA. Una CER con soci sotto più cabine forma una configurazione per ciascuna, e la condivisa si conta dentro ognuna.</li>'), 'manca la voce della cabina primaria');
});

// La sezione «Che cosa resta fuori», come testo: le voci aggiunte dopo il controllo generale si cercano qui.
const fuori = () => HTML.slice(HTML.indexOf('<h2>Che cosa resta fuori</h2>'), HTML.indexOf('<h2>Le fonti di ogni valore</h2>'));

test('«Che cosa resta fuori» dice che il socio produttore è un\'impresa che non consuma sul posto e detrae l\'IVA, quindi il suo impianto si conta senza IVA (esclude un investimento senza IVA che la pagina non spiega)', () => {
  assert.ok(fuori().includes('<li>Il socio produttore della comunità tipo e di «Voglio fondarne una» è un\'impresa che non consuma sul posto e detrae l\'IVA: il suo impianto si conta senza IVA.</li>'));
});

test('«Che cosa resta fuori» dice che le imprese socie devono essere PMI e che il simulatore non lo verifica (esclude una grande impresa che vede benefici che non può avere)', () => {
  assert.ok(fuori().includes('<li>Le imprese possono essere socie di una CER solo se sono piccole o medie imprese (PMI; DM 414/2023, art. 3 c. 2 lett. c): il simulatore non lo verifica.</li>'));
});

test('«Che cosa resta fuori» elenca i costi dell\'impianto che non si contano: inverter, assicurazione, manutenzione straordinaria, corrispettivo del ritiro dedicato (esclude una spesa dell\'impianto taciuta)', () => {
  assert.ok(fuori().includes('<li>Costi dell\'impianto che non contiamo: la sostituzione dell\'inverter, l\'assicurazione, la manutenzione straordinaria e il corrispettivo del ritiro dedicato.</li>'));
});

test('«Come calcoliamo» dichiara tre scelte prudenti, fra cui il corrispettivo del GSE contato per ogni impianto anche senza tariffa (esclude una scelta del calcolo taciuta e il titolo che ne conta due)', () => {
  assert.ok(!HTML.includes('Due scelte prudenti') && !HTML.includes('Su due punti'), 'il titolo e la frase contano ancora due scelte');
  const da = HTML.indexOf('<h2>Tre scelte prudenti</h2>');
  assert.ok(da >= 0, 'manca il titolo «Tre scelte prudenti»');
  const sezione = HTML.slice(da, HTML.indexOf('<h2>', da + 1));
  assert.ok(sezione.includes('<p>Su tre punti le regole non sono chiare, e scegliamo la lettura prudente:</p>'));
  assert.equal((sezione.match(/<li>/g) ?? []).length, 3, 'le scelte elencate sono tre');
  assert.ok(sezione.includes('<li>il corrispettivo del GSE si conta per ogni impianto della comunità, anche per quelli senza tariffa: il DM 106/2024 lo chiede a chi è ammesso alle tariffe incentivanti, ma non dice se valga anche per gli altri.</li>'));
});

test('«Come calcoliamo» dice che la tariffa spetta «per 20 anni», come il DM 414 («pari a 20 anni»), e non «fino a 20 anni» (esclude una durata presentata come un massimo)', () => {
  assert.ok(HTML.includes('non oltre 1 MW di potenza, per 20 anni, e la calcoliamo'));
  assert.ok(!HTML.includes('fino a 20 anni'), 'nella pagina c\'è ancora «fino a 20 anni»');
});
