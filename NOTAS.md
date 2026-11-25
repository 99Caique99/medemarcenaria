# NOTAS — Renovação do site MEDE Marcenaria

## Decisões aprovadas (Fase 0)

| # | Decisão |
|---|---|
| A1 | Imagens: o build gera AVIF/WebP responsivos a partir dos **mesmos arquivos originais** (i.ibb.co). Vídeo: mesmo asset do Cloudinary com `q_auto` (4,0 MB → 1,5 MB, mesma resolução). As URLs originais ficam registradas em `src/config.js`. |
| B1 | Botões WhatsApp: fundo #25D366 mantido; texto/ícone em verde escuro derivado (`color-mix(#25D366 25%, black)`, 6,9:1). |
| C1 | Títulos com gradiente dourado: em fundo claro usam #85603f → mistura com #cba26b (≥ 3,5:1); o dourado claro original fica nos fundos escuros (hero, rodapé). |
| D1 | "Orçamento" (menu desktop e mobile) abre o WhatsApp; "Iniciar meu Projeto" continua indo para `#contato`. |
| E | Meta description / OG reutilizam o parágrafo do hero, palavra por palavra. Etapas do móvel sem rótulos de texto (só numeração). Diferenciais continuam `<h3>` (ordem h1→h2→h3 válida). |
| F | Tailwind v4 (Safari 16.4+, Chrome 111+, Firefox 128+). |

## Pendências que dependem do cliente

- **Domínio final**: preencher `SITE_URL` em `src/config.js`. Enquanto vazio, não são emitidos `canonical`, `og:url` nem a imagem de prévia 1200×630 (o `og:image` usa a foto original do hero, retrato).
- **Texto novo invisível adicionado**: `aria-label="Menu"` no botão do menu mobile (obrigatório para leitores de tela). Confirmar ou sugerir outro.
- **Widget Shapo**: fonte (Nunito), estrelas amarelas e "Powered by Shapo" vêm do próprio widget; ajustar no painel do Shapo para combinar com a paleta, se o plano permitir.

## Erros de português encontrados (NÃO alterados — aguardando aprovação)

1. "Qualidade e personalização **é** a nossa tradição." → concordância: "Qualidade e personalização **são** a nossa tradição."
2. "+ **De** 30 Anos de História" → o "De" maiúsculo destoa do padrão de título ("+ de 30 Anos de História").

## Problemas encontrados e status

Legenda: ✅ corrigido · ⏳ fase seguinte

### Bugs
| Item | Status |
|---|---|
| 1. `un%20projeto` no botão flutuante | ✅ URL única gerada de `src/config.js` |
| 2. `shimmer` sem keyframe | ✅ keyframe definido nos tokens |
| 3. `@keyframes float` duplicado (keyframes iguais, duração 4s × 2s) | ✅ uma definição (2s, a que vencia) |
| 4. Poster do vídeo inexistente (`ERR_FILE_NOT_FOUND`) | ✅ poster = foto do hero |
| 5. Pesos de fonte não carregados (700, 800 e 900) → negrito sintético | ✅ fontes variáveis auto-hospedadas (pesos reais) |
| 6. `.smooth-image` duplicado | ✅ |
| 7. Atrasos desordenados (100/150/600/650 ms) e hover lento | ✅ stagger por `--i`; hover com transição própria |
| 8. Links "Orçamento" | ✅ D1 |
| Extra: faixa branca acima das imagens do "Sobre" (parallax expunha o fundo) | ✅ |
| Extra: círculos do rodapé fora do centro (animação sobrescrevia o translate) | ✅ |
| Extra: conteúdo invisível sem JS (reveals com opacity 0 no CSS) | ✅ só esconde com `.js` |
| Extra: `<div>` dentro de `<h1>` | ✅ |
| Extra: `min-height:100vh` + `height:100dvh` no hero | ✅ `min-height:100svh` |

