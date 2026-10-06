// @ts-nocheck
/**
 * navbar.js
 * Injeta a barra de navegação nas páginas que possuem <div id="app-navbar"></div>
 * e inicializa os eventos globais (menu mobile, tema, logout).
 */
if (typeof window.gNavbarAuthContext === 'undefined') {
    window.gNavbarAuthContext = { user: null, company: null, permissions: [] };
}
var gNavbarAuthContext = window.gNavbarAuthContext;
async function initNavbar() {
    const navbarContainer = document.getElementById('app-navbar');
    if (!navbarContainer)
        return; // Página não precisa de navbar
    try {
        // 1. Fetch nav.html (sempre do servidor com cache buster para garantir atualização imediata)
        const response = await fetch(`/components/nav.html?v=${Date.now()}`, {
            cache: 'no-store'
        });
        if (!response.ok)
            throw new Error('Falha ao carregar a navbar');
        const navHtml = await response.text();
        // 2. Insert HTML
        navbarContainer.innerHTML = navHtml;
        navbarContainer.classList.add('h-16', 'shrink-0');
        navbarContainer.style.height = '64px';
        navbarContainer.style.flexShrink = '0';
        // Move modals to body to prevent stacking context and overflow issues
        ['logoutConfirmModal', 'navWaConfigModal', 'navChangePasswordModal'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                document.body.appendChild(el);
            }
        });
        // Reaplica preferências visuais globais agora que a navbar existe no DOM.
        if (typeof window.applyGlobalLayoutWidth === 'function') {
            window.applyGlobalLayoutWidth();
        }
        if (typeof window.applyGlobalNavWidth === 'function') {
            window.applyGlobalNavWidth();
        }
        if (typeof window.applyGlobalLayoutAlign === 'function') {
            window.applyGlobalLayoutAlign();
        }
        if (typeof window.applyGlobalNavAlign === 'function') {
            window.applyGlobalNavAlign();
        }
        if (typeof window.applyGlobalNavColor === 'function') {
            window.applyGlobalNavColor();
        }
        if (typeof window.applyGlobalThemeToggleVisibility === 'function') {
            window.applyGlobalThemeToggleVisibility();
        }
        // 3. Initialize components
        highlightActiveLink();
        initMobileMenu();
        initDesktopMenuTouch();
        initThemeToggle();
        initLogout();
        initNotifications();
        loadUserGreeting();
        initUserMenuWhatsAppConfig();
        initUserMenuChangePassword();
    }
    catch (error) {
        console.error('Erro ao injetar navbar:', error);
    }
}
function highlightActiveLink() {
    const currentPath = window.location.pathname;
    // Desktop links
    const desktopLinks = document.querySelectorAll('#desktopNavLinks .nav-link');
    const desktopCustomersDropdownLinks = document.querySelectorAll('#desktopCustomersDropdown a');
    const desktopFinanceDropdownLinks = document.querySelectorAll('#desktopFinanceDropdown a');
    const desktopProductsDropdownLinks = document.querySelectorAll('#desktopProductsDropdown a');
    const desktopAccountingDropdownLinks = document.querySelectorAll('#desktopAccountingDropdown a');
    const desktopOverviewDropdownLinks = document.querySelectorAll('#desktopOverviewDropdown a');
    const desktopReportsDropdownLinks = document.querySelectorAll('#desktopReportsDropdown a');
    const desktopConfigDropdownLinks = document.querySelectorAll('#desktopConfigDropdown a');
    const desktopWhatsappDropdownLinks = document.querySelectorAll('#desktopWhatsappDropdown a');
    // Check main links
    desktopLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.split('?')[0] === currentPath) {
            // Active state
            link.classList.remove('border-transparent', 'text-gray-300', 'hover:border-gray-300', 'hover:text-white', 'dark:border-slate-600');
            link.classList.add('border-brand-500', 'text-white');
        }
    });
    // Helper for Desktop Dropdowns
    const highlightDesktopDropdown = (links, btnId) => {
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.split('?')[0] === currentPath) {
                const parentBtn = document.getElementById(btnId);
                if (parentBtn) {
                    parentBtn.classList.remove('border-transparent', 'text-gray-300', 'hover:border-gray-300', 'hover:text-white', 'dark:border-slate-600');
                    parentBtn.classList.add('border-brand-500', 'text-white');
                }
                link.classList.add('bg-gray-100', 'dark:bg-slate-700', 'text-gray-900', 'dark:text-white');
            }
        });
    };
    const desktopPurchasesDropdownLinks = document.querySelectorAll('#desktopPurchasesDropdown a');
    const desktopOrdersDropdownLinks = document.querySelectorAll('#desktopOrdersDropdown a');
    const desktopOperationsDropdownLinks = document.querySelectorAll('#desktopOperationsDropdown a');
    const desktopInfoDropdownLinks = document.querySelectorAll('#desktopInfoDropdown a');
    highlightDesktopDropdown(desktopCustomersDropdownLinks, 'desktopCustomersDropdownBtn');
    highlightDesktopDropdown(desktopFinanceDropdownLinks, 'desktopFinanceDropdownBtn');
    highlightDesktopDropdown(desktopProductsDropdownLinks, 'desktopProductsDropdownBtn');
    highlightDesktopDropdown(desktopAccountingDropdownLinks, 'desktopAccountingDropdownBtn');
    highlightDesktopDropdown(desktopOverviewDropdownLinks, 'desktopOverviewDropdownBtn');
    highlightDesktopDropdown(desktopReportsDropdownLinks, 'desktopReportsDropdownBtn');
    highlightDesktopDropdown(desktopConfigDropdownLinks, 'desktopConfigDropdownBtn');
    highlightDesktopDropdown(desktopWhatsappDropdownLinks, 'desktopWhatsappDropdownBtn');
    highlightDesktopDropdown(desktopPurchasesDropdownLinks, 'desktopPurchasesDropdownBtn');
    highlightDesktopDropdown(desktopOrdersDropdownLinks, 'desktopOrdersDropdownBtn');
    highlightDesktopDropdown(desktopOperationsDropdownLinks, 'desktopOperationsDropdownBtn');
    highlightDesktopDropdown(desktopInfoDropdownLinks, 'desktopInfoDropdownBtn');
    // Mobile links
    const mobileLinks = document.querySelectorAll('#mobileNavLinks .mobile-nav-link');
    const mobileCustomersDropdownLinks = document.querySelectorAll('#mobileCustomersDropdown a');
    const mobileFinanceDropdownLinks = document.querySelectorAll('#mobileFinanceDropdown a');
    const mobileProductsDropdownLinks = document.querySelectorAll('#mobileProductsDropdown a');
    const mobileAccountingDropdownLinks = document.querySelectorAll('#mobileAccountingDropdown a');
    const mobileOverviewDropdownLinks = document.querySelectorAll('#mobileOverviewDropdown a');
    const mobileReportsDropdownLinks = document.querySelectorAll('#mobileReportsDropdown a');
    const mobileConfigDropdownLinks = document.querySelectorAll('#mobileConfigDropdown a');
    const mobileWhatsappDropdownLinks = document.querySelectorAll('#mobileWhatsappDropdown a');
    mobileLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.split('?')[0] === currentPath) {
            link.classList.remove('border-transparent', 'text-gray-300', 'hover:bg-brand-800', 'hover:border-gray-300', 'hover:text-white', 'dark:border-slate-600');
            link.classList.add('bg-brand-800', 'border-brand-500', 'text-white');
        }
    });
    // Helper for Mobile Dropdowns
    const highlightMobileDropdown = (links, btnId, dropdownId, iconId) => {
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.split('?')[0] === currentPath) {
                const parentBtn = document.getElementById(btnId);
                if (parentBtn) {
                    parentBtn.classList.remove('border-transparent', 'text-gray-300', 'hover:bg-brand-800', 'hover:border-gray-300', 'hover:text-white', 'dark:border-slate-600');
                    parentBtn.classList.add('bg-brand-800', 'border-brand-500', 'text-white');
                }
                link.classList.add('bg-brand-800', 'text-white');
                link.classList.remove('text-gray-400');
                const mobileDropdown = document.getElementById(dropdownId);
                const mobileIcon = document.getElementById(iconId);
                if (mobileDropdown)
                    mobileDropdown.classList.remove('hidden');
                if (mobileIcon)
                    mobileIcon.classList.add('rotate-180');
            }
        });
    };
    const mobilePurchasesDropdownLinks = document.querySelectorAll('#mobilePurchasesDropdown a');
    const mobileOperationsDropdownLinks = document.querySelectorAll('#mobileOperationsDropdown a');
    const mobileInfoDropdownLinks = document.querySelectorAll('#mobileInfoDropdown a');
    highlightMobileDropdown(mobileCustomersDropdownLinks, 'mobileCustomersDropdownBtn', 'mobileCustomersDropdown', 'mobileCustomersDropdownIcon');
    highlightMobileDropdown(mobileFinanceDropdownLinks, 'mobileFinanceDropdownBtn', 'mobileFinanceDropdown', 'mobileFinanceDropdownIcon');
    highlightMobileDropdown(mobileProductsDropdownLinks, 'mobileProductsDropdownBtn', 'mobileProductsDropdown', 'mobileProductsDropdownIcon');
    highlightMobileDropdown(mobileAccountingDropdownLinks, 'mobileAccountingDropdownBtn', 'mobileAccountingDropdown', 'mobileAccountingDropdownIcon');
    highlightMobileDropdown(mobileOverviewDropdownLinks, 'mobileOverviewDropdownBtn', 'mobileOverviewDropdown', 'mobileOverviewDropdownIcon');
    highlightMobileDropdown(mobileReportsDropdownLinks, 'mobileReportsDropdownBtn', 'mobileReportsDropdown', 'mobileReportsDropdownIcon');
    highlightMobileDropdown(mobileConfigDropdownLinks, 'mobileConfigDropdownBtn', 'mobileConfigDropdown', 'mobileConfigDropdownIcon');
    highlightMobileDropdown(mobileWhatsappDropdownLinks, 'mobileWhatsappDropdownBtn', 'mobileWhatsappDropdown', 'mobileWhatsappDropdownIcon');
    highlightMobileDropdown(mobilePurchasesDropdownLinks, 'mobilePurchasesDropdownBtn', 'mobilePurchasesDropdown', 'mobilePurchasesDropdownIcon');
    highlightMobileDropdown(mobileOperationsDropdownLinks, 'mobileOperationsDropdownBtn', 'mobileOperationsDropdown', 'mobileOperationsDropdownIcon');
    highlightMobileDropdown(mobileInfoDropdownLinks, 'mobileInfoDropdownBtn', 'mobileInfoDropdown', 'mobileInfoDropdownIcon');
    // Highlight mobile Contabil sub-dropdown links
    const mobileContabilDropdownLinks = document.querySelectorAll('#mobileContabilDropdown a');
    highlightMobileDropdown(mobileContabilDropdownLinks, 'mobileContabilDropdownBtn', 'mobileContabilDropdown', 'mobileContabilDropdownIcon');
    mobileContabilDropdownLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.split('?')[0] === currentPath) {
            const accBtn = document.getElementById('mobileAccountingDropdownBtn');
            const accDropdown = document.getElementById('mobileAccountingDropdown');
            const accIcon = document.getElementById('mobileAccountingDropdownIcon');
            if (accBtn) {
                accBtn.classList.remove('border-transparent', 'text-gray-300', 'hover:bg-brand-800', 'hover:border-gray-300', 'hover:text-white', 'dark:border-slate-600');
                accBtn.classList.add('bg-brand-800', 'border-brand-500', 'text-white');
            }
            if (accDropdown)
                accDropdown.classList.remove('hidden');
            if (accIcon)
                accIcon.classList.add('rotate-180');
        }
    });
    // Highlight mobile Fiscal sub-dropdown links
    const mobileFiscalDropdownLinks = document.querySelectorAll('#mobileFiscalDropdown a');
    highlightMobileDropdown(mobileFiscalDropdownLinks, 'mobileFiscalDropdownBtn', 'mobileFiscalDropdown', 'mobileFiscalDropdownIcon');
    mobileFiscalDropdownLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.split('?')[0] === currentPath) {
            const accBtn = document.getElementById('mobileAccountingDropdownBtn');
            const accDropdown = document.getElementById('mobileAccountingDropdown');
            const accIcon = document.getElementById('mobileAccountingDropdownIcon');
            if (accBtn) {
                accBtn.classList.remove('border-transparent', 'text-gray-300', 'hover:bg-brand-800', 'hover:border-gray-300', 'hover:text-white', 'dark:border-slate-600');
                accBtn.classList.add('bg-brand-800', 'border-brand-500', 'text-white');
            }
            if (accDropdown)
                accDropdown.classList.remove('hidden');
            if (accIcon)
                accIcon.classList.add('rotate-180');
        }
    });
    // Highlight mobile Sped Fiscal sub-dropdown links
    const mobileSpedDropdownLinks = document.querySelectorAll('#mobileSpedDropdown a');
    highlightMobileDropdown(mobileSpedDropdownLinks, 'mobileSpedDropdownBtn', 'mobileSpedDropdown', 'mobileSpedDropdownIcon');
    mobileSpedDropdownLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.split('?')[0] === currentPath) {
            const fiscalBtn = document.getElementById('mobileFiscalDropdownBtn');
            const fiscalDropdown = document.getElementById('mobileFiscalDropdown');
            const fiscalIcon = document.getElementById('mobileFiscalDropdownIcon');
            if (fiscalBtn) {
                fiscalBtn.classList.remove('text-gray-400');
                fiscalBtn.classList.add('text-white', 'bg-brand-800');
            }
            if (fiscalDropdown)
                fiscalDropdown.classList.remove('hidden');
            if (fiscalIcon)
                fiscalIcon.classList.add('rotate-180');
            const accBtn = document.getElementById('mobileAccountingDropdownBtn');
            const accDropdown = document.getElementById('mobileAccountingDropdown');
            const accIcon = document.getElementById('mobileAccountingDropdownIcon');
            if (accBtn) {
                accBtn.classList.remove('border-transparent', 'text-gray-300', 'hover:bg-brand-800', 'hover:border-gray-300', 'hover:text-white', 'dark:border-slate-600');
                accBtn.classList.add('bg-brand-800', 'border-brand-500', 'text-white');
            }
            if (accDropdown)
                accDropdown.classList.remove('hidden');
            if (accIcon)
                accIcon.classList.add('rotate-180');
        }
    });
    // Highlight mobile Departamento Pessoal sub-dropdown links
    const mobileDpDropdownLinks = document.querySelectorAll('#mobileDpDropdown a');
    highlightMobileDropdown(mobileDpDropdownLinks, 'mobileDpDropdownBtn', 'mobileDpDropdown', 'mobileDpDropdownIcon');
    mobileDpDropdownLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.split('?')[0] === currentPath) {
            const accBtn = document.getElementById('mobileAccountingDropdownBtn');
            const accDropdown = document.getElementById('mobileAccountingDropdown');
            const accIcon = document.getElementById('mobileAccountingDropdownIcon');
            if (accBtn) {
                accBtn.classList.remove('border-transparent', 'text-gray-300', 'hover:bg-brand-800', 'hover:border-gray-300', 'hover:text-white', 'dark:border-slate-600');
                accBtn.classList.add('bg-brand-800', 'border-brand-500', 'text-white');
            }
            if (accDropdown)
                accDropdown.classList.remove('hidden');
            if (accIcon)
                accIcon.classList.add('rotate-180');
        }
    });
    // Highlight mobile Forma de Recebível sub-dropdown links
    const mobileFormaRecebivelDropdownLinks = document.querySelectorAll('#mobileFormaRecebivelDropdown a');
    highlightMobileDropdown(mobileFormaRecebivelDropdownLinks, 'mobileFormaRecebivelDropdownBtn', 'mobileFormaRecebivelDropdown', 'mobileFormaRecebivelDropdownIcon');
    mobileFormaRecebivelDropdownLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.split('?')[0] === currentPath) {
            const finBtn = document.getElementById('mobileFinanceDropdownBtn');
            const finDropdown = document.getElementById('mobileFinanceDropdown');
            const finIcon = document.getElementById('mobileFinanceDropdownIcon');
            if (finBtn) {
                finBtn.classList.remove('border-transparent', 'text-gray-300', 'hover:bg-brand-800', 'hover:border-gray-300', 'hover:text-white', 'dark:border-slate-600');
                finBtn.classList.add('bg-brand-800', 'border-brand-500', 'text-white');
            }
            if (finDropdown)
                finDropdown.classList.remove('hidden');
            if (finIcon)
                finIcon.classList.add('rotate-180');
        }
    });
    // Highlight mobile Card Expenses sub-dropdown links
    const mobileCardExpensesDropdownLinks = document.querySelectorAll('#mobileCardExpensesDropdown a');
    highlightMobileDropdown(mobileCardExpensesDropdownLinks, 'mobileCardExpensesDropdownBtn', 'mobileCardExpensesDropdown', 'mobileCardExpensesDropdownIcon');
    mobileCardExpensesDropdownLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.split('?')[0] === currentPath) {
            const finBtn = document.getElementById('mobileFinanceDropdownBtn');
            const finDropdown = document.getElementById('mobileFinanceDropdown');
            const finIcon = document.getElementById('mobileFinanceDropdownIcon');
            if (finBtn) {
                finBtn.classList.remove('border-transparent', 'text-gray-300', 'hover:bg-brand-800', 'hover:border-gray-300', 'hover:text-white', 'dark:border-slate-600');
                finBtn.classList.add('bg-brand-800', 'border-brand-500', 'text-white');
            }
            if (finDropdown)
                finDropdown.classList.remove('hidden');
            if (finIcon)
                finIcon.classList.add('rotate-180');
        }
    });
    // Highlight mobile Payment sub-dropdown links
    const mobilePaymentDropdownLinks = document.querySelectorAll('#mobilePaymentDropdown a');
    highlightMobileDropdown(mobilePaymentDropdownLinks, 'mobilePaymentDropdownBtn', 'mobilePaymentDropdown', 'mobilePaymentDropdownIcon');
    mobilePaymentDropdownLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.split('?')[0] === currentPath) {
            const finBtn = document.getElementById('mobileFinanceDropdownBtn');
            const finDropdown = document.getElementById('mobileFinanceDropdown');
            const finIcon = document.getElementById('mobileFinanceDropdownIcon');
            if (finBtn) {
                finBtn.classList.remove('border-transparent', 'text-gray-300', 'hover:bg-brand-800', 'hover:border-gray-300', 'hover:text-white', 'dark:border-slate-600');
                finBtn.classList.add('bg-brand-800', 'border-brand-500', 'text-white');
            }
            if (finDropdown)
                finDropdown.classList.remove('hidden');
            if (finIcon)
                finIcon.classList.add('rotate-180');
        }
    });
    // Highlight mobile Cad.Serviço sub-dropdown links
    const mobileCadServicoDropdownLinks = document.querySelectorAll('#mobileCadServicoDropdown a');
    highlightMobileDropdown(mobileCadServicoDropdownLinks, 'mobileCadServicoDropdownBtn', 'mobileCadServicoDropdown', 'mobileCadServicoDropdownIcon');
    mobileCadServicoDropdownLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.split('?')[0] === currentPath) {
            const prodBtn = document.getElementById('mobileProductsDropdownBtn');
            const prodDropdown = document.getElementById('mobileProductsDropdown');
            const prodIcon = document.getElementById('mobileProductsDropdownIcon');
            if (prodBtn) {
                prodBtn.classList.remove('border-transparent', 'text-gray-300', 'hover:bg-brand-800', 'hover:border-gray-300', 'hover:text-white', 'dark:border-slate-600');
                prodBtn.classList.add('bg-brand-800', 'border-brand-500', 'text-white');
            }
            if (prodDropdown)
                prodDropdown.classList.remove('hidden');
            if (prodIcon)
                prodIcon.classList.add('rotate-180');
        }
    });
    // Highlight desktop Receivable submenu flyout parent button
    const desktopReceivableDropdownLinks = document.querySelectorAll('#desktopFinanceDropdown .relative a');
    desktopReceivableDropdownLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.split('?')[0] === currentPath) {
            const subBtn = link.closest('.relative')?.querySelector('button');
            if (subBtn) {
                subBtn.classList.add('bg-gray-100', 'dark:bg-slate-700', 'text-gray-900', 'dark:text-white');
            }
        }
    });
    // Highlight desktop Fiscal and nested submenus flyout parent buttons
    const desktopFiscalDropdownLinks = document.querySelectorAll('#desktopAccountingDropdown .relative a');
    desktopFiscalDropdownLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.split('?')[0] === currentPath) {
            let parentRelative = link.closest('.relative');
            while (parentRelative && parentRelative.id !== 'desktopAccountingDropdown') {
                const subBtn = parentRelative.querySelector(':scope > button');
                if (subBtn) {
                    subBtn.classList.add('bg-gray-100', 'dark:bg-slate-700', 'text-gray-900', 'dark:text-white');
                }
                parentRelative = parentRelative.parentElement?.closest('.relative');
            }
        }
    });
    // Highlight desktop Cad.Serviço submenu flyout parent button
    const desktopCadServicoDropdownLinks = document.querySelectorAll('#desktopProductsDropdown .relative a');
    desktopCadServicoDropdownLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.split('?')[0] === currentPath) {
            const subBtn = link.closest('.relative')?.querySelector('button');
            if (subBtn) {
                subBtn.classList.add('bg-gray-100', 'dark:bg-slate-700', 'text-gray-900', 'dark:text-white');
            }
        }
    });
    // Highlight mobile Visão sub-dropdown links & expand Configuração parent
    mobileOverviewDropdownLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.split('?')[0] === currentPath) {
            const configBtn = document.getElementById('mobileConfigDropdownBtn');
            const configDropdown = document.getElementById('mobileConfigDropdown');
            const configIcon = document.getElementById('mobileConfigDropdownIcon');
            if (configBtn) {
                configBtn.classList.remove('border-transparent', 'text-gray-300', 'hover:bg-brand-800', 'hover:border-gray-300', 'hover:text-white', 'dark:border-slate-600');
                configBtn.classList.add('bg-brand-800', 'border-brand-500', 'text-white');
            }
            if (configDropdown)
                configDropdown.classList.remove('hidden');
            if (configIcon)
                configIcon.classList.add('rotate-180');
        }
    });
    // Highlight mobile WhatsApp sub-dropdown links & expand Configuração parent
    mobileWhatsappDropdownLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.split('?')[0] === currentPath) {
            const configBtn = document.getElementById('mobileConfigDropdownBtn');
            const configDropdown = document.getElementById('mobileConfigDropdown');
            const configIcon = document.getElementById('mobileConfigDropdownIcon');
            if (configBtn) {
                configBtn.classList.remove('border-transparent', 'text-gray-300', 'hover:bg-brand-800', 'hover:border-gray-300', 'hover:text-white', 'dark:border-slate-600');
                configBtn.classList.add('bg-brand-800', 'border-brand-500', 'text-white');
            }
            if (configDropdown)
                configDropdown.classList.remove('hidden');
            if (configIcon)
                configIcon.classList.add('rotate-180');
        }
    });
    // Highlight desktop Visão sub-dropdown button
    const desktopOverviewSubDropdownLinks = document.querySelectorAll('#desktopConfigDropdown .relative a');
    desktopOverviewSubDropdownLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.split('?')[0] === currentPath) {
            const subBtn = link.closest('.relative')?.querySelector('button');
            if (subBtn) {
                subBtn.classList.add('bg-gray-100', 'dark:bg-slate-700', 'text-gray-900', 'dark:text-white');
            }
        }
    });
}
function initMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const menu = document.getElementById('mobile-menu');
    const iconClosed = document.getElementById('icon-menu-closed');
    const iconOpen = document.getElementById('icon-menu-open');
    if (btn && menu) {
        btn.addEventListener('click', () => {
            const isHidden = menu.classList.contains('hidden');
            if (isHidden) {
                menu.classList.remove('hidden');
                if (iconClosed)
                    iconClosed.classList.add('hidden');
                if (iconOpen)
                    iconOpen.classList.remove('hidden');
            }
            else {
                menu.classList.add('hidden');
                if (iconClosed)
                    iconClosed.classList.remove('hidden');
                if (iconOpen)
                    iconOpen.classList.add('hidden');
            }
        });
    }
    const mobileDropdowns = [
        { btn: 'mobileCustomersDropdownBtn', menu: 'mobileCustomersDropdown', icon: 'mobileCustomersDropdownIcon' },
        { btn: 'mobileFinanceDropdownBtn', menu: 'mobileFinanceDropdown', icon: 'mobileFinanceDropdownIcon' },
        { btn: 'mobileProductsDropdownBtn', menu: 'mobileProductsDropdown', icon: 'mobileProductsDropdownIcon' },
        { btn: 'mobileCadServicoDropdownBtn', menu: 'mobileCadServicoDropdown', icon: 'mobileCadServicoDropdownIcon' },
        { btn: 'mobileAccountingDropdownBtn', menu: 'mobileAccountingDropdown', icon: 'mobileAccountingDropdownIcon' },
        { btn: 'mobileOverviewDropdownBtn', menu: 'mobileOverviewDropdown', icon: 'mobileOverviewDropdownIcon' },
        { btn: 'mobileWhatsappDropdownBtn', menu: 'mobileWhatsappDropdown', icon: 'mobileWhatsappDropdownIcon' },
        { btn: 'mobileReportsDropdownBtn', menu: 'mobileReportsDropdown', icon: 'mobileReportsDropdownIcon' },
        { btn: 'mobileConfigDropdownBtn', menu: 'mobileConfigDropdown', icon: 'mobileConfigDropdownIcon' },
        { btn: 'mobileControleDropdownBtn', menu: 'mobileControleDropdown', icon: 'mobileControleDropdownIcon' },
        { btn: 'mobileOrdersDropdownBtn', menu: 'mobileOrdersDropdown', icon: 'mobileOrdersDropdownIcon' },
        { btn: 'mobilePurchasesDropdownBtn', menu: 'mobilePurchasesDropdown', icon: 'mobilePurchasesDropdownIcon' },
        { btn: 'mobileOperationsDropdownBtn', menu: 'mobileOperationsDropdown', icon: 'mobileOperationsDropdownIcon' },
        { btn: 'mobileInfoDropdownBtn', menu: 'mobileInfoDropdown', icon: 'mobileInfoDropdownIcon' },
        { btn: 'mobileFiscalDropdownBtn', menu: 'mobileFiscalDropdown', icon: 'mobileFiscalDropdownIcon' },
        { btn: 'mobileSpedDropdownBtn', menu: 'mobileSpedDropdown', icon: 'mobileSpedDropdownIcon' },
        { btn: 'mobilePaymentDropdownBtn', menu: 'mobilePaymentDropdown', icon: 'mobilePaymentDropdownIcon' },
        { btn: 'mobileFormaRecebivelDropdownBtn', menu: 'mobileFormaRecebivelDropdown', icon: 'mobileFormaRecebivelDropdownIcon' },
        { btn: 'mobileCardExpensesDropdownBtn', menu: 'mobileCardExpensesDropdown', icon: 'mobileCardExpensesDropdownIcon' },
        { btn: 'mobileContabilDropdownBtn', menu: 'mobileContabilDropdown', icon: 'mobileContabilDropdownIcon' },
        { btn: 'mobileDpDropdownBtn', menu: 'mobileDpDropdown', icon: 'mobileDpDropdownIcon' }
    ];
    // Helper function for Dropdown toggles
    const setupMobileDropdown = (btnId, dropdownId, iconId) => {
        const dBtn = document.getElementById(btnId);
        const dMenu = document.getElementById(dropdownId);
        const dIcon = document.getElementById(iconId);
        if (dBtn && dMenu && dIcon) {
            dBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Previne fechar comportamentos inesperados
                const isExpanded = dBtn.getAttribute('aria-expanded') === 'true';
                // Se estiver abrindo o menu, fecha todos os outros primeiro (mas não o pai ou filhos diretos)
                if (!isExpanded) {
                    mobileDropdowns.forEach(other => {
                        if (other.btn !== btnId) {
                            const otherBtn = document.getElementById(other.btn);
                            if (otherBtn && otherBtn.contains(dBtn))
                                return;
                            const otherMenu = document.getElementById(other.menu);
                            if (otherMenu && (otherMenu.contains(dBtn) || dMenu.contains(otherMenu)))
                                return;
                            const otherIcon = document.getElementById(other.icon);
                            if (otherBtn)
                                otherBtn.setAttribute('aria-expanded', 'false');
                            if (otherMenu)
                                otherMenu.classList.add('hidden');
                            if (otherIcon)
                                otherIcon.classList.remove('rotate-180');
                        }
                    });
                }
                dBtn.setAttribute('aria-expanded', !isExpanded);
                dMenu.classList.toggle('hidden');
                dIcon.classList.toggle('rotate-180');
            });
        }
    };
    mobileDropdowns.forEach(item => {
        setupMobileDropdown(item.btn, item.menu, item.icon);
    });
}
function initDesktopMenuTouch() {
    const desktopDropdowns = [
        { btn: 'desktopPurchasesDropdownBtn', wrapper: 'desktopPurchasesDropdownWrapper' },
        { btn: 'desktopOrdersDropdownBtn', wrapper: 'desktopOrdersDropdownWrapper' },
        { btn: 'desktopProductsDropdownBtn', wrapper: 'desktopProductsDropdownWrapper' },
        { btn: 'desktopFinanceDropdownBtn', wrapper: 'desktopFinanceDropdownWrapper' },
        { btn: 'desktopCustomersDropdownBtn', wrapper: 'desktopCustomersDropdownWrapper' },
        { btn: 'desktopAccountingDropdownBtn', wrapper: 'desktopAccountingDropdownWrapper' },
        { btn: 'desktopReportsDropdownBtn', wrapper: 'desktopReportsDropdownWrapper' },
        { btn: 'desktopConfigDropdownBtn', wrapper: 'desktopConfigDropdownWrapper' },
        { btn: 'desktopControleDropdownBtn', wrapper: 'desktopControleDropdownWrapper' },
        { btn: 'desktopOperationsDropdownBtn', wrapper: 'desktopOperationsDropdownWrapper' },
        { btn: 'desktopInfoDropdownBtn', wrapper: 'desktopInfoDropdownWrapper' },
        { btn: 'userMenuBtn', wrapper: 'userSubmenuWrapper' }
    ];
    const closeAllNestedSubmenus = (parentContainer) => {
        const root = parentContainer || document.getElementById('desktopNavLinks') || document;
        const openSubmenus = root.querySelectorAll('.desktop-nested-submenu-open');
        openSubmenus.forEach(el => {
            el.classList.add('hidden');
            el.classList.remove('block', 'desktop-nested-submenu-open');
        });
        const activeSubBtns = root.querySelectorAll('.desktop-nested-subbtn-active');
        activeSubBtns.forEach(btn => {
            btn.classList.remove('desktop-nested-subbtn-active', 'bg-gray-100', 'dark:bg-slate-700', 'text-gray-900', 'dark:text-white');
        });
    };
    const closeAllDesktopDropdowns = () => {
        desktopDropdowns.forEach(item => {
            const wrapper = document.getElementById(item.wrapper);
            const btn = document.getElementById(item.btn);
            if (wrapper) {
                wrapper.classList.add('hidden');
                wrapper.classList.remove('block');
            }
            if (btn)
                btn.setAttribute('aria-expanded', 'false');
        });
        closeAllNestedSubmenus();
    };
    // Helper para posicionar o flyout de submenus evitando transbordar da tela em tablets
    const positionSubmenu = (submenuEl, containerEl) => {
        submenuEl.classList.remove('right-full', 'origin-top-right');
        submenuEl.classList.add('left-full', 'origin-top-left');
        const parentRect = containerEl.getBoundingClientRect();
        const submenuWidth = submenuEl.offsetWidth || 192; // largura padrão ~12rem (w-48)
        if (parentRect.right + submenuWidth > window.innerWidth - 12) {
            submenuEl.classList.remove('left-full', 'origin-top-left');
            submenuEl.classList.add('right-full', 'origin-top-right');
        }
    };
    desktopDropdowns.forEach(item => {
        const btn = document.getElementById(item.btn);
        const wrapper = document.getElementById(item.wrapper);
        if (btn && wrapper) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const isHidden = wrapper.classList.contains('hidden');
                // Fechar todos os outros dropdowns e submenus
                desktopDropdowns.forEach(other => {
                    if (other.wrapper !== item.wrapper) {
                        const otherWrapper = document.getElementById(other.wrapper);
                        const otherBtn = document.getElementById(other.btn);
                        if (otherWrapper) {
                            otherWrapper.classList.add('hidden');
                            otherWrapper.classList.remove('block');
                        }
                        if (otherBtn)
                            otherBtn.setAttribute('aria-expanded', 'false');
                    }
                });
                closeAllNestedSubmenus();
                if (isHidden) {
                    wrapper.classList.remove('hidden');
                    wrapper.classList.add('block');
                    btn.setAttribute('aria-expanded', 'true');
                    // Ajustar se o próprio dropdown principal transborda a tela
                    const rect = wrapper.getBoundingClientRect();
                    if (rect.right > window.innerWidth - 12) {
                        wrapper.classList.remove('left-0');
                        wrapper.classList.add('right-0');
                    }
                }
                else {
                    wrapper.classList.add('hidden');
                    wrapper.classList.remove('block');
                    btn.setAttribute('aria-expanded', 'false');
                }
            });
            // Permite que links e botões interativos (como modais de WhatsApp, Senha e Logout) executem seus handlers
            wrapper.addEventListener('click', (e) => {
                const target = e.target;
                if (!target)
                    return;
                const interactive = target.closest('a, button, input, select, textarea');
                if (interactive) {
                    return; // Permite navegação ou disparos de ações/modais
                }
                e.stopPropagation();
            });
        }
    });
    // Inicializa todos os submenus aninhados da navegação desktop para suporte a Touch / Tablet
    const initNestedSubmenus = () => {
        const desktopNav = document.getElementById('desktopNavLinks');
        if (!desktopNav)
            return;
        const subContainers = desktopNav.querySelectorAll('[class*="group/sub-"]');
        subContainers.forEach(container => {
            const subBtn = container.querySelector(':scope > button');
            const submenu = container.querySelector(':scope > div');
            if (subBtn && submenu) {
                // Clique/Toque no botão do submenu aninhado
                subBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const isOpen = submenu.classList.contains('desktop-nested-submenu-open') ||
                        (!submenu.classList.contains('hidden') && submenu.classList.contains('block'));
                    // Fechar submenus irmãos no mesmo nível
                    const parentList = container.parentElement;
                    if (parentList) {
                        const siblingSubmenus = parentList.querySelectorAll(':scope > [class*="group/sub-"] > div');
                        siblingSubmenus.forEach(sib => {
                            if (sib !== submenu) {
                                sib.classList.add('hidden');
                                sib.classList.remove('block', 'desktop-nested-submenu-open');
                            }
                        });
                        const siblingBtns = parentList.querySelectorAll(':scope > [class*="group/sub-"] > button');
                        siblingBtns.forEach(b => {
                            if (b !== subBtn) {
                                b.classList.remove('desktop-nested-subbtn-active', 'bg-gray-100', 'dark:bg-slate-700', 'text-gray-900', 'dark:text-white');
                            }
                        });
                    }
                    if (isOpen) {
                        submenu.classList.add('hidden');
                        submenu.classList.remove('block', 'desktop-nested-submenu-open');
                        subBtn.classList.remove('desktop-nested-subbtn-active', 'bg-gray-100', 'dark:bg-slate-700', 'text-gray-900', 'dark:text-white');
                    }
                    else {
                        submenu.classList.remove('hidden');
                        submenu.classList.add('block', 'desktop-nested-submenu-open');
                        subBtn.classList.add('desktop-nested-subbtn-active', 'bg-gray-100', 'dark:bg-slate-700', 'text-gray-900', 'dark:text-white');
                        positionSubmenu(submenu, container);
                    }
                });
                // Posicionamento inteligente também ao passar o mouse em telas intermediárias
                container.addEventListener('mouseenter', () => {
                    positionSubmenu(submenu, container);
                });
            }
        });
    };
    initNestedSubmenus();
    // Fechar tudo ao clicar fora
    document.addEventListener('click', () => {
        closeAllDesktopDropdowns();
    });
}
function initThemeToggle() {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn)
        return;
    const htmlDecl = document.documentElement;
    const moon = document.getElementById('moonIcon');
    const sun = document.getElementById('sunIcon');
    if (!moon || !sun)
        return;
    const show = (el) => {
        el.classList.remove('hidden');
        el.classList.add('block');
    };
    const hide = (el) => {
        el.classList.add('hidden');
        el.classList.remove('block');
    };
    const apply = (isDark) => {
        // Exibe o ícone do tema ATUAL (não o próximo).
        if (isDark) {
            show(moon);
            hide(sun);
            btn.title = 'Alternar Tema Claro';
        }
        else {
            show(sun);
            hide(moon);
            btn.title = 'Alternar Tema Escuro';
        }
    };
    // Estado inicial (já setado pelo api.js initTheme)
    apply(htmlDecl.classList.contains('dark'));
    btn.addEventListener('click', () => {
        const isDark = htmlDecl.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        apply(isDark);
    });
}
function initLogout() {
    const doLogout = async (event) => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        try {
            if (typeof api === 'function') {
                await api('/auth/logout', { method: 'POST' });
            }
        }
        catch (_err) {
            // Silently ignore network failures on logout
        }
        if (typeof Auth !== 'undefined' && typeof Auth.clearToken === 'function') {
            Auth.clearToken();
        }
        else {
            localStorage.removeItem('erp_token');
        }
        // Fallbacks para ambientes com variações de sessão/local cache.
        localStorage.removeItem('erp_token');
        sessionStorage.removeItem('erp_token');
        localStorage.removeItem('bessa_swagger_token');
        localStorage.removeItem('keystone_last_user_name');
        localStorage.removeItem('keystone_last_company_name');
        localStorage.removeItem('keystone_last_company_cnpj');
        localStorage.removeItem('keystone_last_company_public_id');
        localStorage.removeItem('keystone_accessible_companies');
        closeLogoutModal();
        window.location.replace('/');
    };
    const closeLogoutModal = () => {
        const modal = document.getElementById('logoutConfirmModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    };
    const openLogoutModal = () => {
        const modal = document.getElementById('logoutConfirmModal');
        if (modal) {
            modal.classList.remove('hidden');
            return;
        }
        // Fallback para ambientes sem modal carregado.
        if (window.confirm('Deseja sair do sistema?')) {
            doLogout();
        }
    };
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeLogoutModal();
        }
    });
    // Delegação para cenários em que a navbar é re-renderizada após o bind inicial.
    document.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) {
            return;
        }
        // 1. Botão de abrir o modal de logout
        const trigger = target.closest('#logoutBtn, #logoutBtnMobile');
        if (trigger) {
            event.preventDefault();
            openLogoutModal();
            return;
        }
        // 2. Botão de confirmar o logout
        const confirmBtn = target.closest('#logoutConfirmBtn');
        if (confirmBtn) {
            event.preventDefault();
            doLogout();
            return;
        }
        // 3. Botão de cancelar ou fechar ao clicar no backdrop
        const cancelOrBackdrop = target.closest('#logoutCancelBtn, #logoutConfirmBackdrop');
        if (cancelOrBackdrop) {
            event.preventDefault();
            closeLogoutModal();
            return;
        }
    });
}
window.updateNavbarAvatar = function (name, photoBase64) {
    const userMenuBtn = document.getElementById('userMenuBtn');
    if (!userMenuBtn)
        return;
    const srSpan = '<span class="sr-only">Abrir menu do usuário</span>';
    if (photoBase64 && photoBase64.trim() !== '') {
        userMenuBtn.innerHTML = `
            ${srSpan}
            <img id="userGreetingAvatar" src="${photoBase64}" alt="Avatar" class="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-gray-200 dark:ring-slate-700">
        `;
    }
    else {
        const initial = String(name || 'U').charAt(0).toUpperCase();
        userMenuBtn.innerHTML = `
            ${srSpan}
            <div id="userGreetingAvatar" class="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-sm shrink-0 ring-1 ring-gray-200 dark:ring-slate-700 shadow-sm">${initial}</div>
        `;
    }
};
async function loadUserGreeting() {
    const greetingEl = document.getElementById('userGreeting');
    if (!greetingEl)
        return;
    // Carrega dados do cache local imediatamente para evitar delay visual na tela
    const cachedName = localStorage.getItem('keystone_last_user_name');
    const cachedCompanyName = localStorage.getItem('keystone_last_company_name');
    const cachedCompanyCnpj = localStorage.getItem('keystone_last_company_cnpj');
    const cachedCompanyPublicId = localStorage.getItem('keystone_last_company_public_id');
    const cachedPhoto = localStorage.getItem('keystone_last_user_photo');
    const companyEls = document.querySelectorAll('#userGreetingCompany');
    const compNameEls = document.querySelectorAll('#navbarCompanyName');
    const compCnpjEls = document.querySelectorAll('#navbarCompanyCNPJ');
    const compIdEls = document.querySelectorAll('#navbarCompanyID');
    if (cachedName) {
        greetingEl.textContent = `Olá, ${cachedName}`;
    }
    window.updateNavbarAvatar(cachedName || 'Usuário', cachedPhoto);
    if (cachedCompanyName) {
        if (compNameEls.length > 0) {
            compNameEls.forEach(el => el.textContent = cachedCompanyName);
        }
        if (compCnpjEls.length > 0) {
            compCnpjEls.forEach(el => el.textContent = cachedCompanyCnpj ? `CNPJ: ${cachedCompanyCnpj}` : '');
        }
        if (compIdEls.length > 0) {
            compIdEls.forEach(el => el.textContent = cachedCompanyPublicId ? `ID: ${cachedCompanyPublicId}` : '');
        }
        if (companyEls.length > 0) {
            const compCnpj = cachedCompanyCnpj ? ` - CNPJ: ${cachedCompanyCnpj}` : '';
            const compId = cachedCompanyPublicId ? ` | ID: ${cachedCompanyPublicId}` : '';
            companyEls.forEach(el => {
                el.textContent = `${cachedCompanyName}${compCnpj}${compId}`;
            });
        }
    }
    if (cachedCompanyName) {
        window.SharedFooter?.setCompanyContext({
            name: cachedCompanyName,
            cnpj: cachedCompanyCnpj || '',
            public_id: cachedCompanyPublicId || '',
        });
    }
    try {
        if (typeof api !== 'undefined') {
            const data = await api('/auth/me');
            if (data && data.data && data.data.user && data.data.user.full_name) {
                const role = data.data.user.role;
                const rawName = String(data.data.user.full_name || '').trim();
                const normalizedName = rawName.toLowerCase();
                const isGenericName = normalizedName === 'usuario' || normalizedName === 'usuário';
                const greetingName = role === 'super_admin' && (!rawName || isGenericName)
                    ? 'Super Admin'
                    : (rawName || 'Usuário');
                // Salva no cache local para a próxima carga de página
                localStorage.setItem('keystone_last_user_name', greetingName);
                if (data.data.user.photo_base64) {
                    localStorage.setItem('keystone_last_user_photo', data.data.user.photo_base64);
                }
                else {
                    localStorage.removeItem('keystone_last_user_photo');
                }
                window.updateNavbarAvatar(greetingName, data.data.user.photo_base64);
                if (data.data.company) {
                    const compName = data.data.company.trade_name || data.data.company.company_name || '';
                    const compCnpj = data.data.company.cnpj || '';
                    const compId = data.data.company.public_id || '';
                    localStorage.setItem('keystone_last_company_name', compName);
                    localStorage.setItem('keystone_last_company_cnpj', compCnpj);
                    localStorage.setItem('keystone_last_company_public_id', compId);
                    if (compNameEls.length > 0) {
                        compNameEls.forEach(el => el.textContent = compName);
                    }
                    if (compCnpjEls.length > 0) {
                        compCnpjEls.forEach(el => el.textContent = compCnpj ? `CNPJ: ${compCnpj}` : '');
                    }
                    if (compIdEls.length > 0) {
                        compIdEls.forEach(el => el.textContent = compId ? `ID: ${compId}` : '');
                    }
                    if (companyEls.length > 0) {
                        const compCnpjStr = compCnpj ? ` - CNPJ: ${compCnpj}` : '';
                        const compIdStr = compId ? ` | ID: ${compId}` : '';
                        companyEls.forEach(el => {
                            el.textContent = `${compName}${compCnpjStr}${compIdStr}`;
                        });
                    }
                }
                else {
                    localStorage.removeItem('keystone_last_company_name');
                    localStorage.removeItem('keystone_last_company_cnpj');
                    localStorage.removeItem('keystone_last_company_public_id');
                }
                gNavbarAuthContext = {
                    user: data.data.user || null,
                    company: data.data.company || null,
                    permissions: data.data.permissions || []
                };
                if (data.data.company && data.data.company.swagger_api_token) {
                    localStorage.setItem('bessa_swagger_token', data.data.company.swagger_api_token);
                }
                else {
                    localStorage.removeItem('bessa_swagger_token');
                }
                window.SharedFooter?.setCompanyContext({
                    name: data.data.company?.trade_name || data.data.company?.company_name || '',
                    cnpj: data.data.company?.cnpj || '',
                    public_id: data.data.company?.public_id || '',
                });
                greetingEl.textContent = `Olá, ${greetingName}`;
                const companyData = data.data.company;
                const isGeneralAdminCompany = companyData?.is_general_admin === true || companyData?.is_general_admin === 1;
                const hasGeneralAdminContext = Boolean(data.data.user?.general_admin_company_id);
                const isGroupMasterCompany = (companyData?.is_group_master === true || companyData?.is_group_master === 1) && !!companyData?.company_group_id;
                const hasGroupMasterContext = Boolean(data.data.user?.group_master_company_id);
                const hasGroupMasterPrivileges = isGroupMasterCompany || hasGroupMasterContext;
                const isSuperAdmin = role === 'super_admin' || isGeneralAdminCompany || hasGeneralAdminContext;
                const isSuperAdminPage = document.body?.dataset?.superAdminPage === 'true';
                document.querySelectorAll('[data-super-admin-only="true"]').forEach((element) => {
                    const isCompanyLink = element.getAttribute('href') === '/pages/companies.html' || element.getAttribute('data-module') === 'company';
                    const isCompanyGroupLink = element.getAttribute('href') === '/pages/company-groups.html' || element.getAttribute('data-module') === 'company_group';
                    if (!isSuperAdmin && (!hasGroupMasterPrivileges || (!isCompanyLink && !isCompanyGroupLink))) {
                        element.style.setProperty('display', 'none', 'important');
                    }
                });
                if (isSuperAdminPage && !isSuperAdmin) {
                    const currentPath = window.location.pathname;
                    if (hasGroupMasterPrivileges && (currentPath.includes('companies.html') || currentPath.endsWith('/companies') || currentPath.includes('company-groups.html') || currentPath.endsWith('/company-groups'))) {
                        // Permite acesso de empresa master à tela de companies e company-groups
                    }
                    else {
                        window.location.href = '/pages/dashboard.html';
                        return;
                    }
                }
                // Sincroniza empresas acessíveis com o switcher do rodapé (Empresa Master do Grupo ou Super Admin)
                if (hasGroupMasterPrivileges || isSuperAdmin) {
                    try {
                        const companiesRes = await api('/companies');
                        if (companiesRes && Array.isArray(companiesRes.data) && companiesRes.data.length > 0) {
                            window.SharedFooter?.setAccessibleCompanies(companiesRes.data, companyData?.public_id || '');
                        }
                    }
                    catch (err) {
                        console.warn('Não foi possível carregar empresas acessíveis para o footer:', err);
                    }
                }
                else {
                    window.SharedFooter?.setAccessibleCompanies([], companyData?.public_id || '');
                }
                // Super Admin deve sempre visualizar todos os menus/submenus.
                // Super Admin deve visualizar somente o menu Configuração.
                if (role === 'super_admin') {
                    const hideBtns = [
                        'desktopCustomersDropdownBtn',
                        'desktopFinanceDropdownBtn',
                        'desktopProductsDropdownBtn',
                        'desktopAccountingDropdownBtn',
                        'desktopOverviewDropdownBtn',
                        'desktopReportsDropdownBtn',
                        'desktopOrdersDropdownBtn',
                        'desktopPurchasesDropdownBtn',
                        'desktopOperationsDropdownBtn',
                        'mobileCustomersDropdownBtn',
                        'mobileFinanceDropdownBtn',
                        'mobileProductsDropdownBtn',
                        'mobileAccountingDropdownBtn',
                        'mobileOverviewDropdownBtn',
                        'mobileReportsDropdownBtn',
                        'mobileOrdersDropdownBtn',
                        'mobilePurchasesDropdownBtn',
                        'mobileControleDropdownBtn',
                    ];
                    hideBtns.forEach((btnId) => {
                        const btnEl = document.getElementById(btnId);
                        if (btnEl && btnEl.parentElement) {
                            btnEl.parentElement.style.setProperty('display', 'none', 'important');
                        }
                    });
                    const showBtns = [
                        'desktopConfigDropdownBtn',
                        'mobileConfigDropdownBtn',
                        'desktopInfoDropdownBtn',
                        'mobileInfoDropdownBtn'
                    ];
                    showBtns.forEach((btnId) => {
                        const btnEl = document.getElementById(btnId);
                        if (btnEl && btnEl.parentElement) {
                            btnEl.parentElement.style.removeProperty('display');
                        }
                    });
                    // Ensure links inside the config dropdown are visible
                    const configDropdowns = ['desktopConfigDropdown', 'mobileConfigDropdown'];
                    configDropdowns.forEach(menuId => {
                        const menuEl = document.getElementById(menuId);
                        if (menuEl) {
                            menuEl.querySelectorAll('a').forEach(a => {
                                a.style.removeProperty('display');
                            });
                        }
                    });
                    // Redirect if super_admin attempts to load a non-config page
                    const currentFile = window.location.pathname.split('/').pop()?.replace('.html', '') || '';
                    const allowedSuperAdminFiles = [
                        'companies',
                        'company-groups',
                        'users',
                        'roles',
                        'tasks',
                        'organizer',
                        'audit',
                        'email',
                        'whatsapp',
                        'swagger',
                        'ajuste',
                        'backup_restore',
                        'ajuda',
                        'email-config',
                        'whatsapp-info',
                        'whatsapp_sessions',
                        'maintenance',
                        'gera-pix',
                        'cost-centers',
                        'nova_reforma_simples',
                        'declaracao_faturamento'
                    ];
                    if (currentFile && currentFile !== 'login' && !allowedSuperAdminFiles.includes(currentFile)) {
                        window.location.href = '/pages/companies.html';
                    }
                    return;
                }
                // Hide unauthorized links
                const permissions = gNavbarAuthContext.permissions || [];
                // Administrador e Supervisor Completo possuem acesso irrestrito a todos os menus da empresa.
                if (role === 'admin' || role === 'supervisor')
                    return;
                if (role === 'super_admin' && permissions.length === 0)
                    return;
                // Normaliza nomes de módulos (compatibilidade com seeds/DB antigos)
                const MODULE_ALIASES = {
                    // Compatibilidade com seeds/DB antigos e nomes no menu
                    seller: 'sellers',
                    buyer: 'buyers',
                    service_provider: 'service_providers',
                    supplier: 'suppliers',
                    // Alguns ambientes gravaram como singular/"profile"
                    user: 'users',
                    // Legado: "profile" costumava significar "Config. de Perfis" (roles)
                    profile: 'roles',
                    // Página é companies.html, mas permissão é company
                    companies: 'company',
                    'company-groups': 'company_group',
                    // Mapeamento de página para módulo de permissão
                    'stock-vision': 'stock_vision',
                    'finance-vision': 'finance_vision',
                    'receivable-types': 'receivable_types',
                    'payment-types': 'payment_types',
                    'card-configurations': 'card_configurations',
                    'card-brands': 'card_brands',
                    'customer-groups': 'customer_groups',
                    'activity-groups': 'activity_groups',
                    'card-debits': 'card_debits',
                    'card-expenses': 'card_expenses',
                    'product-types': 'product_types',
                    'rel-rafael': 'rel_rafael',
                    'rel-pedido-dorsal': 'rel_pedido_dorsal',
                    'rel-saldo-banco': 'rel_saldo_banco',
                    'cost-centers': 'cost_centers',
                    'fin_solidcon_vision': 'fin_solidcon_vision',
                    'fin-solidcon-vision': 'fin_solidcon_vision',
                    'rel-valor-empresa': 'rel_valor_empresa',
                    'rel_valor_empresa': 'rel_valor_empresa',
                };
                const normalizeModule = (name) => {
                    const value = String(name || '').trim();
                    return MODULE_ALIASES[value] || value;
                };
                const moduleToPage = (moduleName) => {
                    if (moduleName === 'stock_vision') {
                        return 'stock-vision';
                    }
                    if (moduleName === 'finance_vision') {
                        return 'finance-vision';
                    }
                    if (moduleName === 'fin_solidcon_vision') {
                        return 'fin_solidcon_vision';
                    }
                    if (moduleName === 'rel_valor_empresa') {
                        return 'rel_valor_empresa';
                    }
                    if (moduleName === 'stock_types') {
                        return 'stock-types';
                    }
                    if (moduleName === 'product_types') {
                        return 'product-types';
                    }
                    if (moduleName === 'receivable_types') {
                        return 'receivable-types';
                    }
                    if (moduleName === 'payment_types') {
                        return 'payment-types';
                    }
                    if (moduleName === 'customer_groups') {
                        return 'customer-groups';
                    }
                    if (moduleName === 'activity_groups') {
                        return 'activity-groups';
                    }
                    if (moduleName === 'card_configurations') {
                        return 'card-configurations';
                    }
                    if (moduleName === 'card_brands') {
                        return 'card-brands';
                    }
                    if (moduleName === 'card_debits') {
                        return 'card-debits';
                    }
                    if (moduleName === 'card_expenses') {
                        return 'card-expenses';
                    }
                    if (moduleName === 'rel_rafael') {
                        return 'rel-rafael';
                    }
                    if (moduleName === 'rel_pedido_dorsal') {
                        return 'rel-pedido-dorsal';
                    }
                    if (moduleName === 'rel_saldo_banco') {
                        return 'rel-saldo-banco';
                    }
                    if (moduleName === 'cost_centers') {
                        return 'cost-centers';
                    }
                    return moduleName;
                };
                // Obter lista de permissões onde can_view é true
                const activePerms = permissions.filter(p => p.can_view).map(p => normalizeModule(p.module));
                // Fallback por role apenas quando não houver permissões ativas retornadas pela API.
                const ROLE_FALLBACK_MODULES = {
                    seller: ['dashboard', 'sales', 'customers', 'sellers'],
                };
                const fallbackPerms = activePerms.length === 0
                    ? (ROLE_FALLBACK_MODULES[role] || []).map(normalizeModule)
                    : [];
                const effectivePerms = Array.from(new Set([
                    ...activePerms,
                    ...fallbackPerms,
                ]));
                const hasStockTypesAccess = effectivePerms.includes('stock_types') || effectivePerms.includes('categories');
                const hasProductTypesAccess = effectivePerms.includes('product_types') || effectivePerms.includes('categories');
                // Aplicar as regras na Navbar visível
                const allLinks = document.querySelectorAll('a[href^="/pages/"]');
                allLinks.forEach(a => {
                    const requiresSuperAdmin = a.dataset.superAdminOnly === 'true';
                    // Se não for super_admin, nunca exibir links restritos.
                    if (requiresSuperAdmin && !isSuperAdmin) {
                        a.style.setProperty('display', 'none', 'important');
                        return;
                    }
                    // Reset: evita "sumir" link por inline style antigo (ex: após atualizar permissões)
                    a.style.removeProperty('display');
                    // Links marcados como utilitários (ex: Ajuda, D. Faturamento, Legislação) nunca são ocultados
                    if (a.dataset.noPermCheck === 'true' || a.getAttribute('data-no-perm-check') === 'true')
                        return;
                    const href = a.getAttribute('href') || '';
                    const file = href.split('/').pop()?.replace('.html', '') || '';
                    const moduleName = normalizeModule(a.dataset.module || file);
                    if (requiresSuperAdmin && isSuperAdmin) {
                        return;
                    }
                    // Ocultar com força (style.display) recursos sem permissão
                    // Obs: admin, supervisor e super_admin possuem bypass total para todos os módulos da empresa
                    const isAdminBypass = (role === 'super_admin' || role === 'admin' || role === 'supervisor');
                    const hasModuleAccess = moduleName === 'stock_types'
                        ? hasStockTypesAccess
                        : moduleName === 'product_types'
                            ? hasProductTypesAccess
                            : effectivePerms.includes(moduleName);
                    if (!hasModuleAccess && !isAdminBypass) {
                        a.style.setProperty('display', 'none', 'important');
                    }
                });
                // Ocultar dropdown containers (os "ícones" de Estoque, Financeiro, Pessoas, Config) se estiverem vazios ou marcados como ocultos
                const dropdownContainers = [
                    { btn: 'desktopCustomersDropdownBtn', menu: 'desktopCustomersDropdown', group: 'Pessoas' },
                    { btn: 'desktopFinanceDropdownBtn', menu: 'desktopFinanceDropdown', group: 'Financeiro' },
                    { btn: 'desktopProductsDropdownBtn', menu: 'desktopProductsDropdown', group: 'Estoque' },
                    { btn: 'desktopAccountingDropdownBtn', menu: 'desktopAccountingDropdown', group: 'Contabilidade' },
                    { btn: 'desktopOverviewDropdownBtn', menu: 'desktopOverviewDropdown', group: 'Visão' },
                    { btn: 'desktopReportsDropdownBtn', menu: 'desktopReportsDropdown', group: 'Relatórios' },
                    { btn: 'desktopConfigDropdownBtn', menu: 'desktopConfigDropdown', group: 'Configuração' },
                    { btn: 'desktopOrdersDropdownBtn', menu: 'desktopOrdersDropdown', group: 'Pedido' },
                    { btn: 'desktopPurchasesDropdownBtn', menu: 'desktopPurchasesDropdown', group: 'Pedido_Compra' },
                    { btn: 'desktopOperationsDropdownBtn', menu: 'desktopOperationsDropdown', group: 'Operação' },
                    { btn: 'desktopInfoDropdownBtn', menu: 'desktopInfoDropdown', group: 'Info' },
                    { btn: 'mobileCustomersDropdownBtn', menu: 'mobileCustomersDropdown', group: 'Pessoas' },
                    { btn: 'mobileFinanceDropdownBtn', menu: 'mobileFinanceDropdown', group: 'Financeiro' },
                    { btn: 'mobileProductsDropdownBtn', menu: 'mobileProductsDropdown', group: 'Estoque' },
                    { btn: 'mobileAccountingDropdownBtn', menu: 'mobileAccountingDropdown', group: 'Contabilidade' },
                    { btn: 'mobileOverviewDropdownBtn', menu: 'mobileOverviewDropdown', group: 'Visão' },
                    { btn: 'mobileReportsDropdownBtn', menu: 'mobileReportsDropdown', group: 'Relatórios' },
                    { btn: 'mobileConfigDropdownBtn', menu: 'mobileConfigDropdown', group: 'Configuração' },
                    { btn: 'mobileControleDropdownBtn', menu: 'mobileControleDropdown', group: 'Configuração' },
                    { btn: 'mobileOrdersDropdownBtn', menu: 'mobileOrdersDropdown', group: 'Pedido' },
                    { btn: 'mobilePurchasesDropdownBtn', menu: 'mobilePurchasesDropdown', group: 'Pedido_Compra' },
                    { btn: 'mobileOperationsDropdownBtn', menu: 'mobileOperationsDropdown', group: 'Operação' },
                    { btn: 'mobileInfoDropdownBtn', menu: 'mobileInfoDropdown', group: 'Info' }
                ];
                dropdownContainers.forEach(containerObj => {
                    const btnEl = document.getElementById(containerObj.btn);
                    const menuEl = document.getElementById(containerObj.menu);
                    if (btnEl && menuEl) {
                        // Reset: se antes o dropdown foi ocultado, garante que pode voltar a aparecer
                        const parent = btnEl.parentElement;
                        parent?.style.removeProperty('display');
                        const links = menuEl.querySelectorAll('a');
                        let hasVisible = false;
                        links.forEach(l => {
                            if (l.style.display !== 'none')
                                hasVisible = true;
                        });
                        // Verifica se existe a permissão explícita para ocultar este menu
                        const menuShowPerm = permissions.find(p => p.module === `menu_show_${containerObj.group}`);
                        const isMenuHidden = menuShowPerm !== undefined && (menuShowPerm.can_view === 0 || menuShowPerm.can_view === false || menuShowPerm.can_view === '0');
                        if (!hasVisible || isMenuHidden) {
                            // No desktop e mobile, escondemos o elemento PAI imediato (wrapper container)
                            if (parent) {
                                parent.style.setProperty('display', 'none', 'important');
                            }
                        }
                    }
                });
                // Ocultar submenus aninhados (desktop) se todos os seus links internos estiverem ocultos ou se houver restrição menu_show
                const SUBMENU_MAP = {
                    'cadservico': 'Cad.Serviço',
                    'despesacartao': 'Despesa Cartão',
                    'formapagamento': 'Forma de Pagamento',
                    'formarecebivel': 'Forma de Recebível',
                    'contabil': 'Contábil',
                    'fiscal': 'Fiscal',
                    'sped': 'Sped Fiscal',
                    'dpessoal': 'D.Pessoal',
                    'visao': 'Visão',
                    'whatsapp': 'A.WhatsApp'
                };
                const desktopSubmenus = document.querySelectorAll('[id$="Dropdown"] .relative');
                desktopSubmenus.forEach(sub => {
                    const groupClass = Array.from(sub.classList).find(c => c.startsWith('group/sub-'));
                    let isMenuHidden = false;
                    if (groupClass) {
                        const rawGroup = groupClass.replace('group/sub-', '');
                        const mappedGroup = SUBMENU_MAP[rawGroup] || rawGroup;
                        const menuShowPerm = permissions.find(p => p.module === `menu_show_${mappedGroup}`);
                        isMenuHidden = menuShowPerm !== undefined && (menuShowPerm.can_view === 0 || menuShowPerm.can_view === false || menuShowPerm.can_view === '0');
                    }
                    const links = sub.querySelectorAll('a');
                    let hasVisible = false;
                    links.forEach(l => {
                        if (l.style.display !== 'none')
                            hasVisible = true;
                    });
                    if (!hasVisible || isMenuHidden) {
                        sub.style.setProperty('display', 'none', 'important');
                    }
                    else {
                        sub.style.removeProperty('display');
                    }
                });
                // Ocultar submenus aninhados (mobile) se todos os seus links internos estiverem ocultos ou se houver restrição menu_show
                const MOBILE_SUBMENU_MAP = {
                    'mobileCardExpensesDropdownBtn': 'Despesa Cartão',
                    'mobilePaymentDropdownBtn': 'Forma de Pagamento',
                    'mobileFormaRecebivelDropdownBtn': 'Forma de Recebível',
                    'mobileContabilDropdownBtn': 'Contábil',
                    'mobileFiscalDropdownBtn': 'Fiscal',
                    'mobileSpedDropdownBtn': 'Sped Fiscal',
                    'mobileDpDropdownBtn': 'D.Pessoal',
                    'mobileOverviewDropdownBtn': 'Visão',
                    'mobileCadServicoDropdownBtn': 'Cad.Serviço',
                    'mobileWhatsappDropdownBtn': 'A.WhatsApp'
                };
                Object.keys(MOBILE_SUBMENU_MAP).forEach(btnId => {
                    const btnEl = document.getElementById(btnId);
                    if (btnEl && btnEl.parentElement) {
                        const mappedGroup = MOBILE_SUBMENU_MAP[btnId];
                        const menuShowPerm = permissions.find(p => p.module === `menu_show_${mappedGroup}`);
                        const isMenuHidden = menuShowPerm !== undefined && (menuShowPerm.can_view === 0 || menuShowPerm.can_view === false || menuShowPerm.can_view === '0');
                        const controlsId = btnEl.getAttribute('aria-controls') || '';
                        const menuEl = document.getElementById(controlsId);
                        let hasVisible = false;
                        if (menuEl) {
                            const links = menuEl.querySelectorAll('a');
                            links.forEach(l => {
                                if (l.style.display !== 'none')
                                    hasVisible = true;
                            });
                        }
                        if (!hasVisible || isMenuHidden) {
                            btnEl.parentElement.style.setProperty('display', 'none', 'important');
                        }
                        else {
                            btnEl.parentElement.style.removeProperty('display');
                        }
                    }
                });
                // Blindagem de Rota Frontend: Onde o usuário está navegando agora?
                const currentFile = window.location.pathname.split('/').pop().replace('.html', '');
                // Páginas utilitárias: podem ficar acessíveis mesmo sem permissão explícita.
                const isNoPermCheckPage = document.body?.dataset?.noPermCheckPage === 'true';
                if (isNoPermCheckPage || currentFile === 'ajuda') {
                    return;
                }
                const currentModule = normalizeModule(document.body?.dataset?.requiredModule || currentFile);
                const isBypassed = (role === 'super_admin' || role === 'admin' || role === 'supervisor');
                const hasCurrentModuleAccess = currentModule === 'stock_types'
                    ? hasStockTypesAccess
                    : currentModule === 'product_types'
                        ? hasProductTypesAccess
                        : effectivePerms.includes(currentModule);
                if (currentModule && currentFile !== 'roles' && !hasCurrentModuleAccess && !isBypassed) {
                    // Usuário tentou acessar/está em uma página que não tem permissão!
                    if (effectivePerms.includes('dashboard')) {
                        window.location.href = '/pages/dashboard.html';
                    }
                    else if (effectivePerms.length > 0) {
                        window.location.href = `/pages/${moduleToPage(effectivePerms[0])}.html`;
                    }
                    else {
                        // Nenhuma tela permitida
                        window.location.href = '/pages/roles.html';
                    }
                }
            }
        }
    }
    catch (e) {
        const errorMsg = String(e?.message || '');
        if (errorMsg.includes('Servidor indisponível') || errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError') || e?.name === 'TypeError') {
            console.warn('Navbar: Servidor ocupado ou reiniciando. Sincronizando dados em instantes...');
            setTimeout(() => {
                loadUserGreeting();
            }, 3000);
            return;
        }
        console.warn('Não foi possível sincronizar usuário na navegação:', e);
    }
}
/**
 * Lógica de Notificações Globais
 */
