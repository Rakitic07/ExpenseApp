"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpCircle, RefreshCw, Loader2, X } from "lucide-react";
import { isNativeApp } from "@/lib/platform";

type VersionResponse = {
  web: string;
  android: { versionCode: number; versionName: string; url: string };
};

type AppUpdaterPlugin = {
  getInfo(): Promise<{ versionCode: number; versionName: string }>;
  downloadAndInstall(opts: { url: string }): Promise<{ status: string }>;
};

function updaterPlugin(): AppUpdaterPlugin | undefined {
  if (typeof window === "undefined") return undefined;
  const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor;
  return cap?.Plugins?.AppUpdater as AppUpdaterPlugin | undefined;
}

const POLL_MS = 5 * 60 * 1000; // re-check every 5 minutes and on resume

// Shown only inside the native app. Detects two kinds of updates:
//   • a new APK binary  → one-tap "Update" (downloads + opens the installer)
//   • a new web build   → one-tap "Refresh" (reloads the shell instantly)
export default function UpdatePrompt() {
  const [apk, setApk] = useState<{ versionName: string; url: string } | null>(null);
  const [webStale, setWebStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const initialWeb = useRef<string | null>(null);
  const currentCode = useRef<number | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const data: VersionResponse = await res.json();

      if (initialWeb.current == null) initialWeb.current = data.web;
      else if (data.web !== initialWeb.current) setWebStale(true);

      if (currentCode.current != null && data.android.versionCode > currentCode.current) {
        setApk({ versionName: data.android.versionName, url: data.android.url });
      }
    } catch {
      /* offline / transient — ignore */
    }
  }, []);

  useEffect(() => {
    if (!isNativeApp()) return;
    const plugin = updaterPlugin();
    if (!plugin) return;

    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    (async () => {
      try {
        const info = await plugin.getInfo();
        if (cancelled) return;
        currentCode.current = Number(info.versionCode);
      } catch {
        currentCode.current = 0;
      }
      await check();
      timer = setInterval(check, POLL_MS);
    })();

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [check]);

  const runApkUpdate = useCallback(async () => {
    const plugin = updaterPlugin();
    if (!plugin || !apk) return;
    setBusy(true);
    setNote("Downloading update…");
    try {
      const result = await plugin.downloadAndInstall({ url: apk.url });
      if (result?.status === "permission_required") {
        setNote("Allow “Install unknown apps”, then tap Update again.");
        setBusy(false);
        return;
      }
      setNote("Opening installer…");
    } catch {
      setNote("Update failed. Please try again.");
      setBusy(false);
    }
  }, [apk]);

  const show = !dismissed && (apk != null || webStale);
  if (!show) return null;

  const isApk = apk != null;

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
            {isApk ? <ArrowUpCircle className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">
              {isApk ? "App update available" : "New version ready"}
            </p>
            <p className="truncate text-xs text-white/55">
              {note ?? (isApk ? `Version ${apk!.versionName}` : "Refresh to get the latest.")}
            </p>
          </div>
          <button
            onClick={isApk ? runApkUpdate : () => window.location.reload()}
            disabled={busy}
            className="glass-btn-primary shrink-0 px-3 py-2 text-sm disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isApk ? (
              "Update"
            ) : (
              "Refresh"
            )}
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
