// ==================== SERVICE WORKER ====================
const CACHE_NAME = 'airline-manager-v4';
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


/* ==================== FETCH ==================== */
self.addEventListener('fetch', event => {
  const request = event.request;

  // Only handle GET requests.
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Leave external resources to the browser.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Do not cache analytics or telemetry.
  if (
    url.pathname.includes('analytics') ||
    url.pathname.includes('telemetry')
  ) {
    return;
  }

  // Network first: prefer the newest available version.
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.ok) {
          const responseToCache = response.clone();

          event.waitUntil(
            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, responseToCache))
              .catch(error => {
                console.warn('Cache update failed:', error);
              })
          );
        }

        return response;
      })
      .catch(async () => {
        // If offline, use the cached response.
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
          return cachedResponse;
        }

        // Fallback for offline page navigation.
        if (request.mode === 'navigate') {
          const offlinePage = await caches.match('./index.html');

          if (offlinePage) {
            return offlinePage;
          }
        }

        return new Response(
          'Offline - this resource is not available.',
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: {
              'Content-Type': 'text/plain; charset=utf-8'
            }
          }
        );
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
