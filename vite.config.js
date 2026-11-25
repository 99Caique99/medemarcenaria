import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import * as site from './src/config.js';
import images from './src/images.json' with { type: 'json' };

const attrRe = /([\w-]+)(?:="([^"]*)")?/g;
const parseAttrs = (str) => Object.fromEntries([...str.matchAll(attrRe)].map(([, k, v]) => [k, v ?? true]));

// <mede-img key="hero" alt="…" sizes="…" class="…" eager></mede-img>
// → <picture> com AVIF + WebP responsivos, width/height (evita CLS) e lazy-loading.
function picture({ key, alt, sizes = '100vw', class: cls = '', eager, 'picture-class': picCls = 'contents' }) {
  const img = images[key];
  if (!img) throw new Error(`Imagem desconhecida: ${key}`);
  const set = (ext) => img.widths.map((w) => `/img/${key}-${w}.${ext} ${w}w`).join(', ');
  const fallback = img.widths.find((w) => w >= 768) ?? img.widths.at(-1);
  const loading = eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  return `<picture class="${picCls}"><source type="image/avif" srcset="${set('avif')}" sizes="${sizes}"><img src="/img/${key}-${fallback}.webp" srcset="${set('webp')}" sizes="${sizes}" alt="${alt}" width="${img.width}" height="${img.height}" ${loading} decoding="async" class="${cls}"></picture>`;
}

function seo() {
  const description =
    'Transformamos ambientes com mobiliários de alto padrão que entregam exclusividade. Com sofisticação e personalização em cada detalhe!';
  const title = 'MEDE Marcenaria | Design & Excelência';
  const url = site.SITE_URL;
  const ogImage = url ? `${url}/og-image.jpg` : site.IMAGES.hero.src;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'HomeAndConstructionBusiness'],
    name: 'MEDE Marcenaria',
    description,
    image: site.IMAGES.hero.src,
    logo: site.IMAGES.logo.src,
    telephone: `+${site.WHATSAPP_NUMBER}`,
    taxID: site.CNPJ,
    address: { '@type': 'PostalAddress', addressLocality: 'Rio de Janeiro', addressRegion: 'RJ', addressCountry: 'BR' },
    areaServed: 'Rio de Janeiro',
    sameAs: [site.INSTAGRAM_URL],
    ...(url && { url }),
  };
  return [
    `<meta name="description" content="${description}">`,
    url && `<link rel="canonical" href="${url}/">`,
    '<meta name="theme-color" content="#ffffff">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
    '<meta property="og:type" content="website">',
    '<meta property="og:locale" content="pt_BR">',
    '<meta property="og:site_name" content="MEDE Marcenaria">',
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    url && `<meta property="og:url" content="${url}/">`,
    `<meta property="og:image" content="${ogImage}">`,
    url ? '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' : '',
    '<meta property="og:image:alt" content="Interior MEDE Marcenaria">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${ogImage}">`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
  ].filter(Boolean).join('\n    ');
}

function medeHtml() {
  const vars = {
    WHATSAPP_URL: site.WHATSAPP_URL,
    INSTAGRAM_URL: site.INSTAGRAM_URL,
    VIDEO_URL: site.VIDEO_URL,
    YEAR: String(new Date().getFullYear()),
    HERO_PRELOAD: (() => {
      const h = images.hero;
      const set = h.widths.map((w) => `/img/hero-${w}.avif ${w}w`).join(', ');
      return `<link rel="preload" as="image" type="image/avif" imagesrcset="${set}" imagesizes="100vw" fetchpriority="high">`;
    })(),
    POSTER: `/img/hero-${images.hero.widths.find((w) => w >= 768)}.webp`,
  };
  return {
    name: 'mede-html',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) =>
        html
          .replace('<!-- @seo -->', seo())
          // <!-- @include src/partials/x.svg --> → conteúdo do arquivo (SVG inline)
          .replace(/<!-- @include (\S+) -->/g, (_, file) => readFileSync(new URL(file, import.meta.url), 'utf8'))
          .replace(/<mede-img\s([^>]*)><\/mede-img>/g, (_, a) => picture(parseAttrs(a)))
          .replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] ?? m),
    },
  };
}

export default defineConfig({
  plugins: [medeHtml(), tailwindcss()],
  build: { target: 'es2020', cssMinify: true, assetsInlineLimit: 0 },
});
