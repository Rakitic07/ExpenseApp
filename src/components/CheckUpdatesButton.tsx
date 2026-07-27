"use client";

import { useState } from "react";
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  ArrowUpCircle,
  AlertCircle,
} from "lucide-react";
import {
  fetchLatest,
  checkForUpdate,
  installUpdate,
  markInstalled,
  broadcastDigests,
} from "@/lib/appUpdate";
import { recordDiag } from "@/lib/perf";

type State = "idle" | "checking" | "uptodate" | "available" | "installing" | "error";
type Target = { versionName: string; url: string; assetSha: string };

// Small footer control (native app only). Tapping it flashes the installed vs
// latest APK sha (via the on-screen badge) and, if they differ, immediately
// downloads + installs the new APK. The downloaded binary is cleaned up on the
// next launch (see cleanupDownloads).
export default function CheckUpdatesButton() {
  const [state, setState] = useState<State>("idle");
  const [target, setTarget] = useState<Target | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function install(t: Target) {
    setTarget(t);
    setState("installing");
    setMsg("Downloading…");
    try {
      const res = await installUpdate(t.url);
      if (res?.status === "permission_required") {
        setMsg("Allow “Install unknown apps”, then tap Update.");
        setState("available");
        return;
      }
      // Installer launched — remember this digest so we don't re-prompt for it.
      markInstalled(t.assetSha);
      setMsg("Opening installer…");
    } catch {
      setMsg("Update failed. Tap to retry.");
      setState("available");
    }
  }

  async function check() {
    setState("checking");
    setMsg(null);
    const latest = await fetchLatest();
    // Compare the REAL installed APK sha (computed natively) with the latest
    // release asset digest — no seeding heuristic.
    const { installed, latest: latestSha, isUpdate } = await checkForUpdate(latest);
    broadcastDigests({ installed, latest: latestSha });
    recordDiag("update-check", {
      reachable: !!latest,
      installed,
      latest: latestSha,
      isUpdate,
    });

    if (!latest) {
      setState("error");
      setMsg("Couldn't reach the update server.");
      window.setTimeout(() => setState("idle"), 3000);
      return;
    }
    if (isUpdate) {
      // shas differ → download + install right away.
      void install({
        versionName: latest.versionName,
        url: latest.url,
        assetSha: latest.assetSha,
      });
    } else {
      setState("uptodate");
      window.setTimeout(() => setState("idle"), 3000);
    }
  }

  const onClick = () => {
    if (state === "available" && target) return void install(target);
    if (state === "checking" || state === "installing") return;
    void check();
  };

  const { Icon, label, spin } = view(state, target?.versionName);

  return (
    <button
      type="button"
      onClick={onClick}
      title={msg ?? label}
      aria-label={label}
      disabled={state === "checking" || state === "installing"}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-white/50 transition hover:bg-white/10 hover:text-white/80 disabled:opacity-60"
    >
      <Icon className={`h-4 w-4 ${spin ? "animate-spin" : ""}`} />
      <span>{msg ?? label}</span>
    </button>
  );
}

function view(state: State, versionName?: string) {
  switch (state) {
    case "checking":
      return { Icon: Loader2, label: "Checking…", spin: true };
    case "installing":
      return { Icon: Loader2, label: "Updating…", spin: true };
    case "available":
      return {
        Icon: ArrowUpCircle,
        label: versionName ? `Update to ${versionName}` : "Update available",
        spin: false,
      };
    case "uptodate":
      return { Icon: CheckCircle2, label: "Up to date", spin: false };
    case "error":
      return { Icon: AlertCircle, label: "Try again", spin: false };
    default:
      return { Icon: RefreshCw, label: "Check for updates", spin: false };
  }
}
