self.addEventListener('push', (event) => {
  if (!event.data) return;
  const { titulo, cuerpo, datos = {} } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(titulo || 'RefriElectri Pro', {
      body: cuerpo || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: datos.url || 'refri-notif',
      renotify: true,
      data: datos,
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url });
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
