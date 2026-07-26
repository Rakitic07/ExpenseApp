import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Spendly-Plus — Liquid Glass Expense Tracker",
  description:
    "A beautiful, interactive way to track daily, monthly and yearly expenses. Set a passphrase and keep your spending private.",
  applicationName: "Spendly-Plus",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Spendly-Plus",
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#05060f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/*
         * Tag <html> with `native` as early as possible (before first paint) when
         * running inside the Capacitor shell, so the native-only CSS (no expensive
         * backdrop-blur) applies immediately with no glass→solid flash. Capacitor
         * injects window.Capacitor before page scripts run, so this is synchronous.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var c=window.Capacitor;if(c&&(c.isNativePlatform?c.isNativePlatform():c.isNative)){document.documentElement.classList.add('native')}}catch(e){}",
          }}
        />
      </head>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
