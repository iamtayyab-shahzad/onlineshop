"use client";

import { useEffect } from "react";

/** Registers the service worker in production only (avoids stale pages while developing). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Offline support is a bonus; the app works without it.
    });
  }, []);
  return null;
}
