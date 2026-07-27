"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpCircle, Loader2, X } from "lucide-react";
import { isNativeApp } from "@/lib/platform";
import {
  fetchLatest,
  checkForUpdate,
  installUpdate,
  markInstalled,
  cleanupDownloads,
} from "@/lib/appUpdate";

const POLL_MS = 5 * 60 * 1000; // re-check every 5 minutes and on resume

// Automatic update banner, shown only inside the native app. Detection is based
// on the APK's sha256 (see lib/appUpdate): when the latest GitHub release's APK
// digest differs from the one this app installed, it offers a one-tap download +
// install. The manual "Check for updates" button uses the same logic.
export default function UpdatePrompt() {
  const [apk, setApk] = useState<{
    versionName: string;
    url: string;
    assetSha: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    const latest = await fetchLatest();
    const { isUpdate } = await checkForUpdate(latest);
    if (isUpdate && latest) {
      setApk({
        versionName: latest.versionName,
        url: latest.url,
        assetSha: latest.assetSha,
      });
    }
  }, []);

  useEffect(() => {
    if (!isNativeApp()) return;

    // A previously downloaded update APK is now installed (we're running) — or
    // was abandoned. Either way delete the leftover binary from storage.
    void cleanupDownloads();

    void check();
    const timer = setInterval(check, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [check]);

  const runApkUpdate = useCallback(async () => {
    if (!apk) return;
    setBusy(true);
    setNote("Downloading update…");
    try {
      const result = await installUpdate(apk.url);
      if (result?.status === "permission_required") {
        setNote("Allow “Install unknown apps”, then tap Update again.");
        setBusy(false);
        return;
      }
      // Installer launched — remember this digest so we don't re-prompt for it.
      markInstalled(apk.assetSha);
      setNote("Opening installer…");
    } catch {
      setNote("Update failed. Please try again.");
      setBusy(false);
    }
  }, [apk]);

  const show = !dismissed && apk != null;
  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="fixed inset-x-0 top-0 z-[70] px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]"
      >
        <div className="glass-strong mx-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-2.5 shadow-glass">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#7c8cff] to-[#ff6bd0]">
            <ArrowUpCircle className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">App update available</p>
            <p className="truncate text-xs text-white/55">
              {note ?? `Version ${apk!.versionName}`}
            </p>
          </div>
          <button
            onClick={runApkUpdate}
            disabled={busy}
            className="glass-btn-primary shrink-0 px-3 py-2 text-sm disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
          </button>
          {!busy && (
            <button
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
              className="shrink-0 rounded-lg p-1.5 text-white/40 transition hover:text-white/70"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
