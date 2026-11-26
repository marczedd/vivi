'use strict';

// Cache the app shell for offline launches after the first successful visit.
const CACHE = 'vivi-app-v3';
const FILES = [
    './', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
    'assets/egg.png', 'assets/egg-strawberry.png', 'assets/egg-garden.png',
    'assets/settings.png', 'assets/water.png', 'assets/love.png',
    'assets/logo.png', 'assets/happy.gif', 'assets/loved.png', 'assets/Vivi_loved.gif',
    'assets/patrick-hand.ttf', 'assets/icon-192.png', 'assets/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys().then(async (keys) => {
        await Promise.all(keys.filter((key) => key.startsWith('vivi-app-') && key !== CACHE)
            .map((key) => caches.delete(key)));
        await self.clients.claim();
    }));
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
    event.respondWith(fetch(event.request).then((response) => {
        if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
        }
        return response;
    }).catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('index.html');
        return Response.error();
    }));
});
