"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, MONTH_LABELS } from "@/lib/utils";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

// Parse a YYYY-MM-DD string into a *local* date (no timezone shift).
function parse(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function toValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = useMemo(() => parse(value), [value]);
  const today = useMemo(() => new Date(), []);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"day" | "month">("day");
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  // Keep the visible month in sync when the value changes externally.
  useEffect(() => {
    setViewYear(selected.getFullYear());
    setViewMonth(selected.getMonth());
  }, [selected]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Build a stable 6-row (42-cell) grid, Sunday-first.
  const cells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startOffset = firstOfMonth.getDay(); // 0 = Sunday
    const gridStart = new Date(viewYear, viewMonth, 1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [viewYear, viewMonth]);

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function pick(d: Date) {
    onChange(toValue(d));
    setOpen(false);
    setMode("day");
  }

  function openPopover() {
    setMode("day");
    setViewYear(selected.getFullYear());
    setViewMonth(selected.getMonth());
    setOpen((o) => !o);
  }

  const label = selected.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={openPopover}
        className="glass-input flex items-center justify-between text-left"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>{label}</span>
        <Calendar className="h-4 w-4 text-white/50" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="glass-strong absolute right-0 z-30 mt-2 w-[216px] max-w-[80vw] rounded-2xl p-2.5 sm:w-[260px] sm:p-3"
          >
            {/* header: chevrons step the month (day mode) or year (month mode);
                the title toggles between the two modes. */}
            <div className="mb-1.5 flex items-center justify-between sm:mb-2">
              <button
                type="button"
                onClick={() => (mode === "day" ? shiftMonth(-1) : setViewYear((y) => y - 1))}
                className="grid h-6 w-6 place-items-center rounded-lg text-white/70 transition hover:bg-white/15 hover:text-white sm:h-7 sm:w-7"
                aria-label={mode === "day" ? "Previous month" : "Previous year"}
              >
                <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <button
                type="button"
                onClick={() => setMode((m) => (m === "day" ? "month" : "day"))}
                className="rounded-lg px-2 py-0.5 text-xs font-semibold transition hover:bg-white/10 sm:text-[13px]"
              >
                {mode === "day" ? `${MONTH_LABELS[viewMonth]} ${viewYear}` : viewYear}
              </button>
              <button
                type="button"
                onClick={() => (mode === "day" ? shiftMonth(1) : setViewYear((y) => y + 1))}
                className="grid h-6 w-6 place-items-center rounded-lg text-white/70 transition hover:bg-white/15 hover:text-white sm:h-7 sm:w-7"
                aria-label={mode === "day" ? "Next month" : "Next year"}
              >
                <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>

            {mode === "month" ? (
              /* month picker grid */
              <div className="grid grid-cols-3 gap-1.5">
                {MONTH_LABELS.map((m, i) => {
                  const isCur = i === viewMonth;
                  const isSelMonth = i === selected.getMonth() && viewYear === selected.getFullYear();
                  return (
                    <button
                      type="button"
                      key={m}
                      onClick={() => {
                        setViewMonth(i);
                        setMode("day");
                      }}
                      className={cn(
                        "rounded-xl py-2 text-xs font-medium transition sm:text-[13px]",
                        isCur || isSelMonth ? "text-white" : "text-white/75 hover:bg-white/15"
                      )}
                      style={
                        isSelMonth
                          ? {
                              backgroundImage:
                                "linear-gradient(135deg, #7c8cff, #b06bff 55%, #ff6bd0)",
                              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
                            }
                          : isCur
                            ? { background: "rgba(255,255,255,0.12)" }
                            : undefined
                      }
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                {/* weekday labels */}
                <div className="mb-0.5 grid grid-cols-7 text-center text-[9px] font-medium text-white/45 sm:text-[10px]">
                  {WEEKDAYS.map((w, i) => (
                    <div key={i} className="py-0.5 sm:py-1">
                      {w}
                    </div>
                  ))}
                </div>

                {/* days */}
                <div className="grid grid-cols-7 gap-0.5">
                  {cells.map((d, i) => {
                    const inMonth = d.getMonth() === viewMonth;
                    const isSelected = sameDay(d, selected);
                    const isToday = sameDay(d, today);
                    return (
                      <button
                        type="button"
                        key={i}
                        onClick={() => pick(d)}
                        className={cn(
                          "relative grid h-7 w-full place-items-center rounded-lg text-[11px] transition sm:h-8 sm:text-[13px]",
                          inMonth ? "text-white/90" : "text-white/25",
                          !isSelected && "hover:bg-white/15"
                        )}
                        style={
                          isSelected
                            ? {
                                backgroundImage:
                                  "linear-gradient(135deg, #7c8cff, #b06bff 55%, #ff6bd0)",
                                boxShadow:
                                  "0 6px 14px -8px rgba(124,140,255,0.8), inset 0 1px 0 rgba(255,255,255,0.5)",
                              }
                            : undefined
                        }
                      >
                        {d.getDate()}
                        {isToday && !isSelected && (
                          <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#a5b4ff]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* footer */}
            <div className="mt-1.5 flex items-center justify-between border-t border-white/10 pt-1.5 sm:mt-2 sm:pt-2">
              <button
                type="button"
                onClick={() => pick(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))}
                className="rounded-lg px-2 py-1 text-[11px] font-medium text-white/70 transition hover:bg-white/10 sm:px-2.5 sm:text-xs"
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => pick(new Date())}
                className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[#a5b4ff] transition hover:bg-white/10 sm:px-2.5 sm:text-xs"
              >
                Today
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
