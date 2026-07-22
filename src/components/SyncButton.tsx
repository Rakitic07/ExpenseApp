"use client";

import { RefreshCw, Check, CloudOff } from "lucide-react";

export default function SyncButton({
  online,
  syncing,
  pending,
  onSync,
}: {
  online: boolean;
  syncing: boolean;
  pending: number;
  onSync: () => void;
}) {
  const title = !online
    ? "Offline — changes will sync automatically when you're back online"
    : syncing
      ? "Syncing…"
      : pending > 0
        ? `${pending} change${pending > 1 ? "s" : ""} pending — tap to sync now`
        : "All changes synced";

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
      ) : syncing ? (
        <RefreshCw className="h-4 w-4 animate-spin text-[#a5b4ff]" />
      ) : pending > 0 ? (
        <RefreshCw className="h-4 w-4 text-[#ffd43b]" />
      ) : (
        <Check className="h-4 w-4 text-[#38d9a9]" />
      )}
      {pending > 0 && !syncing && (
        <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-[#ff6bd0] px-1 text-[10px] font-bold leading-none text-white">
          {pending > 9 ? "9+" : pending}
        </span>
      )}
    </button>
  );
}
