"use strict";
/// <reference lib="webworker" />
const sw = self;
const CACHE_NAME = 'keystone-pwa-v20260607183424';
const ASSETS_TO_CACHE = [
    '/index.html',
    '/register.html',
    '/manifest.json',
    '/build.json',
    '/favicon.ico',
    '/img/icon-192x192-v3.png',
    '/img/icon-512x512-v3.png',
    '/img/logo.png',
    '/vendor/forge.min.js',
    '/components/nav.html',
    '/css/style.css',
    '/js/pwa.js',
    '/js/api.js',
    '/js/components/navbar.js',
    '/js/components/footer.js',
    '/js/login.js',
    '/js/register.js',
    '/pages/dashboard.html',
    '/',
];
function normalizeCacheKey(requestOrUrl) {
    const rawUrl = typeof requestOrUrl === 'string' ? requestOrUrl : requestOrUrl.url;
    const url = new URL(rawUrl, sw.location.origin);
    if (url.origin !== sw.location.origin) {
        return null;
    }
    const normalizedPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const isHtmlRequest = normalizedPath.endsWith('.html') || normalizedPath === '/index.html';
    const hasFileExtension = /\.[a-z0-9]+$/i.test(normalizedPath);
    // Para HTML e assets estáticos (ex: .js, .css, imagens), ignoramos querystring para evitar
    // duplicidade no cache (ex: /components/nav.html?v=... ou /js/pwa.js?v=...).
    if (isHtmlRequest || hasFileExtension) {
        return normalizedPath;
    }
    return `${normalizedPath}${url.search}`;
}
async function matchCachedResponse(request) {
    const cacheKey = normalizeCacheKey(request);
    if (!cacheKey)
        return undefined;
    return caches.match(cacheKey);
}
async function storeCachedResponse(request, response) {
    const cacheKey = normalizeCacheKey(request);
    if (!cacheKey)
        return;
    const cache = await caches.open(CACHE_NAME);
    await cache.put(cacheKey, response);
}
sw.addEventListener('install', (event) => {
    event.waitUntil(caches
        .open(CACHE_NAME)
        .then((cache) => cache.addAll(ASSETS_TO_CACHE))
        .then(() => sw.skipWaiting()));
});
sw.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys().then((cacheNames) => Promise.all(cacheNames.map((cacheName) => {
        if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
        }
        return undefined;
    }))));
    sw.clients.claim();
});
sw.addEventListener('message', (event) => {
    const data = event.data;
    if (data?.type === 'SKIP_WAITING') {
        sw.skipWaiting();
    }
});
sw.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return;
    }
    if (url.origin !== sw.location.origin) {
        return;
    }
    if (event.request.method !== 'GET' || event.request.url.includes('/api/v1/')) {
        return;
    }
    // Evita "versão presa" por cache: estes arquivos devem refletir o deploy imediatamente.
    // (mesmo quando os HTMLs usam `?v=` fixo e o SW faria cache-first)
    if (url.pathname === '/build.json'
        || url.pathname.startsWith('/js/')
        || url.pathname.endsWith('.js')
        || url.pathname === '/css/style.css'
        || url.pathname === '/js/components/footer.js'
        || url.pathname === '/js/components/navbar.js'
        || url.pathname === '/js/api.js'
        || url.pathname === '/components/nav.html') {
        event.respondWith(fetch(event.request)
            .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                storeCachedResponse(event.request, networkResponse.clone());
            }
            return networkResponse;
        })
            .catch(() => matchCachedResponse(event.request).then((cachedResponse) => cachedResponse || Response.error())));
        return;
    }
    if (event.request.mode === 'navigate'
        || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
        event.respondWith(fetch(event.request)
            .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                storeCachedResponse(event.request, networkResponse.clone());
            }
            return networkResponse;
        })
            .catch(() => matchCachedResponse(event.request).then((cachedResponse) => {
            if (cachedResponse)
                return cachedResponse;
            return caches.match('/index.html').then((fallback) => fallback || Response.error());
        })));
        return;
    }
    event.respondWith(matchCachedResponse(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                storeCachedResponse(event.request, networkResponse.clone());
            }
            return networkResponse;
        })
            .catch(() => Response.error());
        return cachedResponse || fetchPromise;
    }));
});
