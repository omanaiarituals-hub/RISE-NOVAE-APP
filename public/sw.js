const CACHE_NAME = 'novae-v2'
const STATIC_ASSETS = ['/', '/manifest.json', '/icons/icon-192x192.png', '/icons/icon-512x512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ))
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('supabase.co')) return
  if (e.request.url.includes('onesignal.com')) return
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.ok && e.request.method === 'GET') {
          const c = r.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, c))
        }
        return r
      })
      .catch(() => caches.match(e.request))
  )
})

// ── NOTIFICATIONS PUSH en arrière-plan ──
self.addEventListener('push', (e) => {
  if (!e.data) return
  let data = {}
  try { data = e.data.json() } catch { data = { title: 'NOVAÉ', body: e.data.text() } }

  const options = {
    body: data.body || 'Tu as un nouveau message de NOVAÉ',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Ouvrir NOVAÉ' },
      { action: 'close', title: 'Plus tard' }
    ]
  }
  e.waitUntil(self.registration.showNotification(data.title || 'NOVAÉ ✦', options))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  if (e.action === 'close') return
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})