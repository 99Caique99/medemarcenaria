// Orquestra o móvel por breakpoint (gsap.matchMedia):
//   • rail (desktop/paisagem): prancha fixa; cada seção avança uma etapa (scrub)
//   • sem rail (mobile/tablet): checkpoints inline entre as seções + barra de progresso
//   • prefers-reduced-motion: estados estáticos, sem scrub
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { RAIL_MQ } from '../breakpoints.js';
import { buildTimeline, STAGES } from './timeline.js';

gsap.registerPlugin(ScrollTrigger);

// Seção que conduz cada etapa (desktop)
const RAIL_STAGES = [
  { trigger: '#inicio', start: 'top top', end: 'bottom 45%' },
  { trigger: '[data-stage="2"]', start: 'top 80%', end: 'bottom 45%' },
  { trigger: '[data-stage="3"]', start: 'top 80%', end: 'bottom 45%' },
  { trigger: '[data-stage="4"]', start: 'top 80%', end: 'bottom 45%' },
  { trigger: '#features-section', start: 'top 75%', end: 'bottom 55%' },
  { trigger: '#depoimentos', start: 'top 75%', end: 'bottom 55%' },
  { trigger: '#contato', start: 'top 85%', end: 'clamp(top 25%)' },
];

// Checkpoints (mobile/tablet): onde entram e qual trecho da montagem mostram
const CHECKPOINTS = [
  { before: '[data-stage="2"]', from: 0, to: 2 },
  { before: '[data-stage="3"]', from: 2, to: 3 },
  { before: '[data-stage="4"]', from: 3, to: 4 },
  { before: '#features-section .features-grid', from: 4, to: 5 },
  { before: '#contato .footer-head', from: 5, to: 7 },
];

const pad = (n) => String(n).padStart(2, '0');
const stageNum = (time) => Math.min(STAGES, Math.max(1, Math.ceil(time - 1e-3)));

function breathing(svg) {
  return gsap.to(svg.querySelector('[data-part="movel"]'), {
    scale: 1.012, transformOrigin: '50% 100%', duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1, paused: true,
  });
}

function railMode(svg, sheet, reduce) {
  const num = sheet.querySelector('.sheet-num');
  if (reduce) {
    num.dataset.num = pad(STAGES);
    sheet.classList.add('is-done');
    return () => sheet.classList.remove('is-done');
  }

  const tl = buildTimeline(svg);
  const breathe = breathing(svg);
  const intro = { p: 0 };
  // onRefresh dispara já durante o create(): a lista precisa existir antes.
  const triggers = [];
  RAIL_STAGES.forEach((s) => triggers.push(ScrollTrigger.create({ ...s, onUpdate: update, onRefresh: update })));

  function update() {
    // Etapas são sequenciais: a soma dos progressos é a posição na montagem.
    const time = triggers.reduce((sum, st, i) => sum + (i === 0 ? Math.max(intro.p, st.progress) : st.progress), 0);
    gsap.to(tl, { time, duration: 0.6, ease: 'power3.out', overwrite: true });
    num.dataset.num = pad(stageNum(time));
    const done = time >= STAGES - 0.02;
    sheet.classList.toggle('is-done', done);
    done ? breathe.play() : breathe.pause(0);
  }

  // Etapa 01 se desenha sozinha ao abrir a página (e também acompanha o scroll do hero).
  gsap.to(intro, { p: 1, duration: 2.2, delay: 0.5, ease: 'power1.inOut', onUpdate: update });
  update();

  return () => {
    breathe.kill();
    tl.progress(1).kill();
    sheet.classList.remove('is-done');
    num.dataset.num = pad(STAGES);
  };
}

function checkpointMode(source, reduce) {
  const created = [];
  const navbar = document.getElementById('navbar');

  for (const cp of CHECKPOINTS) {
    const anchor = document.querySelector(cp.before);
    if (!anchor) continue;
    const svg = source.cloneNode(true);
    svg.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    svg.removeAttribute('id');

    const fig = document.createElement('figure');
    fig.className = 'checkpoint';
    fig.setAttribute('aria-hidden', 'true');
    const sheet = document.createElement('div');
    sheet.className = 'checkpoint-sheet';
    sheet.append(svg);
    fig.append(sheet);
    anchor.before(fig);
    created.push(fig);

    const tl = buildTimeline(svg);
    const last = cp.to === STAGES;
    if (reduce) {
      tl.time(cp.to);
      sheet.classList.toggle('is-done', last);
      continue;
    }
    tl.time(cp.from);
    const breathe = last ? breathing(svg) : null;
    gsap.to(tl, {
      time: cp.to,
      ease: 'none',
      scrollTrigger: {
        trigger: sheet,
        start: 'top 92%',
        end: 'bottom 35%',
        scrub: 0.6,
        onUpdate(self) {
          if (!last) return;
          const done = self.progress > 0.98;
          sheet.classList.toggle('is-done', done);
          done ? breathe.play() : breathe.pause(0);
        },
      },
    });
  }

  let bar;
  if (!reduce && navbar) {
    bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    navbar.append(bar);
    gsap.to(bar, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
  }

  ScrollTrigger.refresh();
  return () => {
    created.forEach((el) => el.remove());
    bar?.remove();
  };
}

export function initFurniture() {
  const railSvg = document.querySelector('#movel-rail .movel');
  const sheet = document.querySelector('.rail-sheet');
  if (!railSvg || !sheet) return;

  gsap.matchMedia().add(
    // 'all' garante que o callback rode também quando nenhuma outra condição bate (mobile).
    { all: '(min-width: 0px)', rail: RAIL_MQ, reduce: '(prefers-reduced-motion: reduce)' },
    ({ conditions }) => (conditions.rail ? railMode(railSvg, sheet, conditions.reduce) : checkpointMode(railSvg, conditions.reduce)),
  );
}
