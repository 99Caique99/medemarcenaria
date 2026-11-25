// Texturas de madeira procedurais (canvas), geradas no navegador: nenhuma imagem
// nova é baixada. Modelo de lâmina "flat-sawn": anéis de crescimento cortados pelo
// plano formam as catedrais, com fibras finas e poros ao longo do veio. A mesma
// textura serve de bumpMap (relevo dos veios).
import { CanvasTexture, SRGBColorSpace } from 'three';

// Cede o main thread entre fatias de trabalho (sem tarefas longas).
export const pause = () => new Promise((r) => (globalThis.scheduler?.yield ? globalThis.scheduler.yield().then(r) : setTimeout(r, 0)));

// PRNG determinístico: a madeira sai igual em toda visita.
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Value noise 2D suave + fbm
function makeNoise(rand) {
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = rand(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = vals[perm[X + perm[Y]]], b = vals[perm[X + 1 + perm[Y]]];
    const c = vals[perm[X + perm[Y + 1]]], d = vals[perm[X + 1 + perm[Y + 1]]];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y) => noise(x, y) * 0.57 + noise(x * 2.03, y * 2.03) * 0.29 + noise(x * 4.1, y * 4.1) * 0.14;
  return { noise, fbm };
}

const rgb = (hex) => [16, 8, 0].map((s) => (parseInt(hex.slice(1), 16) >> s) & 255);

export async function woodTexture({ base, dark, light, seed = 7, size = 1024, rings = 40, arch = 0.45, wave = 1, vertical = false, shade = 0, maxAnisotropy = 8 }) {
  const rand = rng(seed);
  const { noise, fbm } = makeNoise(rand);
  const B = rgb(base), D = rgb(dark), L = rgb(light);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const img = g.createImageData(size, size);
  const px = img.data;
  const ox = rand() * 50, oy = rand() * 50;

  for (let y0 = 0; y0 < size; y0 += 64) {
    for (let y = y0; y < Math.min(size, y0 + 64); y++) {
      for (let x = 0; x < size; x++) {
        // u: ao longo do veio; v: através dele
        const u = (vertical ? y : x) / size, v = (vertical ? x : y) / size;
        const warp = fbm(ox + u * 1.6, oy + v * 2.4) - 0.5;
        // Anéis finos com espaçamento irregular; catedral no meio da lâmina; leve ondulação
        const cath = (u - 0.5 - warp * 0.35) ** 2 * arch;
        const r = (v + cath + warp * 0.06 * wave + (noise(ox + u * 5, oy + v * 40) - 0.5) * 0.004) * rings
          + (fbm(ox * 0.5 + u * 0.4, oy + v * 5) - 0.5) * rings * 0.12 * wave;
        const n = Math.floor(r), ring = r - n;
        const strength = 0.35 + noise(n * 0.71 + 0.5, oy) * 0.9;           // cada anel com um contraste
        const late = (Math.pow(ring, 6) * 0.8 + Math.pow(ring, 2) * 0.2) * strength; // lenho tardio, mais escuro
        const fiber = noise(ox + u * 7, oy + v * size * 0.5) - 0.5;       // fibras finas ao longo
        const streak = fbm(oy + u * 0.7, ox + v * 7) - 0.5;              // manchas longas no sentido do veio
        const kL = Math.max(0, 0.18 + streak * 0.9 - late * 0.5);
        const kD = Math.min(1, late * 0.42 + Math.max(0, -streak) * 0.35 + fiber * 0.12 + 0.03);
        // shade: oclusão "assada" nas bordas (fundo do móvel, onde a luz chega menos)
        const edge = shade ? shade * (1 - Math.min(1, Math.min(u, 1 - u, v, 1 - v) * 7)) : 0;
        const i = (y * size + x) * 4;
        for (let c = 0; c < 3; c++) {
          const lit = B[c] + (L[c] - B[c]) * kL;
          px[i + c] = (lit + (D[c] - lit) * Math.max(0, kD)) * (1 - edge);
        }
        px[i + 3] = 255;
      }
    }
    await pause();
  }
  g.putImageData(img, 0, 0);

  // Poros: traços curtos e escuros no sentido do veio
  g.fillStyle = dark;
  for (let i = 0; i < size * 5; i++) {
    g.globalAlpha = 0.04 + rand() * 0.1;
    const l = 2 + rand() * 7, t = 0.5 + rand() * 0.6;
    const x = rand() * size, y = rand() * size;
    vertical ? g.fillRect(x, y, t, l) : g.fillRect(x, y, l, t);
  }
  g.globalAlpha = 1;

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

// Sombra de contato "assada" (gradiente radial) para assentar o móvel no chão
export function contactShadowTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  r.addColorStop(0, 'rgba(46, 38, 31, 0.55)');
  r.addColorStop(0.5, 'rgba(46, 38, 31, 0.22)');
  r.addColorStop(1, 'rgba(46, 38, 31, 0)');
  g.fillStyle = r;
  g.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}
