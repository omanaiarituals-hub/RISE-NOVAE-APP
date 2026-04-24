const CACHE_NAME = 'novae-v1'
const STATIC_ASSETS = ['/', '/manifest.json', '/icons/icon-192x192.png', '/icons/icon-512x512.png']

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS))); self.skipWaiting() })
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))); self.clients.claim() })
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('supabase.co')) return
  e.respondWith(fetch(e.request).then(r => { if (r.ok && e.request.method === 'GET') { const c = r.clone(); caches.open(CACHE_NAME).then(cache => cache.put(e.request, c)) } return r }).catch(() => caches.match(e.request)))
})