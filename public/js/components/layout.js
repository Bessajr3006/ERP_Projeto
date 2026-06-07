/**
 * layout.ts
 * Gerencia a estrutura comum de layout (Navbar e Footer) em todas as páginas.
 */
const appLayout = {
    async init() {
        const navbarContainer = document.getElementById('app-navbar');
        if (navbarContainer && !navbarContainer.innerHTML.trim()) {
            console.log('[Layout] Inicializando Navbar...');
        }
        const footerContainer = document.getElementById('app-footer');
        if (footerContainer && !footerContainer.innerHTML.trim()) {
            console.log('[Layout] Inicializando Footer...');
        }
        document.body.classList.add('bg-gray-100', 'dark:bg-slate-900', 'min-h-screen', 'flex', 'flex-col', 'text-gray-800', 'font-sans');
        const main = document.querySelector('main');
        if (main) {
            main.classList.add('flex-1', 'w-full', 'pt-24', 'pb-8', 'max-w-7xl', 'mx-auto', 'sm:px-6', 'lg:px-8');
        }
    },
};
window.AppLayout = appLayout;
document.addEventListener('DOMContentLoaded', () => void appLayout.init());