function initNotifications() {
    const btn = document.getElementById('notificationBtn');
    const badge = document.getElementById('notificationBadge');
    const dropdown = document.getElementById('notificationDropdown');
    const list = document.getElementById('notificationList');
    const clearBtn = document.getElementById('clearNotificationsBtn');
    if (!btn || !dropdown)
        return;
    // Toggle dropdown
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
        if (!dropdown.classList.contains('hidden')) {
            badge.classList.add('hidden'); // Clear badge on open
        }
    });
    document.addEventListener('click', () => dropdown.classList.add('hidden'));
    dropdown.addEventListener('click', (e) => e.stopPropagation());
    // Clear notifications
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            localStorage.setItem('keystone_notifications', JSON.stringify([]));
            updateNotificationList();
        });
    }
    // Update UI from storage
    const updateNotificationList = () => {
        const notifications = JSON.parse(localStorage.getItem('keystone_notifications') || '[]');
        if (notifications.length === 0) {
            list.innerHTML = '<div class="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-xs">Nenhuma notificação por enquanto</div>';
            return;
        }
        list.innerHTML = notifications.reverse().map(n => `
            <div class="px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                <div class="flex items-start gap-3">
                    <div class="mt-1 shrink-0">
                        ${n.type === 'success' ? '✅' : '❌'}
                    </div>
                    <div class="flex-1">
                        <p class="text-xs font-semibold text-gray-900 dark:text-gray-100">${n.title}</p>
                        <p class="text-[10px] text-gray-500 mt-0.5">${n.message}</p>
                        <p class="text-[9px] text-gray-400 mt-1">${new Date(n.time).toLocaleString('pt-BR')}</p>
                    </div>
                </div>
            </div>
        `).join('');
    };
    updateNotificationList();
    // Background Job Polling (Monitora se houve término de job de SEFAZ e PIX)
    let lastProcessedJobId = localStorage.getItem('last_processed_job_id');
    let lastNotifiedTransactions = JSON.parse(localStorage.getItem('last_notified_txs') || '[]');
    const pollBackgroundTasks = async () => {
        try {
            if (!gNavbarAuthContext.user || !Auth.isAuthenticated())
                return;
            const now = Date.now();
            const lastCheck = Number(localStorage.getItem('last_recent_paid_check') || '0');
            if (now - lastCheck < 300000) { // 5 minutes throttle
                return;
            }
            localStorage.setItem('last_recent_paid_check', String(now));
            // Recarrega do localStorage para evitar alertas duplicados em múltiplas abas abertas
            lastNotifiedTransactions = JSON.parse(localStorage.getItem('last_notified_txs') || '[]');
            // 1. Verificar recebimentos recentes (PIX/Boleto)
            const result = await api('/finance/revenues/recent-paid');
            if (result?.status === 'success' && Array.isArray(result.data)) {
                result.data.forEach(tx => {
                    if (!lastNotifiedTransactions.includes(tx.public_id)) {
                        window.dispatchEvent(new CustomEvent('add-notification', {
                            detail: {
                                title: 'Pagamento Recebido! 💰',
                                message: `Recebimento de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.amount)} de ${tx.customer_name || 'Cliente'}.`,
                                type: 'success'
                            }
                        }));
                        lastNotifiedTransactions.push(tx.public_id);
                    }
                });
                // Manter apenas os últimos 50 ids para não inflar o storage
                if (lastNotifiedTransactions.length > 50)
                    lastNotifiedTransactions = lastNotifiedTransactions.slice(-50);
                localStorage.setItem('last_notified_txs', JSON.stringify(lastNotifiedTransactions));
            }
        }
        catch (err) {
            console.warn('Erro no polling de notificações:', err);
        }
    };
    // Polling a cada 60 segundos
    setInterval(pollBackgroundTasks, 60000);
    pollBackgroundTasks(); // Executa na carga (respeitando o throttle de 5 min)
    // Ouvinte de Notificações Customizadas (Disparado por outros scripts como manifestation.js ou ordens de venda)
    window.addEventListener('add-notification', (e) => {
        const { title, message, type } = e.detail;
        const current = JSON.parse(localStorage.getItem('keystone_notifications') || '[]');
        current.push({ title, message, type, time: new Date().getTime() });
        localStorage.setItem('keystone_notifications', JSON.stringify(current.slice(-20))); // Keep last 20
        updateNotificationList();
        if (dropdown && dropdown.classList.contains('hidden')) {
            badge.classList.remove('hidden');
            // Little bounce animation if possible
            btn.classList.add('animate-bounce');
            setTimeout(() => btn.classList.remove('animate-bounce'), 2000);
        }
    });
    // Notificar envio de WhatsApp (Disparo manual nos botões de venda)
    window.addEventListener('whatsapp-sent', (e) => {
        window.dispatchEvent(new CustomEvent('add-notification', {
            detail: { title: 'Venda via WhatsApp', message: 'Mensagem enviada para o cliente com sucesso!', type: 'success' }
        }));
    });
}
async function initUserMenuWhatsAppConfig() {
    const navContent = document.getElementById('whatsappContentNav');
    if (!navContent)
        return;
    const modal = document.getElementById('navWaConfigModal');
    const openBtn = document.getElementById('navOpenWaConfigModalBtn');
    const closeBtn = document.getElementById('closeNavWaConfigBtn');
    const closeFooterBtn = document.getElementById('closeNavWaConfigFooterBtn');
    const backdrop = document.getElementById('navWaConfigModalBackdrop');
    document.addEventListener('click', async (e) => {
        const target = e.target instanceof Element ? e.target : null;
        if (!target)
            return;
        const openBtn = target.closest('#navOpenWaConfigModalBtn');
        if (openBtn) {
            e.preventDefault();
            e.stopPropagation();
            const modalEl = document.getElementById('navWaConfigModal');
            if (modalEl)
                modalEl.classList.remove('hidden');
            // Close the user submenu dropdown
            const userSubmenuWrapper = document.getElementById('userSubmenuWrapper');
            if (userSubmenuWrapper) {
                userSubmenuWrapper.classList.add('hidden');
                userSubmenuWrapper.classList.remove('block');
            }
            const userMenuBtn = document.getElementById('userMenuBtn');
            if (userMenuBtn) {
                userMenuBtn.setAttribute('aria-expanded', 'false');
            }
            // Lazy load session on open
            if (!userId) {
                if (gNavbarAuthContext?.user?.public_id) {
                    userId = gNavbarAuthContext.user.public_id;
                    editingUserWhatsAppAutoReplyMode = gNavbarAuthContext.user.whatsapp_auto_reply_mode || 'automatic';
                }
                else {
                    try {
                        const res = await api('/auth/me');
                        if (res?.data?.user) {
                            userId = res.data.user.public_id;
                            editingUserWhatsAppAutoReplyMode = res.data.user.whatsapp_auto_reply_mode || 'automatic';
                        }
                    }
                    catch (_err) { }
                }
            }
            if (userId) {
                await loadWaSession();
            }
            return;
        }
        const closeBtn = target.closest('#closeNavWaConfigBtn, #closeNavWaConfigFooterBtn, #navWaConfigModalBackdrop');
        if (closeBtn) {
            e.preventDefault();
            e.stopPropagation();
            if (waPollingInterval) {
                window.clearTimeout(waPollingInterval);
                waPollingInterval = null;
            }
            const modalEl = document.getElementById('navWaConfigModal');
            if (modalEl)
                modalEl.classList.add('hidden');
            return;
        }
    });
    let userId = '';
    let waSession = { status: 'idle', pairing_code: null, qr_code_data_url: null, last_event_at: null, last_error: null, connected_number: null, connected_name: null };
    let waPollingInterval = null;
    let editingUserWhatsAppAutoReplyMode = 'automatic';
    function getById(id) {
        return document.getElementById(id);
    }
    function formatConnectedNumber() {
        const phone = waSession.connected_number || '';
        if (!phone)
            return 'Não conectado';
        return `+${phone}`;
    }
    function resolveConnectedNumber() {
        return waSession.connected_number || '';
    }
    function getWaStatusMeta() {
        const status = waSession.status || 'idle';
        const map = {
            'idle': { badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300', label: 'Desconectado', helper: 'Inicie a sessão para conectar seu WhatsApp.' },
            'disconnected': { badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300', label: 'Desconectado', helper: 'Inicie a sessão para conectar seu WhatsApp.' },
            'initializing': { badgeClass: 'bg-blue-100 text-blue-800', label: 'Iniciando...', helper: 'Aguarde, gerando conexão...' },
            'awaiting_qr': { badgeClass: 'bg-amber-100 text-amber-800', label: 'Aguardando Pareamento', helper: waSession.pairing_code ? 'Use o código abaixo no WhatsApp do celular para conectar.' : 'Escaneie o QR code no WhatsApp do celular em Dispositivos conectados.' },
            'ready': {
                badgeClass: 'bg-green-100 text-green-800',
                label: waSession.connected_name ? `Conectado · ${waSession.connected_name}` : 'Conectado',
                helper: 'Sua sessão do WhatsApp Business está ativa e pronta para uso.'
            },
            'auth_failure': { badgeClass: 'bg-red-100 text-red-800', label: 'Falha de Autenticação', helper: 'Falha ao autenticar. Inicie a sessão novamente.' },
            'error': { badgeClass: 'bg-red-100 text-red-800', label: 'Erro', helper: waSession.last_error || 'Erro na sessão do WhatsApp.' }
        };
        return map[status] || map.idle;
    }
    function renderNav() {
        const container = getById('whatsappContentNav');
        if (!container)
            return;
        const isNewUser = !userId;
        const statusMeta = getWaStatusMeta();
        const hasQr = !isNewUser && !!waSession.qr_code_data_url;
        const hasPairingCode = !isNewUser && !!waSession.pairing_code;
        const isBusy = !isNewUser && waSession.status === 'initializing';
        const connectedNumberDisplay = isNewUser ? 'Não disponível' : formatConnectedNumber();
        const connectedNumberDigits = isNewUser ? '' : resolveConnectedNumber();
        const lastEventAt = !isNewUser && waSession.last_event_at
            ? new Date(waSession.last_event_at).toLocaleString('pt-BR')
            : null;
        container.innerHTML = `
            <div class="w-full text-left">
                <div class="flex justify-between items-center mb-3">
                    <h4 class="text-sm font-semibold dark:text-white">WhatsApp Business</h4>
                    ${isNewUser ? '' : `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusMeta.badgeClass}">${statusMeta.label}</span>`}
                </div>
                <div class="p-3 bg-gray-50 dark:bg-slate-900/30 rounded-lg border dark:border-slate-700 text-xs">
                    <div class="space-y-3">
                        <div class="bg-white dark:bg-slate-800 rounded border dark:border-slate-700 p-2.5">
                            <div class="flex items-start justify-between gap-3 flex-wrap">
                                <div>
                                    <div class="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Modo de atendimento</div>
                                    <h5 class="text-xs font-semibold dark:text-white">Respostas automáticas / manual</h5>
                                </div>
                                <div class="w-full sm:w-40">
                                    <label for="formWhatsAppAutoReplyModeNav" class="sr-only">Modo de atendimento</label>
                                    <select id="formWhatsAppAutoReplyModeNav" class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100">
                                        <option value="automatic" ${editingUserWhatsAppAutoReplyMode === 'automatic' ? 'selected' : ''}>Automático</option>
                                        <option value="manual" ${editingUserWhatsAppAutoReplyMode === 'manual' ? 'selected' : ''}>Manual</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        ${isNewUser ? `
                            <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2.5 text-xs text-yellow-700 dark:text-yellow-400">
                                Por favor, faça login para configurar o pareamento.
                            </div>
                        ` : `
                            <div class="grid grid-cols-[1.5fr,1fr] gap-3">
                                <div class="space-y-2">
                                    <div class="bg-white dark:bg-slate-800 p-2 rounded border dark:border-slate-700 text-[11px] dark:text-gray-300 leading-normal">${statusMeta.helper}</div>
                                    <div class="grid grid-cols-2 gap-2 text-[10px]">
                                        <div class="bg-white dark:bg-slate-800 p-2 rounded border dark:border-slate-700">
                                            <div class="text-gray-400 mb-0.5">Conectado</div>
                                            <div class="font-medium truncate dark:text-white">${connectedNumberDisplay}</div>
                                        </div>
                                        <div class="bg-white dark:bg-slate-800 p-2 rounded border dark:border-slate-700">
                                            <div class="text-gray-400 mb-0.5">Atualizado</div>
                                            <div class="font-medium truncate dark:text-white">${lastEventAt ? lastEventAt.split(', ')[1] || lastEventAt : 'Aguardando'}</div>
                                        </div>
                                    </div>
                                    <div class="flex gap-1.5">
                                        <button type="button" id="btnStartWaNav" class="px-2.5 py-1 bg-brand-600 text-white rounded text-xs font-medium disabled:opacity-50 hover:bg-brand-700" ${isBusy ? 'disabled' : ''}>${isBusy ? 'Gerando...' : 'Iniciar'}</button>
                                        <button type="button" id="btnDisconnectWaNav" class="px-2.5 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded text-xs font-medium hover:bg-red-100">Desconectar</button>
                                    </div>
                                    <div class="grid grid-cols-[1fr,auto] gap-1.5 items-end">
                                        <div>
                                            <label for="waPairPhoneNav" class="block text-[9px] uppercase tracking-wide text-gray-400 mb-0.5">Parear por telefone</label>
                                            <input type="tel" id="waPairPhoneNav" placeholder="5511999999999" value="${connectedNumberDigits}" class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100" />
                                        </div>
                                        <button type="button" id="btnPairWaNav" class="px-2.5 py-1 bg-indigo-600 text-white rounded text-xs font-medium disabled:opacity-50 hover:bg-indigo-700" ${isBusy ? 'disabled' : ''}>Gerar</button>
                                    </div>
                                </div>
                                <div class="bg-white dark:bg-slate-800 p-2 rounded border border-dashed dark:border-slate-700 flex flex-col items-center justify-center gap-1.5 min-h-40">
                                    ${hasPairingCode ? `
                                        <div class="w-full rounded border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/20 px-2 py-3 text-center">
                                            <div class="text-[9px] uppercase text-indigo-600 dark:text-indigo-400">Código</div>
                                            <div class="mt-1 text-2xl font-bold tracking-widest text-indigo-700 dark:text-indigo-300">${waSession.pairing_code}</div>
                                        </div>
                                        <p class="text-[9px] text-center text-gray-500 dark:text-gray-400 leading-normal">Digite no seu WhatsApp.</p>
                                    ` : hasQr ? `
                                        <div class="flex items-center justify-center rounded bg-white p-1 shadow-sm ring-1 ring-gray-100">
                                            <img src="${waSession.qr_code_data_url}" alt="QR Code" class="block rounded" style="width: 120px; height: 120px; image-rendering: pixelated;">
                                        </div>
                                        <p class="text-[9px] text-center text-gray-500 dark:text-gray-400 leading-normal">Escaneie com o celular.</p>
                                    ` : `
                                        <div class="flex items-center justify-center rounded border border-dashed border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-900/40 p-2 text-center" style="width: 120px; height: 120px;">
                                            <span class="text-[9px] text-gray-400 leading-normal">O QR Code aparecerá aqui.</span>
                                        </div>
                                    `}
                                </div>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
        const whatsappModeSelect = getById('formWhatsAppAutoReplyModeNav');
        if (whatsappModeSelect) {
            whatsappModeSelect.value = editingUserWhatsAppAutoReplyMode;
            whatsappModeSelect.addEventListener('change', () => {
                const targetMode = whatsappModeSelect.value === 'manual' ? 'manual' : 'automatic';
                editingUserWhatsAppAutoReplyMode = targetMode;
                void updateAutoReplyMode(targetMode);
            });
        }
        getById('btnStartWaNav')?.addEventListener('click', () => {
            void startWaSession();
        });
        getById('btnPairWaNav')?.addEventListener('click', () => {
            void requestWaPairingCode();
        });
        getById('btnDisconnectWaNav')?.addEventListener('click', () => {
            void disconnectWaSession();
        });
    }
    async function updateAutoReplyMode(mode) {
        try {
            await api(`/users/${userId}`, {
                method: 'PATCH',
                body: JSON.stringify({ whatsapp_auto_reply_mode: mode })
            });
        }
        catch (e) {
            console.error('[WhatsAppConfigNav] Erro ao atualizar modo:', e);
        }
    }
    async function startWaSession() {
        if (!userId)
            return;
        try {
            waSession.status = 'initializing';
            waSession.qr_code_data_url = null;
            waSession.pairing_code = null;
            renderNav();
            await api(`/users/${userId}/whatsapp-business/session`, { method: 'POST' });
            scheduleWaPolling(1000);
        }
        catch (e) {
            waSession.status = 'error';
            waSession.last_error = e?.message || 'Erro ao iniciar.';
            renderNav();
        }
    }
    async function disconnectWaSession() {
        if (!userId)
            return;
        try {
            await api(`/users/${userId}/whatsapp-business/session`, { method: 'DELETE' });
            waSession = { status: 'disconnected', pairing_code: null, qr_code_data_url: null, last_event_at: null, last_error: null };
            renderNav();
        }
        catch (e) {
            console.error(e);
        }
    }
    async function requestWaPairingCode() {
        if (!userId)
            return;
        const phoneInput = getById('waPairPhoneNav');
        const phone = phoneInput?.value?.replace(/\D/g, '') || '';
        if (!phone) {
            return;
        }
        try {
            waSession.status = 'initializing';
            renderNav();
            await api(`/users/${userId}/whatsapp-business/session/pairing-code`, {
                method: 'POST',
                body: JSON.stringify({ phone }),
            });
            scheduleWaPolling(1500);
        }
        catch (e) {
            waSession.status = 'error';
            waSession.last_error = e?.message || 'Erro ao solicitar código.';
            renderNav();
        }
    }
    function scheduleWaPolling(delay = 3000) {
        if (waPollingInterval)
            window.clearTimeout(waPollingInterval);
        waPollingInterval = window.setTimeout(async () => {
            if (!userId)
                return;
            try {
                const res = await api(`/users/${userId}/whatsapp-business/session`);
                const session = res.data || res;
                waSession = session;
                renderNav();
                if (session.status === 'initializing' || session.status === 'awaiting_qr') {
                    scheduleWaPolling(3000);
                }
            }
            catch (e) {
                console.warn(e);
            }
        }, delay);
    }
    async function loadWaSession() {
        if (!userId)
            return;
        try {
            const res = await api(`/users/${userId}/whatsapp-business/session`);
            waSession = res.data || res;
            renderNav();
            if (waSession.status === 'initializing' || waSession.status === 'awaiting_qr') {
                scheduleWaPolling(3000);
            }
        }
        catch (e) {
            console.warn(e);
            waSession = {
                ...waSession,
                status: 'error',
                last_error: e?.message || 'Erro na carga.',
                qr_code_data_url: null,
                has_qr_code: false,
            };
            renderNav();
        }
    }
}
async function initUserMenuChangePassword() {
    const modal = document.getElementById('navChangePasswordModal');
    const openBtn = document.getElementById('navOpenChangePasswordModalBtn');
    const closeBtn = document.getElementById('closeNavChangePasswordBtn');
    const closeFooterBtn = document.getElementById('closeNavChangePasswordFooterBtn');
    const backdrop = document.getElementById('navChangePasswordModalBackdrop');
    const form = document.getElementById('navChangePasswordForm');
    const errorDiv = document.getElementById('navChangePasswordError');
    const successDiv = document.getElementById('navChangePasswordSuccess');
    const spinner = document.getElementById('navChangePasswordSpinner');
    const saveText = document.getElementById('navChangePasswordSaveText');
    if (!modal)
        return;
    document.addEventListener('click', (e) => {
        const target = e.target instanceof Element ? e.target : null;
        if (!target)
            return;
        const openBtn = target.closest('#navOpenChangePasswordModalBtn');
        if (openBtn) {
            e.preventDefault();
            e.stopPropagation();
            // Reset form fields and alerts
            if (form)
                form.reset();
            const usernameInput = document.getElementById('navChangePasswordUsername');
            if (usernameInput && window.gNavbarAuthContext?.user?.email) {
                usernameInput.value = window.gNavbarAuthContext.user.email;
            }
            if (errorDiv) {
                errorDiv.classList.add('hidden');
                errorDiv.textContent = '';
            }
            if (successDiv) {
                successDiv.classList.add('hidden');
                successDiv.textContent = '';
            }
            const modalEl = document.getElementById('navChangePasswordModal');
            if (modalEl)
                modalEl.classList.remove('hidden');
            // Close the user submenu dropdown
            const userSubmenuWrapper = document.getElementById('userSubmenuWrapper');
            if (userSubmenuWrapper) {
                userSubmenuWrapper.classList.add('hidden');
                userSubmenuWrapper.classList.remove('block');
            }
            const userMenuBtn = document.getElementById('userMenuBtn');
            if (userMenuBtn) {
                userMenuBtn.setAttribute('aria-expanded', 'false');
            }
            return;
        }
        const closeBtn = target.closest('#closeNavChangePasswordBtn, #closeNavChangePasswordFooterBtn, #navChangePasswordModalBackdrop');
        if (closeBtn) {
            e.preventDefault();
            e.stopPropagation();
            const modalEl = document.getElementById('navChangePasswordModal');
            if (modalEl)
                modalEl.classList.add('hidden');
            return;
        }
    });
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPass = document.getElementById('navCurrentPassword').value;
            const newPass = document.getElementById('navNewPassword').value;
            const confirmPass = document.getElementById('navConfirmNewPassword').value;
            // Clear alerts
            if (errorDiv)
                errorDiv.classList.add('hidden');
            if (successDiv)
                successDiv.classList.add('hidden');
            // Simple validation checks
            if (newPass.length < 6) {
                if (errorDiv) {
                    errorDiv.textContent = 'A nova senha deve ter pelo menos 6 caracteres.';
                    errorDiv.classList.remove('hidden');
                }
                return;
            }
            if (newPass !== confirmPass) {
                if (errorDiv) {
                    errorDiv.textContent = 'As senhas não coincidem.';
                    errorDiv.classList.remove('hidden');
                }
                return;
            }
            // Show loading spinner
            if (spinner)
                spinner.classList.remove('hidden');
            if (saveText)
                saveText.textContent = 'Alterando...';
            try {
                // @ts-ignore
                const response = await api('/auth/change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currentPasswordRaw: currentPass, newPasswordRaw: newPass })
                });
                if (response && (response.status === 'success' || response.message)) {
                    if (successDiv) {
                        successDiv.textContent = 'Senha alterada com sucesso!';
                        successDiv.classList.remove('hidden');
                    }
                    form.reset();
                    // Auto-close after 1.5 seconds
                    setTimeout(() => {
                        modal.classList.add('hidden');
                    }, 1500);
                }
                else {
                    const msg = response?.message || 'Erro ao alterar a senha. Verifique os dados inseridos.';
                    if (errorDiv) {
                        errorDiv.textContent = msg;
                        errorDiv.classList.remove('hidden');
                    }
                }
            }
            catch (err) {
                console.error(err);
                const msg = err?.message || 'Erro de conexão. Tente novamente mais tarde.';
                if (errorDiv) {
                    errorDiv.textContent = msg;
                    errorDiv.classList.remove('hidden');
                }
            }
            finally {
                if (spinner)
                    spinner.classList.add('hidden');
                if (saveText)
                    saveText.textContent = 'Alterar Senha';
            }
        });
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initNavbar().catch((err) => console.error('Failed to init navbar:', err));
    });
}
else {
    initNavbar().catch((err) => console.error('Failed to init navbar:', err));
}
