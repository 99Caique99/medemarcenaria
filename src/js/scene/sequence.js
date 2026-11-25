// Montagem do guarda-roupa como sequência de quadros renderizados (Blender/Cycles,
// scripts/render/guarda_roupa.py), tocada num <canvas> conforme a rolagem — o mesmo
// recurso das páginas de produto da Apple. O progresso p (0 → 1) escolhe o quadro;
// entre dois quadros há um cruzamento suave, então o movimento não "degraus".
//
// Carregamento progressivo: primeiro 1 a cada 8 quadros (a montagem inteira já
// funciona, só mais "espaçada"), depois 1 a cada 4, 2 e todos. Sempre desenha o
// quadro carregado mais próximo.
import data from '../../sequencia.json';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export async function createStage(container, { mobile }) {
  const N = data.frames;
  const size = mobile && window.devicePixelRatio < 2.5 ? data.sizes[1] : data.sizes[0];
  const url = (i) => `montagem/seq/${size}/q${String(i).padStart(4, '0')}.webp`;

  const canvas = document.createElement('canvas');
  canvas.className = 'montagem__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  container.append(canvas);
  const ctx = canvas.getContext('2d');

  const imgs = new Array(N).fill(null);
  const ready = new Uint8Array(N);
  let disposed = false;
  let current = 0;
  let last = { a: -1, b: -1, k: -1 };

  function load(i) {
    if (imgs[i]) return imgs[i].p;
    const img = new Image();
    img.decoding = 'async';
    img.src = url(i);
    const p = img.decode().then(() => { ready[i] = 1; if (Math.abs(i - current) < 10) draw(true); }, () => {});
    imgs[i] = { img, p };
    return p;
  }
  // ordem: 0, 8, 16… depois 4, 12… depois os ímpares — em lotes, sem afogar a rede
  const order = [];
  for (const step of [8, 4, 2, 1]) for (let i = 0; i < N; i += step) if (!order.includes(i)) order.push(i);
  if (!order.includes(N - 1)) order.splice(1, 0, N - 1);
  async function rest() {
    while (order.length && !disposed) {
      // prioriza os quadros perto de onde o visitante está
      order.sort((x, y) => Math.abs(x - current) - Math.abs(y - current));
      await Promise.all(order.splice(0, 6).map(load));
    }
  }
  // montagem completa (espaçada) antes de aparecer; o resto chega em segundo plano
  const firstBatch = Promise.all(order.splice(0, Math.ceil(N / 8) + 1).map(load));
  firstBatch.then(rest);

  // ---------- enquadramento (cover, centrado no móvel) ----------
  let W = 1, H = 1, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, container.clientWidth);
    H = Math.max(1, container.clientHeight);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    last = { a: -1, b: -1, k: -1 };
    draw(true);
  }

  const nearest = (i) => {
    for (let d = 0; d < N; d++) {
      if (i - d >= 0 && ready[i - d]) return i - d;
      if (i + d < N && ready[i + d]) return i + d;
    }
    return -1;
  };

  function paint(i, alpha) {
    const img = imgs[i].img;
    const fw = canvas.width / img.naturalWidth, fh = canvas.height / img.naturalHeight;
    // celular: cobre a faixa. Desktop (coluna em pé): cabe na largura, para as portas
    // abertas não serem cortadas; as bordas se dissolvem no fundo da seção (CSS).
    const s = mobile ? Math.max(fw, fh * 0.86) : Math.max(fw * 1.04, fh * 0.8);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    const x = (canvas.width - w) / 2;
    const y = h > canvas.height ? clamp((canvas.height - h) * (mobile ? 0.62 : 0.5), canvas.height - h, 0) : (canvas.height - h) / 2;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x, y, w, h);
  }

  let progress = 0;
  function draw(force) {
    if (disposed) return;
    const f = progress * (N - 1);
    current = Math.round(f);
    let a = Math.floor(f), b = Math.min(N - 1, a + 1), k = f - a;
    if (!ready[a] || !ready[b]) { a = b = nearest(current); k = 0; }
    if (a < 0) return;
    k = Math.round(k * 24) / 24; // 24 níveis de mistura bastam e evitam redesenhos inúteis
    if (!force && a === last.a && b === last.b && k === last.k) return;
    last = { a, b, k };
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paint(a, 1);
    if (k > 0 && b !== a) paint(b, k);
    ctx.globalAlpha = 1;
  }

  function setProgress(p) {
    progress = clamp(p, 0, 1);
    draw(false);
  }

  resize();
  await firstBatch;
  draw(true);

  return {
    setProgress,
    resize,
    dispose() { disposed = true; canvas.remove(); },
  };
}
