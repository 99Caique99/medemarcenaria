import { initSmoothScroll } from './smooth.js';
import { initNav } from './nav.js';
import { initMedia } from './media.js';
import { initMotion } from './motion.js';

initSmoothScroll();
initNav();
initMedia();
initMotion();

// Ano do copyright sempre atual (o HTML já sai com o ano do build).
document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});
