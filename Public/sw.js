// CabShop Pro Service Worker - minimal version
const CACHE_NAME = 'cabshoppro-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network only - no caching to avoid issues
self.addEventListener('fetch', (event) => {
  if (event.request.url.startsWith('chrome-extension')) return;
  // Just pass through to network
});
