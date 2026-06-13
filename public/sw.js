const CACHE_NAME = 'certiverify-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/verify.html',
  '/login.html',
  '/css/styles.css',
  '/css/dashboard.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/dashboard.js'
];

// Install Service Worker
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Pre-caching static assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).catch(err => console.error('SW: Cache error:', err))
  );
});

// Activate Service Worker
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('SW: Cleaning old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Intercept Network Requests
self.addEventListener('fetch', (e) => {
  // Only cache GET requests and ignore API routes or websocket connections
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(e.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        
        // Cache dynamic pages / files if fetched
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, networkResponse.clone());
          return networkResponse;
        });
      }).catch((err) => {
        console.warn('SW: Fetch error (offline mode):', err);
      });
    })
  );
});
