// @ts-nocheck
(() => {
    const THEME_KEY = 'theme';
    const ALIGN_KEY = 'layout_align';
    const NAV_ALIGN_KEY = 'nav_align';
    const WIDTH_KEY = 'layout_width';
    const NAV_WIDTH_KEY = 'nav_width';
    const NAV_COLOR_KEY = 'nav_color';
    const FOOTER_COLOR_KEY = 'footer_color';
    const FORM_PATTERN_KEY = 'form_pattern_preferences';
    const THEME_TOGGLE_VISIBLE_KEY = 'theme_toggle_visible';
    const SALES_CARDS_PER_ROW_KEY = 'sales_cards_per_row';
    const SALES_LAYOUT_KEY = 'sales_layout';
    const SPLIT_CART_SIZE_KEY = 'split_cart_size';

    const qsa = (selector) => document.querySelectorAll(selector);

    function getSalesCardsPerRowValue() {
        const raw = localStorage.getItem(SALES_CARDS_PER_ROW_KEY);
        const valid = [
            'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3',
            'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4',
            'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
            'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6',
            'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7',
            'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8',
        ];
        if (valid.includes(raw)) {
            return raw;
        }
        return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
    }
    function getSalesLayoutValue() {
        const raw = localStorage.getItem(SALES_LAYOUT_KEY);
        if (raw === 'split' || raw === 'drawer') return raw;
        return 'drawer';
    }
    function getSplitCartSizeValue() {
        const raw = localStorage.getItem(SPLIT_CART_SIZE_KEY);
        if (raw === 'small' || raw === 'medium' || raw === 'large') return raw;
        return 'medium';
    }
    const qs = (selector) => document.querySelector(selector);

    function getThemeValue() {
        const raw = localStorage.getItem(THEME_KEY);
        if (raw === 'light' || raw === 'dark' || raw === 'system') {
            return raw;
        }
        return 'dark';
    }

    function getAlignValue() {
        const raw = localStorage.getItem(ALIGN_KEY);
        if (raw === 'left' || raw === 'center' || raw === 'right' || raw === 'responsive') {
            return raw;
        }
        return 'responsive';
    }

    function getNavAlignValue() {
        const raw = localStorage.getItem(NAV_ALIGN_KEY);
        if (raw === 'left' || raw === 'center' || raw === 'right' || raw === 'responsive') {
            return raw;
        }
        const fallback = getAlignValue();
        localStorage.setItem(NAV_ALIGN_KEY, fallback);
        return fallback;
    }

    function getWidthValue() {
        const raw = localStorage.getItem(WIDTH_KEY);
        if (!raw) {
            localStorage.setItem(WIDTH_KEY, 'system');
            return 'system';
        }
        if (raw === 'system' || raw === 'max-w-5xl' || raw === 'max-w-6xl' || raw === 'max-w-7xl' || raw === 'max-w-screen-2xl' || raw === 'max-w-none') {
            return raw;
        }
        localStorage.setItem(WIDTH_KEY, 'system');
        return 'system';
    }

    function getNavWidthValue() {
        const raw = localStorage.getItem(NAV_WIDTH_KEY);
        if (raw === 'system' || raw === 'max-w-5xl' || raw === 'max-w-6xl' || raw === 'max-w-7xl' || raw === 'max-w-screen-2xl' || raw === 'max-w-none') {
            return raw;
        }
        const fallback = getWidthValue();
        localStorage.setItem(NAV_WIDTH_KEY, fallback);
        return fallback;
    }

    function getNavColorValue() {
        const raw = localStorage.getItem(NAV_COLOR_KEY);
        const LEGACY = {
            brand: '#1e3a8a',
            slate: '#0f172a',
            emerald: '#064e3b',
            rose: '#881337',
        };
        const normalizeHex = (value) => {
            const v = String(value || '').trim().toLowerCase();
            if (LEGACY[v]) return LEGACY[v];
            if (/^#([0-9a-f]{6})$/.test(v)) return v;
            return '#0f172a';
        };
        const normalized = normalizeHex(raw);
        if (normalized !== raw) {
            localStorage.setItem(NAV_COLOR_KEY, normalized);
        }
        return normalized;
    }

    function getFooterColorValue() {
        const raw = localStorage.getItem(FOOTER_COLOR_KEY);
        const LEGACY = {
            brand: '#1e3a8a',
            slate: '#0f172a',
            emerald: '#064e3b',
            rose: '#881337',
        };
        const normalizeHex = (value) => {
            const v = String(value || '').trim().toLowerCase();
            if (LEGACY[v]) return LEGACY[v];
            if (/^#([0-9a-f]{6})$/.test(v)) return v;
            return '#0f172a';
        };
        const normalized = normalizeHex(raw);
        if (normalized !== raw) {
            localStorage.setItem(FOOTER_COLOR_KEY, normalized);
        }
        return normalized;
    }

    function getThemeToggleVisibilityValue() {
        const raw = String(localStorage.getItem(THEME_TOGGLE_VISIBLE_KEY) || '').trim().toLowerCase();
        if (raw === 'hide') {
            return 'hide';
        }
        if (raw !== 'show') {
            localStorage.setItem(THEME_TOGGLE_VISIBLE_KEY, 'show');
        }
        return 'show';
    }

    function applyTheme(themeMode) {
        const htmlDecl = document.documentElement;
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const shouldUseDark = themeMode === 'dark' || (themeMode === 'system' && prefersDark);

        if (shouldUseDark) {
            htmlDecl.classList.add('dark');
        } else {
            htmlDecl.classList.remove('dark');
        }
    }

    function pulseThemeHero() {
        const hero = document.querySelector('[data-animate="hero"]');
        if (!hero) return;

        hero.classList.remove('shadow-lg', 'shadow-brand-500/20', 'scale-[1.005]');
        void hero.offsetWidth;
        hero.classList.add('shadow-lg', 'shadow-brand-500/20', 'scale-[1.005]', 'transition-all', 'duration-300');

        window.setTimeout(() => {
            hero.classList.remove('shadow-lg', 'shadow-brand-500/20', 'scale-[1.005]');
        }, 320);
    }

    function pulsePreviewCard() {
        const previewCard = document.getElementById('systemLayoutPreviewCard');
        if (!previewCard) return;

        previewCard.classList.remove('shadow-md', 'shadow-brand-500/20', 'scale-[1.01]');
        // Reinicia a animação para permitir repetição a cada troca.
        void previewCard.offsetWidth;
        previewCard.classList.add('shadow-md', 'shadow-brand-500/20', 'scale-[1.01]', 'transition-all', 'duration-300');

        window.setTimeout(() => {
            previewCard.classList.remove('shadow-md', 'shadow-brand-500/20', 'scale-[1.01]');
        }, 320);
    }

    function pulseNavPreviewCard() {
        const previewCard = document.getElementById('navAlignPreviewCard');
        if (!previewCard) return;

        previewCard.classList.remove('shadow-md', 'shadow-brand-500/20', 'scale-[1.01]');
        void previewCard.offsetWidth;
        previewCard.classList.add('shadow-md', 'shadow-brand-500/20', 'scale-[1.01]', 'transition-all', 'duration-300');

        window.setTimeout(() => {
            previewCard.classList.remove('shadow-md', 'shadow-brand-500/20', 'scale-[1.01]');
        }, 320);
    }

    function applyAlignment(alignMode, shouldPulse = false) {
        const preview = document.getElementById('systemLayoutPreview');
        const previewCard = document.getElementById('systemLayoutPreviewCard');
        if (!preview) return;

        preview.classList.remove('text-left', 'text-center', 'text-right', 'sm:text-center', 'lg:text-left', 'lg:text-center', 'lg:text-right');
        previewCard?.classList.remove('mx-0', 'mx-auto', 'ml-auto', 'mr-0', 'w-full', 'sm:w-auto');

        if (alignMode === 'left') {
            preview.classList.add('text-left');
            previewCard?.classList.add('mx-0');
        } else if (alignMode === 'center') {
            preview.classList.add('text-center');
            previewCard?.classList.add('mx-auto');
        } else if (alignMode === 'right') {
            preview.classList.add('text-right');
            previewCard?.classList.add('ml-auto', 'mr-0');
        } else {
            preview.classList.add('text-left', 'sm:text-center', 'lg:text-left');
            previewCard?.classList.add('w-full', 'sm:w-auto', 'mx-0', 'sm:mx-auto', 'lg:mx-0');
        }

        document.documentElement.setAttribute('data-layout-align', alignMode);

        if (shouldPulse) {
            pulsePreviewCard();
        }
    }

    function applyNavAlignmentPreview(alignMode, shouldPulse = false) {
        const previewCard = document.getElementById('navAlignPreviewCard');
        if (!previewCard) return;

        previewCard.classList.remove('mx-0', 'mx-auto', 'ml-auto', 'mr-0', 'w-full', 'sm:w-auto');

        if (alignMode === 'left') {
            previewCard.classList.add('mx-0');
        } else if (alignMode === 'center') {
            previewCard.classList.add('mx-auto');
        } else if (alignMode === 'right') {
            previewCard.classList.add('ml-auto', 'mr-0');
        } else {
            previewCard.classList.add('w-full', 'sm:w-auto', 'mx-0', 'sm:mx-auto', 'lg:mx-0');
        }

        if (shouldPulse) {
            pulseNavPreviewCard();
        }
    }

    function updateChoiceCards() {
        qsa('[data-choice-card]').forEach((card) => {
            const input = card.querySelector('input[type="radio"]');
            if (!input) return;

            card.classList.remove(
                'bg-brand-50',
                'dark:bg-brand-900/20',
                'shadow-sm',
                'shadow-brand-500/10'
            );

            if (input.checked) {
                card.classList.add(
                    'bg-brand-50',
                    'dark:bg-brand-900/20',
                    'shadow-sm',
                    'shadow-brand-500/10'
                );
            }
        });
    }

    function setChecked(name, value) {
        qsa(`input[name="${name}"]`).forEach((input) => {
            input.checked = input.value === value;
        });
    }

    function showMessage(message, type = 'success') {
        const el = document.getElementById('systemPreferencesMessage');
        if (!el) return;

        el.textContent = message;
        el.className = 'inline-flex items-center rounded-md px-3 py-2 text-xs font-medium';
        if (type === 'success') {
            el.classList.add('bg-emerald-100', 'text-emerald-700', 'dark:bg-emerald-900/40', 'dark:text-emerald-300');
        } else {
            el.classList.add('bg-red-100', 'text-red-700', 'dark:bg-red-900/40', 'dark:text-red-300');
        }
        el.classList.remove('hidden');

        window.setTimeout(() => {
            el.classList.add('hidden');
        }, 2500);
    }

    function setSaveButtonState(button, state) {
        if (!button) return;

        if (state === 'loading') {
            button.disabled = true;
            button.classList.add('opacity-90', 'cursor-not-allowed');
            button.innerHTML = '<span class="inline-flex items-center gap-2"><span class="h-3 w-3 rounded-full border-2 border-white/70 border-t-transparent animate-spin"></span><span>Salvando...</span></span>';
            return;
        }

        if (state === 'success') {
            button.disabled = true;
            button.classList.remove('opacity-90', 'cursor-not-allowed');
            button.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
            button.classList.remove('bg-brand-600', 'hover:bg-brand-700');
            button.innerHTML = '<span class="inline-flex items-center gap-2"><span>✓</span><span>Salvo</span></span>';
            return;
        }

        button.disabled = false;
        button.classList.remove('opacity-90', 'cursor-not-allowed', 'bg-emerald-600', 'hover:bg-emerald-700');
        button.classList.add('bg-brand-600', 'hover:bg-brand-700');
        button.textContent = 'Salvar Preferências';
    }

    function runEntranceAnimations() {
        const animatedBlocks = [
            ...Array.from(qsa('[data-animate="hero"]')),
            ...Array.from(qsa('[data-animate="section"]')),
            ...Array.from(qsa('[data-animate="card"]')),
        ];

        animatedBlocks.forEach((el, index) => {
            const delay = Math.min(index * 45, 500);
            window.setTimeout(() => {
                el.classList.remove('opacity-0', 'translate-y-2');
            }, delay);
        });
    }

    function setupFormPattern() {
        const form = document.getElementById('formPatternForm');
        const saveBtn = document.getElementById('saveFormPatternBtn');
        const resetBtn = document.getElementById('resetFormPatternBtn');
        const messageEl = document.getElementById('formPatternMessage');
        const empresaInput = document.getElementById('ajusteEmpresa');
        const perfilSelect = document.getElementById('ajustePerfil');
        const corInput = document.getElementById('ajusteCor');
        const cabecalhoSelect = document.getElementById('ajusteCabecalho');
        const sectionTitle = document.querySelector('#formPatternForm')?.closest('section')?.querySelector('h2');

        if (!form || !saveBtn || !resetBtn || !messageEl || !empresaInput || !perfilSelect || !corInput || !cabecalhoSelect) {
            return;
        }

        const colorMap = {
            brand: '#2563eb',
            teal: '#0d9488',
            emerald: '#059669',
            indigo: '#4f46e5',
            sky: '#0284c7',
            amber: '#d97706',
            orange: '#ea580c',
            cyan: '#0891b2',
            slate: '#334155',
            rose: '#be123c',
        };

        const getNormalizedFormPatternState = () => {
            const raw = localStorage.getItem(FORM_PATTERN_KEY);
            const fallback = {
                empresa: '',
                perfil: 'padrao',
                cor: 'brand',
                cabecalho: 'medio',
            };

            if (!raw) return fallback;

            try {
                const parsed = JSON.parse(raw);
                return {
                    empresa: String(parsed?.empresa || ''),
                    perfil: getProfile(parsed?.perfil || 'padrao'),
                    cor: String(parsed?.cor || 'brand').trim().toLowerCase() || 'brand',
                    cabecalho: getHeaderSize(parsed?.cabecalho || 'medio'),
                };
            } catch (_error) {
                return fallback;
            }
        };

        const syncUiPreferencesToServer = async () => {
            const apiClient = window.api;
            const authClient = window.Auth;
            if (typeof apiClient !== 'function' || !authClient || typeof authClient.isAuthenticated !== 'function' || !authClient.isAuthenticated()) {
                return null;
            }

            const formPattern = getNormalizedFormPatternState();

            try {
                await apiClient('/ui-preferences', {
                    method: 'POST',
                    body: JSON.stringify({
                        theme: getThemeValue(),
                        layout_align: getAlignValue(),
                        nav_align: getNavAlignValue(),
                        layout_width: getWidthValue(),
                        nav_width: getNavWidthValue(),
                        nav_color: getNavColorValue(),
                        footer_color: getFooterColorValue(),
                        theme_toggle_visible: getThemeToggleVisibilityValue() === 'show',
                        form_company_name: formPattern.empresa || null,
                        form_profile: formPattern.perfil,
                        form_accent: formPattern.cor,
                        form_header_size: formPattern.cabecalho,
                        sales_cards_per_row: getSalesCardsPerRowValue(),
                    }),
                });
                return null;
            } catch (error) {
                return error;
            }
        };

        const showFormPatternMessage = (text, type = 'success') => {
            messageEl.textContent = text;
            messageEl.className = 'inline-flex items-center rounded-md px-3 py-2 text-xs font-medium';
            if (type === 'success') {
                messageEl.classList.add('bg-emerald-100', 'text-emerald-700', 'dark:bg-emerald-900/40', 'dark:text-emerald-300');
            } else {
                messageEl.classList.add('bg-red-100', 'text-red-700', 'dark:bg-red-900/40', 'dark:text-red-300');
            }
            messageEl.classList.remove('hidden');
            window.setTimeout(() => messageEl.classList.add('hidden'), 2400);
        };

        const normalizeAccentColor = (value) => {
            const raw = String(value || '').trim().toLowerCase();
            if (!raw) return colorMap.brand;
            if (colorMap[raw]) return colorMap[raw];
            if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
            return colorMap.brand;
        };

        const getProfile = (value) => {
            const v = String(value || '').trim().toLowerCase();
            if (v === 'compacto' || v === 'confortavel') return v;
            return 'padrao';
        };

        const getHeaderSize = (value) => {
            const v = String(value || '').trim().toLowerCase();
            if (v === 'pequeno' || v === 'grande') return v;
            return 'medio';
        };

        const applyFormPatternVisual = () => {
            const profile = getProfile(perfilSelect.value);
            const headerSize = getHeaderSize(cabecalhoSelect.value);
            const accent = normalizeAccentColor(corInput.value);
            const controls = form.querySelectorAll('input, select, textarea');

            controls.forEach((el) => {
                el.style.borderColor = '';
                el.style.paddingTop = '';
                el.style.paddingBottom = '';
                el.style.fontSize = '';
            });

            if (profile === 'compacto') {
                controls.forEach((el) => {
                    el.style.paddingTop = '0.4rem';
                    el.style.paddingBottom = '0.4rem';
                    el.style.fontSize = '0.85rem';
                });
            }

            if (profile === 'confortavel') {
                controls.forEach((el) => {
                    el.style.paddingTop = '0.7rem';
                    el.style.paddingBottom = '0.7rem';
                    el.style.fontSize = '0.96rem';
                });
            }

            if (sectionTitle) {
                sectionTitle.style.color = accent;
                sectionTitle.style.fontSize = headerSize === 'pequeno' ? '0.95rem' : headerSize === 'grande' ? '1.2rem' : '1rem';
            }

            saveBtn.style.backgroundColor = accent;
            saveBtn.style.borderColor = accent;
        };

        const loadSavedState = () => {
            const raw = localStorage.getItem(FORM_PATTERN_KEY);
            if (!raw) {
                applyFormPatternVisual();
                return;
            }

            try {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    empresaInput.value = String(parsed.empresa || '');
                    perfilSelect.value = getProfile(parsed.perfil || 'padrao');
                    corInput.value = String(parsed.cor || 'brand');
                    cabecalhoSelect.value = getHeaderSize(parsed.cabecalho || 'medio');
                }
            } catch (_error) {
                localStorage.removeItem(FORM_PATTERN_KEY);
            }

            applyFormPatternVisual();
        };

        const saveState = async () => {
            const state = {
                empresa: String(empresaInput.value || '').trim(),
                perfil: getProfile(perfilSelect.value),
                cor: String(corInput.value || '').trim().toLowerCase(),
                cabecalho: getHeaderSize(cabecalhoSelect.value),
            };

            localStorage.setItem(FORM_PATTERN_KEY, JSON.stringify(state));
            applyFormPatternVisual();

            const syncError = await syncUiPreferencesToServer();
            if (syncError) {
                showFormPatternMessage('Padrão salvo localmente. Falha ao sincronizar no banco.', 'error');
                return;
            }

            showFormPatternMessage('Padrão de formulário salvo com sucesso.');
        };

        const resetState = () => {
            form.reset();
            empresaInput.value = '';
            perfilSelect.value = 'padrao';
            corInput.value = 'brand';
            cabecalhoSelect.value = 'medio';
            localStorage.setItem(FORM_PATTERN_KEY, JSON.stringify({
                empresa: '',
                perfil: 'padrao',
                cor: 'brand',
                cabecalho: 'medio',
            }));
            applyFormPatternVisual();
            showFormPatternMessage('Padrão de formulário limpo.', 'success');
            syncUiPreferencesToServer();
        };

        perfilSelect.addEventListener('change', applyFormPatternVisual);
        corInput.addEventListener('input', applyFormPatternVisual);
        cabecalhoSelect.addEventListener('change', applyFormPatternVisual);
        saveBtn.addEventListener('click', () => {
            saveState();
        });
        resetBtn.addEventListener('click', (event) => {
            event.preventDefault();
            resetState();
        });

        loadSavedState();
    }

    async function hydratePreferencesFromServer() {
        const apiClient = window.api;
        const authClient = window.Auth;
        if (typeof apiClient !== 'function' || !authClient || typeof authClient.isAuthenticated !== 'function' || !authClient.isAuthenticated()) {
            return;
        }

        try {
            const response = await apiClient('/ui-preferences', {
                method: 'GET',
                cache: 'no-store',
            });
            const data = response?.data;
            if (!data || typeof data !== 'object') {
                return;
            }

            if (data.theme === 'light' || data.theme === 'dark' || data.theme === 'system') {
                localStorage.setItem(THEME_KEY, data.theme);
            }
            if (data.layout_align === 'left' || data.layout_align === 'center' || data.layout_align === 'right' || data.layout_align === 'responsive') {
                localStorage.setItem(ALIGN_KEY, data.layout_align);
            }
            if (data.nav_align === 'left' || data.nav_align === 'center' || data.nav_align === 'right' || data.nav_align === 'responsive') {
                localStorage.setItem(NAV_ALIGN_KEY, data.nav_align);
            }
            if (data.layout_width === 'system' || data.layout_width === 'max-w-5xl' || data.layout_width === 'max-w-6xl' || data.layout_width === 'max-w-7xl' || data.layout_width === 'max-w-screen-2xl' || data.layout_width === 'max-w-none') {
                localStorage.setItem(WIDTH_KEY, data.layout_width);
            }
            if (data.nav_width === 'system' || data.nav_width === 'max-w-5xl' || data.nav_width === 'max-w-6xl' || data.nav_width === 'max-w-7xl' || data.nav_width === 'max-w-screen-2xl' || data.nav_width === 'max-w-none') {
                localStorage.setItem(NAV_WIDTH_KEY, data.nav_width);
            }
            if (typeof data.nav_color === 'string' && /^#[0-9a-fA-F]{6}$/.test(data.nav_color)) {
                localStorage.setItem(NAV_COLOR_KEY, data.nav_color.toLowerCase());
            }
            if (typeof data.footer_color === 'string' && /^#[0-9a-fA-F]{6}$/.test(data.footer_color)) {
                localStorage.setItem(FOOTER_COLOR_KEY, data.footer_color.toLowerCase());
            }
            if (typeof data.theme_toggle_visible === 'boolean') {
                localStorage.setItem(THEME_TOGGLE_VISIBLE_KEY, data.theme_toggle_visible ? 'show' : 'hide');
            }
            if (data.sales_cards_per_row) {
                localStorage.setItem(SALES_CARDS_PER_ROW_KEY, data.sales_cards_per_row);
            }
            if (
                Object.prototype.hasOwnProperty.call(data, 'form_company_name')
                || Object.prototype.hasOwnProperty.call(data, 'form_profile')
                || Object.prototype.hasOwnProperty.call(data, 'form_accent')
                || Object.prototype.hasOwnProperty.call(data, 'form_header_size')
            ) {
                localStorage.setItem(FORM_PATTERN_KEY, JSON.stringify({
                    empresa: String(data.form_company_name || ''),
                    perfil: String(data.form_profile || 'padrao').toLowerCase(),
                    cor: String(data.form_accent || 'brand').toLowerCase(),
                    cabecalho: String(data.form_header_size || 'medio').toLowerCase(),
                }));
            }
        }
        catch (_error) {
            // Sem bloquear a tela de ajuste quando o backend nao estiver acessivel.
        }
    }

    async function setupSystemPreferences() {
        const saveBtn = document.getElementById('saveSystemPreferencesBtn');
        if (!saveBtn) return;

        await hydratePreferencesFromServer();
        runEntranceAnimations();

        const currentTheme = getThemeValue();
        const currentAlign = getAlignValue();
        const currentNavAlign = getNavAlignValue();
        const currentWidth = getWidthValue();
        const currentNavWidth = getNavWidthValue();
        const currentNavColor = getNavColorValue();
        const currentFooterColor = getFooterColorValue();
        const currentThemeToggleVisibility = getThemeToggleVisibilityValue();
        const currentSalesCardsPerRow = getSalesCardsPerRowValue();
        const navColorPicker = document.getElementById('navColorPicker');
        const navColorHexLabel = document.getElementById('navColorHexLabel');
        const resetNavColorBtn = document.getElementById('resetNavColorBtn');
        const footerColorPicker = document.getElementById('footerColorPicker');
        const footerColorHexLabel = document.getElementById('footerColorHexLabel');
        const resetFooterColorBtn = document.getElementById('resetFooterColorBtn');

        const updateNavColorUI = (hexColor) => {
            const safe = String(hexColor || '#0f172a').toLowerCase();
            if (navColorPicker) {
                navColorPicker.value = safe;
            }
            if (navColorHexLabel) {
                navColorHexLabel.textContent = safe;
            }
        };

        const updateFooterColorUI = (hexColor) => {
            const safe = String(hexColor || '#0f172a').toLowerCase();
            if (footerColorPicker) {
                footerColorPicker.value = safe;
            }
            if (footerColorHexLabel) {
                footerColorHexLabel.textContent = safe;
            }
        };

        setChecked('themeMode', currentTheme);
        setChecked('themeToggleVisibility', currentThemeToggleVisibility);
        setChecked('layoutAlign', currentAlign);
        setChecked('navAlign', currentNavAlign);
        setChecked('layoutWidth', currentWidth);
        setChecked('navWidth', currentNavWidth);
        setChecked('salesCardsPerRow', currentSalesCardsPerRow);
        setChecked('salesLayout', getSalesLayoutValue());
        setChecked('splitCartSize', getSplitCartSizeValue());
        updateNavColorUI(currentNavColor);
        updateFooterColorUI(currentFooterColor);
        applyTheme(currentTheme);
        applyAlignment(currentAlign, false);
        applyNavAlignmentPreview(currentNavAlign, false);
        if (typeof window.applyGlobalLayoutWidth === 'function') {
            window.applyGlobalLayoutWidth();
        }
        if (typeof window.applyGlobalNavWidth === 'function') {
            window.applyGlobalNavWidth();
        }
        if (typeof window.applyGlobalNavAlign === 'function') {
            window.applyGlobalNavAlign();
        }
        if (typeof window.applyGlobalNavColor === 'function') {
            window.applyGlobalNavColor();
        }
        if (typeof window.applyGlobalFooterColor === 'function') {
            window.applyGlobalFooterColor();
        }
        if (typeof window.applyGlobalThemeToggleVisibility === 'function') {
            window.applyGlobalThemeToggleVisibility();
        }
        updateChoiceCards();

        qsa('input[name="themeMode"]').forEach((input) => {
            input.addEventListener('change', () => {
                const value = qs('input[name="themeMode"]:checked')?.value || 'dark';
                applyTheme(value);
                pulseThemeHero();
                updateChoiceCards();
            });
        });

        qsa('input[name="themeToggleVisibility"]').forEach((input) => {
            input.addEventListener('change', () => {
                const value = qs('input[name="themeToggleVisibility"]:checked')?.value || 'show';
                localStorage.setItem(THEME_TOGGLE_VISIBLE_KEY, value === 'hide' ? 'hide' : 'show');
                if (typeof window.applyGlobalThemeToggleVisibility === 'function') {
                    window.applyGlobalThemeToggleVisibility();
                }
                updateChoiceCards();
            });
        });

        qsa('input[name="layoutAlign"]').forEach((input) => {
            input.addEventListener('change', () => {
                const value = qs('input[name="layoutAlign"]:checked')?.value || 'responsive';
                applyAlignment(value, true);
                updateChoiceCards();
            });
        });

        qsa('input[name="navAlign"]').forEach((input) => {
            input.addEventListener('change', () => {
                const value = qs('input[name="navAlign"]:checked')?.value || 'responsive';
                localStorage.setItem(NAV_ALIGN_KEY, value);
                applyNavAlignmentPreview(value, true);
                if (typeof window.applyGlobalNavAlign === 'function') {
                    window.applyGlobalNavAlign();
                }
                updateChoiceCards();
            });
        });

        qsa('input[name="layoutWidth"]').forEach((input) => {
            input.addEventListener('change', () => {
                localStorage.setItem(WIDTH_KEY, qs('input[name="layoutWidth"]:checked')?.value || 'system');
                if (typeof window.applyGlobalLayoutWidth === 'function') {
                    window.applyGlobalLayoutWidth();
                }
                updateChoiceCards();
            });
        });

        qsa('input[name="navWidth"]').forEach((input) => {
            input.addEventListener('change', () => {
                localStorage.setItem(NAV_WIDTH_KEY, qs('input[name="navWidth"]:checked')?.value || 'system');
                if (typeof window.applyGlobalNavWidth === 'function') {
                    window.applyGlobalNavWidth();
                }
                updateChoiceCards();
            });
        });

        qsa('input[name="salesCardsPerRow"]').forEach((input) => {
            input.addEventListener('change', () => {
                localStorage.setItem(SALES_CARDS_PER_ROW_KEY, qs('input[name="salesCardsPerRow"]:checked')?.value || 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5');
                updateChoiceCards();
            });
        });

        qsa('input[name="salesLayout"]').forEach((input) => {
            input.addEventListener('change', () => {
                const val = qs('input[name="salesLayout"]:checked')?.value || 'drawer';
                localStorage.setItem(SALES_LAYOUT_KEY, val);
                updateChoiceCards();
            });
        });

        qsa('input[name="splitCartSize"]').forEach((input) => {
            input.addEventListener('change', () => {
                const val = qs('input[name="splitCartSize"]:checked')?.value || 'medium';
                localStorage.setItem(SPLIT_CART_SIZE_KEY, val);
                updateChoiceCards();
            });
        });

        if (navColorPicker) {
            navColorPicker.addEventListener('input', () => {
                const color = String(navColorPicker.value || '#0f172a').toLowerCase();
                localStorage.setItem(NAV_COLOR_KEY, color);
                updateNavColorUI(color);
                if (typeof window.applyGlobalNavColor === 'function') {
                    window.applyGlobalNavColor();
                }
            });
        }

        if (resetNavColorBtn) {
            resetNavColorBtn.addEventListener('click', () => {
                const color = '#0f172a';
                localStorage.setItem(NAV_COLOR_KEY, color);
                updateNavColorUI(color);
                if (typeof window.applyGlobalNavColor === 'function') {
                    window.applyGlobalNavColor();
                }
            });
        }

        if (footerColorPicker) {
            footerColorPicker.addEventListener('input', () => {
                const color = String(footerColorPicker.value || '#0f172a').toLowerCase();
                localStorage.setItem(FOOTER_COLOR_KEY, color);
                updateFooterColorUI(color);
                if (typeof window.applyGlobalFooterColor === 'function') {
                    window.applyGlobalFooterColor();
                }
            });
        }

        if (resetFooterColorBtn) {
            resetFooterColorBtn.addEventListener('click', () => {
                const color = '#0f172a';
                localStorage.setItem(FOOTER_COLOR_KEY, color);
                updateFooterColorUI(color);
                if (typeof window.applyGlobalFooterColor === 'function') {
                    window.applyGlobalFooterColor();
                }
            });
        }

        saveBtn.addEventListener('click', () => {
            const themeChoice = qs('input[name="themeMode"]:checked')?.value || 'dark';
            const alignChoice = qs('input[name="layoutAlign"]:checked')?.value || 'responsive';
            const navAlignChoice = qs('input[name="navAlign"]:checked')?.value || 'responsive';
            const widthChoice = qs('input[name="layoutWidth"]:checked')?.value || 'system';
            const navWidthChoice = qs('input[name="navWidth"]:checked')?.value || 'system';
            const themeToggleVisibilityChoice = qs('input[name="themeToggleVisibility"]:checked')?.value || 'show';
            const salesCardsPerRowChoice = qs('input[name="salesCardsPerRow"]:checked')?.value || 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
            const navColorChoice = String(navColorPicker?.value || '#0f172a').toLowerCase();
            const footerColorChoice = String(footerColorPicker?.value || '#0f172a').toLowerCase();

            setSaveButtonState(saveBtn, 'loading');

            window.setTimeout(async () => {
                localStorage.setItem(THEME_KEY, themeChoice);
                localStorage.setItem(ALIGN_KEY, alignChoice);
                localStorage.setItem(NAV_ALIGN_KEY, navAlignChoice);
                localStorage.setItem(WIDTH_KEY, widthChoice);
                localStorage.setItem(NAV_WIDTH_KEY, navWidthChoice);
                localStorage.setItem(THEME_TOGGLE_VISIBLE_KEY, themeToggleVisibilityChoice === 'hide' ? 'hide' : 'show');
                localStorage.setItem(SALES_CARDS_PER_ROW_KEY, salesCardsPerRowChoice);
                localStorage.setItem(SALES_LAYOUT_KEY, qs('input[name="salesLayout"]:checked')?.value || 'drawer');
                localStorage.setItem(SPLIT_CART_SIZE_KEY, qs('input[name="splitCartSize"]:checked')?.value || 'medium');
                localStorage.setItem(NAV_COLOR_KEY, navColorChoice);
                localStorage.setItem(FOOTER_COLOR_KEY, footerColorChoice);

                let syncError = null;
                const rawPattern = localStorage.getItem(FORM_PATTERN_KEY);
                let formPattern = { empresa: '', perfil: 'padrao', cor: 'brand', cabecalho: 'medio' };
                if (rawPattern) {
                    try {
                        const parsed = JSON.parse(rawPattern);
                        formPattern = {
                            empresa: String(parsed?.empresa || ''),
                            perfil: String(parsed?.perfil || 'padrao').toLowerCase(),
                            cor: String(parsed?.cor || 'brand').toLowerCase(),
                            cabecalho: String(parsed?.cabecalho || 'medio').toLowerCase(),
                        };
                    } catch (_error) {
                        // ignora parse e usa fallback
                    }
                }

                const apiClient = window.api;
                const authClient = window.Auth;
                if (typeof apiClient === 'function' && authClient && typeof authClient.isAuthenticated === 'function' && authClient.isAuthenticated()) {
                    try {
                        await apiClient('/ui-preferences', {
                            method: 'POST',
                            body: JSON.stringify({
                                theme: themeChoice,
                                layout_align: alignChoice,
                                nav_align: navAlignChoice,
                                layout_width: widthChoice,
                                nav_width: navWidthChoice,
                                nav_color: navColorChoice,
                                footer_color: footerColorChoice,
                                theme_toggle_visible: themeToggleVisibilityChoice !== 'hide',
                                form_company_name: formPattern.empresa || null,
                                form_profile: formPattern.perfil,
                                form_accent: formPattern.cor,
                                form_header_size: formPattern.cabecalho,
                                sales_cards_per_row: salesCardsPerRowChoice,
                            }),
                        });
                    }
                    catch (error) {
                        syncError = error;
                    }
                }

                if (typeof window.applyGlobalLayoutAlign === 'function') {
                    window.applyGlobalLayoutAlign();
                }
                if (typeof window.applyGlobalLayoutWidth === 'function') {
                    window.applyGlobalLayoutWidth();
                }
                if (typeof window.applyGlobalNavWidth === 'function') {
                    window.applyGlobalNavWidth();
                }
                if (typeof window.applyGlobalNavAlign === 'function') {
                    window.applyGlobalNavAlign();
                }
                if (typeof window.applyGlobalNavColor === 'function') {
                    window.applyGlobalNavColor();
                }
                if (typeof window.applyGlobalFooterColor === 'function') {
                    window.applyGlobalFooterColor();
                }
                if (typeof window.applyGlobalThemeToggleVisibility === 'function') {
                    window.applyGlobalThemeToggleVisibility();
                }

                applyTheme(themeChoice);
                applyAlignment(alignChoice, true);
                updateChoiceCards();
                pulseThemeHero();

                setSaveButtonState(saveBtn, 'success');
                if (syncError) {
                    showMessage('Preferências salvas localmente. Falha ao sincronizar no banco.', 'error');
                } else {
                    showMessage('Preferências salvas com sucesso.');
                }

                window.setTimeout(() => {
                    setSaveButtonState(saveBtn, 'default');
                }, 1200);
            }, 450);
        });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        await setupSystemPreferences();
        setupFormPattern();
    });
})();
