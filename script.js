        // Inicializa ícones
        lucide.createIcons();

        // Menu Mobile Toggle
        const menuBtn = document.getElementById('menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        const mobileLinks = document.querySelectorAll('.mobile-link');
        let isMenuOpen = false;

        function toggleMenu() {
            isMenuOpen = !isMenuOpen;
            
            if (isMenuOpen) {
                // Abrir
                mobileMenu.classList.remove('scale-y-0', 'opacity-0');
                mobileMenu.classList.add('scale-y-100', 'opacity-100');
                menuBtn.classList.add('active'); // CSS animation class
            } else {
                // Fechar
                mobileMenu.classList.remove('scale-y-100', 'opacity-100');
                mobileMenu.classList.add('scale-y-0', 'opacity-0');
                menuBtn.classList.remove('active');
            }
            lucide.createIcons();
        }

        menuBtn.addEventListener('click', toggleMenu);

        // Fechar menu ao clicar em link
        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (isMenuOpen) toggleMenu();
            });
        });

        // Scroll Effect para Navbar
        const navbar = document.getElementById('navbar');

        function checkReveal() {
            const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
            const triggerBottom = window.innerHeight / 5 * 4;

            revealElements.forEach(element => {
                const boxTop = element.getBoundingClientRect().top;
                if (boxTop < triggerBottom) {
                    element.classList.add('active');
                    
                    const line = element.querySelector('.line-reveal');
                    if (line) line.classList.add('active');
                }
            });
        }

        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('nav-scrolled');
            } else {
                navbar.classList.remove('nav-scrolled');
            }
            checkReveal();
            requestAnimationFrame(updateParallax);
        });

        // Atualiza Parallax no scroll
        const parallaxImages = document.querySelectorAll('.parallax-img');
        
        function updateParallax() {
            parallaxImages.forEach(img => {
                const parent = img.parentElement;
                const parentTop = parent.getBoundingClientRect().top;
                const windowHeight = window.innerHeight;
                
                if (parentTop < windowHeight && parentTop > -parent.offsetHeight) {
                    const speed = 0.15;
                    const yPos = (parentTop - windowHeight / 2) * speed;
                    img.style.transform = `translateY(${yPos}px)`;
                }
            });
        }
        
        window.addEventListener('load', () => {
            checkReveal();
        });

  document.addEventListener("DOMContentLoaded", function() {
    // Seleciona o observer
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Quando a seção aparece na tela, busca todos os itens
          const items = entry.target.querySelectorAll('.feature-item');
          
          items.forEach((item, index) => {
            // Adiciona um pequeno atraso (delay) para cada item criar o efeito cascata
            setTimeout(() => {
              item.classList.remove('opacity-0', 'translate-y-12'); // Remove invisibilidade
              item.classList.add('opacity-100', 'translate-y-0');   // Mostra o item
            }, index * 150); // 150ms de diferença entre cada um
          });
          
          // Para de observar depois que animou
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 }); // Começa quando 10% da seção estiver visível

    // Começa a observar a seção
    const section = document.getElementById('features-section');
    if(section) observer.observe(section);
  });
