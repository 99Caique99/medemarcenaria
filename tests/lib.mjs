// Utilitários compartilhados pelos testes.
// Motor via BROWSER=chrome (padrão, usa o Google Chrome instalado) | firefox | webkit
import { chromium, firefox, webkit } from 'playwright';

export const engine = process.env.BROWSER ?? 'chrome';
export const launch = () =>
  engine === 'firefox' ? firefox.launch() : engine === 'webkit' ? webkit.launch() : chromium.launch({ channel: 'chrome' });

// Texto "de copy" da página: textContent normalizado (independe de CSS como
// text-transform), sem scripts, estilos, SVGs e sem o conteúdo do widget Shapo
// (de terceiros). Também coleta alt, aria-label, title e links.
export async function extractCopy(page) {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('script, style, noscript, svg, template, [id^="shapo-widget"] > *, [data-copy-ignore]').forEach((n) => n.remove());
    const blocks = [];
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) {
          const t = child.textContent.replace(/\s+/g, ' ').trim();
          if (t) blocks.push(t);
        } else if (child.nodeType === 1) walk(child);
      }
    };
    walk(clone);
    const text = blocks.join(' ').replace(/\s+/g, ' ').replace(/ ([.,!?])/g, '$1');
    const attrs = [...document.querySelectorAll('img[alt], [aria-label]')]
      .filter((el) => !el.closest('[id^="shapo-widget"], [data-copy-ignore]'))
      .map((el) => (el.tagName === 'IMG' ? `alt: ${el.alt}` : `aria-label: ${el.getAttribute('aria-label')}`));
    const links = [...new Set([...document.querySelectorAll('a[href]')]
      .filter((a) => !a.closest('[id^="shapo-widget"]'))
      .map((a) => a.getAttribute('href')))];
    return { title: document.title, text, attrs: [...new Set(attrs)].sort(), links: links.sort() };
  });
}
