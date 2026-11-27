"use client";

import { useEffect } from "react";
// Starts listening for the browser's install offer on every shop page, so the "Install our app"
// button works even if the customer lands on a product page first.
import "@/lib/install-prompt";

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
