import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Spendly-Plus native app.
 *
 * The UI is BUNDLED inside the app (webDir = `out`, produced by
 * `npm run build:native`), so it launches instantly from local files with no
 * network round-trip for the shell — this is what makes the app feel native and
 * fast. Only data calls go to the deployed backend (baked in at build time via
 * NEXT_PUBLIC_API_BASE), authenticated with a Bearer token.
 *
 * IMPORTANT (performance): CapacitorHttp is deliberately DISABLED. When enabled
 * it patches window.fetch/XHR to tunnel every request through the native Java
 * bridge, and each response is serialized back to JS on the WebView's MAIN
 * thread. That main-thread work lands exactly when the app is starting up or
 * syncing — i.e. while the user is scrolling/tapping — which is why the native
 * app felt janky while the phone browser (which uses the engine's own
 * off-thread networking) was smooth. Instead the WebView makes normal fetches
 * straight to the backend; cross-origin is handled by CORS (see src/middleware.ts,
 * which allow-lists the Capacitor local origins) and auth is Bearer-token based
 * (see src/lib/http.ts, credentials omitted), so no cookies/CORS-credentials.
 */
const config: CapacitorConfig = {
  appId: "app.spendlyplus.mobile",
  appName: "Spendly-Plus",
  webDir: "out",
  backgroundColor: "#0b0b16",
  // Forward JS console.* to native logs (Android logcat) even in RELEASE builds.
  // Default ("debug") suppresses console output in release, which would hide our
  // [PERF] diagnostics. Set back to "debug" (or remove) once profiling is done.
  loggingBehavior: "production",
  android: {
    // Enable chrome://inspect remote debugging so the WebView can also be
    // profiled from desktop Chrome DevTools while we diagnose performance.
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: false,
    },
  },
};

export default config;
