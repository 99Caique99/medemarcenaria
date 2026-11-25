// Navbar: estado "rolado", altura real → scroll-padding, e menu mobile acessível.
export function initNav() {
  const navbar = document.getElementById('navbar');
  const menuBtn = document.getElementById('menu-btn');
  const menu = document.getElementById('mobile-menu');
  if (!navbar) return;

  // Altura real da navbar (muda com o breakpoint e ao rolar).
  const syncHeight = () => document.documentElement.style.setProperty('--nav-h', `${navbar.offsetHeight}px`);
  new ResizeObserver(syncHeight).observe(navbar);

  // Sentinela no topo da página no lugar de um listener de scroll.
  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.cssText = 'position:absolute;top:50px;left:0;width:1px;height:1px;pointer-events:none';
  document.body.prepend(sentinel);
  new IntersectionObserver(([entry]) => {
    navbar.classList.toggle('nav-scrolled', !entry.isIntersecting);
  }).observe(sentinel);

  if (!menuBtn || !menu) return;

  const mq = window.matchMedia('(min-width: 768px) and (min-height: 500px)');
  const isOpen = () => menuBtn.getAttribute('aria-expanded') === 'true';

  function setOpen(open, { restoreFocus = true } = {}) {
    menuBtn.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
    menu.inert = !open;
    document.documentElement.style.overflow = open ? 'hidden' : '';
    if (open) menu.querySelector('a')?.focus({ preventScroll: true });
    else if (restoreFocus && menu.contains(document.activeElement)) menuBtn.focus({ preventScroll: true });
  }

  menuBtn.addEventListener('click', () => setOpen(!isOpen()));
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false, { restoreFocus: false });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) setOpen(false);
  });
  mq.addEventListener('change', (e) => {
    if (e.matches && isOpen()) setOpen(false, { restoreFocus: false });
  });
}
