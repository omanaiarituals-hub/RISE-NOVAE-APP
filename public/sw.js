// =============================================================
// NOVAÉ Service Worker — Web Push natif
// Pas de SDK externe, juste les API W3C standard
// =============================================================

// Activation immediate du nouveau SW (force update sur les anciens devices)
self.addEventListener('install', (event) => {
  console.log('[SW] Install — skipWaiting');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate — claiming clients');
  event.waitUntil(self.clients.claim());
});

// =============================================================
// RECEPTION D'UN PUSH
// =============================================================
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  let payload = {
    title: 'NOVAÉ',
    body: 'Tu as une nouvelle notification',
    icon: '/novae-icon.svg',
    badge: '/novae-icon.svg',
    url: '/',
  };

  // Le serveur envoie un JSON dans event.data
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch (err) {
      console.error('[SW] Erreur parse payload:', err);
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    data: { url: payload.url },
    tag: payload.tag || 'novae-default',
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// =============================================================
// CLIC SUR UNE NOTIFICATION
// =============================================================
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si l'app est deja ouverte, on focus l'onglet et on navigue
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      // Sinon on ouvre une nouvelle fenetre
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// =============================================================
// FERMETURE D'UNE NOTIF (analytics futurs)
// =============================================================
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification fermee');
});