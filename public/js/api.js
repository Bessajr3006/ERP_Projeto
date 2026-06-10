// Base URL helper
const API_BASE = '/api/v1';
const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NAIVE_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/;
function isDateOnlyString(value) {
    return typeof value === 'string' && DATE_ONLY_PATTERN.test(value.trim());
}
function parseDateValue(value) {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
    }
    if (typeof value === 'number') {
        const normalizedValue = Math.abs(value) < 1e12 ? value * 1000 : value;
        const date = new Date(normalizedValue);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value !== 'string' || !value.trim())
        return null;
    const trimmed = value.trim();
    if (isDateOnlyString(trimmed)) {
        return new Date(`${trimmed}T00:00:00-03:00`);
    }
    const naiveMatch = trimmed.match(NAIVE_DATE_TIME_PATTERN);
    if (naiveMatch && !/[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed)) {
        const [, year, month, day, hour, minute, second = '00'] = naiveMatch;
        const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
}
function getDatePart(parts, type) {
    return parts.find((part) => part.type === type)?.value || '00';
}
function getBrazilParts(value) {
    const date = parseDateValue(value);
    if (!date)
        return null;
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: BRAZIL_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(date);
    return {
        year: getDatePart(parts, 'year'),
        month: getDatePart(parts, 'month'),
        day: getDatePart(parts, 'day'),
        hour: getDatePart(parts, 'hour'),
        minute: getDatePart(parts, 'minute'),
        second: getDatePart(parts, 'second'),
    };
}
function getBrazilOffset(value) {
    const date = parseDateValue(value) || new Date();
    try {
        const offset = new Intl.DateTimeFormat('en-US', {
            timeZone: BRAZIL_TIME_ZONE,
            timeZoneName: 'longOffset',
        }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value;
        const match = offset && offset.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
        if (match) {
            const sign = match[1];
            const hours = match[2].padStart(2, '0');
            const minutes = (match[3] || '00').padStart(2, '0');
            return `${sign}${hours}:${minutes}`;
        }
    }
    catch (_error) {
        // Fallback for browsers without longOffset support.
    }
    return '-03:00';
}
const DateUtils = {
    timeZone: BRAZIL_TIME_ZONE,
    toDateInputValue(value) {
        if (!value)
            return '';
        if (isDateOnlyString(value))
            return value.trim();
        const parts = getBrazilParts(value);
        return parts ? `${parts.year}-${parts.month}-${parts.day}` : '';
    },
    getTodayDateInputValue() {
        return DateUtils.toDateInputValue(new Date());
    },
    formatDate(value) {
        if (!value)
            return '-';
        if (isDateOnlyString(value)) {
            const [year, month, day] = value.trim().split('-');
            return `${day}/${month}/${year}`;
        }
        const date = parseDateValue(value);
        if (!date)
            return '-';
        return new Intl.DateTimeFormat('pt-BR', {
            timeZone: BRAZIL_TIME_ZONE,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).format(date);
    },
    formatDateTime(value) {
        if (!value)
            return '-';
        if (isDateOnlyString(value))
            return DateUtils.formatDate(value);
        const date = parseDateValue(value);
        if (!date)
            return '-';
        return new Intl.DateTimeFormat('pt-BR', {
            timeZone: BRAZIL_TIME_ZONE,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    },
    toBrazilIsoDateTime(value = new Date()) {
        const parts = getBrazilParts(value);
        if (!parts)
            return '';
        return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${getBrazilOffset(value)}`;
    },
    compareDateOnly(left, right) {
        const leftValue = DateUtils.toDateInputValue(left);
        const rightValue = DateUtils.toDateInputValue(right);
        if (!leftValue || !rightValue)
            return 0;
        if (leftValue === rightValue)
            return 0;
        return leftValue < rightValue ? -1 : 1;
    },
    isBeforeToday(value) {
        return DateUtils.compareDateOnly(value, DateUtils.getTodayDateInputValue()) < 0;
    },
    addDays(value, days) {
        const base = DateUtils.toDateInputValue(value) || DateUtils.getTodayDateInputValue();
        const [year, month, day] = base.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        date.setUTCDate(date.getUTCDate() + Number(days || 0));
        const y = String(date.getUTCFullYear());
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },
};
window.DateUtils = DateUtils;
// Token Management
const Auth = {
    setToken(token) {
        const normalizedToken = typeof token === 'string' ? token.trim() : '';
        if (!normalizedToken || normalizedToken === 'undefined' || normalizedToken === 'null') {
            localStorage.removeItem('erp_token');
            return false;
        }
        localStorage.setItem('erp_token', normalizedToken);
        return true;
    },
    getToken() {
        const token = localStorage.getItem('erp_token');
        if (!token || token === 'undefined' || token === 'null') {
            localStorage.removeItem('erp_token');
            return null;
        }
        return token;
    },
    clearToken() {
        localStorage.removeItem('erp_token');
    },
    isAuthenticated() {
        return !!Auth.getToken();
    }
};
// LocalStorage Cache Manager for Offline PWA Support
const CacheManager = {
    normalizeEndpoint: (endpoint) => {
        const rawEndpoint = String(endpoint || '').trim();
        if (!rawEndpoint)
            return '';
        const [pathname, rawQuery = ''] = rawEndpoint.split('?');
        if (!rawQuery)
            return pathname;
        const params = new URLSearchParams(rawQuery);
        params.delete('ts');
        const normalizedQuery = params.toString();
        return normalizedQuery ? `${pathname}?${normalizedQuery}` : pathname;
    },
    shouldCache: (endpoint, serializedData = '') => {
        const normalizedEndpoint = CacheManager.normalizeEndpoint(endpoint);
        if (!normalizedEndpoint)
            return false;
        if (normalizedEndpoint.includes('/whatsapp-business/')
            || normalizedEndpoint.includes('/auth/me')
            || normalizedEndpoint.includes('/health')) {
            return false;
        }
        if (serializedData && serializedData.length > 200000) {
            return false;
        }
        return true;
    },
    pruneVolatileEntries: () => {
        try {
            const keysToDelete = [];
            for (let index = 0; index < localStorage.length; index += 1) {
                const key = localStorage.key(index);
                if (!key || !key.startsWith('erp_cache_'))
                    continue;
                if (key.includes('/whatsapp-business/')
                    || key.includes('/auth/me')
                    || key.includes('/health')
                    || key.includes('ts=')) {
                    keysToDelete.push(key);
                }
            }
            keysToDelete.forEach((key) => localStorage.removeItem(key));
        }
        catch (_error) {
            // Ignore cache cleanup errors.
        }
    },
    save: (endpoint, data) => {
        const normalizedEndpoint = CacheManager.normalizeEndpoint(endpoint);
        let serializedData = '';
        try {
            serializedData = JSON.stringify(data);
        }
        catch (_error) {
            return;
        }
        if (!CacheManager.shouldCache(normalizedEndpoint, serializedData)) {
            return;
        }
        try {
            localStorage.setItem(`erp_cache_${normalizedEndpoint}`, serializedData);
        }
        catch (e) {
            CacheManager.pruneVolatileEntries();
            try {
                localStorage.setItem(`erp_cache_${normalizedEndpoint}`, serializedData);
            }
            catch (_retryError) {
                // Ignore quota/cache failures silently to avoid flooding the console.
            }
        }
    },
    get: (endpoint) => {
        try {
            const normalizedEndpoint = CacheManager.normalizeEndpoint(endpoint);
            if (!normalizedEndpoint)
                return null;
            const cached = localStorage.getItem(`erp_cache_${normalizedEndpoint}`);
            return cached ? JSON.parse(cached) : null;
        }
        catch (e) {
            return null;
        }
    }
};
CacheManager.pruneVolatileEntries();
// LocalStorage Sync Manager for Offline Writes
const SyncManager = {
    enqueue: (requestParams) => {
        try {
            const queue = JSON.parse(localStorage.getItem('erp_sync_queue') || '[]');
            queue.push({ ...requestParams, id: Date.now(), timestamp: DateUtils.toBrazilIsoDateTime() });
            localStorage.setItem('erp_sync_queue', JSON.stringify(queue));
        }
        catch (e) {
            console.warn('Falha ao enfileirar requisição offline');
        }
    },
    getQueue: () => {
        try {
            return JSON.parse(localStorage.getItem('erp_sync_queue') || '[]');
        }
        catch (e) {
            return [];
        }
    },
    clearQueue: () => {
        localStorage.removeItem('erp_sync_queue');
    },
    setQueue: (queue) => {
        try {
            localStorage.setItem('erp_sync_queue', JSON.stringify(queue));
        }
        catch (_error) {
            // Ignore storage failures.
        }
    },
    processQueue: async () => {
        const queue = SyncManager.getQueue();
        if (queue.length === 0)
            return;
        console.log(`[Offline Mode] Processando fila de sincronização: ${queue.length} itens.`);
        let hasErrors = false;
        const remainingQueue = [];
        for (const req of queue) {
            try {
                const config = {
                    method: req.method,
                    headers: req.headers,
                    body: req.body
                };
                const response = await fetch(`${API_BASE}${req.endpoint}`, config);
                if (!response.ok) {
                    console.error(`Falha na sincronização do endpoint: ${req.endpoint}`);
                    // Se for um erro do cliente (400-499), a requisição é inválida e nunca vai passar.
                    // Descartamos para não travar a fila para sempre.
                    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                        console.warn(`Descartando requisição da fila devido a erro do cliente (${response.status})`);
                    }
                    else {
                        hasErrors = true;
                        remainingQueue.push(req);
                    }
                }
            }
            catch (error) {
                console.error(`A rede falhou novamente ao sincronizar: ${req.endpoint}`);
                hasErrors = true;
                remainingQueue.push(req);
                break; // Stop and keep remaining queue for next attempt.
            }
        }
        if (!hasErrors) {
            SyncManager.clearQueue();
            if (typeof UI !== 'undefined' && UI.showAlert) {
                try {
                    UI.showAlert('alertMessage', 'Você voltou a ficar Online. Todos os dados salvos offline foram sincronizados com sucesso!', 'success', 6000);
                }
                catch (e) { }
            }
        }
        else {
            console.warn('Alguns dados não puderam ser sincronizados.');
            SyncManager.setQueue(remainingQueue);
            if (typeof UI !== 'undefined' && UI.showAlert) {
                try {
                    UI.showAlert('alertMessage', 'Conexão restabelecida, mas alguns dados não puderam ser sincronizados (possível conflito de validação).', 'warn', 6000);
                }
                catch (e) { }
            }
        }
    }
};
window.addEventListener('online', () => {
    if (SyncManager.getQueue().length > 0) {
        if (typeof UI !== 'undefined' && UI.showAlert) {
            try {
                UI.showAlert('alertMessage', 'Conexão restabelecida! Iniciando sincronização em background...', 'success', 5000);
            }
            catch (e) { }
        }
        SyncManager.processQueue();
    }
});
if (navigator.onLine && SyncManager.getQueue().length > 0) {
    setTimeout(() => {
        SyncManager.processQueue();
    }, 1500);
}
function normalizeHeaders(headers) {
    if (!headers)
        return {};
    if (headers instanceof Headers) {
        const obj = {};
        headers.forEach((value, key) => {
            obj[key] = value;
        });
        return obj;
    }
    if (Array.isArray(headers)) {
        return Object.fromEntries(headers);
    }
    return headers;
}
// Generic Fetch Wrapper
const api = async (endpoint, options = {}) => {
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };
    const normalizedEndpoint = String(endpoint || '').trim();
    const isVolatileEndpoint = normalizedEndpoint.includes('/whatsapp-business/')
        || normalizedEndpoint === '/tasks'
        || normalizedEndpoint.startsWith('/tasks/')
        || normalizedEndpoint === '/organizer'
        || normalizedEndpoint.includes('/auth/me')
        || normalizedEndpoint.includes('/health');
    if (Auth.isAuthenticated()) {
        defaultHeaders['Authorization'] = `Bearer ${Auth.getToken()}`;
    }
    const optionHeaders = normalizeHeaders(options.headers);
    const config = {
        ...options,
        cache: isVolatileEndpoint ? 'no-store' : options.cache,
        headers: {
            ...defaultHeaders,
            ...(isVolatileEndpoint
                ? {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    Pragma: 'no-cache',
                    Expires: '0',
                }
                : {}),
            ...optionHeaders,
        },
    };
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        let data = null;
        // Avoid crashing on 204 No Content since body is completely empty
        if (response.status !== 204) {
            const contentType = response.headers.get('Content-Type') || '';
            if (contentType.includes('application/json')) {
                data = await response.json();
            }
            else {
                // Try JSON anyway (some servers omit or vary Content-Type)
                const text = await response.text();
                try {
                    data = JSON.parse(text);
                }
                catch (_) {
                    // Backend returned non-JSON (e.g. nginx HTML error page)
                    console.error('[API] Non-JSON response', response.status, endpoint, text.slice(0, 200));
                    throw new Error('Servidor indisponível. Tente novamente em instantes.');
                }
            }
        }
        if (!response.ok) {
            if (response.status === 401) {
                // Token expired or invalid
                Auth.clearToken();
                if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
                    window.location.href = '/';
                }
            }
            let errorMsg = null;
            if (data && typeof data === 'object') {
                const anyData = data;
                errorMsg = anyData.message || anyData.error || anyData.details || null;
                if (!errorMsg && Array.isArray(anyData.errors) && anyData.errors.length > 0) {
                    errorMsg = anyData.errors
                        .map((e) => e?.message)
                        .filter(Boolean)
                        .join('; ');
                }
            }
            if (!errorMsg)
                errorMsg = 'Erro na requisição';
            console.error('[API Error]', response.status, endpoint, data);
            throw new Error(errorMsg);
        }
        // Cache successful GET requests
        if (!options.method || options.method.toUpperCase() === 'GET') {
            CacheManager.save(endpoint, data);
        }
        return data;
    }
    catch (error) {
        // Fallback to cache for GET requests or Queue for POST/PUT if offline
        const method = options.method ? options.method.toUpperCase() : 'GET';
        const isGet = (method === 'GET');
        const isAuthMutation = !isGet && /^\/auth\/(login|register)$/.test(endpoint);
        const isVolatileMutation = !isGet && (endpoint.includes('/proxy-consulta') ||
            endpoint.includes('/import') ||
            endpoint.includes('/upload'));
        const isNetworkError = !navigator.onLine
            || (error instanceof TypeError)
            || (error instanceof Error && /fetch|network|failed to fetch/i.test(error.message || ''));
        if (isNetworkError) {
            if (isGet) {
                const cachedData = CacheManager.get(endpoint);
                if (cachedData) {
                    console.warn(`[Offline Mode] Servindo dados de cache: ${endpoint}`);
                    setTimeout(() => {
                        if (typeof UI !== 'undefined' && UI.showAlert) {
                            try {
                                UI.showAlert('alertMessage', 'Você está offline. Exibindo dados de cache baseados na sua última sincronização com a internet.', 'warn', 5000);
                            }
                            catch (e) { }
                        }
                    }, 500);
                    return cachedData;
                }
                else {
                    throw new Error('Você está sem internet e não possui dados baixados para exibir nesta tela.');
                }
            }
            else if (isAuthMutation) {
                Auth.clearToken();
                throw new Error('Não foi possível conectar ao servidor para autenticar o usuário. Verifique a conexão e tente novamente.');
            }
            else if (isVolatileMutation) {
                throw new Error('Você está offline e esta operação exige conexão com a internet.');
            }
            else {
                // Sincronização offline
                console.warn(`[Offline Mode] Salvando requisição ${method} localmente na fila: ${endpoint}`);
                SyncManager.enqueue({ endpoint, method, headers: config.headers, body: options.body });
                setTimeout(() => {
                    if (typeof UI !== 'undefined' && UI.showAlert) {
                        try {
                            UI.showAlert('alertMessage', 'Você está offline. Os dados foram salvos magicamente no seu dispositivo e serão sincronizados com a nuvem quando a conexão voltar.', 'success', 8000);
                        }
                        catch (e) { }
                    }
                }, 500);
                // Simular o sucesso para o frontend continuar funcionando (ex: limpar carrinho do PDV)
                return { status: 'success', data: { id: 'offline_' + Date.now(), offline: true }, message: 'Salvo offline' };
            }
        }
        throw error;
    }
};
// UI Helpers
const UI = {
    _alertTimers: {},
    showAlert: (elementId, message, type = 'error', durationMillis = 15000) => {
        const el = document.getElementById(elementId);
        if (!el)
            return;
        el.textContent = message;
        el.classList.remove('hidden', 
        // error
        'bg-red-100', 'text-red-700', 'dark:bg-red-900/40', 'dark:text-red-300', 
        // success
        'bg-green-100', 'text-green-700', 'dark:bg-green-900/40', 'dark:text-green-300', 
        // warn
        'bg-yellow-100', 'text-yellow-800', 'dark:bg-yellow-900/40', 'dark:text-yellow-300');
        if (type === 'error') {
            el.classList.add('bg-red-100', 'text-red-700', 'dark:bg-red-900/40', 'dark:text-red-300');
        }
        else if (type === 'warn' || type === 'warning') {
            el.classList.add('bg-yellow-100', 'text-yellow-800', 'dark:bg-yellow-900/40', 'dark:text-yellow-300');
        }
        else {
            // success (default)
            el.classList.add('bg-green-100', 'text-green-700', 'dark:bg-green-900/40', 'dark:text-green-300');
        }
        // Clear any prior hide timer for this alert element
        if (UI._alertTimers[elementId]) {
            clearTimeout(UI._alertTimers[elementId]);
        }
        // Set new timer to auto-hide
        if (durationMillis > 0) {
            UI._alertTimers[elementId] = setTimeout(() => {
                UI.hideAlert(elementId);
            }, durationMillis);
        }
    },
    hideAlert: (elementId) => {
        const el = document.getElementById(elementId);
        if (el)
            el.classList.add('hidden');
    }
};
// ==========================================
// Theme (Light/Dark Mode) Handler
// ==========================================
function initTheme() {
    const htmlDecl = document.documentElement;
    // Tema pode ser: dark | light | system
    const currentTheme = localStorage.getItem('theme') || 'dark';
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (currentTheme === 'dark' || (currentTheme === 'system' && prefersDark)) {
        htmlDecl.classList.add('dark');
    }
    else {
        htmlDecl.classList.remove('dark');
    }
}
const LAYOUT_ALIGN_KEY = 'layout_align';
const NAV_ALIGN_KEY = 'nav_align';
const LAYOUT_WIDTH_KEY = 'layout_width';
const NAV_WIDTH_KEY = 'nav_width';
const NAV_COLOR_KEY = 'nav_color';
const FOOTER_COLOR_KEY = 'footer_color';
const FORM_PATTERN_KEY = 'form_pattern_preferences';
const THEME_TOGGLE_VISIBLE_KEY = 'theme_toggle_visible';
async function syncUiPreferencesFromServer() {
    if (!Auth.isAuthenticated()) {
        return;
    }
    try {
        const response = await api('/ui-preferences', {
            method: 'GET',
            cache: 'no-store',
        });
        const data = response?.data;
        if (!data || typeof data !== 'object') {
            return;
        }
        if (data.theme === 'light' || data.theme === 'dark' || data.theme === 'system') {
            localStorage.setItem('theme', data.theme);
        }
        if (data.layout_align === 'left' || data.layout_align === 'center' || data.layout_align === 'right' || data.layout_align === 'responsive') {
            localStorage.setItem(LAYOUT_ALIGN_KEY, data.layout_align);
        }
        if (data.nav_align === 'left' || data.nav_align === 'center' || data.nav_align === 'right' || data.nav_align === 'responsive') {
            localStorage.setItem(NAV_ALIGN_KEY, data.nav_align);
        }
        if (data.layout_width === 'system' || data.layout_width === 'max-w-5xl' || data.layout_width === 'max-w-6xl' || data.layout_width === 'max-w-7xl' || data.layout_width === 'max-w-screen-2xl' || data.layout_width === 'max-w-none') {
            localStorage.setItem(LAYOUT_WIDTH_KEY, data.layout_width);
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
            localStorage.setItem('sales_cards_per_row', data.sales_cards_per_row);
        }
        if (data.sales_layout === 'drawer' || data.sales_layout === 'split') {
            localStorage.setItem('sales_layout', data.sales_layout);
        }
        if (data.split_cart_size === 'small' || data.split_cart_size === 'medium' || data.split_cart_size === 'large') {
            localStorage.setItem('split_cart_size', data.split_cart_size);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'form_company_name')
            || Object.prototype.hasOwnProperty.call(data, 'form_profile')
            || Object.prototype.hasOwnProperty.call(data, 'form_accent')
            || Object.prototype.hasOwnProperty.call(data, 'form_header_size')) {
            const formPattern = {
                empresa: String(data.form_company_name || ''),
                perfil: String(data.form_profile || 'padrao').toLowerCase(),
                cor: String(data.form_accent || 'brand').toLowerCase(),
                cabecalho: String(data.form_header_size || 'medio').toLowerCase(),
            };
            localStorage.setItem(FORM_PATTERN_KEY, JSON.stringify(formPattern));
        }
    }
    catch (_error) {
        // Mantem o fallback local quando a API nao estiver disponivel.
    }
}
function getThemeToggleVisibilityPreference() {
    const raw = String(localStorage.getItem(THEME_TOGGLE_VISIBLE_KEY) || '').trim().toLowerCase();
    if (raw === 'hide') {
        return 'hide';
    }
    if (raw !== 'show') {
        localStorage.setItem(THEME_TOGGLE_VISIBLE_KEY, 'show');
    }
    return 'show';
}
function applyThemeToggleVisibilityPreference() {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn)
        return;
    const mode = getThemeToggleVisibilityPreference();
    if (mode === 'hide') {
        btn.classList.add('hidden');
        btn.setAttribute('aria-hidden', 'true');
    }
    else {
        btn.classList.remove('hidden');
        btn.removeAttribute('aria-hidden');
    }
}
function getLayoutAlignPreference() {
    const align = localStorage.getItem(LAYOUT_ALIGN_KEY);
    if (align === 'left' || align === 'center' || align === 'right' || align === 'responsive') {
        return align;
    }
    return 'responsive';
}
function applyLayoutAlignPreference() {
    const htmlDecl = document.documentElement;
    const body = document.body;
    if (!htmlDecl || !body)
        return;
    const align = getLayoutAlignPreference();
    const isDesktop = window.matchMedia && window.matchMedia('(min-width: 1024px)').matches;
    const resolvedAlign = align === 'responsive' ? (isDesktop ? 'left' : 'center') : align;
    htmlDecl.setAttribute('data-layout-align', align);
    const targets = document.querySelectorAll('main.max-w-5xl, main.max-w-6xl, main.max-w-7xl, main.max-w-screen-2xl, main.max-w-none');
    targets.forEach((el) => {
        el.style.removeProperty('margin-left');
        el.style.removeProperty('margin-right');
        if (resolvedAlign === 'left') {
            el.style.marginLeft = '0';
            el.style.marginRight = 'auto';
            return;
        }
        if (resolvedAlign === 'right') {
            el.style.marginLeft = 'auto';
            el.style.marginRight = '0';
            return;
        }
        el.style.marginLeft = 'auto';
        el.style.marginRight = 'auto';
    });
}
function getNavAlignPreference() {
    const align = localStorage.getItem(NAV_ALIGN_KEY);
    if (align === 'left' || align === 'center' || align === 'right' || align === 'responsive') {
        return align;
    }
    const fallback = getLayoutAlignPreference();
    localStorage.setItem(NAV_ALIGN_KEY, fallback);
    return fallback;
}
function applyNavAlignPreference() {
    const navInner = document.getElementById('globalNavInnerContainer');
    if (!navInner)
        return;
    const align = getNavAlignPreference();
    const isDesktop = window.matchMedia && window.matchMedia('(min-width: 1024px)').matches;
    const resolvedAlign = align === 'responsive' ? (isDesktop ? 'left' : 'center') : align;
    navInner.classList.remove('mx-auto', 'mx-0', 'ml-auto', 'mr-0');
    navInner.style.removeProperty('margin-left');
    navInner.style.removeProperty('margin-right');
    if (resolvedAlign === 'left') {
        navInner.style.setProperty('margin-left', '0', 'important');
        navInner.style.setProperty('margin-right', 'auto', 'important');
        return;
    }
    if (resolvedAlign === 'right') {
        navInner.style.setProperty('margin-left', 'auto', 'important');
        navInner.style.setProperty('margin-right', '0', 'important');
        return;
    }
    navInner.style.setProperty('margin-left', 'auto', 'important');
    navInner.style.setProperty('margin-right', 'auto', 'important');
}
function getLayoutWidthPreference() {
    const width = localStorage.getItem(LAYOUT_WIDTH_KEY);
    if (!width) {
        localStorage.setItem(LAYOUT_WIDTH_KEY, 'system');
        return 'system';
    }
    if (width === 'system' || width === 'max-w-5xl' || width === 'max-w-6xl' || width === 'max-w-7xl' || width === 'max-w-screen-2xl' || width === 'max-w-none') {
        return width;
    }
    localStorage.setItem(LAYOUT_WIDTH_KEY, 'system');
    return 'system';
}
function applyLayoutWidthPreference() {
    const widthPreference = getLayoutWidthPreference();
    const widthClass = widthPreference === 'system' ? 'max-w-7xl' : widthPreference;
    const targets = document.querySelectorAll('main.w-full');
    targets.forEach((el) => {
        el.classList.remove('max-w-5xl', 'max-w-6xl', 'max-w-7xl', 'max-w-screen-2xl', 'max-w-none');
        el.classList.add(widthClass);
    });
}
function getNavWidthPreference() {
    const width = localStorage.getItem(NAV_WIDTH_KEY);
    if (width === 'system' || width === 'max-w-5xl' || width === 'max-w-6xl' || width === 'max-w-7xl' || width === 'max-w-screen-2xl' || width === 'max-w-none') {
        return width;
    }
    const fallback = getLayoutWidthPreference();
    localStorage.setItem(NAV_WIDTH_KEY, fallback);
    return fallback;
}
function applyNavWidthPreference() {
    const navInner = document.getElementById('globalNavInnerContainer');
    if (!navInner)
        return;
    const widthPreference = getNavWidthPreference();
    const widthClass = widthPreference === 'system' ? 'max-w-7xl' : widthPreference;
    navInner.classList.remove('max-w-5xl', 'max-w-6xl', 'max-w-7xl', 'max-w-screen-2xl', 'max-w-none');
    navInner.classList.add(widthClass);
}
function getNavColorPreference() {
    const navColor = localStorage.getItem(NAV_COLOR_KEY);
    const LEGACY = {
        brand: '#1e3a8a',
        slate: '#0f172a',
        emerald: '#064e3b',
        rose: '#881337',
    };
    const normalizeHex = (value) => {
        const raw = String(value || '').trim().toLowerCase();
        if (LEGACY[raw]) {
            return LEGACY[raw];
        }
        if (/^#([0-9a-f]{6})$/.test(raw)) {
            return raw;
        }
        return '#0f172a';
    };
    const normalized = normalizeHex(navColor);
    if (normalized !== navColor) {
        localStorage.setItem(NAV_COLOR_KEY, normalized);
    }
    return normalized;
}
function applyNavColorPreference() {
    const navRoot = document.getElementById('globalNavRoot');
    if (!navRoot)
        return;
    const color = getNavColorPreference();
    const hexToRgba = (hex, alpha = 1) => {
        const n = parseInt(hex.slice(1), 16);
        const r = (n >> 16) & 0xff;
        const g = (n >> 8) & 0xff;
        const b = n & 0xff;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };
    const shadeHex = (hex, delta) => {
        const n = parseInt(hex.slice(1), 16);
        const r = Math.min(255, Math.max(0, (n >> 16) + delta));
        const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + delta));
        const b = Math.min(255, Math.max(0, (n & 0xff) + delta));
        return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
    };
    navRoot.style.backgroundColor = hexToRgba(color, 0.9);
    navRoot.style.borderColor = shadeHex(color, -18);
}
function getFooterColorPreference() {
    const footerColor = localStorage.getItem(FOOTER_COLOR_KEY);
    const LEGACY = {
        brand: '#1e3a8a',
        slate: '#0f172a',
        emerald: '#064e3b',
        rose: '#881337',
    };
    const normalizeHex = (value) => {
        const raw = String(value || '').trim().toLowerCase();
        if (LEGACY[raw]) {
            return LEGACY[raw];
        }
        if (/^#([0-9a-f]{6})$/.test(raw)) {
            return raw;
        }
        return '#0f172a';
    };
    const normalized = normalizeHex(footerColor);
    if (normalized !== footerColor) {
        localStorage.setItem(FOOTER_COLOR_KEY, normalized);
    }
    return normalized;
}
function applyFooterColorPreference() {
    const footerRoot = document.getElementById('globalFooterRoot');
    if (!footerRoot)
        return;
    const footerBrandText = document.getElementById('footerBrandText');
    const footerBrandDot = document.getElementById('footerBrandDot');
    const footerCompanyInfo = document.getElementById('footerCompanyInfo');
    const footerCopyright = document.getElementById('footerCopyright');
    const color = getFooterColorPreference();
    const hexToRgba = (hex, alpha = 1) => {
        const n = parseInt(hex.slice(1), 16);
        const r = (n >> 16) & 0xff;
        const g = (n >> 8) & 0xff;
        const b = n & 0xff;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };
    const shadeHex = (hex, delta) => {
        const n = parseInt(hex.slice(1), 16);
        const r = Math.min(255, Math.max(0, (n >> 16) + delta));
        const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + delta));
        const b = Math.min(255, Math.max(0, (n & 0xff) + delta));
        return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
    };
    const getLuminance = (hex) => {
        const n = parseInt(hex.slice(1), 16);
        const r = (n >> 16) & 0xff;
        const g = (n >> 8) & 0xff;
        const b = n & 0xff;
        return (0.299 * r) + (0.587 * g) + (0.114 * b);
    };
    footerRoot.style.backgroundColor = hexToRgba(color, 0.9);
    footerRoot.style.borderColor = shadeHex(color, -18);
    const isDarkBg = getLuminance(color) < 150;
    const primaryText = isDarkBg ? '#f8fafc' : '#0f172a';
    const secondaryText = isDarkBg ? '#e2e8f0' : '#1e293b';
    const mutedText = isDarkBg ? '#cbd5e1' : '#334155';
    if (footerBrandText) {
        footerBrandText.style.color = primaryText;
    }
    if (footerBrandDot) {
        footerBrandDot.style.backgroundColor = primaryText;
    }
    if (footerCompanyInfo) {
        footerCompanyInfo.style.color = secondaryText;
        const infoBadge = footerCompanyInfo.querySelector('span');
        if (infoBadge) {
            infoBadge.style.backgroundColor = hexToRgba(color, isDarkBg ? 0.22 : 0.14);
            infoBadge.style.borderColor = shadeHex(color, isDarkBg ? 24 : -12);
            infoBadge.style.color = secondaryText;
        }
    }
    if (footerCopyright) {
        footerCopyright.style.color = mutedText;
    }
}
window.addEventListener('resize', () => {
    if (getLayoutAlignPreference() === 'responsive') {
        applyLayoutAlignPreference();
    }
    if (getNavAlignPreference() === 'responsive') {
        applyNavAlignPreference();
    }
});
// Run init immediately on load to prevent blinding flash
initTheme();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await syncUiPreferencesFromServer();
        initTheme();
        applyLayoutWidthPreference();
        applyNavWidthPreference();
        applyLayoutAlignPreference();
        applyNavAlignPreference();
        applyNavColorPreference();
        applyFooterColorPreference();
        applyThemeToggleVisibilityPreference();
    });
}
else {
    syncUiPreferencesFromServer().finally(() => {
        initTheme();
        applyLayoutWidthPreference();
        applyNavWidthPreference();
        applyLayoutAlignPreference();
        applyNavAlignPreference();
        applyNavColorPreference();
        applyFooterColorPreference();
        applyThemeToggleVisibilityPreference();
    });
}
// Expor helpers no escopo global (vários módulos públicos usam window.*)
window.Auth = Auth;
window.api = api;
window.UI = UI;
window.CacheManager = CacheManager;
window.SyncManager = SyncManager;
window.applyGlobalLayoutAlign = applyLayoutAlignPreference;
window.applyGlobalNavAlign = applyNavAlignPreference;
window.applyGlobalLayoutWidth = applyLayoutWidthPreference;
window.applyGlobalNavWidth = applyNavWidthPreference;
window.applyGlobalNavColor = applyNavColorPreference;
window.applyGlobalFooterColor = applyFooterColorPreference;
window.applyGlobalThemeToggleVisibility = applyThemeToggleVisibilityPreference;
