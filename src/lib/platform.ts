// Tiny runtime helpers to tell where the web app is running.
//
// The native shell (Capacitor) injects a global `window.Capacitor`. We check it
// without importing @capacitor/core so the web/PWA bundle stays dependency-free.

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  isNative?: boolean;
  getPlatform?: () => string;
};

function cap(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True only when running inside the packaged Android/iOS app. */
export function isNativeApp(): boolean {
  const c = cap();
  return Boolean(c?.isNativePlatform?.() ?? c?.isNative);
}
