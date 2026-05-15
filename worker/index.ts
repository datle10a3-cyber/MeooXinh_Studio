/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

// Handle push notifications from the server
sw.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string; url?: string; tag?: string };
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Mèoo Xinhh Studio", body: event.data.text() };
  }

  const title = payload.title || "Mèoo Xinhh Studio";
  const options = {
    body: payload.body || "",
    icon: "/pwa-icon-192.png",
    badge: "/pwa-icon-192.png",
    tag: payload.tag || "studio-notification",
    renotify: true,
    data: { url: payload.url || "/" },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(sw.registration.showNotification(title, options as NotificationOptions));
});

// Handle notification click — open the app at the right URL
sw.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = (event.notification.data?.url as string) || "/";
  const fullUrl = new URL(url, sw.location.origin).href;

  event.waitUntil(
    sw.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If the app is already open, focus it and navigate
      for (const client of windowClients) {
        if (new URL(client.url).origin === sw.location.origin) {
          client.focus();
          client.navigate(fullUrl);
          return;
        }
      }
      // Otherwise open a new window
      return sw.clients.openWindow(fullUrl);
    }),
  );
});
