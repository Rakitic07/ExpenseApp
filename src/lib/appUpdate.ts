// Shared in-app update logic for the native app (used by both the automatic
// banner and the manual "Check for updates" button).
//
// Detection is based on the APK's sha256 (the release ASSET digest), not the
// git tag/commit — because updates are shipped by re-uploading a new binary to
// a single fixed release tag ("latest"), so the tag never changes but the
// APK's sha256 does. The app remembers the digest it last installed and offers
// an update whenever the latest release's digest differs.

import { apiFetch } from "./http";

export type LatestRelease = {
  versionCode: number;
  versionName: string;
  url: string;
  assetSha: string;
};

// Fired when a manual "Check for updates" runs, so the on-screen digest badge
// can show the installed vs latest APK sha.
export const DIGEST_EVENT = "spendly:update-digests";
export type DigestDetail = { installed: string; latest: string };

export function broadcastDigests(detail: DigestDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<DigestDetail>(DIGEST_EVENT, { detail }));
}

type AppUpdaterPlugin = {
  getInfo(): Promise<{ versionCode: number; versionName: string }>;
  downloadAndInstall(opts: { url: string }): Promise<{ status: string }>;
  cleanup?(): Promise<{ deleted: number }>;
};

export function updaterPlugin(): AppUpdaterPlugin | undefined {
  if (typeof window === "undefined") return undefined;
  const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } })
    .Capacitor;
  return cap?.Plugins?.AppUpdater as AppUpdaterPlugin | undefined;
}

// sha256 of the APK this app considers "installed". Seeded on first run to the
// current latest (a fresh install always has the newest binary), then updated
// whenever we launch an in-app update.
const DIGEST_KEY = "spendly_apk_digest";

function seenDigest(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(DIGEST_KEY);
  } catch {
    return null;
  }
}

/** The APK digest this app currently considers installed (for debugging/UI). */
export function installedDigest(): string {
  return seenDigest() ?? "";
}

/** Record the digest we just installed so we don't re-prompt for it. */
export function markInstalled(assetSha: string): void {
  if (typeof window === "undefined" || !assetSha) return;
  try {
    window.localStorage.setItem(DIGEST_KEY, assetSha);
  } catch {
    /* storage disabled — worst case we prompt once more */
  }
}

/** Fetches the latest release info (APK sha256 + url) from the backend. */
export async function fetchLatest(): Promise<LatestRelease | null> {
  try {
    const res = await apiFetch("/api/version", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { android?: LatestRelease };
    return data.android ?? null;
  } catch {
    return null;
  }
}

/**
 * True when the latest release's APK digest differs from the one this app last
 * installed. On the very first run we seed the baseline to the current latest
 * (the just-installed binary IS the latest) and report "no update".
 */
export function hasUpdate(latest: LatestRelease | null): boolean {
  if (!latest?.assetSha) return false;
  const seen = seenDigest();
  if (!seen) {
    markInstalled(latest.assetSha);
    return false;
  }
  return seen !== latest.assetSha;
}

/** Downloads the APK and launches the system installer. */
export async function installUpdate(url: string): Promise<{ status: string }> {
  const plugin = updaterPlugin();
  if (!plugin) return { status: "unavailable" };
  return plugin.downloadAndInstall({ url });
}

/**
 * Deletes any leftover downloaded update APK. Safe to call on launch: if the app
 * is running, a previously downloaded update has already been installed, so the
 * binary is no longer needed and shouldn't linger in storage.
 */
export async function cleanupDownloads(): Promise<void> {
  const plugin = updaterPlugin();
  try {
    await plugin?.cleanup?.();
  } catch {
    /* nothing downloaded yet, or plugin missing — ignore */
  }
}
