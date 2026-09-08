// sw.js — app works with no signal.
//
// Bump CACHE_VERSION whenever a change is made to any file below, or phones will
// keep serving the old copy from cache.

const CACHE_VERSION = 'shift-report-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/state.js',
  './js/db.js',
  './js/photos.js',
  './js/render.js',
  './js/email.js',
  './js/backup.js',
  './js/lock.js',
  './js/ui.js'
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evt => {
  if (evt.request.method !== 'GET') return;
  evt.respondWith(
    caches.match(evt.request).then(hit => hit || fetch(evt.request).then(res => {
      // Cache same-origin responses so a first visit while online primes
      // everything for later.
      if (res.ok && new URL(evt.request.url).origin === self.location.origin) {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(evt.request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
