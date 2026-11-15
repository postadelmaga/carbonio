// Asse delle 8.760 ore dell'anno in ora italiana, con l'ora legale (spec §6.2): mese, ora locale, tipo di giorno e
// indice del giorno di ogni ora reale. Le festività nazionali valgono come domenica; i santi patroni no.
export const ANNO = 2023;
export const ORE = 8760;
export const TIPI = ['feriale', 'sabato', 'festivo'];
const H = 3600 * 1000;

const ultimaDomenica = (anno, mese0) => {
  const ultimo = new Date(Date.UTC(anno, mese0 + 1, 0));
  return ultimo.getUTCDate() - ultimo.getUTCDay();
};

// Calendario gregoriano, algoritmo anonimo (Meeus/Jones/Butcher).
export function pasqua(anno) {
  const a = anno % 19, b = Math.floor(anno / 100), c = anno % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const x = h + l - 7 * m + 114;
  return { mese: Math.floor(x / 31), giorno: (x % 31) + 1 };
}

const mmgg = (mese, giorno) => `${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;

export function festivi(anno) {
  const p = pasqua(anno);
  const lunedi = new Date(Date.UTC(anno, p.mese - 1, p.giorno + 1));
  return new Set(['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26',
    mmgg(lunedi.getUTCMonth() + 1, lunedi.getUTCDate())]);
}

// Ora legale europea: dall'ultima domenica di marzo all'ultima di ottobre, alle 01:00 UTC.
export function oraLegale(t, anno) {
  return t >= Date.UTC(anno, 2, ultimaDomenica(anno, 2), 1) && t < Date.UTC(anno, 9, ultimaDomenica(anno, 9), 1);
}

export function asseOre(anno = ANNO) {
  if (new Date(Date.UTC(anno, 1, 29)).getUTCMonth() === 1) throw new Error(`anno bisestile non previsto: ${anno}`);
  const n = ORE;
  const mese = new Uint8Array(n), ora = new Uint8Array(n), tipo = new Uint8Array(n), giorno = new Uint16Array(n);
  const fest = festivi(anno);
  const inizio = Date.UTC(anno, 0, 1);
  const t0 = inizio - H; // mezzanotte del 1° gennaio in ora solare, UTC+1
  for (let i = 0; i < n; i++) {
    const t = t0 + i * H;
    const loc = new Date(t + (oraLegale(t, anno) ? 2 : 1) * H);
    mese[i] = loc.getUTCMonth() + 1;
    ora[i] = loc.getUTCHours();
    const dow = loc.getUTCDay();
    tipo[i] = dow === 0 || fest.has(mmgg(mese[i], loc.getUTCDate())) ? 2 : dow === 6 ? 1 : 0;
    giorno[i] = Math.round((Date.UTC(anno, loc.getUTCMonth(), loc.getUTCDate()) - inizio) / (24 * H));
  }
  return { anno, n, mese, ora, tipo, giorno };
}
