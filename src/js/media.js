// Mídia sob demanda: vídeo só carrega/toca quando visível; widget Shapo só
// é baixado quando a seção de depoimentos se aproxima.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function initVideos() {
  document.querySelectorAll('video.lazy-video').forEach((video) => {
    const load = () => {
      if (video.dataset.loaded) return;
      video.querySelectorAll('source[data-src]').forEach((s) => (s.src = s.dataset.src));
      video.dataset.loaded = '1';
      video.load();
    };
    new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          load();
          if (!reducedMotion.matches) video.play().catch(() => {});
        } else if (!video.paused) {
          video.pause();
        }
      },
      { rootMargin: '200px 0px' },
    ).observe(video);
  });
}

function initShapo() {
  const widget = document.querySelector('[id^="shapo-widget-"]');
  if (!widget) return;
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const script = document.createElement('script');
      script.id = 'shapo-embed-js';
      script.src = 'https://cdn.shapo.io/js/embed.js';
      script.defer = true;
      document.body.append(script);
    },
    { rootMargin: '800px 0px' },
  );
  io.observe(widget);
}

export function initMedia() {
  initVideos();
  initShapo();
}
