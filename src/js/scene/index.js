// Montagem do móvel conduzida pela rolagem:
//   • desktop (coluna): fixo à direita do "Sobre" até o rodapé, o conteúdo rola à esquerda
//   • celular/tablet (capítulo): seção própria em tela cheia (#montagem); o miolo fica
//     grudado na tela enquanto o móvel se monta em 4 etapas, depois o site segue normal.
//     (A antiga faixa fixa ocupava meia tela por cima de todo o conteúdo.)
// O hero continua sendo a foto (aparece de imediato). Progressive enhancement:
// sem JS → nada muda; reduced-motion → desktop mostra o móvel pronto, mobile sem faixa.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

// Manter em sincronia com src/styles/scene.css
const COL_MQ = '(min-width: 1280px) and (min-height: 560px), (min-width: 1024px) and (orientation: landscape) and (min-height: 560px)';
const CHAP_MQ = '(max-width: 1279px) and (min-height: 500px) and (prefers-reduced-motion: no-preference)';
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

// Etapas do capítulo (legendas), pelo progresso da montagem — ver STEPS em
// scripts/render/guarda_roupa.py: base, estrutura (laterais/tampo/fundo), interior, portas.
const ETAPAS = [0.12, 0.42, 0.68];

async function mount({ createStage }, mode, reduce) {
  const chap = mode === 'chap';
  const section = chap ? document.getElementById('montagem') : null;
  const el = chap ? section?.querySelector('.montagem-palco') : document.createElement('div');
  if (!el) return () => {};
  if (!chap) {
    el.className = `stage3d stage3d--${mode}`;
    el.setAttribute('aria-hidden', 'true');
    document.body.append(el);
  }
  root.classList.add(`stage-${mode}-on`);

  let stage;
  try {
    // vão livre do capítulo, em px do palco: do fim do título ao começo da legenda
    const area = chap && (() => {
      const r = el.getBoundingClientRect();
      return {
        top: section.querySelector('.montagem-head').getBoundingClientRect().bottom - r.top + 8,
        bottom: section.querySelector('.montagem-etapas').getBoundingClientRect().top - r.top + 6,
      };
    });
    stage = await createStage(el, { mobile: chap, area });
  } catch {
    // Imagens indisponíveis: libera o espaço reservado (e esconde o capítulo).
    if (!chap) el.remove();
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
  const OMEGA = chap ? 7.5 : 9;
  let last = -1;

  // Coluna: aparece quando o hero já saiu quase todo e fica até o fim da página; a
  // montagem termina com o rodapé em cena. Capítulo: a montagem ocupa a rolagem da seção.
  const start = 'top 45%';
  const follow = (self) => { state.target = self.progress; };
  const progress = ScrollTrigger.create({
    ...(chap
      ? { trigger: section, start: 'top top', end: 'bottom bottom' }
      : { trigger: '#sobre', start, endTrigger: '#contato', end: 'clamp(top 35%)' }),
    onUpdate: follow,
    onRefresh: follow,
  });
  const setOn = (self) => {
    const on = self.progress > 0;
    if (on !== el.classList.contains('is-on')) { el.classList.toggle('is-on', on); last = -1; }
  };
  const show = chap ? null : ScrollTrigger.create({
    trigger: '#sobre',
    start,
    end: 'bottom top',
    onUpdate: setOn,
    onRefresh: setOn,
  });
  if (chap) el.classList.add('is-on');

  // Capítulo: legenda e barra da etapa atual
  const itens = chap ? [...section.querySelectorAll('.montagem-etapas li')] : [];
  const barras = chap ? [...section.querySelectorAll('.montagem-barra i')] : [];
  let etapa = -1;
  const legenda = (p) => {
    const k = ETAPAS.filter((x) => p >= x).length;
    if (k === etapa) return;
    etapa = k;
    itens.forEach((li, i) => li.classList.toggle('is-on', i === k));
    barras.forEach((b, i) => b.classList.toggle('is-on', i <= k));
  };

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
    // capítulo: começa com a base já entrando em cena (t = 0,06), não com o palco vazio
    const t = chap ? 0.06 + 0.94 * state.current : state.current;
    stage.setProgress(t);
    if (chap) legenda(t);
  }
  gsap.ticker.add(tick);

  const ro = new ResizeObserver(() => { stage.resize(); last = -1; });
  ro.observe(el);
  ScrollTrigger.refresh();

  return () => {
    gsap.ticker.remove(tick);
    ro.disconnect();
    [progress, show].forEach((t) => t?.kill());
    stage.dispose();
    if (!chap) el.remove();
    root.classList.remove(`stage-${mode}-on`);
  };
}

export function initStage() {
  if (!root.classList.contains('stage-ok')) return;
  let modPromise;
  const load = () => (modPromise ??= import('./sequence.js'));

  // 'all' garante que o callback rode mesmo quando só uma condição muda.
  gsap.matchMedia().add({ all: '(min-width: 0px)', col: COL_MQ, chap: CHAP_MQ, reduce: REDUCE }, ({ conditions }) => {
    const mode = conditions.col ? 'col' : conditions.chap ? 'chap' : null;
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
