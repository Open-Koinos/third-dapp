// service-worker.js
const CACHE_NAME = 'koinos-wallet-tracker-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/app-controller.js',
  '/js/wallet-service.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/maskable-icon.png',
  'https://cdn.jsdelivr.net/npm/@picocss/pico@1/css/pico.min.css',
  'https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js',
  '/js/base/koinos.min.js',
  '/js/base/kondor.min.js'
];

// Install event - cache assets
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.filter(cacheName => {
            return cacheName !== CACHE_NAME;
          }).map(cacheName => {
            console.log('[ServiceWorker] Removing old cache', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - network-first strategy for API calls, cache-first for static assets
self.addEventListener('fetch', event => {
  const requestURL = new URL(event.request.url);
  
  // Skip cross-origin requests except for CDNs we cache
  if (requestURL.origin !== location.origin && 
      !ASSETS_TO_CACHE.some(asset => event.request.url.includes(asset))) {
    return;
  }
  
  // For API calls, use network first strategy
  if (event.request.url.includes('api.koinos.io') || 
      requestURL.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone the response for caching
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          return response;
        })
        .catch(() => {
          // If network fails, try to get from cache
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // For navigation requests, try network first but fall back to index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }
  
  // For static assets, use cache first strategy
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request)
          .then(response => {
            // Don't cache non-successful responses or non-basic responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response to cache it
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(error => {
            console.error('[ServiceWorker] Fetch error:', error);
            
            // For navigation, return the index page as fallback
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            
            return null;
          });
      })
  );
});

// Handle messages from client
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});