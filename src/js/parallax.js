// Parallax sutil das imagens do "Sobre" com GSAP ScrollTrigger (scrub, só transform).
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initParallax() {
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    gsap.utils.toArray('.parallax-frame').forEach((frame) => {
      const img = frame.querySelector('img');
      if (!img) return;
      // A imagem tem 120% da altura da moldura (sobra de 10% em cima e embaixo),
      // e ±6% da imagem (≈7% da moldura) nunca expõe o fundo.
      gsap.fromTo(
        img,
        { yPercent: -6 },
        { yPercent: 6, ease: 'none', scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true } },
      );
    });
  });

  // Recalcula depois que imagens/fontes/widget mudam a altura da página.
  window.addEventListener('load', () => ScrollTrigger.refresh());
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  const shapo = document.querySelector('.shapo-slot');
  if (shapo) {
    let t;
    new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => ScrollTrigger.refresh(), 150);
    }).observe(shapo);
  }
}
