// Grava o motion do móvel como GIF animado (quadro a quadro, sem ffmpeg).
//   node tests/record-motion.mjs [saida-dir] [url]
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { launch } from './lib.mjs';

const out = process.argv[2] ?? 'docs';
const url = process.argv[3] ?? 'http://localhost:4173/';
await mkdir(out, { recursive: true });
const browser = await launch();

async function record(name, viewport, scale, steps) {
  const page = await browser.newPage({ viewport });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const frames = [];
  const shot = async () => frames.push(await sharp(await page.screenshot()).resize(Math.round(viewport.width * scale)).png().toBuffer());
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(330); await shot(); } // intro (etapa 01)
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let i = 1; i <= steps; i++) {
    await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), (max * i) / steps);
    await page.waitForTimeout(260);
    await shot();
  }
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(400); await shot(); } // entrega + respiração
  await sharp(frames, { join: { animated: true } })
    .gif({ delay: frames.map(() => 110), loop: 0, effort: 7, colours: 128 })
    .toFile(`${out}/${name}.gif`);
  console.log(`${out}/${name}.gif (${frames.length} quadros)`);
  await page.close();
}

await record('motion-desktop', { width: 1280, height: 800 }, 0.5, 70);
await record('motion-mobile', { width: 375, height: 812 }, 0.6, 90);
await browser.close();
