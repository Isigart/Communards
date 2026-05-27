// Service Worker minimal pour Web Push.
// Reçoit les push notifications du serveur et les affiche.
// Au clic, ouvre l'URL contenue dans la payload (par défaut /dashboard).

self.addEventListener('install', (event) => {
  // On active le SW immédiatement sans attendre la fermeture des onglets.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "L'Ordinaire", body: event.data ? event.data.text() : '' };
  }

  const title = data.title || "L'Ordinaire";
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'lordinaire-notif', // remplace la notif précédente du même tag
    renotify: true,
    data: { url: data.url || '/dashboard' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Si une fenêtre de l'app est déjà ouverte, on la focus et on navigue
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(url);
          return;
        }
      }
      // Sinon on ouvre une nouvelle fenêtre
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
