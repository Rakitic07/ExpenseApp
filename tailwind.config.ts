import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // Only apply `hover:` styles on devices with a real pointer (desktop mouse).
  // On phones/native the WebView still fires synthetic mouseover/mouseout while a
  // finger drags during a scroll, and any `hover:bg-*`/`transition` on the cards
  // it passes over kicks off an animated repaint — the [PERF] logs literally show
  // a single `mouseover` taking 352ms. Gating hover behind (hover:hover) kills
  // that scroll-time repaint churn entirely on touch, which is the main cause of
  // the sustained ~30fps while scrolling.
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Inter",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        glass: {
          DEFAULT: "rgba(255,255,255,0.12)",
          strong: "rgba(255,255,255,0.22)",
          border: "rgba(255,255,255,0.28)",
        },
      },
      backdropBlur: {
        xs: "2px",
      },
      borderRadius: {
        "3xl": "1.75rem",
        "4xl": "2.25rem",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0,0,0,0.22)",
        "glass-sm": "0 4px 18px 0 rgba(0,0,0,0.18)",
        glow: "0 0 40px 0 rgba(120,140,255,0.35)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-18px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out",
        float: "float 9s ease-in-out infinite",
        shimmer: "shimmer 2.2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
