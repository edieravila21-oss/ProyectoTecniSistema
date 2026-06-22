// ─── OFFLINE CACHING ───────────────────────────────────────────────────────
const CACHE_SHELL = 'refri-shell-v1';
const CACHE_API   = 'refri-api-v1';
const CACHE_IMG   = 'refri-img-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL)
      .then((cache) => cache.addAll(['/index.html', '/']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const keep = [CACHE_SHELL, CACHE_API, CACHE_IMG];
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cloudinary images → cache-first (never stale)
  if (url.hostname.includes('res.cloudinary.com')) {
    event.respondWith(cacheFirst(request, CACHE_IMG));
    return;
  }

  // API responses → network-first, cache fallback when offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, CACHE_API));
    return;
  }

  // Navigation → always serve app shell so SPA routes work offline
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((r) => r || fetch(request))
    );
    return;
  }

  // JS/CSS/fonts/icons from same origin → cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, CACHE_SHELL));
  }
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ success: false, offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ─── PUSH NOTIFICATIONS ────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const { titulo, cuerpo, datos = {}, badge = 0 } = event.data.json();

  // Actualizar badge en el ícono de la app
  if ('setAppBadge' in self.navigator && badge > 0) {
    self.navigator.setAppBadge(badge).catch(() => {});
  }

  event.waitUntil(
    self.registration.showNotification(titulo || 'RefriElectri Pro', {
      body: cuerpo || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: datos.tag || 'refri-notif',
      renotify: true,
      requireInteraction: true,
      data: datos,
      vibrate: [200, 100, 200, 100, 200],
      actions: datos.url
        ? [{ action: 'open', title: 'Ver detalles' }]
        : [],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Limpiar badge al abrir la notificación
  if ('clearAppBadge' in self.navigator) {
    self.navigator.clearAppBadge().catch(() => {});
  }

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url });
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});

// Limpiar badge cuando se cierran todas las notificaciones
self.addEventListener('notificationclose', () => {
  self.registration.getNotifications().then((notifs) => {
    if (notifs.length === 0 && 'clearAppBadge' in self.navigator) {
      self.navigator.clearAppBadge().catch(() => {});
    }
  });
});
