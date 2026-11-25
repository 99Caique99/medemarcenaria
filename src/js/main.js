import { initNav } from './nav.js';
import { initReveal } from './reveal.js';
import { initMedia } from './media.js';
import { initParallax } from './parallax.js';
import { initFurniture } from './motion/furniture.js';

initNav();
initReveal();
initMedia();
initParallax();
initFurniture();

// Ano do copyright sempre atual (o HTML já sai com o ano do build).
document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});
