// Texturas de madeira procedurais (canvas), só com tons da paleta da marca.
// Geradas no navegador: nenhuma imagem nova é baixada.
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

export function woodTexture({ base, dark, light, seed = 7, size = 1024, vertical = false, maxAnisotropy = 8 }) {
  const rand = rng(seed);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');

  // Fundo com faixas largas de tom (variação natural da tábua)
  const bands = g.createLinearGradient(0, 0, 0, size);
  for (let i = 0; i <= 6; i++) bands.addColorStop(i / 6, i % 2 ? base : mix(base, dark, 0.18 + rand() * 0.12));
  g.fillStyle = bands;
  g.fillRect(0, 0, size, size);

  // Veios: muitas linhas finas onduladas
  for (let i = 0; i < 260; i++) {
    const y0 = rand() * size;
    const amp = 1.5 + rand() * 7;
    const freq = 0.002 + rand() * 0.008;
    const phase = rand() * Math.PI * 2;
    g.strokeStyle = rand() < 0.55 ? dark : light;
    g.globalAlpha = 0.035 + rand() * 0.11;
    g.lineWidth = 0.5 + rand() * 2.4;
    g.beginPath();
    for (let x = -8; x <= size + 8; x += 8) {
      const y = y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.7 + phase) * amp * 0.25;
      x < 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
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

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t));
  return `rgb(${c.join(',')})`;
}
