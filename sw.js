// ==================== SERVICE WORKER ====================
const CACHE_NAME = 'airline-manager-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/main.js',
  './js/game.js',
  './js/data.js',
  './js/utils.js',
  './js/ui.js',
  './js/airlines.js',
  './js/routes.js',
  './js/loans.js',
  './js/events.js',
  './js/map.js',
  './js/prestige.js',
  './js/audio.js'
];

// ==================== INSTALL ====================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker installed');
        return self.skipWaiting();
      })
  );
});

// ==================== ACTIVATE ====================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('🗑️ Removing old cache:', key);
            return caches.delete(key);
          })
      );
    })
    .then(() => {
      console.log('✅ Service Worker activated');
      return self.clients.claim();
    })
  );
});

// ==================== FETCH ====================
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return event.respondWith(fetch(event.request));
  }

  // Skip external resources (CDN)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return event.respondWith(fetch(event.request));
  }

  // Skip if request is for analytics or non-critical
  if (url.pathname.includes('analytics') || url.pathname.includes('telemetry')) {
    return event.respondWith(fetch(event.request));
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached response if available
        if (cachedResponse) {
          // Update cache in background for fresh content
          fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.ok) {
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(event.request, networkResponse));
              }
            })
            .catch(() => { /* Network error, ignore */ });
          return cachedResponse;
        }

        // If not in cache, fetch from network
        return fetch(event.request)
          .then(networkResponse => {
            // Cache the response for future
            if (networkResponse && networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseClone))
                .catch(() => { /* Cache error, ignore */ });
            }
            return networkResponse;
          })
          .catch(() => {
            // Offline fallback for HTML pages
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }
            return new Response('Offline - content not available', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// ==================== MESSAGE HANDLING ====================
self.addEventListener('message', event => {
  const data = event.data;
  
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME)
      .then(() => {
        event.ports[0].postMessage({ success: true });
      });
  }
});

// ==================== PUSH NOTIFICATIONS ====================
self.addEventListener('push', event => {
  const options = {
    body: event.data?.text() || '✈️ Your flights are ready!',
    icon: './assets/icons/icon-192.png',
    badge: './assets/icons/icon-72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      { action: 'open', title: 'Open Game' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('✈️ Airline Manager', options)
  );
});

// ==================== NOTIFICATION CLICK ====================
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Focus existing window or open new one
        for (let client of windowClients) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('./');
        }
      })
  );
});