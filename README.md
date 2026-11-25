# MEDE Marcenaria — site

Site estático (HTML + Tailwind v4 + JS vanilla + GSAP), gerado com Vite.

## Requisitos

Node.js 20+.

## Comandos

```bash
npm install          # instala as dependências (versões fixadas)
npm run dev          # servidor de desenvolvimento
npm run build        # gera o site final em dist/
npm run preview      # serve dist/ em http://localhost:4173
npm run images       # regenera public/img a partir das imagens originais (só se trocarem)
```

Testes (com o `preview` rodando; usam o Google Chrome instalado):

```bash
npm run test:text    # texto visível idêntico ao original (baseline/texto-original.json)
npm run test:qa      # overflow horizontal 320→1920, erros de console, acessibilidade (axe)
npm run test:shots -- screenshots/nome   # screenshots 375/768/1280/1920
node tests/record-motion.mjs docs        # GIFs do motion (desktop e mobile)
```

## Onde mudar o quê

| O quê | Onde |
|---|---|
| Número/mensagem do WhatsApp, Instagram, domínio, URLs das imagens e do vídeo | `src/config.js` |
| Cores, fontes, espaçamentos, sombras, durações e easings (tokens) | `@theme` em `src/styles/main.css` |
| Componentes (botões, navbar, reveals) | `src/styles/components.css` |
| Conteúdo | `index.html` |
| Móvel 3D (peças, materiais, câmera, luzes, etapas) | `src/js/scene/stage.js` |
| Seção que conduz cada etapa, coluna/faixa e fallbacks | `src/js/scene/index.js` + `src/styles/scene.css` |
| Textura de madeira | `src/js/scene/wood.js` |

## Deploy

Publicar a pasta `dist/` em qualquer hospedagem estática (Netlify, Vercel, Cloudflare Pages, GitHub Pages).
O site assume que está na raiz do domínio (`/`). Antes do deploy, preencha `SITE_URL` em `src/config.js`.
