// Gera versões responsivas (AVIF/WebP) a partir dos MESMOS arquivos originais
// hospedados no i.ibb.co. O conteúdo é idêntico; muda só a compressão/tamanho.
// Saída em public/img (versionada) + src/images.json (dimensões, usado no build).
//   npm run images
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { IMAGES } from '../src/config.js';

const root = new URL('../', import.meta.url);
const cacheDir = new URL('.cache/originals/', root);
const outDir = new URL('public/img/', root);
await mkdir(cacheDir, { recursive: true });
await mkdir(outDir, { recursive: true });

async function original(url) {
  const file = new URL(url.split('/').pop(), cacheDir);
  try { await access(file); } catch {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ao baixar ${url}`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  return readFile(file);
}

const manifest = {};
for (const [key, img] of Object.entries(IMAGES)) {
  const buf = await original(img.src);
  const meta = await sharp(buf).metadata();
  const widths = img.widths.filter((w) => w < meta.width).concat(meta.width);
  manifest[key] = { width: meta.width, height: meta.height, widths: [...new Set(widths)] };
  for (const w of manifest[key].widths) {
    const base = sharp(buf).resize({ width: w, withoutEnlargement: true });
    await base.clone().avif({ quality: 50, effort: 6 }).toFile(fileURLToPath(new URL(`${key}-${w}.avif`, outDir)));
    await base.clone().webp({ quality: 74, effort: 6 }).toFile(fileURLToPath(new URL(`${key}-${w}.webp`, outDir)));
  }
  console.log(`${key}: ${meta.width}x${meta.height} → ${manifest[key].widths.join(', ')}`);
}

// Ícones a partir da logo original (fundo branco para o apple-touch-icon).
const logo = await original(IMAGES.logo.src);
const pub = (name) => fileURLToPath(new URL(name, new URL('public/', root)));
const square = (size, pad, bg) => sharp(logo)
  .resize(size - pad * 2, size - pad * 2, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: pad, bottom: pad, left: pad, right: pad, background: bg })
  .png({ compressionLevel: 9 });
const clear = { r: 0, g: 0, b: 0, alpha: 0 };
await square(32, 0, clear).toFile(pub('favicon-32.png'));
await square(180, 18, { r: 255, g: 255, b: 255, alpha: 1 }).flatten({ background: '#ffffff' }).toFile(pub('apple-touch-icon.png'));
await square(192, 16, { r: 255, g: 255, b: 255, alpha: 1 }).flatten({ background: '#ffffff' }).toFile(pub('icon-192.png'));
await square(512, 44, { r: 255, g: 255, b: 255, alpha: 1 }).flatten({ background: '#ffffff' }).toFile(pub('icon-512.png'));

// Prévia de compartilhamento (WhatsApp/redes): recorte 1200x630 da foto do hero.
await sharp(await original(IMAGES.hero.src))
  .resize(1200, 630, { fit: 'cover', position: 'centre' })
  .jpeg({ quality: 80, mozjpeg: true })
  .toFile(pub('og-image.jpg'));

await writeFile(new URL('src/images.json', root), JSON.stringify(manifest, null, 2) + '\n');
console.log('Ícones e src/images.json gerados.');
