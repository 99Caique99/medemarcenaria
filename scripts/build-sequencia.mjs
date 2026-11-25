// Codifica os quadros renderizados (scripts/render/guarda_roupa.py) em WebP, em dois
// tamanhos: o original (desktop) e 640 px (celular). WebP decodifica rápido, o que
// importa ao trocar de quadro durante a rolagem. Os quadros têm fundo transparente
// (só o móvel e a sombra), e o WebP guarda o canal alfa.
//   node scripts/build-sequencia.mjs .cache/render
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const src = process.argv[2] ?? '.cache/render';
const files = (await readdir(src)).filter((f) => /^q\d{4}\.png$/.test(f)).sort();
const { width } = await sharp(`${src}/${files[0]}`).metadata();
const sizes = [width, 640];
await rm('public/montagem/seq', { recursive: true, force: true }); // tamanhos de renders anteriores
for (const s of sizes) {
  await mkdir(`public/montagem/seq/${s}`, { recursive: true });
  await Promise.all(files.map((f, i) => sharp(`${src}/${f}`).resize(s).webp({ quality: s > 700 ? 74 : 70, alphaQuality: 90, effort: 6 })
    .toFile(`public/montagem/seq/${s}/q${String(i).padStart(4, '0')}.webp`)));
}
await writeFile('src/sequencia.json', JSON.stringify({ frames: files.length, sizes }, null, 2) + '\n');
console.log(`${files.length} quadros → public/montagem/seq/{${sizes.join(',')}}`);
