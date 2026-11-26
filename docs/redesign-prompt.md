# Prompt sênior — novo site da MEDE Marcenaria

> Papel: você é diretor de arte e engenheiro front-end sênior de um estúdio premiado (Awwwards / CSS Design Awards), especializado em marcas de mobiliário de alto padrão. Você pensa como designer, escreve código como engenheiro e revisa como um cliente exigente.

## 1. Contexto do cliente
- MEDE Marcenaria, Rio de Janeiro, +30 anos, móveis planejados de alto padrão, atendimento exclusivo.
- Público: clientes de alto padrão e arquitetos que decidem pelo celular, muitas vezes vindo do Instagram ou do WhatsApp.
- Objetivo único da página: levar a pessoa a pedir orçamento no WhatsApp, com confiança na qualidade.
- Repositório: Vite 8 + Tailwind v4 + GSAP + Lenis. Netlify publica o `main`; trabalhar em branch e abrir PR.

## 2. Regras inegociáveis
1. **Backup antes de tudo:** o site atual fica intacto na branch `backup-antes-redesign`. Nada é apagado do histórico.
2. **Textos idênticos:** cada palavra visível, `alt`, `aria-label`, título da página e links continuam iguais. O teste `npm run test:text` contra `baseline/` precisa passar. Os 2 erros de português conhecidos ficam como estão até o cliente aprovar a correção.
3. **Nada do armário 3D / montagem:** essa linha foi rejeitada. Sem three.js, sem sequência de quadros.
4. **Celular primeiro:** desenhar em 375 px e só depois expandir. Nada de rolagem horizontal, botões com pelo menos 44 px, texto legível sem zoom, `100svh` no lugar de `100vh`.
5. **Qualidade mínima silenciosa:** contraste AA, foco visível no teclado, `prefers-reduced-motion` respeitado, imagens AVIF/WebP com tamanho certo, LCP rápido, sem erro de console.

## 3. Pesquisa: os 5 melhores sites de marcenaria/móveis planejados
Elencar e, de cada um, extrair **uma** lição concreta (efeito, didática ou UX), não copiar a cara:
1. **Mathurin Cabinetry** (Awwwards): tipografia editorial grande, fotos que se revelam com recorte ao rolar, ritmo lento de revista.
2. **Loeven Morcel** (Awwwards): projetos como capítulos de cinema, transições de imagem com máscara, uma imagem por vez em tela cheia.
3. **Henrybuilt**: didática de sistema, cada atributo (material, garantia, processo) explicado como ficha técnica clara.
4. **deVOL Kitchens**: calor humano e narrativa de oficina; o texto conversa, a marca parece gente.
5. **bulthaup**: contenção arquitetônica, muito respiro, poucas cores, a foto do móvel é a estrela.

## 4. Conceito de design
- **Ideia central:** MEDE é "medir". O elemento memorável é uma **trena**: uma régua milimetrada que acompanha a rolagem e marca onde a pessoa está na página (lateral no computador, fita no topo no celular). Todo o resto fica quieto.
- **Paleta (sem creme + terracota, sem preto com neon):** nogueira escura, pedra clara fria, latão (herdeiro do dourado da marca), freijó e grafite.
- **Tipografia:** uma serifada de alto contraste (Bodoni Moda) para títulos, uma grotesca limpa (Hanken Grotesk) para texto. Escala tipográfica clara, linhas com menos de 80 caracteres.
- **Layout:** hero dividido (texto na nogueira, foto alta do armário ao lado; no celular, foto em cima e texto embaixo). As 3 histórias do "Sobre" como capítulos editoriais alternados. Os 4 diferenciais como ficha técnica com marcas de régua. Depoimentos em fundo pedra. Rodapé em nogueira com o convite final.
- **Movimento:** um único momento orquestrado na abertura (texto e foto entram juntos) + fotos que se revelam por recorte ao entrar na tela + a trena. Sem fade em cada bloco, sem hover em tudo.
- **Evitar:** rótulos em caixa alta em cima de cada título, números 01/02/03 decorativos, cards arredondados iguais com sombra cinza, setas "→" penduradas no texto.

## 5. Execução
1. Branch nova a partir do `main`; remover a cena 3D e as dependências que sobrarem.
2. Reescrever `index.html` (mesmo conteúdo), tokens em `main.css`, componentes e seções.
3. JS: navegação/menu acessível (manter), vídeo e Shapo sob demanda (manter), trena e revelações com GSAP ScrollTrigger.
4. `npm run build`, `test:text`, `test:qa` (overflow 320→1920, console, axe).
5. Capturas em 375 px (iPhone), 768 px e 1440 px; revisar como cliente exigente e corrigir antes de entregar.
6. Abrir PR com o link de prévia do Netlify para testar no celular. Nada vai para o ar sem aprovação.
