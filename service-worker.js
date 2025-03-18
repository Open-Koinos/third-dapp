const CACHE_NAME = 'koinos-wallet-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-icon.png',
  'https://cdn.jsdelivr.net/npm/@picocss/pico@1/css/pico.min.css',
  'https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js'
];

// Install event - cache assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Install');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching all assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Removing old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - network-first, falling back to cache
self.addEventListener('fetch', event => {
  // Parse the URL
  const requestURL = new URL(event.request.url);
  
  // Skip cross-origin requests like the token list API
  if (requestURL.origin !== location.origin) {
    return;
  }
  
  // Handle API calls differently (don't cache)
  if (requestURL.pathname.includes('/api/')) {
    return;
  }
  
  // For page navigations, use network-first strategy
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match('/index.html');
        })
    );
    return;
  }
  
  // For all other requests, use cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached response if found
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Otherwise try to fetch from network
        return fetch(event.request)
          .then(networkResponse => {
            // Don't cache invalid responses
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            // Clone the response since we need to use it twice
            const responseToCache = networkResponse.clone();
            
            // Open cache and store the new response
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
              
            return networkResponse;
          })
          .catch(() => {
            // Return the offline page for navigation requests
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
