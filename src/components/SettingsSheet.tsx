"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Settings2,
  BarChart3,
  Image as ImageIcon,
  Trash2,
  Sparkles,
  Wallet,
  User,
  History,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings, type PeriodView } from "@/lib/settings";

const PERIODS: { value: PeriodView; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "all", label: "All time" },
];

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        on ? "bg-gradient-to-r from-[#7c8cff] to-[#ff6bd0]" : "bg-white/15"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow transition-all",
          on ? "left-[1.375rem]" : "left-0.5"
        )}
      />
    </button>
  );
}

function Row({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/10 text-[#c3b6ff]">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white/90">{title}</p>
          {desc && <p className="mt-0.5 text-xs text-white/45">{desc}</p>}
        </div>
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

export default function SettingsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { settings, update, reset } = useSettings();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
        >
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="glass-strong relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-4xl p-6 sm:max-w-lg sm:rounded-4xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-[#7c8cff] to-[#ff6bd0]">
                  <Settings2 className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-semibold">Space settings</h2>
                  <p className="text-xs text-white/45">
                    Saved for this space on this device
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="glass-btn h-9 w-9 p-0"
                aria-label="Close settings"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="divide-y divide-white/5">
              {/* Default period */}
              <Row
                icon={<History className="h-4 w-4" />}
                title="Default period"
                desc="Which range the dashboard opens on"
              >
                <div className="flex gap-1 rounded-full bg-white/5 p-1">
                  {PERIODS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => update({ defaultPeriod: p.value })}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium transition",
                        settings.defaultPeriod === p.value
                          ? "bg-white/20 text-white"
                          : "text-white/55 hover:text-white"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </Row>

              {/* Charts collapsed */}
              <Row
                icon={<BarChart3 className="h-4 w-4" />}
                title="Collapse charts by default"
                desc="Keeps first paint light — expand when you want them"
              >
                <Toggle
                  label="Collapse charts by default"
                  on={settings.chartsCollapsed}
                  onChange={(v) => update({ chartsCollapsed: v })}
                />
              </Row>

              {/* Thumbnails */}
              <Row
                icon={<ImageIcon className="h-4 w-4" />}
                title="Show bill thumbnails"
                desc="Tiny scanned-receipt previews on rows and edits"
              >
                <Toggle
                  label="Show bill thumbnails"
                  on={settings.showThumbnails}
                  onChange={(v) => update({ showThumbnails: v })}
                />
              </Row>

              {/* Confirm delete */}
              <Row
                icon={<Trash2 className="h-4 w-4" />}
                title="Confirm before delete"
                desc="Ask for a tap-through before removing an expense"
              >
                <Toggle
                  label="Confirm before delete"
                  on={settings.confirmDelete}
                  onChange={(v) => update({ confirmDelete: v })}
                />
              </Row>

              {/* Recent suggestions */}
              <Row
                icon={<Sparkles className="h-4 w-4" />}
                title="Recent title suggestions"
                desc="Quick-fill chips from your recent expenses"
              >
                <Toggle
                  label="Recent title suggestions"
                  on={settings.recentSuggestions}
                  onChange={(v) => update({ recentSuggestions: v })}
                />
              </Row>

              {/* Budget alerts */}
              <Row
                icon={<Wallet className="h-4 w-4" />}
                title="Budget alerts"
                desc="Warn as spending nears or passes the monthly budget"
              >
                <Toggle
                  label="Budget alerts"
                  on={settings.budgetAlerts}
                  onChange={(v) => update({ budgetAlerts: v })}
                />
              </Row>

              {/* Default payer */}
              <Row
                icon={<User className="h-4 w-4" />}
                title="Default “Paid by”"
                desc="Pre-fills the payer for new expenses"
              >
                <input
                  value={settings.defaultPayer}
                  onChange={(e) => update({ defaultPayer: e.target.value })}
                  placeholder="e.g. Me"
                  maxLength={40}
                  className="glass-input w-28 px-3 py-1.5 text-sm"
                />
              </Row>
            </div>

            <button
              type="button"
              onClick={reset}
              className="glass-btn mt-5 w-full justify-center py-2.5 text-sm text-white/70"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to defaults
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
