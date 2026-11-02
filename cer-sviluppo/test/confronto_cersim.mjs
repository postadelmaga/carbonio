// Confronto del motore del sito con cersim sul caso la_spezia_riparto @ 10dd415 (spec §9.2).
//   CERSIM_USCITA=<cartella di «cersim esegui»> node cer-sviluppo/test/confronto_cersim.mjs
// Senza la variabile la prova si salta. Nel repo non entra nulla di cersim: solo questo script.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { calcola } from '../../cer/simulatore/js/motore.js';

const dir = process.env.CERSIM_USCITA;
if (!dir) { console.log('CERSIM_USCITA non impostata: confronto saltato'); process.exit(0); }

function csv(nome) {
  const testo = readFileSync(join(dir, nome), 'utf8');
  const righe = []; let riga = [], campo = '', virgolette = false;
  for (let i = 0; i < testo.length; i++) {
    const ch = testo[i];
    if (virgolette) {
      if (ch === '"' && testo[i + 1] === '"') { campo += '"'; i++; } else if (ch === '"') virgolette = false; else campo += ch;
    } else if (ch === '"') virgolette = true;
    else if (ch === ',') { riga.push(campo); campo = ''; }
    else if (ch === '\n') { riga.push(campo); righe.push(riga); riga = []; campo = ''; }
    else if (ch !== '\r') campo += ch;
  }
  if (campo || riga.length) { riga.push(campo); righe.push(riga); }
  const [testa, ...corpo] = righe;
  return corpo.map((r) => Object.fromEntries(testa.map((c, i) => [c, r[i]])));
}
const perChiave = (righe, chiave, valore) => {
  const m = new Map();
  for (const r of righe.sort((x, y) => x.timestamp.localeCompare(y.timestamp))) {
    if (!m.has(r[chiave])) m.set(r[chiave], []);
    m.get(r[chiave]).push(Number(r[valore]));
  }
  return new Map([...m].map(([k, v]) => [k, Float64Array.from(v)]));
};

// Dal file del caso la_spezia_riparto @ 10dd415: potenze, anzianità (data di esercizio), esistente prima della CER.
const IMPIANTI = { FV2: { kwp: 6, esistente: true }, FV3: { kwp: 3, esistente: false }, FV1: { kwp: 20, esistente: false } };
const ORDINE = ['FV2', 'FV3', 'FV1']; // 2023, 15/11/2026, 01/12/2026

const soggetti = csv('soggetti.csv'), impiantiCsv = csv('impianti.csv');
const prelievi = perChiave(csv('orario_pod.csv'), 'pod_id', 'withdrawal_kwh');
const immesse = perChiave(csv('orario_impianti.csv'), 'plant_id', 'injection_kwh');
const tipoDi = { persona_fisica: 'famiglia', pmi: 'attivita' };
const podDi = new Map(), soci = [];
for (const s of soggetti) {
  for (const pod of s.pods.split(';').map((x) => x.trim()).filter(Boolean)) {
    podDi.set(pod, s.subject);
    const kwh = prelievi.get(pod).reduce((x, y) => x + y, 0);
    soci.push({ id: pod, tipo: tipoDi[s.type], numero: 1, consumo_kwh_anno: kwh, classe_potenza: '1,5-3', archetipo: 'com_orario_apertura', spostamento: 0 });
  }
}
const titolare = Object.fromEntries(impiantiCsv.map((r) => [r.plant, r.pod]));
const ingressi = {
  area: 'nord', soci,
  impianti: ORDINE.map((id) => ({ id, kwp: IMPIANTI[id].kwp, titolare: titolare[id], sul_pod_del_titolare: false, per_ogni_membro: false, esistente: IMPIANTI[id].esistente })),
  parametri: { prezzo_zonale: 115.9, gestione_eur_anno: 0, quota_associativa: 0, quota_produttore: 0.4, quota_consumatori: 0.4 },
  serie: { consumi: Object.fromEntries(soci.map((s) => [s.id, prelievi.get(s.id)])), produzioni: Object.fromEntries(ORDINE.map((id) => [id, immesse.get(id)])) },
};
const costanti = JSON.parse(readFileSync(new URL('../../cer/simulatore/dati/costanti.json', import.meta.url), 'utf8'));
const r = calcola(ingressi, { costanti, pv: new Array(8760).fill(0) });

const confronti = [];
const confronta = (cosa, sito, rif, soglia) => confronti.push({ cosa, sito, cersim: rif, scarto: sito - rif, ok: Math.abs(sito - rif) <= soglia });
const annui = csv('indicatori_annui.csv').find((x) => x.period === 'anno');
confronta('condivisa, kWh', r.comunita.condivisa, Number(annui.shared_kwh), Number(annui.shared_kwh) * 1e-4);
const attr = csv('orario_attribuzione.csv');
for (const k of r.impianti) {
  const rif = attr.filter((x) => x.plant_id === k.id).reduce((s, x) => s + Number(x.shared_kwh), 0);
  confronta(`condivisa di ${k.id}, kWh`, k.condivisa, rif, Math.max(1e-6, rif * 1e-4));
}
const voci = csv('economia_voci.csv').filter((x) => x.perspective === 'configurazione' && x.year === '1');
for (const k of r.impianti) {
  const v = voci.find((x) => x.item === 'tariffa_premio' && x.subject === k.id);
  confronta(`tariffa di ${k.id}, €`, k.tariffa, v ? Number(v.amount_eur) : 0, 0.01);
}
const contributo = voci.filter((x) => x.item === 'contributo_valorizzazione').reduce((s, x) => s + Number(x.amount_eur), 0);
confronta('contributo, €', r.comunita.contributo, contributo, 0.01);
const riparto = csv('riparto.csv').filter((x) => x.year === '1');
const perSoggetto = new Map();
for (const x of riparto) if (x.subject && x.subject !== 'cer') perSoggetto.set(x.subject, (perSoggetto.get(x.subject) ?? 0) + Number(x.assigned_eur));
const sitoPerSoggetto = new Map();
for (const s of soci) {
  const v = r.membri[s.id].voci, sogg = podDi.get(s.id);
  sitoPerSoggetto.set(sogg, (sitoPerSoggetto.get(sogg) ?? 0) + v.quotaProduttore + v.quotaTariffa + v.quotaContributo + v.quotaEccedentaria);
}
for (const sogg of new Set([...perSoggetto.keys(), ...sitoPerSoggetto.keys()])) {
  confronta(`riparto a ${sogg}, €`, sitoPerSoggetto.get(sogg) ?? 0, perSoggetto.get(sogg) ?? 0, 0.01);
}
const fondoCersim = riparto.filter((x) => x.recipient === 'cer').reduce((s, x) => s + Number(x.assigned_eur), 0);
confronta('alla CER, €', r.comunita.fondo, fondoCersim, 0.01);

console.table(confronti.map((c) => ({ ...c, sito: c.sito.toFixed(3), cersim: c.cersim.toFixed(3), scarto: c.scarto.toFixed(3) })));
const ko = confronti.filter((c) => !c.ok);
console.log(ko.length ? `${ko.length} scarti oltre la soglia` : 'nessuno scarto oltre la soglia');
process.exit(ko.length ? 1 : 0);
