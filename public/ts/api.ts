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

    if (typeof value !== 'string' || !value.trim()) return null;

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
    if (!date) return null;

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
    } catch (_error) {
        // Fallback for browsers without longOffset support.
    }

    return '-03:00';
}

const DateUtils = {
    timeZone: BRAZIL_TIME_ZONE,
    toDateInputValue(value) {
        if (!value) return '';
        if (isDateOnlyString(value)) return value.trim();

        const parts = getBrazilParts(value);
        return parts ? `${parts.year}-${parts.month}-${parts.day}` : '';
    },
    getTodayDateInputValue() {
        return DateUtils.toDateInputValue(new Date());
    },
    formatDate(value) {
        if (!value) return '-';
        if (isDateOnlyString(value)) {
            const [year, month, day] = value.trim().split('-');
            return `${day}/${month}/${year}`;
        }

        const date = parseDateValue(value);
        if (!date) return '-';

        return new Intl.DateTimeFormat('pt-BR', {
            timeZone: BRAZIL_TIME_ZONE,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).format(date);
    },
    formatDateTime(value) {
        if (!value) return '-';
        if (isDateOnlyString(value)) return DateUtils.formatDate(value);

        const date = parseDateValue(value);
        if (!date) return '-';

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
        if (!parts) return '';

        return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${getBrazilOffset(value)}`;
    },
    compareDateOnly(left, right) {
        const leftValue = DateUtils.toDateInputValue(left);
        const rightValue = DateUtils.toDateInputValue(right);
        if (!leftValue || !rightValue) return 0;
        if (leftValue === rightValue) return 0;
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
        if (!rawEndpoint) return '';

        const [pathname, rawQuery = ''] = rawEndpoint.split('?');
        if (!rawQuery) return pathname;

        const params = new URLSearchParams(rawQuery);
        params.delete('ts');
        const normalizedQuery = params.toString();
        return normalizedQuery ? `${pathname}?${normalizedQuery}` : pathname;
    },
    shouldCache: (endpoint, serializedData = '') => {
        const normalizedEndpoint = CacheManager.normalizeEndpoint(endpoint);
        if (!normalizedEndpoint) return false;

        if (
            normalizedEndpoint.includes('/whatsapp-business/')
            || normalizedEndpoint.includes('/auth/me')
            || normalizedEndpoint.includes('/health')
        ) {
            return false;
        }

        if (serializedData && serializedData.length > 200_000) {
            return false;
        }

        return true;
    },
    pruneVolatileEntries: () => {
        try {
            const keysToDelete: string[] = [];
            for (let index = 0; index < localStorage.length; index += 1) {
                const key = localStorage.key(index);
                if (!key || !key.startsWith('erp_cache_')) continue;

                if (
                    key.includes('/whatsapp-business/')
                    || key.includes('/auth/me')
                    || key.includes('/health')
                    || key.includes('ts=')
                ) {
                    keysToDelete.push(key);
                }
            }

            keysToDelete.forEach((key) => localStorage.removeItem(key));
        } catch (_error) {
            // Ignore cache cleanup errors.
        }
    },
    save: (endpoint, data) => {
        const normalizedEndpoint = CacheManager.normalizeEndpoint(endpoint);
        let serializedData = '';

        try {
            serializedData = JSON.stringify(data);
        } catch (_error) {
            return;
        }

        if (!CacheManager.shouldCache(normalizedEndpoint, serializedData)) {
            return;
        }

        try {
            localStorage.setItem(`erp_cache_${normalizedEndpoint}`, serializedData);
        } catch (e) {
            CacheManager.pruneVolatileEntries();
            try {
                localStorage.setItem(`erp_cache_${normalizedEndpoint}`, serializedData);
            } catch (_retryError) {
                // Ignore quota/cache failures silently to avoid flooding the console.
            }
        }
    },
    get: (endpoint) => {
        try {
            const normalizedEndpoint = CacheManager.normalizeEndpoint(endpoint);
            if (!normalizedEndpoint) return null;
            const cached = localStorage.getItem(`erp_cache_${normalizedEndpoint}`);
            return cached ? JSON.parse(cached) : null;
        } catch (e) {
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
        } catch (e) {
            console.warn('Falha ao enfileirar requisição offline');
        }
    },
    getQueue: () => {
        try {
            return JSON.parse(localStorage.getItem('erp_sync_queue') || '[]');
        } catch (e) {
            return [];
        }
    },
    clearQueue: () => {
        localStorage.removeItem('erp_sync_queue');
    },
    setQueue: (queue) => {
        try {
            localStorage.setItem('erp_sync_queue', JSON.stringify(queue));
        } catch (_error) {
            // Ignore storage failures.
        }
    },
    processQueue: async () => {
        const queue = SyncManager.getQueue();
        if (queue.length === 0) return;

        console.log(`[Offline Mode] Processando fila de sincronização: ${queue.length} itens.`);
        let hasErrors = false;
        const remainingQueue: any[] = [];

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
                    hasErrors = true;
                    remainingQueue.push(req);
                }
            } catch (error) {
                console.error(`A rede falhou novamente ao sincronizar: ${req.endpoint}`);
                hasErrors = true;
                remainingQueue.push(req);
                break; // Stop and keep remaining queue for next attempt.
            }
        }

        if (!hasErrors) {
            SyncManager.clearQueue();
            if (typeof UI !== 'undefined' && UI.showAlert) {
                try { UI.showAlert('alertMessage', 'Você voltou a ficar Online. Todos os dados salvos offline foram sincronizados com sucesso!', 'success', 6000); } catch(e){}
            }
        } else {
            console.warn('Alguns dados não puderam ser sincronizados.');
            SyncManager.setQueue(remainingQueue);
            if (typeof UI !== 'undefined' && UI.showAlert) {
                try { UI.showAlert('alertMessage', 'Conexão restabelecida, mas alguns dados não puderam ser sincronizados (possível conflito de validação).', 'warn', 6000); } catch(e){}
            }
        }
    }
};

window.addEventListener('online', () => {
    if (SyncManager.getQueue().length > 0) {
        if (typeof UI !== 'undefined' && UI.showAlert) {
            try { UI.showAlert('alertMessage', 'Conexão restabelecida! Iniciando sincronização em background...', 'success', 5000); } catch(e){}
        }
        SyncManager.processQueue();
    }
});

if (navigator.onLine && SyncManager.getQueue().length > 0) {
    setTimeout(() => {
        SyncManager.processQueue();
    }, 1500);
}

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
    if (!headers) return {};

    if (headers instanceof Headers) {
        const obj: Record<string, string> = {};
        headers.forEach((value, key) => {
            obj[key] = value;
        });
        return obj;
    }

    if (Array.isArray(headers)) {
        return Object.fromEntries(headers);
    }

    return headers as Record<string, string>;
}

// Generic Fetch Wrapper
const api = async (endpoint: string, options: RequestInit = {}) => {
    const defaultHeaders: Record<string, string> = {
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

    const config: RequestInit & { headers: Record<string, string> } = {
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

        let data: any = null;
        // Avoid crashing on 204 No Content since body is completely empty
        if (response.status !== 204) {
            const contentType = response.headers.get('Content-Type') || '';
            if (contentType.includes('application/json')) {
                data = await response.json();
            } else {
                // Try JSON anyway (some servers omit or vary Content-Type)
                const text = await response.text();
                try {
                    data = JSON.parse(text);
                } catch (_) {
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
            let errorMsg: string | null = null;
            if (data && typeof data === 'object') {
                const anyData = data as any;
                errorMsg = anyData.message || anyData.error || anyData.details || null;

                if (!errorMsg && Array.isArray(anyData.errors) && anyData.errors.length > 0) {
                    errorMsg = anyData.errors
                        .map((e: any) => e?.message)
                        .filter(Boolean)
                        .join('; ');
                }
            }

            if (!errorMsg) errorMsg = 'Erro na requisição';
            console.error('[API Error]', response.status, endpoint, data);
            throw new Error(errorMsg);
        }

        // Cache successful GET requests
        if (!options.method || options.method.toUpperCase() === 'GET') {
            CacheManager.save(endpoint, data);
        }

        return data;
    } catch (error) {
        // Fallback to cache for GET requests or Queue for POST/PUT if offline
        const method = options.method ? options.method.toUpperCase() : 'GET';
        const isGet = (method === 'GET');
        const isAuthMutation = !isGet && /^\/auth\/(login|register)$/.test(endpoint);

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
                            try { UI.showAlert('alertMessage', 'Você está offline. Exibindo dados de cache baseados na sua última sincronização com a internet.', 'warn', 5000); } catch(e){}
                        }
                    }, 500);
                    return cachedData;
                } else {
                    throw new Error('Você está sem internet e não possui dados baixados para exibir nesta tela.');
                }
            } else if (isAuthMutation) {
                Auth.clearToken();
                throw new Error('Não foi possível conectar ao servidor para autenticar o usuário. Verifique a conexão e tente novamente.');
            } else {
                 // Sincronização offline
                 console.warn(`[Offline Mode] Salvando requisição ${method} localmente na fila: ${endpoint}`);
                 
                  SyncManager.enqueue({ endpoint, method, headers: config.headers, body: options.body });
                 
                 setTimeout(() => {
                     if (typeof UI !== 'undefined' && UI.showAlert) {
                         try { UI.showAlert('alertMessage', 'Você está offline. Os dados foram salvos magicamente no seu dispositivo e serão sincronizados com a nuvem quando a conexão voltar.', 'success', 8000); } catch(e){}
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
    _alertTimers: {} as Record<string, ReturnType<typeof setTimeout>>,
    showAlert: (elementId, message, type = 'error', durationMillis = 15000) => {
        const el = document.getElementById(elementId);
        if (!el) return;

        el.textContent = message;
        el.classList.remove(
            'hidden',
            // error
            'bg-red-100',    'text-red-700',
            'dark:bg-red-900/40', 'dark:text-red-300',
            // success
            'bg-green-100',  'text-green-700',
            'dark:bg-green-900/40', 'dark:text-green-300',
            // warn
            'bg-yellow-100', 'text-yellow-800',
            'dark:bg-yellow-900/40', 'dark:text-yellow-300',
        );

        if (type === 'error') {
            el.classList.add('bg-red-100', 'text-red-700', 'dark:bg-red-900/40', 'dark:text-red-300');
        } else if (type === 'warn' || type === 'warning') {
            el.classList.add('bg-yellow-100', 'text-yellow-800', 'dark:bg-yellow-900/40', 'dark:text-yellow-300');
        } else {
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
        if (el) el.classList.add('hidden');
    }
};


// ==========================================
// Theme (Light/Dark Mode) Handler
// ==========================================
function initTheme() {
    const htmlDecl = document.documentElement;
    // Padrão atualizado para "dark", a pedido do usuário
    const currentTheme = localStorage.getItem('theme') || 'dark';

    if (currentTheme === 'dark') {
        htmlDecl.classList.add('dark');
    } else {
        htmlDecl.classList.remove('dark');
    }
}


// Run init immediately on load to prevent blinding flash
initTheme();

// Expor helpers no escopo global (vários módulos públicos usam window.*)
window.Auth = Auth;
window.api = api;
window.UI = UI;
window.CacheManager = CacheManager;
window.SyncManager = SyncManager;

