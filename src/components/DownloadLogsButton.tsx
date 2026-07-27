"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { getPerfLog, clearPerfLog } from "@/lib/perf";
import { updaterPlugin } from "@/lib/appUpdate";
import { isNativeApp } from "@/lib/platform";

// Footer button that exports the in-app performance log so it can be shared for
// diagnosis. In the native app it writes the file to the phone's Downloads via
// the AppUpdater plugin; on the web it triggers a normal browser download.
export default function DownloadLogsButton() {
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    const data = getPerfLog();
    if (!data) {
      setMsg("No logs yet — scroll around first.");
      window.setTimeout(() => setMsg(null), 2500);
      return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const name = `spendly-perf-${stamp}.log`;

    try {
      if (isNativeApp()) {
        const plugin = updaterPlugin();
        if (plugin?.saveText) {
          await plugin.saveText({ name, data });
          setMsg("Saved to Downloads ✓");
        } else {
          setMsg("Save unavailable on this build.");
        }
      } else {
        // Browser: trigger a file download via a temporary object URL.
        const blob = new Blob([data], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setMsg("Downloaded ✓");
      }
    } catch {
      setMsg("Save failed.");
    }
    window.setTimeout(() => setMsg(null), 3000);
  }

  return (
    <button
      type="button"
      onClick={save}
      // Long-press clears the buffer so a fresh capture starts clean.
      onContextMenu={(e) => {
        e.preventDefault();
        clearPerfLog();
        setMsg("Logs cleared.");
        window.setTimeout(() => setMsg(null), 2000);
      }}
      aria-label="Download performance logs"
      title="Download performance logs (long-press to clear)"
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-white/50 transition hover:bg-white/10 hover:text-white/80"
    >
      <FileDown className="h-4 w-4" />
      <span>{msg ?? "Logs"}</span>
    </button>
  );
}
