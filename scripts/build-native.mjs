// Builds the static frontend bundle that Capacitor packages inside the native
// app (output: `out/`). The app then launches instantly from local files and
// only calls the remote API (NEXT_PUBLIC_API_BASE) for data.
//
// Next.js `output: 'export'` refuses to build if the app contains dynamic Route
// Handlers (our /api/*) or Middleware — but the native bundle doesn't need them
// (it talks to the deployed backend). So we temporarily stash those server-only
// files out of the app tree, run the export, and always restore them afterwards
// (even on failure). The Vercel build is untouched and keeps them.

import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const bak = join(root, ".native-build-bak");

// Server-only paths to move out of the way during the static export.
const MOVES = [
  { live: join(root, "src", "app", "api"), stash: join(bak, "api") },
  { live: join(root, "src", "middleware.ts"), stash: join(bak, "middleware.ts") },
];

function restore() {
  for (const { live, stash } of MOVES) {
    if (existsSync(stash)) {
      if (existsSync(live)) rmSync(live, { recursive: true, force: true });
      renameSync(stash, live);
    }
  }
  if (existsSync(bak)) rmSync(bak, { recursive: true, force: true });
}

// Recover cleanly if a previous run was interrupted mid-build.
restore();

const apiBase = (process.env.NEXT_PUBLIC_API_BASE || process.env.CAP_SERVER_URL || "")
  .trim()
  .replace(/\/+$/, "");

// The commit this binary is built from. Baked into the bundle so the app can
// ask /api/version for the latest release's SHA and offer an update when they
// differ. Publish the GitHub release from THIS same commit so the check is exact.
let appSha = process.env.NEXT_PUBLIC_APP_SHA || "";
if (!appSha) {
  try {
    appSha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    appSha = "";
  }
}

if (!apiBase) {
  console.error(
    "ERROR: NEXT_PUBLIC_API_BASE (or CAP_SERVER_URL) must be set to your deployed URL,\n" +
      "       e.g. NEXT_PUBLIC_API_BASE=https://spendly-plus.vercel.app"
  );
  process.exit(1);
}

mkdirSync(bak, { recursive: true });

try {
  for (const { live, stash } of MOVES) {
    if (existsSync(live)) renameSync(live, stash);
  }

  // The lib/*.ts files (prisma client, auth) are still type-checked by the
  // build even though the API routes are stashed, so make sure the Prisma
  // client types exist. This is offline and idempotent.
  execSync("npx --no-install prisma generate", { stdio: "inherit", env: process.env });

  console.log(
    `\n>> Building static native bundle -> out/  (API base: ${apiBase}, sha: ${
      appSha ? appSha.slice(0, 10) : "unknown"
    })\n`
  );
  execSync("npx --no-install next build", {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_EXPORT: "1",
      NEXT_PUBLIC_API_BASE: apiBase,
      NEXT_PUBLIC_APP_SHA: appSha,
      NODE_ENV: "production",
    },
  });
} finally {
  restore();
}

console.log("\n✅ Native web bundle ready in ./out\n");
