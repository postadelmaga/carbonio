// Menu contestuale (tasto destro), come nei programmi di montaggio: voci con la
// scorciatoia a destra, separatori, voci spente o spuntate; si usa anche da
// tastiera (frecce, Invio, Esc) e si chiude cliccando fuori o scorrendo.
//
// items: [{ label, key?, act?, disabled?, checked?, danger? } | '-']

let open = null;

export function closeMenu() {
  if (!open) return;
  open.el.remove();
  removeEventListener('pointerdown', open.outside, true);
  removeEventListener('blur', closeMenu);
  removeEventListener('resize', closeMenu);
  document.removeEventListener('scroll', closeMenu, true);
  const back = open.focus;
  open = null;
  back?.focus?.({ preventScroll: true });
}

export const menuOpen = () => !!open;

export function showMenu(x, y, items) {
  closeMenu();
  const el = document.createElement('div');
  el.className = 'ctx';
  el.setAttribute('role', 'menu');
  const list = items.filter((it, k) => it !== '-' || (k > 0 && items[k - 1] !== '-' && k < items.length - 1));
  el.innerHTML = list.map((it, k) => it === '-' ? '<div class="ctx-sep" role="separator"></div>'
    : `<button type="button" role="${it.checked != null ? 'menuitemcheckbox' : 'menuitem'}" data-k="${k}"${it.disabled ? ' disabled' : ''}${it.checked != null ? ` aria-checked="${!!it.checked}"` : ''} class="${it.danger ? 'danger' : ''}">
      <span class="ck">${it.checked ? '✓' : ''}</span><span class="lb">${it.label}</span><span class="ky">${(it.key || '').replace(/ \+ /g, '+')}</span></button>`).join('');
  document.body.append(el);
  // dentro la finestra
  const r = el.getBoundingClientRect();
  el.style.left = `${Math.max(4, Math.min(x, innerWidth - r.width - 4))}px`;
  el.style.top = `${Math.max(4, y + r.height > innerHeight - 4 ? y - r.height : y)}px`;
  const btns = [...el.querySelectorAll('button:not(:disabled)')];
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-k]');
    if (!b || b.disabled) return;
    const it = list[+b.dataset.k];
    closeMenu();
    it.act?.();
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('keydown', (e) => {
    const i = btns.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); btns[(i + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); btns[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); btns[btns.length - 1]?.focus(); }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); closeMenu(); }
    e.stopPropagation();
  });
  const outside = (e) => { if (!el.contains(e.target)) closeMenu(); };
  open = { el, outside, focus: document.activeElement };
  addEventListener('pointerdown', outside, true);
  addEventListener('blur', closeMenu);
  addEventListener('resize', closeMenu);
  document.addEventListener('scroll', closeMenu, true);
  btns[0]?.focus({ preventScroll: true });
}
