/** @type {import('next').NextConfig} */

// NEXT_EXPORT=1 is set only by the native build (scripts/build-native.mjs): it
// produces a fully static bundle in `out/` that Capacitor packages inside the
// APK/IPA, so the app launches instantly from local files and only calls the
// remote API for data. The normal Vercel build leaves this off and keeps SSR +
// API routes + middleware intact.
const isExport = process.env.NEXT_EXPORT === "1";

const nextConfig = {
  reactStrictMode: true,
  ...(isExport
    ? {
        output: "export",
        // Static export can't use the on-the-fly image optimizer.
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
