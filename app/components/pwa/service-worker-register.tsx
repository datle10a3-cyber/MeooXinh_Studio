"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => null);
      if ("caches" in window) {
        window.caches.keys()
          .then((keys) => Promise.all(keys.filter((key) => key.startsWith("meoo-xinhh-studio")).map((key) => window.caches.delete(key))))
          .catch(() => null);
      }
      return;
    }

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // PWA should never block the app if service worker registration fails.
      });
    });
  }, []);

  return null;
}
