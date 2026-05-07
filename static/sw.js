const CACHE_NAME = 'rentals-v1';
const BASE = '/rentals';

// App shell files to cache on install
const APP_SHELL = [
    `${BASE}/`,
    `${BASE}/index.html`
];

// Install: cache the app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // API calls (Google Sheets, Drive, OAuth): network only, don't cache
    if (
        url.hostname === 'sheets.googleapis.com' ||
        url.hostname === 'www.googleapis.com' ||
        url.hostname === 'accounts.google.com' ||
        url.hostname === 'oauth2.googleapis.com'
    ) {
        return;
    }

    // App assets: stale-while-revalidate
    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cached = await cache.match(event.request);
            const fetchPromise = fetch(event.request)
                .then((response) => {
                    // Only cache successful responses from our origin
                    if (response.ok && url.origin === self.location.origin) {
                        cache.put(event.request, response.clone());
                    }
                    return response;
                })
                .catch(() => cached); // Fallback to cache if offline

            return cached || fetchPromise;
        })
    );
});
