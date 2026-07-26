import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "android/**",
      "ios/**",
      "native/**",
      "next-env.d.ts",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // Next 16 bundles the newer react-hooks plugin, which flags any
      // setState() called synchronously inside an effect. Our effects here
      // hydrate state once from browser-only APIs (localStorage/navigator)
      // and are intentional, tested patterns — keep as advisory, not errors.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
