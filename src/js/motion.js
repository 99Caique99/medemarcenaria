// Movimento: abertura do Início (uma vez), fotos que se revelam por recorte ao
// entrar na tela e a trena que acompanha a rolagem.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function initIntro() {
  if (reduce()) return;
  const lines = gsap.utils.toArray('.hero-line > span');
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from(lines, { yPercent: 110, duration: 1.2, stagger: 0.06 }, 0)
    .from('.hero-eyebrow, .hero-lead, .hero-actions', { y: 16, opacity: 0, duration: 1, stagger: 0.08 }, 0.35)
    .from('.hero-media', { clipPath: 'inset(0 0 0 100%)', duration: 1.4, ease: 'expo.inOut' }, 0)
    .from('.hero-image', { scale: 1.15, duration: 1.8 }, 0.1)
    .from('.cota', { scaleY: 0, duration: 1.1, ease: 'expo.inOut' }, 0.9);
}

function initReveals() {
  if (reduce()) return;
  gsap.utils.toArray('.reveal-clip').forEach((frame) => {
    const media = frame.querySelector('img, video');
    const tl = gsap.timeline({
      scrollTrigger: { trigger: frame, start: 'top 85%', once: true },
      defaults: { duration: 1.4, ease: 'expo.inOut' },
    });
    tl.fromTo(frame, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)' });
    if (media) tl.fromTo(media, { scale: 1.18 }, { scale: 1, duration: 1.8, ease: 'expo.out' }, 0.1);
  });
}

// Trena: a escala desliza a metade da velocidade da página; a leitura mostra
// quantos centímetros da escala já passaram pela marca de latão.
function initTape() {
  const tapes = [...document.querySelectorAll('.tape')].map((el) => ({
    el,
    scale: el.querySelector('.tape-scale'),
    read: el.querySelector('.tape-read'),
    axis: el.classList.contains('tape--y') ? 'y' : 'x',
    built: 0,
  }));
  const K = 0.5;

  function build() {
    const max = document.documentElement.scrollHeight - innerHeight;
    for (const t of tapes) {
      if (!t.el.offsetParent && getComputedStyle(t.el).position !== 'fixed') continue;
      const cm = parseFloat(getComputedStyle(t.el).getPropertyValue('--cm')) || 32;
      const len = Math.ceil(max * K + Math.max(innerWidth, innerHeight));
      t.cm = cm;
      t.scale.style.setProperty('--len', `${len}px`);
      const n = Math.ceil(len / cm);
      if (n === t.built) continue;
      const frag = document.createDocumentFragment();
      for (let i = t.built + 1; i <= n; i++) {
        const s = document.createElement('span');
        s.className = 'tape-num';
        s.textContent = i;
        s.style[t.axis === 'y' ? 'top' : 'left'] = `${i * cm}px`;
        frag.append(s);
      }
      t.scale.append(frag);
      t.built = n;
    }
  }

  let ticking = false;
  function update() {
    ticking = false;
    const d = scrollY * K;
    for (const t of tapes) {
      if (!t.cm) continue;
      t.scale.style.transform = t.axis === 'y' ? `translate3d(0,${-d}px,0)` : `translate3d(${-d}px,0,0)`;
      if (t.read) t.read.textContent = `${Math.round(d / t.cm)} cm`;
    }
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };

  build();
  update();
  addEventListener('scroll', onScroll, { passive: true });
  let rt;
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { build(); update(); }, 150); }).observe(document.body);
}

export function initMotion() {
  initIntro();
  initReveals();
  initTape();
  addEventListener('load', () => ScrollTrigger.refresh());
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
