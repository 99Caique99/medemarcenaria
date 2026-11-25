// Screenshots de página inteira por breakpoint.
//   node tests/screenshots.mjs <pasta-de-saida> [url]
import { mkdir } from 'node:fs/promises';
import { launch } from './lib.mjs';

const out = process.argv[2] ?? 'screenshots';
const url = process.argv[3] ?? 'http://localhost:4173/';
await mkdir(out, { recursive: true });
const browser = await launch();
for (const w of [375, 768, 1280, 1920]) {
  const page = await browser.newPage({ viewport: { width: w, height: w < 768 ? 812 : w < 1280 ? 1024 : w < 1920 ? 800 : 1080 } });
  await page.goto(url, { waitUntil: 'load' });
  // Rola a página toda para disparar reveals, vídeo e widget; volta ao topo.
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.5) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 150));
    }
    document.getElementById('depoimentos')?.scrollIntoView({ behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 6000)); // widget Shapo
    scrollTo({ top: 0, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 800));
  });
  await page.screenshot({ path: `${out}/${w}.png`, fullPage: true });
  console.log(`${out}/${w}.png`);
  await page.close();
}
await browser.close();
