// SquadClock service worker: shows push notifications and opens the
// squad board when one is tapped. Deliberately no offline caching, since
// the board is live data and a stale copy would show wrong availability.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "SquadClock", body: event.data.text(), url: "/" };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "SquadClock", {
      body: payload.body,
      icon: "/icon/192",
      badge: "/icon/192",
      tag: payload.tag,
      renotify: Boolean(payload.tag),
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Reuse an open SquadClock tab (the installed app, usually) if there is one.
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client && client.url !== target) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
