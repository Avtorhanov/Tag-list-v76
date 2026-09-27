const CACHE_NAME = 'tag-list-v67-8-structured-final-published';
const APP_SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/ocr.js',
  './manifest.webmanifest',
  './manifest.webmanifest',
  './css/app.css',
  './js/storage.js',
  './js/tags.js',
  './js/export.js',
  './js/ocr-utils.js',
  './js/import.js',
  './js/ui.js',
  './js/app.js',
  './favicon-64.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
        return response;
      }).catch(() => caches.match(request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      }).catch(() => Response.error());
    })
  );
});
