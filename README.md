# MEDE Marcenaria — site

Site estático (HTML + Tailwind v4 + JS vanilla + GSAP + three.js), gerado com Vite.
Do "Sobre" até o rodapé, um armário planejado em 3D vai sendo montado conforme o visitante rola a página.

## Requisitos

Node.js 20+ e o Google Chrome instalado (usado pelos testes).

## Comandos

```bash
npm install          # instala as dependências (versões fixadas)
npm run dev          # servidor de desenvolvimento (atualiza sozinho) → http://localhost:5173
npm run build        # gera o site final em dist/
npm run preview      # serve dist/ em http://localhost:4173
npm run images       # regenera public/img a partir das imagens originais (só se trocarem)
```

## Testes

Com o `preview` rodando:

```bash
npm run test:text                         # texto visível idêntico ao original (baseline/)
npm run test:qa                           # overflow 320→1920, erros de console, acessibilidade (axe)
npm run test:shots -- docs/screenshots    # screenshots de página inteira 375/768/1280/1920
node tests/record-motion.mjs docs         # GIFs do motion (desktop e mobile)
```

Em outros motores (instale antes com `npx playwright install firefox webkit`):

```bash
BROWSER=firefox npm run test:qa
BROWSER=webkit npm run test:qa
```

Lighthouse:

```bash
npx lighthouse http://localhost:4173/ --view
npx lighthouse http://localhost:4173/ --preset=desktop --view
```

## Onde mudar o quê

| O quê | Onde |
|---|---|
| Número/mensagem do WhatsApp, Instagram, domínio, URLs das imagens e do vídeo | `src/config.js` |
| Cores, fontes, espaçamentos, sombras, durações e easings (tokens) | `@theme` em `src/styles/main.css` |
| Componentes (botões, navbar, reveals) | `src/styles/components.css` |
| Seções (hero, sobre, diferenciais, depoimentos, rodapé) | `src/styles/sections.css` |
| Conteúdo | `index.html` |
| Móvel 3D (peças, materiais, câmera, luzes, etapas) | `src/js/scene/stage.js` |
| Seção que conduz cada etapa, coluna/faixa e fallbacks | `src/js/scene/index.js` + `src/styles/scene.css` |
| Textura de madeira | `src/js/scene/wood.js` |

## Deploy

1. Preencha `SITE_URL` em `src/config.js` (ex.: `https://www.medemarcenaria.com.br`, sem barra no fim).
2. `npm run build`
3. Publique a pasta `dist/` em qualquer hospedagem estática (Netlify, Vercel, Cloudflare Pages, GitHub Pages).

O site assume que está na raiz do domínio (`/`).
