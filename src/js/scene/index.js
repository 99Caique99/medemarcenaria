// Palco 3D do móvel, do "Sobre" até o rodapé:
//   • desktop (coluna): fixo à direita, o conteúdo rola à esquerda
//   • mobile/tablet (faixa): fixo logo abaixo da navbar, o conteúdo rola embaixo
// Cada seção avança um trecho da montagem; o móvel fica pronto no rodapé.
// O hero continua sendo a foto (aparece de imediato). Progressive enhancement:
// sem JS/WebGL → nada muda; reduced-motion → desktop mostra o móvel pronto, mobile sem faixa.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

// Manter em sincronia com src/styles/scene.css
const COL_MQ = '(min-width: 1280px) and (min-height: 560px), (min-width: 1024px) and (orientation: landscape) and (min-height: 560px)';
const BAND_MQ = '(max-width: 1279px) and (min-height: 500px) and (prefers-reduced-motion: no-preference)';
const REDUCE = '(prefers-reduced-motion: reduce)';

// Trecho da montagem conduzido por cada seção [início, fim] (ver stage.js)
const SEGMENTS = [
  { trigger: '[data-stage="2"]', range: [0, 0.3] },
  { trigger: '[data-stage="3"]', range: [0.3, 0.48] },
  { trigger: '[data-stage="4"]', range: [0.48, 0.66] },
  { trigger: '#features-section', range: [0.66, 0.78] },
  { trigger: '#depoimentos', range: [0.78, 0.9] },
  { trigger: '#contato', range: [0.9, 1], end: 'clamp(top 35%)' },
];

const root = document.documentElement;

// Ninguém vê o móvel antes do "Sobre": o three.js só é carregado quando o visitante
// começa a rolar/interagir (ou se a página já abriu no meio, por âncora ou restauração).
function whenNeeded(fn) {
  const events = ['scroll', 'wheel', 'touchstart', 'keydown', 'pointerdown'];
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    events.forEach((e) => window.removeEventListener(e, run));
    'requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 300 }) : setTimeout(fn, 50);
  };
  const arm = () => (window.scrollY > 0 ? run() : events.forEach((e) => window.addEventListener(e, run, { passive: true })));
  document.readyState === 'complete' ? arm() : window.addEventListener('load', arm, { once: true });
}

async function mount({ createStage }, mode, reduce) {
  const el = document.createElement('div');
  el.className = `stage3d stage3d--${mode}`;
  el.setAttribute('aria-hidden', 'true');
  document.body.append(el);
  root.classList.add(`stage-${mode}-on`);

  let stage;
  try {
    stage = await createStage(el, { mobile: mode === 'band' });
  } catch {
    // WebGL indisponível de fato: libera o espaço reservado.
    el.remove();
    root.classList.remove('stage-ok', `stage-${mode}-on`);
    ScrollTrigger.refresh();
    return () => {};
  }

  // Reduced-motion (desktop): móvel pronto e estático.
  if (reduce) {
    el.classList.add('is-on');
    stage.setProgress(1);
    const ro = new ResizeObserver(() => { stage.resize(); stage.setProgress(1); });
    ro.observe(el);
    return () => { ro.disconnect(); stage.dispose(); el.remove(); root.classList.remove(`stage-${mode}-on`); };
  }

  const state = { target: 0, current: 0 };
  let last = -1;

  const triggers = [];
  const segs = SEGMENTS.filter((s) => document.querySelector(s.trigger));
  // Etapas sequenciais: a soma dos progressos ponderados é a posição na montagem.
  const sum = () => triggers.reduce((acc, st, i) => acc + st.progress * (segs[i].range[1] - segs[i].range[0]), 0);
  segs.forEach((s) => {
    triggers.push(ScrollTrigger.create({
      trigger: s.trigger,
      start: 'top 75%',
      end: s.end ?? 'bottom 60%',
      onUpdate: () => { state.target = sum(); },
      onRefresh: () => { state.target = sum(); },
    }));
  });

  // O palco aparece quando o hero já saiu quase todo e fica até o fim da página
  // (inclusive no último pixel de scroll); some de volta ao subir para o hero.
  const setOn = (self) => {
    const on = self.progress > 0;
    if (on !== el.classList.contains('is-on')) { el.classList.toggle('is-on', on); last = -1; }
  };
  const show = ScrollTrigger.create({
    trigger: '#sobre',
    start: mode === 'band' ? 'top 30%' : 'top 45%',
    end: 'bottom top',
    onUpdate: setOn,
    onRefresh: setOn,
  });
  // Faixa do mobile escurece sobre o rodapé marrom.
  const tone = mode === 'band'
    ? ScrollTrigger.create({ trigger: '#contato', start: 'top 45%', end: 'bottom top', toggleClass: { targets: el, className: 'is-dark' } })
    : null;

  function tick(_, deltaMs) {
    if (!el.classList.contains('is-on')) return; // fora de cena: não renderiza
    const k = 1 - Math.exp((-deltaMs / 1000) * 6);
    state.current += (state.target - state.current) * k;
    if (Math.abs(state.target - state.current) < 1e-4) state.current = state.target;
    if (Math.abs(state.current - last) < 1e-5) return;
    last = state.current;
    stage.setProgress(state.current);
  }
  gsap.ticker.add(tick);

  const ro = new ResizeObserver(() => { stage.resize(); last = -1; });
  ro.observe(el);
  ScrollTrigger.refresh();

  return () => {
    gsap.ticker.remove(tick);
    ro.disconnect();
    [...triggers, show, tone].forEach((t) => t?.kill());
    stage.dispose();
    el.remove();
    root.classList.remove(`stage-${mode}-on`);
  };
}

export function initStage() {
  if (!root.classList.contains('stage-ok')) return;
  let modPromise;
  const load = () => (modPromise ??= import('./stage.js'));

  // 'all' garante que o callback rode mesmo quando só uma condição muda.
  gsap.matchMedia().add({ all: '(min-width: 0px)', col: COL_MQ, band: BAND_MQ, reduce: REDUCE }, ({ conditions }) => {
    const mode = conditions.col ? 'col' : conditions.band ? 'band' : null;
    if (!mode) return;
    let cleanup = () => {};
    let cancelled = false;
    whenNeeded(() => {
      if (cancelled) return;
      load()
        .then((mod) => mount(mod, mode, conditions.reduce))
        .then((dispose) => (cancelled ? dispose() : (cleanup = dispose)))
        .catch(() => {});
    });
    return () => { cancelled = true; cleanup(); };
  });
}
