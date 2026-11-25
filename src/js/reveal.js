// Revela elementos uma única vez ao entrarem na viewport (sem listener de scroll).
// O estado escondido só existe com a classe .js no <html>; sem JS tudo fica visível.
export function initReveal() {
  const targets = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-mask, .features-grid');
  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -20% 0px' },
  );
  targets.forEach((el) => io.observe(el));
}
