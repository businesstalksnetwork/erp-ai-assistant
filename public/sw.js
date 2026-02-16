// PausalBox Service Worker for Push Notifications

self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.message || '',
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: {
      url: data.link || '/'
    },
    tag: data.tag || 'pausalbox-notification',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'PausalBox', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});
