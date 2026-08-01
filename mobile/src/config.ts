// Where the native app talks to. This is the SAME Next.js backend that powers
// the web app + admin + DB; the RN app is just a native front-end for phones and
// authenticates with a Bearer token (see lib/api.ts). Change this if you deploy
// the backend elsewhere.
export const API_BASE = 'https://spendly-plus.vercel.app';
