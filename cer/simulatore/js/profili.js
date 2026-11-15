// Consumi orari (forme ARERA delle famiglie, archetipi delle attività), spostamento dei consumi nelle ore di sole e
// produzione da kWp (spec §6.3-§6.4). Tutto in kWh per ora, su un membro o su un impianto.
import { TIPI } from './calendario.js';

export function somma(v) { let s = 0; for (let i = 0; i < v.length; i++) s += v[i]; return s; }

export function formaDomestica(forme, classe, asse) {
  const c = forme.classi[classe];
  if (!c) throw new Error(`classe di potenza sconosciuta: ${classe}`);
  const f = new Float64Array(asse.n);
  for (let i = 0; i < asse.n; i++) f[i] = c[TIPI[asse.tipo[i]]][asse.mese[i] - 1][asse.ora[i]];
  return f;
}

export function formaAttivita(archetipo, asse) {
  const f = new Float64Array(asse.n);
  for (let i = 0; i < asse.n; i++) {
    f[i] = archetipo.forme[TIPI[asse.tipo[i]]][asse.ora[i]] * archetipo.stagionalita[asse.mese[i] - 1];
  }
  return f;
}

export function scala(forma, annuo) {
  const s = somma(forma), out = new Float64Array(forma.length);
  if (!(s > 0) || !(annuo > 0)) return out;
  const k = annuo / s;
  for (let i = 0; i < forma.length; i++) out[i] = forma[i] * k;
  return out;
}

export function inizioGiorni(asse) {
  const inizi = [0];
  for (let i = 1; i < asse.n; i++) if (asse.giorno[i] !== asse.giorno[i - 1]) inizi.push(i);
  inizi.push(asse.n);
  return inizi;
}

// Ogni giorno toglie min(quota × consumo del giorno; consumo delle ore senza sole) dalle ore senza produzione, in
// proporzione al consumo, e lo rimette nelle ore con produzione, in proporzione alla produzione dell'ora.
export function sposta(consumo, pv, asse, quota) {
  const out = Float64Array.from(consumo);
  if (!(quota > 0)) return out;
  const inizi = inizioGiorni(asse);
  for (let d = 0; d + 1 < inizi.length; d++) {
    const a = inizi[d], b = inizi[d + 1];
    let tot = 0, buio = 0, luce = 0;
    for (let h = a; h < b; h++) { tot += consumo[h]; if (pv[h] > 0) luce += pv[h]; else buio += consumo[h]; }
    const m = Math.min(quota * tot, buio);
    if (!(m > 0) || !(luce > 0)) continue;
    for (let h = a; h < b; h++) {
      if (pv[h] > 0) out[h] += (m * pv[h]) / luce;
      else out[h] = Math.max(0, out[h] - (m * consumo[h]) / buio);
    }
  }
  return out;
}

export function produzione(pvWh, kwp, fattore = 1) {
  const out = new Float64Array(pvWh.length), k = (kwp * fattore) / 1000;
  for (let i = 0; i < pvWh.length; i++) out[i] = pvWh[i] * k;
  return out;
}

export const consumoMedioClasse = (forme, classe, asse) => somma(formaDomestica(forme, classe, asse));
