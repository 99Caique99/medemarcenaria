// Abertura cinematográfica: o hero vira uma cena fixada (pinned) e o móvel é
// construído em 3D enquanto o visitante rola. Progressive enhancement:
// sem JS, sem WebGL, aparelho fraco, tela muito baixa ou prefers-reduced-motion
// → o hero clássico (foto + texto) continua exatamente como está.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const SCENE_MQ = '(prefers-reduced-motion: no-preference) and (min-height: 500px)';
const STAGES = 4;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ramp = (p, a, b) => {
  const t = clamp01((p - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function capable() {
  if ((navigator.hardwareConcurrency || 8) <= 2) return false;
  if ((navigator.deviceMemory || 8) < 2) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// Só carrega o three.js depois do conteúdo (não disputa com o LCP).
function whenIdle(fn) {
  const go = () => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 200));
  document.readyState === 'complete' ? go() : window.addEventListener('load', go, { once: true });
}

function buildHud() {
  const hud = document.createElement('div');
  hud.className = 'scene-hud';
  hud.setAttribute('aria-hidden', 'true');
  hud.innerHTML = '<span class="scene-hud-num" data-num="01"></span><span class="scene-hud-track"><span class="scene-hud-fill"></span></span><span class="scene-hud-total" data-num="04"></span>';
  return hud;
}

function mount(hero, { createStage }) {
  const media = hero.querySelector('.hero-media');
  const photo = hero.querySelector('.hero-image');
  const content = hero.querySelector('.hero-content');
  const cue = hero.querySelector('.scroll-cue');
  const wide = () => window.innerWidth >= 1024;

  hero.classList.add('has-scene');
  const holder = document.createElement('div');
  holder.className = 'hero-stage';
  media.after(holder);
  const stage = createStage(holder, { mobile: !wide() });
  const hud = buildHud();
  hero.append(hud);
  const hudNum = hud.querySelector('.scene-hud-num');
  const hudFill = hud.querySelector('.scene-hud-fill');

  const state = { target: 0, current: 0, intro: 0, fade: 0, active: true };
  let last = -1;
  let lastFade = -1;

  const trigger = ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    end: () => `+=${window.innerHeight * (wide() ? 4 : 3.2)}`,
    pin: true,
    pinSpacing: true,
    anticipatePin: 1,
    refreshPriority: 1, // o pin vem antes dos demais triggers da página
    invalidateOnRefresh: true,
    onUpdate: (self) => { state.target = self.progress; },
    onToggle: (self) => { state.active = self.isActive || self.progress < 1; },
  });

  // A animação CSS de entrada (fill-mode both) prenderia a opacidade do texto.
  content.getAnimations().forEach((a) => a.finish());
  content.style.animation = 'none';

  // Desktop: a cena aparece sozinha ao lado do texto e as linhas começam a desenhar.
  // Mobile: a chegada é o hero clássico (foto); a cena entra no primeiro scroll.
  if (wide()) {
    gsap.to(state, { fade: 1, duration: 1.4, ease: 'power2.out' });
    gsap.to(state, { intro: 0.12, duration: 2.6, delay: 0.35, ease: 'power1.inOut' });
  } else {
    state.fade = 1;
  }

  function applyDom(p) {
    const out = ramp(p, 0.92, 1); // dissolve para a foto real do armário
    const enter = wide() ? state.fade : ramp(p, 0, 0.05);
    holder.style.opacity = String(enter * (1 - out));
    photo.style.transform = `scale(${1.06 - 0.06 * out})`;
    hudNum.dataset.num = String(Math.min(STAGES, Math.max(1, Math.ceil(p * STAGES - 1e-3)))).padStart(2, '0');
    hudFill.style.transform = `scaleX(${p})`;
    hud.style.opacity = String(enter * (1 - ramp(p, 0.9, 0.98)));
    if (cue) cue.style.opacity = String(1 - ramp(p, 0.005, 0.04));
    // Mobile/tablet: o texto dá lugar ao móvel e volta sobre a foto no final.
    if (!wide()) {
      const vis = 1 - ramp(p, 0.005, 0.05) + ramp(p, 0.93, 1);
      content.style.opacity = String(vis);
      content.style.transform = `translateY(${(1 - vis) * -24}px)`;
      content.style.pointerEvents = vis < 0.5 ? 'none' : '';
    } else {
      content.style.opacity = '';
      content.style.transform = '';
      content.style.pointerEvents = '';
    }
  }

  function tick(_, deltaMs) {
    if (!state.active && state.fade === lastFade) return;
    const k = 1 - Math.exp((-deltaMs / 1000) * 7); // suavização independente de FPS
    state.current += (state.target - state.current) * k;
    if (Math.abs(state.target - state.current) < 1e-4) state.current = state.target;
    const p = Math.max(state.current, state.intro);
    if (Math.abs(p - last) < 1e-5 && state.fade === lastFade) return; // nada mudou: não renderiza
    last = p;
    lastFade = state.fade;
    stage.setProgress(p);
    applyDom(p);
  }
  gsap.ticker.add(tick);

  const ro = new ResizeObserver(() => {
    stage.resize();
    last = -1;
  });
  ro.observe(hero);
  ScrollTrigger.refresh();

  return () => {
    gsap.ticker.remove(tick);
    ro.disconnect();
    trigger.kill(true);
    stage.dispose();
    holder.remove();
    hud.remove();
    hero.classList.remove('has-scene');
    [photo, content, cue].forEach((el) => el && el.removeAttribute('style'));
    ScrollTrigger.refresh();
  };
}

export function initScene() {
  const hero = document.getElementById('inicio');
  if (!hero || !capable()) return;

  gsap.matchMedia().add(SCENE_MQ, () => {
    let cleanup = () => {};
    let cancelled = false;
    whenIdle(() => {
      // Se o visitante já rolou para além do hero, não monta a cena (evita salto).
      if (cancelled || window.scrollY > hero.offsetHeight * 0.4) return;
      import('./stage.js')
        .then((mod) => {
          if (!cancelled) cleanup = mount(hero, mod);
        })
        .catch(() => {}); // sem cena: o hero clássico permanece
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  });
}