### Performance
| Item | Status |
|---|---|
| 9. Tailwind CDN | ✅ Vite + Tailwind v4 (CSS 9 KB gzip) |
| 10. Lucide @latest | ✅ removido; 2 ícones inline |
| 11. Listener de scroll | ✅ IntersectionObserver + ScrollTrigger |
| 12. `filter: blur` + `transition: all` | ✅ só opacity/transform |
| 13. width/height, lazy, decoding, fetchpriority, preload | ✅ |
| 14. preconnect | ✅ fontes agora são locais (sem Google Fonts); dns-prefetch para Cloudinary e Shapo |
| 15. Shapo carregado cedo | ✅ carrega a 800px da seção |
| 16. Vídeo | ✅ `preload="none"`, carrega/toca só quando visível, pausa fora da tela |
| Extra: imagem do "Sobre" com 3,5 MB | ✅ 41 KB (AVIF 800w) |
| Extra: hero (LCP) com 594 KB | ✅ 23 KB no mobile (AVIF 768w) |

### Acessibilidade
| Item | Status |
|---|---|
| 17. Contraste (dourado claro em fundo claro, WhatsApp 1,98:1, texto dos diferenciais 3,1:1, rodapé 2,1:1) | ✅ axe: 0 violações em 375 e 1280 px |
| 18. Menu mobile | ✅ aria-expanded/controls, `inert` quando fechado, Esc, trava o scroll, devolve o foco |
| 19. Headings h1→h3 | ✅ títulos do "Sobre" agora `<h2>` (visual igual) |
| 20. prefers-reduced-motion | ✅ base (sem parallax, sem scroll suave, sem animações contínuas). Móvel: ⏳ Fase 3 |
| 21. `rel="noopener noreferrer"` | ✅ |
| Extra: sem `<main>`; botão flutuante fora de landmark | ✅ |

### SEO
| Item | Status |
|---|---|
| 22. description, OG/Twitter, favicon, apple-touch-icon, theme-color, canonical | ✅ (canonical aguarda domínio) |
| 23. JSON-LD LocalBusiness | ✅ |
| 24. `?igsh=` no Instagram | ✅ removido |

### Organização
| Item | Status |
|---|---|
| 25. URL do WhatsApp repetida | ✅ constante única no build |
| 26. scroll-smooth duplicado; scroll-padding fixo | ✅ altura real da navbar via ResizeObserver |
| 27. Scrollbar escura | ✅ trilho cream, polegar dourado (também Firefox) |
| 28. `<style>` dentro do header | ✅ |
| 29. Ano fixo | ✅ ano do build + atualização em JS |

## Sugestões (não aplicadas)

- `text-justify` nos parágrafos do "Sobre" cria espaços irregulares no mobile → será tratado no redesign (Fase 2) com alinhamento à esquerda.
- A primeira imagem do "Sobre" é gerada por IA (nome do arquivo "ChatGPT Image"). Para uma marca que vende artesanato real, uma foto de projeto entregue transmitiria mais confiança.

## Fase 2 — Redesign (escolhas aprovadas)

Hero editorial à esquerda (desktop) · "Sobre" assimétrico 7/5 com moldura dourada deslocada · navbar com logo central mais leve · diferenciais em cards com ícone circular.

Como a responsividade foi resolvida:
- **Rail do móvel** (`src/styles/layout.css`): aparece em ≥1280px, ou ≥1024px em paisagem, sempre com ≥560px de altura. A largura é `min(26vw, 26rem, altura útil × 0,68)` — encolhe pela largura e pela altura; o conteúdo reserva exatamente esse espaço (`--rail-space`).
- **Container queries**: os blocos do "Sobre", os diferenciais e o rodapé respondem à largura real da coluna de conteúdo (que muda com o rail), não à viewport.
- **Navbar completa** só com ≥768px de largura **e** ≥500px de altura; celulares deitados usam a navbar compacta + menu em tela cheia.
- **Numeração 01–07** gerada por CSS (`content: attr(data-num) / ""`): não entra no texto da página nem é lida por leitores de tela. Corresponde às 7 etapas do móvel.
- Imagens com revelação por máscara (clip-path) e zoom suave no hover; sem `filter: blur`.
- Texto do "Sobre" alinhado à esquerda (sem justificar); negrito em 700.
- Botão "Fale conosco" do rodapé agora usa o mesmo componente WhatsApp dos demais (componente único).

## Próximos passos

- ~~Fase 2 — Redesign editorial seção por seção.~~ ✅
- Fase 3 — Motion do móvel (SVG + ScrollTrigger).
- Fase 4 — Polimento, Lighthouse, Firefox/WebKit, gravação do motion.
