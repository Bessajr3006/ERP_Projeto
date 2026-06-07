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
document.addEventListener('DOMContentLoaded', async () => {
    const navbarContainer = document.getElementById('app-navbar');
    if (!navbarContainer)
        return; // Página não precisa de navbar
    try {
        // 1. Fetch nav.html (sempre do servidor; URL estável para o SW atualizar o cache corretamente)
        const response = await fetch('/components/nav.html', {
            cache: 'no-store'
        });
        if (!response.ok)
            throw new Error('Falha ao carregar a navbar');
        const navHtml = await response.text();
        // 2. Insert HTML
        navbarContainer.innerHTML = navHtml;
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
        initThemeToggle();
        initLogout();
        initNotifications();
        loadUserGreeting();
    }
    catch (error) {
        console.error('Erro ao injetar navbar:', error);
    }
});
function highlightActiveLink() {
    const currentPath = window.location.pathname;
    // Desktop links
    const desktopLinks = document.querySelectorAll('#desktopNavLinks .nav-link');
    const desktopCustomersDropdownLinks = document.querySelectorAll('#desktopCustomersDropdown a');
    const desktopFinanceDropdownLinks = document.querySelectorAll('#desktopFinanceDropdown a');
    const desktopProductsDropdownLinks = document.querySelectorAll('#desktopProductsDropdown a');
    const desktopServiceDropdownLinks = document.querySelectorAll('#desktopServiceDropdown a');
    const desktopAccountingDropdownLinks = document.querySelectorAll('#desktopAccountingDropdown a');
    const desktopOverviewDropdownLinks = document.querySelectorAll('#desktopOverviewDropdown a');
    const desktopReportsDropdownLinks = document.querySelectorAll('#desktopReportsDropdown a');
    const desktopConfigDropdownLinks = document.querySelectorAll('#desktopConfigDropdown a');
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
    highlightDesktopDropdown(desktopCustomersDropdownLinks, 'desktopCustomersDropdownBtn');
    highlightDesktopDropdown(desktopFinanceDropdownLinks, 'desktopFinanceDropdownBtn');
    highlightDesktopDropdown(desktopProductsDropdownLinks, 'desktopProductsDropdownBtn');
    highlightDesktopDropdown(desktopServiceDropdownLinks, 'desktopServiceDropdownBtn');
    highlightDesktopDropdown(desktopAccountingDropdownLinks, 'desktopAccountingDropdownBtn');
    highlightDesktopDropdown(desktopOverviewDropdownLinks, 'desktopOverviewDropdownBtn');
    highlightDesktopDropdown(desktopReportsDropdownLinks, 'desktopReportsDropdownBtn');
    highlightDesktopDropdown(desktopConfigDropdownLinks, 'desktopConfigDropdownBtn');
    highlightDesktopDropdown(desktopPurchasesDropdownLinks, 'desktopPurchasesDropdownBtn');
    highlightDesktopDropdown(desktopOrdersDropdownLinks, 'desktopOrdersDropdownBtn');
    // Mobile links
    const mobileLinks = document.querySelectorAll('#mobileNavLinks .mobile-nav-link');
    const mobileCustomersDropdownLinks = document.querySelectorAll('#mobileCustomersDropdown a');
    const mobileFinanceDropdownLinks = document.querySelectorAll('#mobileFinanceDropdown a');
    const mobileProductsDropdownLinks = document.querySelectorAll('#mobileProductsDropdown a');
    const mobileServiceDropdownLinks = document.querySelectorAll('#mobileServiceDropdown a');
    const mobileAccountingDropdownLinks = document.querySelectorAll('#mobileAccountingDropdown a');
    const mobileOverviewDropdownLinks = document.querySelectorAll('#mobileOverviewDropdown a');
    const mobileReportsDropdownLinks = document.querySelectorAll('#mobileReportsDropdown a');
    const mobileConfigDropdownLinks = document.querySelectorAll('#mobileConfigDropdown a');
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
    highlightMobileDropdown(mobileCustomersDropdownLinks, 'mobileCustomersDropdownBtn', 'mobileCustomersDropdown', 'mobileCustomersDropdownIcon');
    highlightMobileDropdown(mobileFinanceDropdownLinks, 'mobileFinanceDropdownBtn', 'mobileFinanceDropdown', 'mobileFinanceDropdownIcon');
    highlightMobileDropdown(mobileProductsDropdownLinks, 'mobileProductsDropdownBtn', 'mobileProductsDropdown', 'mobileProductsDropdownIcon');
    highlightMobileDropdown(mobileServiceDropdownLinks, 'mobileServiceDropdownBtn', 'mobileServiceDropdown', 'mobileServiceDropdownIcon');
    highlightMobileDropdown(mobileAccountingDropdownLinks, 'mobileAccountingDropdownBtn', 'mobileAccountingDropdown', 'mobileAccountingDropdownIcon');
    highlightMobileDropdown(mobileOverviewDropdownLinks, 'mobileOverviewDropdownBtn', 'mobileOverviewDropdown', 'mobileOverviewDropdownIcon');
    highlightMobileDropdown(mobileReportsDropdownLinks, 'mobileReportsDropdownBtn', 'mobileReportsDropdown', 'mobileReportsDropdownIcon');
    highlightMobileDropdown(mobileConfigDropdownLinks, 'mobileConfigDropdownBtn', 'mobileConfigDropdown', 'mobileConfigDropdownIcon');
    highlightMobileDropdown(mobilePurchasesDropdownLinks, 'mobilePurchasesDropdownBtn', 'mobilePurchasesDropdown', 'mobilePurchasesDropdownIcon');
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
    // Helper function for Dropdown toggles
    const setupMobileDropdown = (btnId, dropdownId, iconId) => {
        const dBtn = document.getElementById(btnId);
        const dMenu = document.getElementById(dropdownId);
        const dIcon = document.getElementById(iconId);
        if (dBtn && dMenu && dIcon) {
            dBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Previne fechar comportamentos inesperados
                const isExpanded = dBtn.getAttribute('aria-expanded') === 'true';
                dBtn.setAttribute('aria-expanded', !isExpanded);
                dMenu.classList.toggle('hidden');
                dIcon.classList.toggle('rotate-180');
            });
        }
    };
    setupMobileDropdown('mobileCustomersDropdownBtn', 'mobileCustomersDropdown', 'mobileCustomersDropdownIcon');
    setupMobileDropdown('mobileFinanceDropdownBtn', 'mobileFinanceDropdown', 'mobileFinanceDropdownIcon');
    setupMobileDropdown('mobileProductsDropdownBtn', 'mobileProductsDropdown', 'mobileProductsDropdownIcon');
    setupMobileDropdown('mobileServiceDropdownBtn', 'mobileServiceDropdown', 'mobileServiceDropdownIcon');
    setupMobileDropdown('mobileAccountingDropdownBtn', 'mobileAccountingDropdown', 'mobileAccountingDropdownIcon');
    setupMobileDropdown('mobileOverviewDropdownBtn', 'mobileOverviewDropdown', 'mobileOverviewDropdownIcon');
    setupMobileDropdown('mobileReportsDropdownBtn', 'mobileReportsDropdown', 'mobileReportsDropdownIcon');
    setupMobileDropdown('mobileConfigDropdownBtn', 'mobileConfigDropdown', 'mobileConfigDropdownIcon');
    setupMobileDropdown('mobileUserSubmenuBtn', 'mobileUserSubmenu', 'mobileUserSubmenuIcon');
    setupMobileDropdown('mobileOrdersDropdownBtn', 'mobileOrdersDropdown', 'mobileOrdersDropdownIcon');
    setupMobileDropdown('mobilePurchasesDropdownBtn', 'mobilePurchasesDropdown', 'mobilePurchasesDropdownIcon');

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
    const doLogout = (event) => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
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

        closeLogoutModal();
        window.location.replace('/');
    };
    const logoutModal = document.getElementById('logoutConfirmModal');
    const logoutBackdrop = document.getElementById('logoutConfirmBackdrop');
    const logoutCancelBtn = document.getElementById('logoutCancelBtn');
    const logoutConfirmBtn = document.getElementById('logoutConfirmBtn');

    const closeLogoutModal = () => {
        if (logoutModal) {
            logoutModal.classList.add('hidden');
        }
    };

    const openLogoutModal = () => {
        if (logoutModal) {
            logoutModal.classList.remove('hidden');
            return;
        }
        // Fallback para ambientes sem modal carregado.
        if (window.confirm('Deseja sair do sistema?')) {
            doLogout();
        }
    };

    if (logoutBackdrop) {
        logoutBackdrop.addEventListener('click', closeLogoutModal);
    }
    if (logoutCancelBtn) {
        logoutCancelBtn.addEventListener('click', closeLogoutModal);
    }
    if (logoutConfirmBtn) {
        logoutConfirmBtn.addEventListener('click', doLogout);
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeLogoutModal();
        }
    });

    const bindOpenLogout = (elementId) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener('click', openLogoutModal);
        }
    };

    bindOpenLogout('logoutBtn');
    bindOpenLogout('logoutBtnUserSubmenuDesktop');
    bindOpenLogout('logoutBtnUserSubmenuMobile');
    bindOpenLogout('logoutBtnMobile');

    // Delegação para cenários em que a navbar é re-renderizada após o bind inicial.
    document.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) {
            return;
        }

        const trigger = target.closest('#logoutBtn, #logoutBtnUserSubmenuDesktop, #logoutBtnUserSubmenuMobile, #logoutBtnMobile');
        if (trigger) {
            event.preventDefault();
            openLogoutModal();
        }
    });
}
async function loadUserGreeting() {
    const greetingEl = document.getElementById('userGreeting');
    if (!greetingEl)
        return;
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
                gNavbarAuthContext = {
                    user: data.data.user || null,
                    company: data.data.company || null,
                    permissions: data.data.permissions || []
                };
                window.SharedFooter?.setCompanyContext({
                    name: data.data.company?.trade_name || data.data.company?.company_name || '',
                    cnpj: data.data.company?.cnpj || '',
                });
                greetingEl.textContent = `Olá, ${greetingName}`;
                const isSuperAdmin = role === 'super_admin';
                const isSuperAdminPage = document.body?.dataset?.superAdminPage === 'true';
                document.querySelectorAll('[data-super-admin-only="true"]').forEach((element) => {
                    if (!isSuperAdmin) {
                        element.style.setProperty('display', 'none', 'important');
                    }
                });
                if (isSuperAdminPage && !isSuperAdmin) {
                    window.location.href = '/pages/dashboard.html';
                    return;
                }
                    // Super Admin deve sempre visualizar todos os menus/submenus.
                    if (isSuperAdmin) {
                        document.querySelectorAll('a[href^="/pages/"]').forEach((a) => {
                            a.style.removeProperty('display');
                        });
                        [
                            'desktopCustomersDropdownBtn',
                            'desktopFinanceDropdownBtn',
                            'desktopProductsDropdownBtn',
                            'desktopServiceDropdownBtn',
                            'desktopAccountingDropdownBtn',
                            'desktopOverviewDropdownBtn',
                            'desktopReportsDropdownBtn',
                            'desktopConfigDropdownBtn',
                            'desktopOrdersDropdownBtn',
                            'desktopPurchasesDropdownBtn',
                            'mobileCustomersDropdownBtn',
                            'mobileFinanceDropdownBtn',
                            'mobileProductsDropdownBtn',
                            'mobileServiceDropdownBtn',
                            'mobileAccountingDropdownBtn',
                            'mobileOverviewDropdownBtn',
                            'mobileReportsDropdownBtn',
                            'mobileConfigDropdownBtn',
                            'mobileOrdersDropdownBtn',
                            'mobilePurchasesDropdownBtn',
                        ].forEach((btnId) => {
                            const btnEl = document.getElementById(btnId);
                            btnEl?.parentElement?.style.removeProperty('display');
                        });
                        return;
                    }
                // Hide unauthorized links
                const permissions = gNavbarAuthContext.permissions || [];
                // Se for admin/super admin e o backend não trouxe permissões, mantemos o menu padrão.
                if ((role === 'admin' || role === 'super_admin') && permissions.length === 0)
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
                    // Mapeamento de página para módulo de permissão
                    'stock-vision': 'stock_vision',
                    'finance-vision': 'finance_vision',
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
                    // Links marcados como utilitários (ex: Ajuda) nunca são ocultados
                    if (a.dataset.noPermCheck === 'true')
                        return;
                    const href = a.getAttribute('href') || '';
                    const file = href.split('/').pop()?.replace('.html', '') || '';
                    const moduleName = normalizeModule(a.dataset.module || file);
                    if (requiresSuperAdmin && isSuperAdmin) {
                        return;
                    }
                    // Ocultar com força (style.display) recursos sem permissão
                    // Obs: admin agora pode ter permissões customizadas; então NÃO devemos fazer bypass.
                    // Mantemos apenas um bypass de segurança para o super_admin não ficar trancado.
                    const isSuperAdminBypass = (role === 'super_admin' || role === 'admin')
                        && (moduleName === 'tasks' || moduleName === 'roles' || moduleName === 'accounting' || moduleName === 'organizer' || moduleName === 'users' || moduleName === 'company' || moduleName === 'email-config' || moduleName === 'email' || moduleName === 'ajuste' || moduleName === 'service_types' || moduleName === 'services' || moduleName === 'service_launches' || moduleName === 'service_tax_municipal' || moduleName === 'service_tax_federal');
                    if (!effectivePerms.includes(moduleName) && !isSuperAdminBypass) {
                        a.style.setProperty('display', 'none', 'important');
                    }
                });
                // Ocultar dropdown containers (os "ícones" de Estoque, Financeiro, Pessoas, Config) se estiverem vazios
                const dropdownContainers = [
                    { btn: 'desktopCustomersDropdownBtn', menu: 'desktopCustomersDropdown' },
                    { btn: 'desktopFinanceDropdownBtn', menu: 'desktopFinanceDropdown' },
                    { btn: 'desktopProductsDropdownBtn', menu: 'desktopProductsDropdown' },
                    { btn: 'desktopServiceDropdownBtn', menu: 'desktopServiceDropdown' },
                    { btn: 'desktopAccountingDropdownBtn', menu: 'desktopAccountingDropdown' },
                    { btn: 'desktopOverviewDropdownBtn', menu: 'desktopOverviewDropdown' },
                    { btn: 'desktopReportsDropdownBtn', menu: 'desktopReportsDropdown' },
                    { btn: 'desktopConfigDropdownBtn', menu: 'desktopConfigDropdown' },
                    { btn: 'desktopOrdersDropdownBtn', menu: 'desktopOrdersDropdown' },
                    { btn: 'desktopPurchasesDropdownBtn', menu: 'desktopPurchasesDropdown' },
                    { btn: 'mobileCustomersDropdownBtn', menu: 'mobileCustomersDropdown' },
                    { btn: 'mobileFinanceDropdownBtn', menu: 'mobileFinanceDropdown' },
                    { btn: 'mobileProductsDropdownBtn', menu: 'mobileProductsDropdown' },
                    { btn: 'mobileServiceDropdownBtn', menu: 'mobileServiceDropdown' },
                    { btn: 'mobileAccountingDropdownBtn', menu: 'mobileAccountingDropdown' },
                    { btn: 'mobileOverviewDropdownBtn', menu: 'mobileOverviewDropdown' },
                    { btn: 'mobileReportsDropdownBtn', menu: 'mobileReportsDropdown' },
                    { btn: 'mobileConfigDropdownBtn', menu: 'mobileConfigDropdown' },
                    { btn: 'mobileOrdersDropdownBtn', menu: 'mobileOrdersDropdown' },
                    { btn: 'mobilePurchasesDropdownBtn', menu: 'mobilePurchasesDropdown' },
                ];
                dropdownContainers.forEach(group => {
                    const btnEl = document.getElementById(group.btn);
                    const menuEl = document.getElementById(group.menu);
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
                        if (!hasVisible) {
                            // No desktop e mobile, escondemos o elemento PAI imediato (wrapper container)
                            if (parent) {
                                parent.style.setProperty('display', 'none', 'important');
                            }
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
                const isBypassed = (role === 'super_admin' || role === 'admin')
                    && (currentModule === 'tasks' || currentModule === 'roles' || currentModule === 'accounting' || currentModule === 'organizer' || currentModule === 'users' || currentModule === 'company' || currentModule === 'email-config' || currentModule === 'email' || currentModule === 'ajuste' || currentModule === 'service_types' || currentModule === 'services' || currentModule === 'service_launches');
                if (currentModule && currentFile !== 'roles' && !effectivePerms.includes(currentModule) && !isBypassed) {
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
        window.SharedFooter?.clearCompanyContext?.();
        console.error('Erro ao carregar usuário na navegação:', e);
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
    // Polling a cada 30 segundos para não sobrecarregar o banco
    setInterval(pollBackgroundTasks, 30000);
    pollBackgroundTasks(); // Primeira execução imediata
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
