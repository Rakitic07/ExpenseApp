import type { MetadataRoute } from "next";

// Web App Manifest — makes Spendly installable on Android/iOS home screens as a
// PWA. Next.js serves this at /manifest.webmanifest automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Spendly — Expense Tracker",
    short_name: "Spendly",
    description:
      "A beautiful, interactive way to track daily, monthly and yearly expenses. Set a passphrase and keep your spending private.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#05060f",
    theme_color: "#05060f",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
