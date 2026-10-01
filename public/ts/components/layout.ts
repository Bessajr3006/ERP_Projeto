/**
 * layout.ts
 * Gerencia a estrutura comum de layout (Navbar e Footer) em todas as páginas.
 */

type AppLayoutApi = {
    init: () => Promise<void>;
};

const appLayout: AppLayoutApi = {
    async init() {
        const navbarContainer = document.getElementById('app-navbar');
        if (navbarContainer && !navbarContainer.innerHTML.trim()) {
            console.log('[Layout] Inicializando Navbar...');
        }

        const footerContainer = document.getElementById('app-footer');
        if (footerContainer && !footerContainer.innerHTML.trim()) {
            console.log('[Layout] Inicializando Footer...');
        }

        const bodyClasses = [
            'bg-gray-100',
            'dark:bg-slate-900',
            'flex',
            'flex-col',
            'text-gray-800',
            'font-sans',
        ];

        const hasHeightLimit = document.body.classList.contains('h-dvh') || 
                               document.body.classList.contains('h-screen') || 
                               document.body.classList.contains('h-lvh') || 
                               document.body.classList.contains('h-svh') || 
                               document.body.classList.contains('overflow-hidden');

        if (!hasHeightLimit) {
            bodyClasses.push('min-h-screen');
        }

        document.body.classList.add(...bodyClasses);

        const main = document.querySelector('main');
        if (main) {
            main.classList.add('flex-1', 'w-full', 'pt-24', 'pb-8', 'max-w-7xl', 'mx-auto', 'sm:px-6', 'lg:px-8');
        }
    },
};

(window as any).AppLayout = appLayout;

document.addEventListener('DOMContentLoaded', () => void appLayout.init());
