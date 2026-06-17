const CACHE_NAME = 'airline-manager-v1';
const CORE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];
const CDN_URLS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // 1. Кеширане на задължителните файлове (атомарно)
      await cache.addAll(CORE_URLS);
      
      // 2. Опит за кеширане на CDN (не блокира, ако fail-не)
      try {
        await cache.addAll(CDN_URLS);
      } catch (e) {
        console.log('⚠️ CDN files not cached (will load from network)');
      }
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});