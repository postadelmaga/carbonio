// Icone «i» (revisione §8.1). Un pulsante apre e chiude il testo che indica con aria-controls: clic, tocco, Invio e
// Spazio (il pulsante li gestisce da sé) lo fissano aperto o lo chiudono; sui dispositivi con il puntatore anche il
// passaggio del mouse lo mostra. Esc e un clic fuori chiudono; uno solo è aperto alla volta. Il testo si sposta a
// sinistra o a destra quanto serve per restare dentro la finestra, con 16 px di margine.
export function attivaInfo(radice = document) {
  const pulsanti = [...radice.querySelectorAll('button.info')];
  const testo = (b) => document.getElementById(b.getAttribute('aria-controls'));
  const chiudi = (b) => { delete b.dataset.fisso; b.setAttribute('aria-expanded', 'false'); testo(b).hidden = true; };
  const apri = (b) => {
    for (const altro of pulsanti) if (altro !== b) chiudi(altro);
    b.setAttribute('aria-expanded', 'true');
    const t = testo(b);
    t.hidden = false;
    t.style.left = '0px';
    const r = t.getBoundingClientRect(), largo = document.documentElement.clientWidth;
    if (r.right > largo - 16) t.style.left = `${largo - 16 - r.right}px`;
    else if (r.left < 16) t.style.left = `${16 - r.left}px`;
  };
  const puntatore = typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover)').matches;
  for (const b of pulsanti) {
    b.addEventListener('click', () => { if (b.dataset.fisso) chiudi(b); else { apri(b); b.dataset.fisso = '1'; } });
    if (puntatore) {
      const g = b.closest('.info-gruppo');
      g.addEventListener('mouseenter', () => { if (b.getAttribute('aria-expanded') !== 'true') apri(b); });
      g.addEventListener('mouseleave', () => { if (!b.dataset.fisso) chiudi(b); });
    }
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') pulsanti.forEach(chiudi); });
  document.addEventListener('click', (e) => { if (!e.target.closest?.('.info-gruppo')) pulsanti.forEach(chiudi); });
}
