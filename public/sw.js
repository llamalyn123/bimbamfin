// Bimbam: only used to show Capy notifications and open the right screen when one is tapped.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const screen = event.notification.data && event.notification.data.screen;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const client = list[0];
      if (client) {
        client.postMessage({ type: 'bimbam-open', screen });
        return client.focus();
      }
      return self.clients.openWindow('/');
    })
  );
});
