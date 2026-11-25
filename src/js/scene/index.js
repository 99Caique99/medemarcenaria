// Palco 3D do móvel, do "Sobre" até o rodapé:
//   • desktop (coluna): fixo à direita, o conteúdo rola à esquerda
//   • mobile/tablet (faixa): fixo logo abaixo da navbar, o conteúdo rola embaixo
// A montagem avança continuamente com a rolagem; o móvel fica pronto no rodapé.
// O hero continua sendo a foto (aparece de imediato). Progressive enhancement:
// sem JS → nada muda; reduced-motion → desktop mostra o móvel pronto, mobile sem faixa.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

// Manter em sincronia com src/styles/scene.css
const COL_MQ = '(min-width: 1280px) and (min-height: 560px), (min-width: 1024px) and (orientation: landscape) and (min-height: 560px)';
const BAND_MQ = '(max-width: 1279px) and (min-height: 500px) and (prefers-reduced-motion: no-preference)';
const REDUCE = '(prefers-reduced-motion: reduce)';

const root = document.documentElement;

// Ninguém vê o móvel antes do "Sobre": as fotos da montagem só são carregadas quando o visitante
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
    // Imagens indisponíveis: libera o espaço reservado.
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

  // Progresso com mola criticamente amortecida (não um lerp): a montagem ganha e perde
  // velocidade aos poucos, sem tranco quando a rolagem começa ou para, e os saltos
  // discretos do scroll por toque (celular) viram movimento contínuo.
  const state = { target: 0, current: 0, vel: 0 };
  const OMEGA = mode === 'band' ? 7.5 : 9;
  let last = -1;

  // O palco aparece quando o hero já saiu quase todo e fica até o fim da página
  // (inclusive no último pixel de scroll); some de volta ao subir para o hero.
  // A montagem começa no mesmo ponto e termina com o rodapé em cena.
  const start = mode === 'band' ? 'top 30%' : 'top 45%';
  const progress = ScrollTrigger.create({
    trigger: '#sobre',
    start,
    endTrigger: '#contato',
    end: 'clamp(top 35%)',
    onUpdate: (self) => { state.target = self.progress; },
    onRefresh: (self) => { state.target = self.progress; },
  });
  const setOn = (self) => {
    const on = self.progress > 0;
    if (on !== el.classList.contains('is-on')) { el.classList.toggle('is-on', on); last = -1; }
  };
  const show = ScrollTrigger.create({
    trigger: '#sobre',
    start,
    end: 'bottom top',
    onUpdate: setOn,
    onRefresh: setOn,
  });
  // Faixa do mobile: assume a cor da seção que está passando logo abaixo dela,
  // então não aparece como uma caixa de outra cor sobre o conteúdo.
  let toneKey = '';
  const bgOf = (n) => {
    for (; n && n !== document.documentElement; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) return c;
    }
    return getComputedStyle(document.body).backgroundColor;
  };
  const retone = () => {
    if (mode !== 'band') return;
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(4, Math.min(innerHeight - 1, r.bottom + 2));
    const sec = hit?.closest('section, footer') ?? hit;
    if (!sec || sec.id + sec.className === toneKey) return;
    toneKey = sec.id + sec.className;
    el.style.setProperty('--band-bg', bgOf(sec));
  };
  const tone = mode === 'band' ? ScrollTrigger.create({ start: 0, end: 'max', onUpdate: retone, onRefresh: retone }) : null;

  function tick(_, deltaMs) {
    if (!el.classList.contains('is-on')) return; // fora de cena: não renderiza
    const dt = Math.min(deltaMs, 50) / 1000;
    const x = state.target - state.current;
    state.vel += (OMEGA * OMEGA * x - 2 * OMEGA * state.vel) * dt;
    state.current += state.vel * dt;
    if (Math.abs(x) < 1e-4 && Math.abs(state.vel) < 1e-3) { state.current = state.target; state.vel = 0; }
    state.current = Math.min(1, Math.max(0, state.current));
    if (Math.abs(state.current - last) < 1e-5) return;
    last = state.current;
    stage.setProgress(state.current);
  }
  gsap.ticker.add(tick);

  const ro = new ResizeObserver(() => { stage.resize(); stage.setProgress(state.current); last = state.current; });
  ro.observe(el);
  ScrollTrigger.refresh();

  return () => {
    gsap.ticker.remove(tick);
    ro.disconnect();
    [progress, show, tone].forEach((t) => t?.kill());
    stage.dispose();
    el.remove();
    root.classList.remove(`stage-${mode}-on`);
  };
}

export function initStage() {
  if (!root.classList.contains('stage-ok')) return;
  let modPromise;
  const load = () => (modPromise ??= import('./sequence.js'));

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
