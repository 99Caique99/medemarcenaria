// Montagem do guarda-roupa a partir das 9 fotos (assets/montagem), sincronizada com a rolagem.
// As fotos foram alinhadas pelo móvel (scripts/montagem.py): o móvel fica parado no mesmo
// lugar e cada etapa acrescenta peças por cima, então nada "pula" de uma foto para a outra.
//
//   T1 base        desce do alto e assenta no chão da sala vazia
//   T2 laterais    descem do alto, com um leve balanço amortecido
//   T3 tampo       desce do alto e fica pairando sobre as laterais
//   T4 fundo       o tampo assenta e o fundo aparece (dissolve)
//   T5 prateleiras divisória e prateleiras são empurradas para dentro
//   T6 gavetas     gavetas e cabideiro são empurrados para dentro
//   T7 portas      as portas aparecem abertas nas dobradiças (dissolve)
//   T8 fechar      as folhas giram nas dobradiças e fecham
//   T9 abrir       abrem de novo, com o interior arrumado e a luz acesa
//
// Só imagens e transform/opacity (camadas na GPU): leve no celular, sem WebGL.
import { gsap } from 'gsap';
import data from '../../montagem.json';

const S = data.size; // 1200: coordenadas das fotos alinhadas
const P = data.pieces;
// Caixa do móvel (com folga em cima para as peças que descem) — enquadramento
const BOX = { x0: 270, x1: 930, y0: 280, y1: 1040 };

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const win = (p, a, b) => clamp01((p - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const E = {
  travel: gsap.parseEase('power3.out'), // entra em movimento e desacelera até parar
  seat: gsap.parseEase('sine.inOut'),
  close: gsap.parseEase('power3.inOut'), // embalo e freio do amortecedor
  fade: gsap.parseEase('sine.inOut'),
};

// Etapas: tipo de transição de cada uma
const STEPS = ['drop', 'drop', 'drop', 'fade', 'push', 'push', 'fade', 'close', 'open'];
// Cada etapa ocupa um trecho igual da rolagem: começa logo no início do trecho
// e termina a 80% dele (o resto é pausa na foto pronta, para dar tempo de ver).
const END = 0.95;
const SEG = END / STEPS.length;
const span = (i) => [i * SEG + SEG * 0.04, i * SEG + SEG * 0.8];

function picture(name, w, cls) {
  const pic = document.createElement('picture');
  const src = document.createElement('source');
  src.type = 'image/avif';
  src.srcset = `montagem/${name}-${w}.avif`;
  const img = document.createElement('img');
  img.src = `montagem/${name}-${w}.webp`;
  img.alt = '';
  img.decoding = 'async';
  img.draggable = false;
  pic.append(src, img);
  pic.className = cls;
  return { el: pic, img };
}

export async function createStage(container, { mobile }) {
  // 720 px só em telas de baixa densidade; as fotos em AVIF são leves (~15 KB cada)
  const size = mobile && window.devicePixelRatio < 2 ? data.sizes[1] : data.sizes[0];
  const k = size / S;

  const view = document.createElement('div');
  view.className = 'montagem';
  const scene = document.createElement('div');
  scene.className = 'montagem__scene';
  view.append(scene);
  container.append(view);

  const frames = [];
  for (let i = 0; i <= 9; i++) {
    const f = picture(`f${i}`, size, 'montagem__frame');
    f.el.style.opacity = '0';
    scene.append(f.el);
    frames.push(f);
  }
  const piece = (name) => {
    const p = P[name];
    const f = picture(name, Math.round(p.w * k), 'montagem__piece');
    Object.assign(f.el.style, { left: `${p.x}px`, top: `${p.y}px`, width: `${p.w}px`, height: `${p.h}px`, opacity: '0' });
    f.box = p;
    scene.append(f.el);
    return f;
  };
  // Peças na ordem de empilhamento (as portas por cima de tudo)
  const pieces = { 1: piece('p1'), 2: piece('p2'), 3: piece('p3'), 5: piece('p5'), 6: piece('p6') };
  const leaves = [piece('portaE'), piece('portaD')];
  leaves[0].el.style.transformOrigin = '0% 50%'; // dobradiça à esquerda
  leaves[1].el.style.transformOrigin = '100% 50%'; // dobradiça à direita

  // Tudo decodificado antes do primeiro quadro: nenhuma foto "pisca" ao entrar.
  await Promise.all([...frames, ...Object.values(pieces), ...leaves].map((f) => f.img.decode().catch(() => {})));

  // ---------- Enquadramento ----------
  let base = { s: 1, tx: 0, ty: 0 };
  function resize() {
    const w = Math.max(1, container.clientWidth);
    const H = Math.max(1, container.clientHeight);
    // Na faixa do celular os 20% de baixo são um degradê sobre o texto: o móvel
    // inteiro (com os pés) fica na parte sólida.
    const h = mobile ? H * 0.82 : H;
    const bw = BOX.x1 - BOX.x0, bh = BOX.y1 - BOX.y0;
    const s = Math.min(w / bw, h / bh) * (mobile ? 1 : 0.92);
    let tx = w / 2 - ((BOX.x0 + BOX.x1) / 2) * s;
    let ty = h / 2 - ((BOX.y0 + BOX.y1) / 2) * s;
    // A foto cobre o palco sempre que possível (sem bordas vazias)
    if (S * s >= w) tx = Math.min(0, Math.max(w - S * s, tx));
    if (S * s >= H) ty = Math.min(0, Math.max(H - S * s, ty));
    base = { s, tx, ty };
    last = -1;
  }
  let last = -1;

  const show = (f, o, transform = '') => {
    f.el.style.opacity = o > 0.001 ? String(Math.min(1, o)) : '0';
    f.el.style.visibility = o > 0.001 ? 'visible' : 'hidden';
    f.el.style.transform = transform;
  };

  // ---------- Progresso ----------
  function setProgress(p) {
    if (Math.abs(p - last) < 1e-5) return;
    last = p;
    // Câmera: aproximação lenta e contínua ao longo de toda a montagem
    const zoom = 1 + 0.045 * smooth(p);
    const cx = (BOX.x0 + BOX.x1) / 2, cy = (BOX.y0 + BOX.y1) / 2;
    scene.style.transform = `translate(${base.tx}px, ${base.ty}px) scale(${base.s}) translate(${cx}px, ${cy}px) scale(${zoom}) translate(${-cx}px, ${-cy}px)`;

    const t = STEPS.map((_, i) => win(p, ...span(i)));
    const done = t.filter((v) => v >= 1).length; // etapas concluídas
    const i = done; // etapa em curso (0-based), se houver
    const ti = i < STEPS.length ? t[i] : 0;

    // Foto de base: a última etapa pronta
    frames.forEach((f, n) => show(f, n === done ? 1 : 0));
    Object.values(pieces).forEach((f) => show(f, 0));
    leaves.forEach((f) => show(f, 0));
    if (i >= STEPS.length || ti <= 0) return;

    const next = frames[i + 1];
    const type = STEPS[i];
    if (type === 'drop') {
      const pc = pieces[i + 1];
      const travel = 1 - E.travel(win(ti, 0, 0.78));
      const seat = 1 - E.seat(win(ti, 0.6, 0.86));
      const dy = -(pc.box.y + pc.box.h + 120) * travel - 8 * seat; // vem de fora do quadro, por cima
      const sway = 2.2 * Math.cos(ti * Math.PI * 3) * (1 - ti) ** 2; // balanço que se amortece
      show(pc, 1 - smooth(win(ti, 0.9, 1)), `translateY(${dy}px) rotate(${i === 1 ? 0 : sway}deg)`);
      show(next, smooth(win(ti, 0.8, 1)));
    } else if (type === 'push') {
      const pc = pieces[i + 1];
      const e = E.travel(win(ti, 0, 0.85));
      const sc = 1 + 0.14 * (1 - e); // vem da frente (maior) e entra até o lugar
      show(pc, smooth(win(ti, 0, 0.3)) * (1 - smooth(win(ti, 0.9, 1))), `translateY(${26 * (1 - e)}px) scale(${sc})`);
      show(next, smooth(win(ti, 0.78, 1)));
    } else if (type === 'fade') {
      const e = E.fade(ti);
      show(next, e, `scale(${1 + 0.012 * (1 - e)})`);
    } else if (type === 'close') {
      // As portas abertas da foto 7 dão lugar às folhas que giram (foto 6 por baixo)
      show(frames[6], smooth(win(ti, 0, 0.25)));
      const a = 86 * (1 - E.close(win(ti, 0.04, 0.86)));
      show(leaves[0], smooth(win(ti, 0, 0.12)), `perspective(1400px) rotateY(${-a}deg)`);
      show(leaves[1], smooth(win(ti, 0, 0.12)), `perspective(1400px) rotateY(${a}deg)`);
      show(next, smooth(win(ti, 0.86, 1)));
    } else if (type === 'open') {
      // Abrem de novo: por baixo já está o interior arrumado e iluminado
      show(next, smooth(win(ti, 0.05, 0.4)));
      const a = 78 * E.close(win(ti, 0, 0.9));
      const o = 1 - smooth(win(ti, 0.55, 0.95));
      show(leaves[0], o, `perspective(1400px) rotateY(${-a}deg)`);
      show(leaves[1], o, `perspective(1400px) rotateY(${a}deg)`);
    }
  }

  resize();
  setProgress(0);

  function dispose() {
    view.remove();
  }
  return { setProgress, resize, dispose };
}
