// Service Worker for JEE Study Companion PWA
const CACHE_NAME = 'jee-companion-v2';
const RUNTIME_CACHE = 'jee-companion-runtime';

// Files to cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // API requests - network only
  if (event.request.url.includes('/api/') || event.request.url.includes('/trpc/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For other requests - network first, cache fallback
  event.respondWith(
    caches.open(RUNTIME_CACHE).then((cache) => {
      return fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => {
          return cache.match(event.request);
        });
    })
  );
});

// ─── Push Notifications (Remote Call Bridge) ───

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'AuraRing', body: event.data?.text() || 'New notification' };
  }

  const title = data.title || 'AuraRing Remote Bridge';
  const isCall = data.tag === 'incoming-call' && !data.title?.includes('Ended');

  const options = {
    body: data.body || 'New update',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: data,
    tag: data.tag || 'default',
    renotify: true,
    requireInteraction: isCall, // Keep call notifications until user interacts
    vibrate: isCall ? [200, 100, 200, 100, 200, 100, 200] : [200],
    actions: isCall ? [
      { action: 'answer', title: '✅ Answer' },
      { action: 'decline', title: '❌ Decline' },
    ] : [],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const url = '/remote-bridge';

  if (action === 'decline') {
    // Send message to an open Remote Bridge client; if none exists, open one
    // with an action query so the page can reject after WebSocket auth.
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          let sent = false;
          for (const client of clientList) {
            if (client.url.includes('/remote-bridge')) {
              client.postMessage({ type: 'CALL_ACTION', action: 'REJECT_CALL' });
              sent = true;
              if ('focus' in client) return client.focus();
            }
          }
          if (!sent) return clients.openWindow(url + '?action=decline');
        })
    );
    return;
  }

  // For 'answer' action or default click — open/focus the bridge page
  const actionParam = action === 'answer' ? '?action=answer' : '';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to find and focus existing Remote Bridge window
        for (const client of clientList) {
          if (client.url.includes('/remote-bridge') && 'focus' in client) {
            if (action === 'answer') {
              client.postMessage({ type: 'CALL_ACTION', action: 'ACCEPT_CALL' });
            }
            return client.focus();
          }
        }
        // Otherwise open new window
        return clients.openWindow(url + actionParam);
      })
  );
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  console.log('Background sync triggered');
}
