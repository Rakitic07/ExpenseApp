"use client";

import { useEffect } from "react";

// Registers the PWA service worker on the client. Kept tiny and side-effect
// only so it can sit at the root layout without affecting server rendering.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
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
