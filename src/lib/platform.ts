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

/**
 * True when the web app is running as an installed PWA (standalone display
 * mode), i.e. on a phone home-screen — where a rear camera is available and a
 * "Scan a bill" capture button makes sense. In a regular desktop/mobile browser
 * this is false, so those users only get "Choose from Gallery".
 */
export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  const mm = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(mm || iosStandalone);
}

/**
 * True on phones/tablets — installed PWA, native shell, or a plain mobile
 * browser — where a rear camera exists and the "Scan a bill" capture button is
 * useful. Desktop browsers return false and get "Choose from Gallery" only.
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  if (isNativeApp() || isStandalonePWA()) return true;

  const nav = window.navigator as unknown as {
    userAgentData?: { mobile?: boolean };
    userAgent?: string;
    platform?: string;
    maxTouchPoints?: number;
  };
  // Modern Chromium exposes an explicit mobile flag — trust it when present.
  if (typeof nav.userAgentData?.mobile === "boolean") return nav.userAgentData.mobile;

  const ua = nav.userAgent ?? "";
  if (/Android|iPhone|iPad|iPod|Mobile|Windows Phone|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }
  // iPadOS 13+ masquerades as desktop Safari; detect via Mac + multi-touch.
  return nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1;
}
