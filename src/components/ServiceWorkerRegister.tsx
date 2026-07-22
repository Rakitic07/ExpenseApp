"use client";

import { useEffect } from "react";

// Registers the PWA service worker on the client. Kept tiny and side-effect
// only so it can sit at the root layout without affecting server rendering.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Only register in production builds; during dev the SW can interfere with
    // hot reloading and Next.js dev assets.
    if (process.env.NODE_ENV !== "production") return;

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
