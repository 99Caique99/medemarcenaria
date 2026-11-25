// Timeline da montagem do móvel. Cada etapa ocupa 1 unidade de tempo:
//   0–1 Projeto · 1–2 Estrutura · 2–3 Interior · 3–4 Portas
//   4–5 Detalhes · 5–6 Acabamento · 6–7 Entrega
// Anima apenas transform, opacity e stroke-dashoffset.
import { gsap } from 'gsap';

export const STAGES = 7;

export function buildTimeline(svg) {
  const q = (part) => svg.querySelectorAll(`[data-part="${part}"]`);
  const ghosts = svg.querySelectorAll('.ghost');
  const cotaLines = svg.querySelectorAll('.cota');
  const wood = svg.querySelectorAll('.wd');

  // Traços "desenháveis": comprimento real de cada linha
  [...ghosts, ...cotaLines].forEach((p) => {
    const len = Math.ceil(p.getTotalLength()) + 1;
    gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
  });

  // Estado inicial: folha em branco. (O markup é o móvel pronto, para sem-JS.)
  gsap.set([q('guia'), q('cotas')], { opacity: 1 });
  gsap.set(svg.querySelectorAll('.cota-txt'), { opacity: 0 });
  gsap.set(q('rodape'), { y: 40, opacity: 0 });
  gsap.set(q('base'), { y: 50, opacity: 0 });
  gsap.set(q('lateral'), { y: 130, opacity: 0 });
  gsap.set(q('tampo'), { y: -90, opacity: 0 });
  gsap.set(q('fundo'), { opacity: 0 });
  gsap.set(q('divisoria'), { y: -70, opacity: 0 });
  gsap.set(q('prateleira-centro'), { x: 160, opacity: 0 });
  gsap.set(q('prateleira-esq'), { x: -75, opacity: 0 });
  gsap.set(q('prateleira-dir'), { x: 75, opacity: 0 });
  // Perspectiva simulada em 2D (scaleX + skewY a partir da dobradiça):
  // transformações 3D em elementos SVG não são confiáveis no Safari/Firefox.
  gsap.set(q('porta-esq'), { scaleX: 0.12, skewY: -14, opacity: 0, svgOrigin: '81 302' });
  gsap.set(q('porta-dir'), { scaleX: 0.12, skewY: 14, opacity: 0, svgOrigin: '319 302' });
  gsap.set(q('puxador'), { scaleY: 0, opacity: 0, transformOrigin: '50% 50%' });
  gsap.set(q('dobradica'), { scale: 0, opacity: 0, transformOrigin: '50% 50%' });
  gsap.set(q('parafuso'), { rotation: -300, scale: 0.2, opacity: 0, transformOrigin: '50% 50%' });
  gsap.set(q('led'), { opacity: 0 });
  gsap.set(wood, { opacity: 0 });
  gsap.set(q('reflexo'), { x: 0 });
  gsap.set(q('movel'), { y: -10 });
  gsap.set(q('sombra'), { scaleX: 0.4, opacity: 0, transformOrigin: '50% 50%' });
  gsap.set(q('brilho'), { scale: 0, opacity: 0, transformOrigin: '50% 50%' });

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
  const settle = 'back.out(1.6)';

  // 01 · Projeto — linhas e cotas desenhadas
  tl.to(ghosts, { strokeDashoffset: 0, duration: 0.5, stagger: 0.05, ease: 'power2.inOut' }, 0);
  tl.to(cotaLines, { strokeDashoffset: 0, duration: 0.4, stagger: 0.06, ease: 'power2.inOut' }, 0.35);
  tl.to(svg.querySelectorAll('.cota-txt'), { opacity: 1, duration: 0.3, stagger: 0.1 }, 0.6);

  // 02 · Estrutura — sobe e assenta com leve overshoot
  tl.to(q('rodape'), { y: 0, opacity: 1, duration: 0.35, ease: settle }, 1);
  tl.to(q('base'), { y: 0, opacity: 1, duration: 0.35, ease: settle }, 1.08);
  tl.to(q('lateral'), { y: 0, opacity: 1, duration: 0.45, ease: settle, stagger: 0.1 }, 1.18);
  tl.to(q('tampo'), { y: 0, opacity: 1, duration: 0.4, ease: settle }, 1.45);
  tl.to(q('fundo'), { opacity: 1, duration: 0.35, ease: 'none' }, 1.55);
  tl.to(q('guia'), { opacity: 0.4, duration: 0.5, ease: 'none' }, 1.3);

  // 03 · Interior — divisórias descem; prateleiras deslizam uma a uma
  tl.to(q('divisoria'), { y: 0, opacity: 1, duration: 0.35, ease: settle, stagger: 0.1 }, 2);
  tl.to(q('prateleira-centro'), { x: 0, opacity: 1, duration: 0.3, stagger: 0.1 }, 2.25);
  tl.to(q('prateleira-esq'), { x: 0, opacity: 1, duration: 0.3, stagger: 0.1 }, 2.5);
  tl.to(q('prateleira-dir'), { x: 0, opacity: 1, duration: 0.3, stagger: 0.1 }, 2.6);

  // 04 · Portas — giram na dobradiça e fecham
  tl.to(q('porta-esq'), { scaleX: 1, skewY: 0, opacity: 1, duration: 0.6, ease: 'power2.inOut' }, 3.05);
  tl.to(q('porta-dir'), { scaleX: 1, skewY: 0, opacity: 1, duration: 0.6, ease: 'power2.inOut' }, 3.3);

  // 05 · Detalhes — um por diferencial: puxadores, dobradiças, parafusos, LED
  tl.to(q('puxador'), { scaleY: 1, opacity: 1, duration: 0.25, stagger: 0.08 }, 4);
  tl.to(q('dobradica'), { scale: 1, opacity: 1, duration: 0.2, stagger: 0.04, ease: 'back.out(2)' }, 4.25);
  tl.to(q('parafuso'), { rotation: 0, scale: 1, opacity: 1, duration: 0.25, stagger: 0.04 }, 4.5);
  tl.to(q('led'), { opacity: 1, duration: 0.25, ease: 'power1.in' }, 4.75);

  // 06 · Acabamento — madeira substitui o traço do projeto; reflexo de luz
  tl.to(wood, { opacity: 1, duration: 0.35, stagger: 0.012, ease: 'none' }, 5);
  tl.to(q('guia'), { opacity: 0, duration: 0.3, ease: 'none' }, 5);
  tl.to(q('cotas'), { opacity: 0.45, duration: 0.3, ease: 'none' }, 5.3);
  tl.to(q('reflexo'), { x: 620, duration: 0.5, ease: 'power1.inOut' }, 5.45);

  // 07 · Entrega — assenta no chão, sombra e brilho dourado
  tl.to(q('movel'), { y: 0, duration: 0.4, ease: 'bounce.out' }, 6);
  tl.to(q('sombra'), { scaleX: 1, opacity: 1, duration: 0.45 }, 6.05);
  tl.to(q('cotas'), { opacity: 0, duration: 0.3, ease: 'none' }, 6.2);
  tl.to(q('brilho'), { scale: 1, opacity: 1, duration: 0.35, stagger: 0.15, ease: 'back.out(3)' }, 6.45);
  tl.set({}, {}, STAGES);

  return tl;
}
