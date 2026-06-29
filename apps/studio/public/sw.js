const CACHE = 'studio-shell-v1';
const ASSETS = ['/', '/manifest.webmanifest', '/icons/icon.svg'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') event.respondWith(fetch(event.request).catch(() => caches.match('/')));
  else event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
