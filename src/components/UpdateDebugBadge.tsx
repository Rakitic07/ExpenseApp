"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { isNativeApp } from "@/lib/platform";
import { DIGEST_EVENT, type DigestDetail } from "@/lib/appUpdate";

// First 6 hex chars of a sha256 digest (strips the "sha256:" prefix). Fallback
// tokens like "u:<time>" / "id:<n>" just show their first 6 chars.
function short(s: string): string {
  if (!s) return "——————";
  return s.replace(/^sha256:/i, "").slice(0, 6);
}

// Native-only diagnostic: when the user taps "Check for updates", show the APK
// digest this app installed vs. the latest APK digest on GitHub. Green = same
// (up to date), amber = different (updating). Fades away after a few seconds.
export default function UpdateDebugBadge() {
  const [info, setInfo] = useState<DigestDetail | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!isNativeApp()) return;
    function onDigests(e: Event) {
      const detail = (e as CustomEvent<DigestDetail>).detail;
      if (!detail) return;
      setInfo(detail);
      setVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setVisible(false), 4000);
    }
    window.addEventListener(DIGEST_EVENT, onDigests as EventListener);
    return () => {
      window.removeEventListener(DIGEST_EVENT, onDigests as EventListener);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!info) return null;
  const match = !!info.installed && info.installed === info.latest;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35 }}
          className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]"
        >
          <div className="glass-strong rounded-full px-4 py-1.5 text-[11px] font-medium tabular-nums">
            <span className="text-white/45">apk </span>
            <span className="text-white">{short(info.installed)}</span>
            <span className="text-white/40"> → latest </span>
            <span className={match ? "text-emerald-300" : "text-amber-300"}>
              {short(info.latest)}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
