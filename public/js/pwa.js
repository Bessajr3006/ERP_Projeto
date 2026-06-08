let deferredPrompt;
let installButtonsObserverStarted = false;
const PWA_DEV_RESET_KEY = 'keystone_dev_sw_reset';
const PWA_FORCE_RESET_KEY = 'keystone_sw_force_reset_20260601';
const PWA_THEME_COLOR = '#5283AE';
const PWA_APP_NAME = 'KEYSTONE';
const FAVICON_PATH = '/favicon.ico';
const APPLE_ICON_PATH = '/img/icon-192x192-v3.png';
const IS_LOCAL_DEV_HOST = ['localhost', '127.0.0.1'].includes(window.location.hostname);
ensurePwaHead();
window.createMaskAdapter = createMaskAdapter;
if ('serviceWorker' in navigator) {
    if (IS_LOCAL_DEV_HOST) {
        window.addEventListener('load', async () => {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                const hasRegistrations = registrations.length > 0;
                await Promise.all(registrations.map((registration) => registration.unregister()));
                if ('caches' in window) {
                    const cacheNames = await window.caches.keys();
                    await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
                }
                if (hasRegistrations && !sessionStorage.getItem(PWA_DEV_RESET_KEY)) {
                    sessionStorage.setItem(PWA_DEV_RESET_KEY, '1');
                    // Não recarregar — evita flicker do footer/navbar em dev
                    // window.location.reload();
                    return;
                }
                sessionStorage.removeItem(PWA_DEV_RESET_KEY);
                console.log('KEYSTONE PWA disabled for local development host.');
            }
            catch (error) {
                console.error('KEYSTONE failed to disable service workers in local development:', error);
            }
        });
    }
    else {
        window.addEventListener('load', async () => {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map((registration) => registration.unregister()));
                if ('caches' in window) {
                    const cacheNames = await window.caches.keys();
                    await Promise.all(cacheNames
                        .filter((cacheName) => cacheName.startsWith('keystone-pwa-'))
                        .map((cacheName) => window.caches.delete(cacheName)));
                }
                if (navigator.serviceWorker.controller && !sessionStorage.getItem(PWA_FORCE_RESET_KEY)) {
                    sessionStorage.setItem(PWA_FORCE_RESET_KEY, '1');
                    window.location.reload();
                    return;
                }
                console.log('KEYSTONE ServiceWorker disabled for production reset.');
            }
            catch (error) {
                console.error('KEYSTONE failed to reset service workers:', error);
            }
        });
    }
}
window.addEventListener('beforeinstallprompt', (e) => {
    const installButtons = Array.from(document.querySelectorAll('.pwaInstallBtn'));
    const hasVisibleInstallButton = installButtons.some((btn) => {
        const style = window.getComputedStyle(btn);
        const isHidden = btn.classList.contains('hidden') || style.display === 'none' || style.visibility === 'hidden';
        return !isHidden;
    });
    if (!hasVisibleInstallButton) {
        // Sem CTA customizado, deixa o navegador seguir com o comportamento padrão.
        deferredPrompt = null;
        return;
    }
    e.preventDefault();
    deferredPrompt = e;
    refreshInstallButtons();
});
document.addEventListener('DOMContentLoaded', () => {
    ensurePwaHead();
    startInstallButtonsObserver();
    refreshInstallButtons();
});
window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    console.log('PWA was installed');
    refreshInstallButtons();
});
function ensurePwaHead() {
    const viewport = ensureMetaTag('viewport');
    const viewportTokens = new Set((viewport.getAttribute('content') || 'width=device-width, initial-scale=1.0')
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean));
    viewportTokens.add('width=device-width');
    viewportTokens.add('initial-scale=1.0');
    viewportTokens.add('viewport-fit=cover');
    viewport.setAttribute('content', Array.from(viewportTokens).join(', '));
    ensureMetaTag('theme-color', PWA_THEME_COLOR);
    ensureMetaTag('mobile-web-app-capable', 'yes');
    ensureMetaTag('apple-mobile-web-app-capable', 'yes');
    ensureMetaTag('apple-mobile-web-app-status-bar-style', 'default');
    ensureMetaTag('apple-mobile-web-app-title', PWA_APP_NAME);
    ensureLinkTag('icon', FAVICON_PATH);
    ensureLinkTag('apple-touch-icon', APPLE_ICON_PATH);
}
function ensureMetaTag(name, content = '') {
    let tag = document.head.querySelector(`meta[name="${name}"]`);
    if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', name);
        document.head.appendChild(tag);
    }
    if (content) {
        tag.setAttribute('content', content);
    }
    return tag;
}
function ensureLinkTag(rel, href) {
    let tag = document.head.querySelector(`link[rel="${rel}"]`);
    if (!tag) {
        tag = document.createElement('link');
        tag.setAttribute('rel', rel);
        document.head.appendChild(tag);
    }
    tag.setAttribute('href', href);
    return tag;
}
function startInstallButtonsObserver() {
    if (installButtonsObserverStarted || !document.body)
        return;
    installButtonsObserverStarted = true;
    const observer = new MutationObserver(() => {
        if (document.querySelector('.pwaInstallBtn')) {
            refreshInstallButtons();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}
function refreshInstallButtons() {
    const installBtns = document.querySelectorAll('.pwaInstallBtn');
    const iOSInstallMode = isIosInstallAvailable();
    installBtns.forEach((btn) => {
        if (deferredPrompt) {
            btn.classList.remove('hidden');
            bindInstallButton(btn, 'prompt', async () => {
                if (!deferredPrompt)
                    return;
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                deferredPrompt = null;
                refreshInstallButtons();
            });
            return;
        }
        if (iOSInstallMode) {
            btn.classList.remove('hidden');
            bindInstallButton(btn, 'ios', () => {
                alert('No iPhone/iPad, use Compartilhar > Adicionar à Tela de Início para instalar o KEYSTONE.');
            });
            return;
        }
        btn.classList.add('hidden');
        btn.onclick = null;
        delete btn.dataset.pwaMode;
    });
}
function bindInstallButton(btn, mode, handler) {
    if (btn.dataset.pwaMode === mode)
        return;
    btn.dataset.pwaMode = mode;
    btn.onclick = handler;
}
function isIosInstallAvailable() {
    const ua = window.navigator.userAgent || '';
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    return isIOS && !isStandalone;
}
function createMaskAdapter(input, options = {}) {
    if (!input)
        return null;
    if (typeof window.IMask === 'function') {
        return window.IMask(input, options);
    }
    const patterns = normalizeMaskPatterns(options.mask);
    const completeListeners = [];
    const applyFormattedValue = (rawValue) => {
        const digits = String(rawValue || '').replace(/\D/g, '');
        const pattern = chooseMaskPattern(patterns, digits.length);
        input.value = formatDigitsWithPattern(digits, pattern);
        if (pattern && digits.length === countMaskSlots(pattern)) {
            completeListeners.forEach((listener) => listener());
        }
    };
    input.addEventListener('input', () => {
        applyFormattedValue(input.value);
    });
    return {
        get value() {
            return input.value || '';
        },
        set value(nextValue) {
            applyFormattedValue(nextValue || '');
        },
        get unmaskedValue() {
            return (input.value || '').replace(/\D/g, '');
        },
        set unmaskedValue(nextValue) {
            applyFormattedValue(nextValue || '');
        },
        updateValue() {
            applyFormattedValue(input.value);
        },
        on(eventName, listener) {
            if (eventName === 'complete' && typeof listener === 'function') {
                completeListeners.push(listener);
            }
        }
    };
}
function normalizeMaskPatterns(maskOption) {
    if (Array.isArray(maskOption)) {
        return maskOption
            .map((entry) => (typeof entry === 'string' ? entry : entry && entry.mask))
            .filter(Boolean);
    }
    if (typeof maskOption === 'string') {
        return [maskOption];
    }
    if (maskOption && typeof maskOption.mask === 'string') {
        return [maskOption.mask];
    }
    return ['0000000000000000'];
}
function chooseMaskPattern(patterns, digitsLength) {
    if (!patterns.length)
        return null;
    const ordered = [...patterns].sort((left, right) => countMaskSlots(left) - countMaskSlots(right));
    return ordered.find((pattern) => digitsLength <= countMaskSlots(pattern)) || ordered[ordered.length - 1];
}
function countMaskSlots(pattern) {
    return (pattern.match(/0/g) || []).length;
}
function formatDigitsWithPattern(digits, pattern) {
    if (!pattern)
        return digits;
    let formatted = '';
    let digitIndex = 0;
    for (const token of pattern) {
        if (token === '0') {
            if (digitIndex >= digits.length)
                break;
            formatted += digits[digitIndex];
            digitIndex += 1;
            continue;
        }
        if (digitIndex < digits.length) {
            formatted += token;
        }
    }
    return formatted;
}
