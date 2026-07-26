"use client";

import { useEffect } from "react";
import { isNativeApp } from "@/lib/platform";

// Registers the PWA service worker on the client. Kept tiny and side-effect
// only so it can sit at the root layout without affecting server rendering.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Fallback in case the inline head script ran before window.Capacitor was
    // ready: ensure the `native` class (which disables costly WebView blur) is
    // present when running inside the packaged app.
    if (isNativeApp()) {
      document.documentElement.classList.add("native");
      // The native app's UI is bundled in the APK (local files) and updated via
      // a new binary — a service worker would only add a stale-cache layer on
      // top of already-local assets, so skip it entirely inside the app.
      return;
    }

    if (!("serviceWorker" in navigator)) return;

    // During dev the SW must NOT be active: a worker left over from a previous
    // production build (`npm run start`) keeps intercepting requests and can
    // serve stale `/_next` chunks after a framework upgrade, which breaks
    // hydration (app gets stuck on the loading screen). So in dev we actively
    // unregister any existing worker and drop its caches — self-healing.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {});
      if (typeof caches !== "undefined") {
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .catch(() => {});
      }
      return;
    }

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration failures are non-fatal */
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
