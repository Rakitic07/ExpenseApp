import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Spendly-Plus ships as a real native app via Capacitor, but the app itself is a
 * Next.js server app (API routes + cookie sessions). Rather than trying to bundle
 * a backend into the binary, the native shell simply loads your deployed site over
 * HTTPS — so the APK/IPA always runs the exact same code as the web app, and
 * updates ship the moment you deploy to Vercel (no store re-submission needed).
 *
 * Point it at your deployment by setting CAP_SERVER_URL before syncing, e.g.:
 *   CAP_SERVER_URL="https://your-app.vercel.app" npm run cap:sync
 *
 * If CAP_SERVER_URL is not set, the shell falls back to the bundled offline splash
 * in `native/www` which just tells you to configure the URL.
 */
const serverUrl = process.env.CAP_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "app.spendlyplus.mobile",
  appName: "Spendly-Plus",
  webDir: "native/www",
  server: serverUrl
    ? {
        url: serverUrl,
        androidScheme: "https",
        // Only the deployed origin may be navigated to inside the shell.
        allowNavigation: [new URL(serverUrl).host],
      }
    : {
        androidScheme: "https",
      },
  backgroundColor: "#0b0b16",
};

export default config;
