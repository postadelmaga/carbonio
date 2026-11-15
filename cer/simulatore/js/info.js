// Icone «i» (revisione §8.1). Un pulsante apre e chiude il testo che indica con aria-controls: clic, tocco, Invio e
// Spazio (il pulsante li gestisce da sé) lo fissano aperto o lo chiudono; sui dispositivi con il puntatore anche il
// passaggio del mouse lo mostra. Esc e un clic fuori chiudono, e chiude anche il fuoco che passa a un altro controllo
// (Tab); uno solo è aperto alla volta. Il testo resta dentro i limiti visibili: la finestra, con 16 px di margine, e ogni
// antenato che taglia in orizzontale (overflow-x diverso da visible), con 8 px di margine dentro il suo rettangolo.
// Si sposta a sinistra o a destra quanto serve e, se è più largo dello spazio utile, si restringe.
export function attivaInfo(radice = document) {
  const pulsanti = [...radice.querySelectorAll('button.info')];
  const testo = (b) => document.getElementById(b.getAttribute('aria-controls'));
  const chiudi = (b) => { delete b.dataset.fisso; b.setAttribute('aria-expanded', 'false'); testo(b).hidden = true; };
  // I limiti a sinistra e a destra entro cui il testo si vede: l'intersezione della finestra e degli antenati che tagliano.
  const limiti = (t) => {
    let da = 16, a = document.documentElement.clientWidth - 16;
    for (let n = t.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      if (getComputedStyle(n).overflowX === 'visible') continue;
      const r = n.getBoundingClientRect(), dentro = r.left + n.clientLeft;
      da = Math.max(da, dentro + 8);
      a = Math.min(a, dentro + n.clientWidth - 8);
    }
    return { da, a };
  };
  const apri = (b) => {
    for (const altro of pulsanti) if (altro !== b) chiudi(altro);
    b.setAttribute('aria-expanded', 'true');
    const t = testo(b);
    t.hidden = false;
    t.style.width = '';
    t.style.left = '0px';
    const { da, a } = limiti(t);
    let r = t.getBoundingClientRect();
    if (r.width > a - da) { t.style.width = `${a - da}px`; r = t.getBoundingClientRect(); }
    if (r.right > a) t.style.left = `${a - r.right}px`;
    else if (r.left < da) t.style.left = `${da - r.left}px`;
  };
  const puntatore = typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover)').matches;
  for (const b of pulsanti) {
    const g = b.closest('.info-gruppo');
    b.addEventListener('click', () => { if (b.dataset.fisso) chiudi(b); else { apri(b); b.dataset.fisso = '1'; } });
    // Tab porta il fuoco a un altro controllo: il testo non resta aperto sopra di lui. Un fuoco che sparisce (relatedTarget
    // nullo, per esempio un clic sul testo) non chiude: ci pensa il clic fuori.
    g.addEventListener('focusout', (e) => { if (e.relatedTarget && !g.contains(e.relatedTarget)) chiudi(b); });
    if (puntatore) {
      g.addEventListener('mouseenter', () => { if (b.getAttribute('aria-expanded') !== 'true') apri(b); });
      g.addEventListener('mouseleave', () => { if (!b.dataset.fisso) chiudi(b); });
    }
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') pulsanti.forEach(chiudi); });
  document.addEventListener('click', (e) => { if (!e.target.closest?.('.info-gruppo')) pulsanti.forEach(chiudi); });
}
