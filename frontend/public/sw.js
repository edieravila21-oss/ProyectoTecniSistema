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

// ─── BACKGROUND SYNC ───────────────────────────────────────────────────────
// Fires when Chrome detects connectivity, even with the browser in the background.
// Reads the auth token and pending queue from IndexedDB, then uploads directly.

self.addEventListener('sync', (event) => {
  if (event.tag === 'offline-sync') {
    event.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue() {
  const token = await idbGet('auth', 'token');
  if (!token) return;

  const queue = await idbGetAll('sync-queue');
  for (const entry of queue) {
    try {
      let ok = false;

      if (entry.type === 'checklist') {
        const res = await fetch(`/api/servicios/${entry.servicioId}/checklist/${entry.itemId}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        ok = res.ok || (res.status >= 400 && res.status < 500);
      } else if (entry.type === 'foto') {
        const fd = new FormData();
        fd.append('foto', entry.blob, 'foto.jpg');
        fd.append('tipo', entry.tipo);
        const res = await fetch(`/api/servicios/${entry.servicioId}/fotos`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: fd,
        });
        ok = res.ok || (res.status >= 400 && res.status < 500);
      }

      if (ok) await idbDelete('sync-queue', entry.id);
    } catch { /* network error — keep in queue */ }
  }
}

// Raw IndexedDB helpers for the service worker context (no bundler, no idb lib).
// Open without a version so we never get a VersionError if the app upgraded the DB.
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('refri-offline');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(storeName, key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    try {
      const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch { resolve(undefined); }
  });
}

async function idbGetAll(storeName) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    try {
      const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    } catch { resolve([]); }
  });
}

async function idbDelete(storeName, key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    try {
      const req = db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    } catch { resolve(); }
  });
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
