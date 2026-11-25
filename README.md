# MEDE Marcenaria — site

Site estático (HTML + Tailwind v4 + JS vanilla + GSAP), gerado com Vite.
Do "Sobre" até o rodapé, um guarda-roupa vai sendo montado (sequência renderizada em 3D, tocada pela rolagem) conforme o visitante rola a página.

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
| Player da montagem (quadros pela rolagem, carregamento, enquadramento) | `src/js/scene/sequence.js` |
| Seção que conduz a montagem, coluna/faixa e fallbacks | `src/js/scene/index.js` + `src/styles/scene.css` |
| Cena 3D do guarda-roupa (peças, madeira, luz, câmera, tempo de cada etapa) | `scripts/render/guarda_roupa.py` (Blender como módulo: `pip install bpy numpy scipy pillow`) → `python scripts/render/guarda_roupa.py --out .cache/render --size 960 --frames 144 --samples 32` (~30 s por quadro em 4 núcleos) → `node scripts/build-sequencia.mjs .cache/render` (gera `public/montagem/seq/` e `src/sequencia.json`) |
| Lâmina de carvalho (gerada, sem imagem externa) | `scripts/render/madeira.py` |

## Deploy

> ⚠️ O `index.html` da raiz é o código-fonte: aberto direto (duplo clique ou Live Server) ele aparece quebrado, com `{{HERO_PRELOAD}}` e sem estilos. O site final é a pasta `dist/` gerada pelo build. Para ver localmente: `npm run build` e depois `npm run preview`.

**Netlify (automático):** o `netlify.toml` define o build (`npm run build`, Node 22) e a pasta publicada (`dist`). Cada push no `main` publica sozinho. Se o painel do Netlify tiver comando/pasta preenchidos à mão, o `netlify.toml` tem prioridade.

**Outra hospedagem estática** (Vercel, Cloudflare Pages, GitHub Pages): comando de build `npm run build`, pasta publicada `dist`.

Ao ter o domínio final, preencha `SITE_URL` em `src/config.js` (ex.: `https://www.medemarcenaria.com.br`, sem barra no fim): ativa canonical e a prévia de link (og:image) no WhatsApp.

Os caminhos são relativos (`base: './'`): o mesmo build funciona na raiz de um domínio ou numa subpasta.
