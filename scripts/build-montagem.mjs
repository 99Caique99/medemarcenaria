// Codifica as etapas da montagem (preparadas por scripts/montagem.py em .cache/montagem)
// em AVIF/WebP, em dois tamanhos: 1200 px (desktop) e 720 px (celular).
// Saída: public/montagem/ (versionada) + src/montagem.json (posições das peças).
//   python3 scripts/montagem.py && node scripts/build-montagem.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const src = '.cache/montagem';
const out = 'public/montagem';
await mkdir(out, { recursive: true });
const meta = JSON.parse(await readFile(`${src}/montagem.json`, 'utf8'));
const SIZES = { g: meta.size, p: 720 };

async function encode(name, w) {
  const img = sharp(`${src}/${name}.png`).resize({ width: w });
  await img.clone().avif({ quality: 52, effort: 7 }).toFile(`${out}/${name}-${w}.avif`);
  await img.clone().webp({ quality: 78, effort: 6, alphaQuality: 90 }).toFile(`${out}/${name}-${w}.webp`);
}

for (const s of Object.values(SIZES)) {
  const k = s / meta.size;
  for (let i = 0; i <= 9; i++) await encode(`f${i}`, s);
  for (const [name, p] of Object.entries(meta.pieces)) await encode(name, Math.round(p.w * k));
}
await writeFile('src/montagem.json', JSON.stringify({ ...meta, sizes: Object.values(SIZES) }, null, 2) + '\n');
console.log('montagem: ok');
