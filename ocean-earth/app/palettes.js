// Scale di colore. Ogni scala e' una lista di tappe [posizione 0..1, colore];
// diventa una texture 256×1 per gli shader e un gradiente CSS per la legenda.

export const PALETTES = {
  // temperatura assoluta: blu scuro → blu → verde → giallo → arancio → rosso
  classic: { kind: 'sst', stops: [
    [0.00, '#0b1a5c'], [0.15, '#1f4fbf'], [0.32, '#3aa0d8'], [0.47, '#3fb67a'],
    [0.62, '#d9d63a'], [0.76, '#f2a23a'], [0.89, '#e0502b'], [1.00, '#9e1028']] },
  // percettivamente uniforme, simile a "thermal" di cmocean
  thermal: { kind: 'sst', stops: [
    [0.00, '#04232f'], [0.15, '#1b3e85'], [0.32, '#5a4ba0'], [0.48, '#8f5a8f'],
    [0.64, '#c86a6c'], [0.80, '#ef8c45'], [0.92, '#f9c445'], [1.00, '#f6f6a8']] },
  // stile "turbo": massimo contrasto locale, utile per i fronti
  turbo: { kind: 'sst', stops: [
    [0.00, '#30123b'], [0.13, '#4662d7'], [0.25, '#36aaf9'], [0.38, '#1ae4b6'],
    [0.50, '#72fe5e'], [0.63, '#c8ef34'], [0.75, '#faba39'], [0.88, '#f66b19'], [1.00, '#7a0403']] },
  // anomalia: divergente, bianco sullo zero
  anomaly: { kind: 'anom', stops: [
    [0.00, '#053061'], [0.15, '#2166ac'], [0.32, '#6aa8d2'], [0.45, '#d1e5f0'],
    [0.50, '#f7f7f7'], [0.55, '#fddbc7'], [0.68, '#e98868'], [0.85, '#b2182b'], [1.00, '#67001f']] },
  // velocita' delle correnti: chiara, per stare sopra la temperatura
  speed: { kind: 'speed', stops: [
    [0.00, '#8aa4bd'], [0.25, '#d9ecff'], [0.50, '#ffffff'], [0.70, '#ffe14d'],
    [0.85, '#ff8a3d'], [1.00, '#ff2f7a']] },
  // velocita' come campo colorato (modalita' "velocita'")
  speedField: { kind: 'speed', stops: [
    [0.00, '#0d0887'], [0.25, '#6a00a8'], [0.50, '#b12a90'], [0.70, '#e16462'],
    [0.85, '#fca636'], [1.00, '#f0f921']] },
};

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function lut(name, n = 256) {
  const stops = PALETTES[name].stops;
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [t0, c0] = stops[k], [t1, c1] = stops[k + 1];
    const f = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;
    const a = hex(c0), b = hex(c1);
    for (let j = 0; j < 3; j++) out[i * 4 + j] = Math.round(a[j] + (b[j] - a[j]) * f);
    out[i * 4 + 3] = 255;
  }
  return out;
}

export function cssGradient(name) {
  return 'linear-gradient(90deg,' + PALETTES[name].stops.map(([t, c]) => `${c} ${(t * 100).toFixed(1)}%`).join(',') + ')';
}

// colore del valore v nella scala (per i grafici e i marcatori)
export function colorAt(name, t) {
  const l = lut(name, 64);
  const i = Math.round(Math.min(1, Math.max(0, t)) * 63) * 4;
  return `rgb(${l[i]},${l[i + 1]},${l[i + 2]})`;
}
