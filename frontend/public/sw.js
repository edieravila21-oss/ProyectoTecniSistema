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
