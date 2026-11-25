// QA automatizado contra o preview (npm run build && npm run preview):
// overflow horizontal 320→1920 (retrato e paisagem), erros de console e axe (WCAG 2.2 AA).
//   node tests/qa.mjs [url]
import AxeBuilder from '@axe-core/playwright';
import { launch } from './lib.mjs';

const url = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'http://localhost:4173/';
const sizes = [
  [320, 568], [375, 812], [414, 896], [768, 1024], [1024, 768], [1024, 1366],
  [1280, 720], [1280, 800], [1440, 900], [1920, 1080],
  [568, 320], [812, 375], [896, 414],
];
const browser = await launch();
let problems = 0;

async function scrollThrough(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.6) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
    await new Promise((r) => setTimeout(r, 400));
  });
}

for (const [w, h] of process.argv.includes('--axe') ? [] : sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: 'load' });
  await scrollThrough(page);
  const overflow = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    // Overflow real: elementos que ultrapassam a viewport sem ancestral que recorte.
    const clipped = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o !== 'visible') return true;
      }
      return false;
    };
    const offenders = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width && (r.right > vw + 1 || r.left < -1) && !clipped(el) && getComputedStyle(el).position !== 'fixed';
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 3).join('.')} (${Math.round(el.getBoundingClientRect().right)}px)`);
    return { scrollWidth: document.documentElement.scrollWidth, vw, offenders };
  });
  const ownErrors = errors.filter((e) => !/shapo/i.test(e));
  const ok = overflow.scrollWidth <= overflow.vw && !overflow.offenders.length && !ownErrors.length;
  if (!ok) problems++;
  console.log(`${ok ? '✔' : '✘'} ${w}x${h}  scrollWidth=${overflow.scrollWidth}${overflow.offenders.length ? '  overflow: ' + overflow.offenders.join(', ') : ''}${ownErrors.length ? '  erros: ' + ownErrors.join(' | ') : ''}${errors.length > ownErrors.length ? `  (+${errors.length - ownErrors.length} erro(s) do Shapo)` : ''}`);
  await page.close();
}

// Acessibilidade (desktop e mobile)
for (const [w, h] of [[375, 812], [1280, 800]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load' });
  await scrollThrough(page);
  await page.waitForTimeout(2000); // espera as transições de reveal terminarem
  const res = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .exclude('[id^="shapo-widget"]')
    .analyze();
  const v = res.violations;
  if (v.length) problems++;
  console.log(`${v.length ? '✘' : '✔'} axe ${w}px: ${v.length} violação(ões)`);
  for (const x of v) console.log(`   [${x.impact}] ${x.id}: ${x.help} → ${x.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  await page.close();
}

await browser.close();
process.exit(problems ? 1 : 0);
