// Formattazione in italiano e nomi di file. Funzioni pure: le usano la pagina, lo script dei dati e i test.
const formati = new Map();
function formato(decimali) {
  if (!formati.has(decimali)) {
    formati.set(decimali, new Intl.NumberFormat('it-IT', { minimumFractionDigits: decimali, maximumFractionDigits: decimali }));
  }
  return formati.get(decimali);
}
const finito = (x) => typeof x === 'number' && Number.isFinite(x);

export function numero(x, decimali = 0) {
  if (!finito(x)) return '—';
  const s = formato(decimali).format(x);
  return /^-0([,]0+)?$/.test(s) ? s.slice(1) : s;
}
export const euro = (x, decimali = 0) => (finito(x) ? `${numero(x, decimali)} €` : '—');
export const kwh = (x) => (finito(x) ? `${numero(x)} kWh` : '—');
export const perc = (x, decimali = 0) => (finito(x) ? `${numero(x * 100, decimali)}%` : '—');
export function tonnellate(t) {
  if (!finito(t)) return '—';
  return Math.abs(t) < 1 ? `${numero(t * 1000)} kg` : `${numero(t, 1)} t`;
}
// CO₂ in pagina (revisione §9.3): due cifre significative e «circa», in kg sotto la tonnellata. I fattori non sostengono
// più precisione.
export function circa(t) {
  if (!finito(t)) return '—';
  if (t === 0) return '0 kg';
  const due = (x) => { const p = 10 ** (Math.floor(Math.log10(Math.abs(x))) - 1); return Math.round(x / p) * p; };
  if (Math.abs(t) < 1) {
    const kg = due(t * 1000);
    if (Math.abs(kg) < 1000) return `circa ${numero(kg)} kg`;
  }
  const v = due(t);
  return `circa ${numero(v, Math.abs(v) < 10 ? 1 : 0)} t`;
}
export const anni = (n, durata) => (n == null ? `non rientra in ${durata} anni` : n === 1 ? '1 anno' : `${n} anni`);

// Lo stesso algoritmo di slug() in prepara_dati.py: i nomi dei file delle regioni devono coincidere.
export function slug(testo) {
  return testo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
