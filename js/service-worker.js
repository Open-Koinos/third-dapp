// service-worker.js
const CACHE_NAME = 'koinos-wallet-tracker-v1';

// Updated list of essential files that should exist
const ESSENTIAL_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/ui-controller.js',
  '/js/wallet-service.js',
  '/js/kondor-init.js',
  '/js/crypto-polyfill.js'
];

// Optional assets that may not exist in all deployments
const OPTIONAL_ASSETS = [
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/maskable-icon.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@4.5.2/dist/js/bootstrap.bundle.min.js',
  'https://code.jquery.com/jquery-3.6.0.min.js',
  'https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css',
  '/js/base/koinos.min.js',
  '/js/base/kondor.min.js'
];

// Install event - cache assets
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Install');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching essential assets');
        
        // First, cache the essential assets (and ignore failures)
        return cache.addAll(ESSENTIAL_ASSETS)
          .catch(error => {
            console.error('[ServiceWorker] Failed to cache essential assets:', error);
            // Continue despite errors to avoid blocking service worker installation
          })
          .then(() => {
            console.log('[ServiceWorker] Adding optional assets individually');
            
            // Then try to cache each optional asset individually
            const cachePromises = OPTIONAL_ASSETS.map(url => {
              return cache.add(url)
                .catch(error => {
                  console.log(`[ServiceWorker] Failed to cache optional asset ${url}:`, error);
                  // Continue despite errors
                });
            });
            
            return Promise.all(cachePromises);
          });
      })
      .then(() => {
        console.log('[ServiceWorker] Install completed');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[ServiceWorker] Install failed:', error);
        // Continue despite errors to avoid blocking service worker installation
        return self.skipWaiting();
      })
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
      .catch(error => {
        console.error('[ServiceWorker] Activate error:', error);
      })
  );
});

// Helper to determine if a request is an API call
function isApiRequest(url) {
  return url.includes('api.koinos.io') || url.pathname.includes('/api/');
}

// Fetch event - network-first strategy for API calls, cache-first for static assets
self.addEventListener('fetch', event => {
  const requestURL = new URL(event.request.url);
  
  // Skip cross-origin requests except for CDNs we specifically include
  const isThirdParty = requestURL.origin !== location.origin;
  const isCachedThirdParty = OPTIONAL_ASSETS.some(asset => event.request.url.includes(asset));
  
  if (isThirdParty && !isCachedThirdParty) {
    return;
  }
  
  // For API calls, use network first strategy
  if (isApiRequest(requestURL)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone the response for caching
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            })
            .catch(error => {
              console.error('[ServiceWorker] Error caching API response:', error);
            });
          return response;
        })
        .catch(() => {
          // If network fails, try to get from cache
          return caches.match(event.request)
            .catch(error => {
              console.error('[ServiceWorker] Error retrieving cached API response:', error);
              // Return a basic error response if all else fails
              return new Response('Network error occurred', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({
                  'Content-Type': 'text/plain'
                })
              });
            });
        })
    );
    return;
  }
  
  // For navigation requests, try network first but fall back to index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('/index.html')
          .catch(error => {
            console.error('[ServiceWorker] Error retrieving cached navigation:', error);
            return new Response('App is currently offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          })
        )
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
              })
              .catch(error => {
                console.error('[ServiceWorker] Error caching fetch response:', error);
              });
            
            return response;
          })
          .catch(error => {
            console.error('[ServiceWorker] Fetch error:', error);
            
            // For images, return a placeholder if available
            if (event.request.destination === 'image') {
              return caches.match('/icons/placeholder.png')
                .catch(() => null);
            }
            
            return null;
          });
      })
      .catch(error => {
        console.error('[ServiceWorker] Cache match error:', error);
        return null;
      })
  );
});

// Handle messages from client
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});