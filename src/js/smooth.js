// Rolagem com inércia (Lenis) no desktop com mouse/trackpad: a roda deixa de
// andar em "degraus" e o móvel 3D, o parallax e os reveals acompanham sem tranco.
// Toque e reduced-motion continuam com a rolagem nativa.
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initSmoothScroll() {
  if (!matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return;

  const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Âncoras internas: mesma rolagem suave, descontando a navbar (e a faixa do 3D).
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    const id = a?.getAttribute('href');
    if (!id || id === '#' || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    const offset = -parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop || '0');
    lenis.scrollTo(target, { offset, onComplete: () => target.focus?.({ preventScroll: true }) });
    history.pushState(null, '', id);
  });
}
