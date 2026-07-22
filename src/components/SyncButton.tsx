"use client";

import { RefreshCw, CloudOff } from "lucide-react";

export default function SyncButton({
  online,
  syncing,
  pending,
  error,
  onSync,
}: {
  online: boolean;
  syncing: boolean;
  pending: number;
  error?: boolean;
  onSync: () => void;
}) {
  const title = !online
    ? "Offline — changes will sync automatically when you're back online"
    : syncing
      ? "Syncing…"
      : error
        ? "Sync failed — tap to retry"
        : pending > 0
          ? `${pending} change${pending > 1 ? "s" : ""} pending — tap to sync now`
          : "All changes synced";

  // A single sync circle that changes colour by state:
  //   green  → all synced        (idle, success)
  //   yellow → syncing / pending  (in progress or waiting)
  //   red    → last sync failed
  //   grey   → offline (cloud-off)
  const color = syncing || pending > 0 ? "#ffd43b" : error ? "#ff6b6b" : "#38d9a9";

  return (
    <button
      type="button"
      onClick={onSync}
      disabled={syncing || !online}
      className="glass-btn relative shrink-0 px-3 py-2.5 disabled:opacity-100"
      aria-label={title}
      title={title}
    >
      {!online ? (
        <CloudOff className="h-4 w-4 text-white/55" />
      ) : (
        <RefreshCw
          className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
          style={{ color }}
        />
      )}
      {pending > 0 && !syncing && (
        <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-[#ff6bd0] px-1 text-[10px] font-bold leading-none text-white">
          {pending > 9 ? "9+" : pending}
        </span>
      )}
    </button>
  );
}
