// Texturas de madeira procedurais (canvas), só com tons da paleta da marca.
// Geradas no navegador: nenhuma imagem nova é baixada. A mesma textura serve
// de bumpMap (relevo dos veios e poros).
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

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

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t));
  return `rgb(${c.join(',')})`;
}

export function woodTexture({ base, dark, light, seed = 7, size = 1024, vertical = false, maxAnisotropy = 8 }) {
  const rand = rng(seed);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');

  // Faixas largas de tom (variação natural entre lâminas)
  const bands = g.createLinearGradient(0, 0, 0, size);
  for (let i = 0; i <= 8; i++) bands.addColorStop(i / 8, mix(base, i % 2 ? light : dark, 0.08 + rand() * 0.14));
  g.fillStyle = bands;
  g.fillRect(0, 0, size, size);

  // Veios longos e ondulados (com "catedrais" suaves)
  for (let i = 0; i < 320; i++) {
    const y0 = rand() * size;
    const amp = 1 + rand() * 9;
    const freq = 0.0015 + rand() * 0.007;
    const phase = rand() * Math.PI * 2;
    g.strokeStyle = rand() < 0.62 ? dark : light;
    g.globalAlpha = 0.03 + rand() * 0.12;
    g.lineWidth = 0.4 + rand() * 2.6;
    g.beginPath();
    for (let x = -8; x <= size + 8; x += 6) {
      const y = y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.3 + phase * 2) * amp * 0.3;
      x < 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }

  // Poros: traços curtos e escuros ao longo dos veios
  g.fillStyle = dark;
  for (let i = 0; i < size * 6; i++) {
    g.globalAlpha = 0.05 + rand() * 0.12;
    g.fillRect(rand() * size, rand() * size, 2 + rand() * 6, 0.6 + rand() * 0.6);
  }
  g.globalAlpha = 1;

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  if (vertical) {
    tex.center.set(0.5, 0.5);
    tex.rotation = Math.PI / 2;
  }
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
