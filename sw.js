/* MR ALL IN Personal PWA shell cache.
 * Never cache Supabase auth/rest responses or any response containing personal finance data.
 */
const CACHE_NAME = 'mrall-personal-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/style.css',
  './assets/js/app.js',
  './assets/js/pwa.js',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/img/icon-192-maskable.png',
  './assets/img/icon-512-maskable.png',
  './assets/img/apple-touch-icon.png',
  './assets/img/hero-sunset.jpg',
  './assets/img/dream-home.jpg',
  './assets/img/dream-car.jpg',
  './assets/img/dream-japan.jpg',
  './assets/img/dream-setup.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('mrall-personal-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase/CDN are deliberately not cached.

  const isNavigation = request.mode === 'navigate';
  const isCodeOrManifest = /\.(?:html|css|js|webmanifest)$/.test(url.pathname);
  if (!isNavigation && !isCodeOrManifest && !/\.(?:png|jpe?g|webp|svg|ico)$/.test(url.pathname)) return;

  if (isNavigation || isCodeOrManifest) {
    // Network-first so deployments show fresh code; cached shell is only the fallback.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      } catch (error) {
        const cached = await caches.match(request, { ignoreSearch: true }) || await caches.match('./index.html');
        if (cached) return cached;
        throw error;
      }
    })());
    return;
  }

  // Artwork/icons use cache-first, then refresh the cache when online.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const update = fetch(request).then(response => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    }).catch(() => cached);
    return cached || update;
  })());
});
