// Inicializa ícones
        lucide.createIcons();

        const menuBtn = document.getElementById('menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        const mobileLinks = document.querySelectorAll('.mobile-link');
        let isMenuOpen = false;

        function toggleMenu() {
            isMenuOpen = !isMenuOpen;
            if (isMenuOpen) {
                mobileMenu.classList.remove('translate-x-full');
                menuBtn.innerHTML = '<i data-lucide="x" class="w-8 h-8 text-white"></i>';
                menuBtn.classList.remove('bg-white/80', 'text-mede-brown'); 
                menuBtn.classList.add('text-white');
            } else {
                mobileMenu.classList.add('translate-x-full');
                menuBtn.innerHTML = '<i data-lucide="menu" class="w-8 h-8 text-mede-brown"></i>';
                menuBtn.classList.add('bg-white/80', 'text-mede-brown');
                menuBtn.classList.remove('text-white');
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

        const navbar = document.getElementById('navbar');

        function checkReveal() {
            const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
            const triggerBottom = window.innerHeight / 5 * 4;

            revealElements.forEach(element => {
                const boxTop = element.getBoundingClientRect().top;
                if (boxTop < triggerBottom) {
                    element.classList.add('active');
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
        });

        window.addEventListener('load', checkReveal);
