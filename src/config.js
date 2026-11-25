// Fonte única de dados do site. Usado no build (vite.config.js, scripts/) e no navegador.

// Domínio final (sem barra no fim). Enquanto vazio, canonical/og:url não são emitidos.
export const SITE_URL = '';

export const WHATSAPP_NUMBER = '5521990892815';
export const WHATSAPP_MESSAGE =
  'Olá! Tudo bem? Gostaria de solicitar um orçamento para um projeto de marcenaria sob medida. Como posso enviar os detalhes e as especificações para que vocês façam uma avaliação?';
// Mantém o formato de codificação do link original (só espaços viram %20).
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE.replace(/ /g, '%20')}`;

export const INSTAGRAM_URL = 'https://www.instagram.com/medemarcenaria';
export const CNPJ = '16.813.885/0001-88';

// Arquivos originais (as URLs não mudam; o build gera versões otimizadas deles).
export const IMAGES = {
  logo: { src: 'https://i.ibb.co/Y4N5V4mQ/EDESEMBG.png', widths: [140, 280] },
  hero: { src: 'https://i.ibb.co/bjvL3JhJ/fotoarmario-MEDE-JPG.jpg', widths: [480, 768, 1080] },
  sobre1: { src: 'https://i.ibb.co/nqY5rs73/Chat-GPT-Image-4-de-fev-de-2026-13-07-10.png', widths: [480, 800] },
  sobre3: { src: 'https://i.ibb.co/N6tRVyt6/IMG-4270-jpg.jpg', widths: [480, 800] },
};

const VIDEO_ID = 'v1770233777/WhatsApp_Video_2026-02-04_at_15.40.02_jwquu1.mp4';
// Mesmo asset do Cloudinary; q_auto reduz de ~4 MB para ~1,5 MB sem mudar a resolução.
export const VIDEO_URL = `https://res.cloudinary.com/dxukdxpzc/video/upload/q_auto/${VIDEO_ID}`;
export const VIDEO_ORIGINAL_URL = `https://res.cloudinary.com/dxukdxpzc/video/upload/${VIDEO_ID}`;
