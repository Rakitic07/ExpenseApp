"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { CATEGORIES, CATEGORY_NAMES } from "@/lib/categories";

// On phones we show only the first TOP_COUNT categories + "Other" by default;
// the rest live behind a "More categories" toggle. The web app shows them all.
const TOP_COUNT = 10;

// True for categories hidden on phones until expanded (everything after the top
// slice, except the always-visible "Other").
function isExtraCategory(name: string): boolean {
  const idx = CATEGORIES.findIndex((c) => c.name === name);
  return idx >= TOP_COUNT && name !== "Other";
}
import type { Expense, ExpenseDraft } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/lib/currency";
import DatePicker from "./DatePicker";

// Distinct accent per quick-suggestion chip so a picked one lights up in colour.
const SUGGESTION_COLORS = ["#7c8cff", "#ff6bd0", "#38d9a9", "#ffd43b"];

function toDateInput(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function ExpenseForm({
  open,
  editing,
  onClose,
  onSave,
  onDelete,
  recentTitles = [],
}: {
  open: boolean;
  editing: Expense | null;
  onClose: () => void;
  onSave: (draft: ExpenseDraft, id?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  recentTitles?: string[];
}) {
  const { currency } = useCurrency();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].name);
  // Free-text label shown only when the "Other" category is picked.
  const [customCategory, setCustomCategory] = useState("");
  // Phones: whether the extra categories are revealed.
  const [catsExpanded, setCatsExpanded] = useState(false);
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [date, setDate] = useState(toDateInput());
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      // A saved category that isn't in our list was entered via "Other" —
      // reselect "Other" and restore its custom label.
      const known = CATEGORY_NAMES.includes(editing.category);
      const cat = known ? editing.category : "Other";
      setCategory(cat);
      setCustomCategory(known ? "" : editing.category);
      // Reveal the extras if the editing category lives among them.
      setCatsExpanded(isExtraCategory(cat));
      setAmount(String(editing.amount));
      setPaidBy(editing.paidBy);
      setDate(toDateInput(editing.date));
      setNotes(editing.notes ?? "");
    } else {
      setTitle("");
      setCategory(CATEGORIES[0].name);
      setCustomCategory("");
      setCatsExpanded(false);
      setAmount("");
      setPaidBy("");
      setDate(toDateInput());
      setNotes("");
    }
    setError(null);
  }, [open, editing]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Enter a valid amount greater than 0.");
      return;
    }
    if (!category) {
      setError("Please pick a category.");
      return;
    }
    // When "Other" is chosen, use the typed label (if any) as the real category.
    const finalCategory =
      category === "Other" && customCategory.trim() ? customCategory.trim() : category;
    setBusy(true);
    try {
      await onSave(
        {
          title: title.trim(),
          category: finalCategory,
          amount: amountNum,
          paidBy: paidBy.trim(),
          date,
          notes: notes.trim() || undefined,
        },
        editing?.id
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          {/* Solid overlay (no backdrop-blur): blurring the whole screen while
              fading in is very expensive on phones and made the popup crawl. */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
          />
          {/* Plain (non-animated) panel: the surface is frosted glass, and
              animating a blurred element re-rasterizes it every frame, which was
              the real cause of the slow, laggy open. A single quick fade on the
              wrapper above is all the motion we need. */}
          <div className="glass-strong relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-4xl p-6 sm:max-w-lg sm:rounded-4xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editing ? "Edit expense" : "Add expense"}
              </h3>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">
                  What did you spend on?
                </label>
                <input
                  className="glass-input"
                  placeholder="e.g. Groceries, Petrol, Dinner"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
                {!editing && recentTitles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {recentTitles.slice(0, 4).map((t, i) => {
                      const color = SUGGESTION_COLORS[i % SUGGESTION_COLORS.length];
                      const active = title.trim() === t;
                      return (
                        <button
                          type="button"
                          key={t}
                          onClick={() => setTitle(t)}
                          className={cn(
                            "pill select-none transition",
                            active ? "text-white" : "text-white/70 hover:text-white"
                          )}
                          // Picked suggestion lights up in its own colour.
                          style={
                            active
                              ? {
                                  background: color + "40",
                                  borderColor: color,
                                  boxShadow: `0 0 0 2px ${color}`,
                                }
                              : undefined
                          }
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">
                  Category
                </label>
                <div
                  className={cn(
                    "flex flex-wrap gap-2",
                    !catsExpanded && "cats-collapsed"
                  )}
                >
                  {CATEGORIES.map((c, i) => (
                    <button
                      type="button"
                      key={c.name}
                      // Tap toggles: tapping the selected category again clears it.
                      // (Works on touch devices, unlike double-click.)
                      onClick={() =>
                        setCategory((prev) => (prev === c.name ? "" : c.name))
                      }
                      title="Tap again to clear"
                      className={cn(
                        "pill select-none transition",
                        // Hidden on phones (until expanded) for everything past
                        // the top slice, except "Other".
                        i >= TOP_COUNT && c.name !== "Other" && "cat-extra",
                        category === c.name
                          ? "ring-2 ring-white/60"
                          : "opacity-70 hover:opacity-100"
                      )}
                      style={
                        category === c.name
                          ? { background: c.color + "40", borderColor: c.color }
                          : undefined
                      }
                    >
                      <span>{c.emoji}</span>
                      {c.name}
                    </button>
                  ))}
                </div>

                {/* Expand/collapse the extra categories — phones only. */}
                <button
                  type="button"
                  onClick={() => setCatsExpanded((v) => !v)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-white/60 transition hover:text-white sm:hidden"
                >
                  {catsExpanded ? (
                    <>
                      Show fewer categories <ChevronUp className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      More categories <ChevronDown className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>

                {/* Extra field appears only for "Other"; it disappears the moment
                    any other category is selected. */}
                {category === "Other" && (
                  <input
                    className="glass-input mt-2"
                    placeholder="Specify category (e.g. Parking, Repairs)"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    autoFocus
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/60">
                    Amount ({currency.symbol})
                  </label>
                  <input
                    className="glass-input"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/60">
                    Date
                  </label>
                  <DatePicker value={date} onChange={setDate} />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">
                  Paid by
                </label>
                <input
                  className="glass-input"
                  placeholder="e.g. Raktim"
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">
                  Notes (optional)
                </label>
                <input
                  className="glass-input"
                  placeholder="Anything worth remembering"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {error && (
                <p className="rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-2.5 text-sm text-red-100">
                  {error}
                </p>
              )}

              <div className="flex items-center gap-3 pt-1">
                {editing && onDelete && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!editing) return;
                      setBusy(true);
                      try {
                        await onDelete(editing.id);
                        onClose();
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="glass-btn border-red-400/30 bg-red-500/15 text-red-100 hover:bg-red-500/25"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="glass-btn-primary flex-1"
                >
                  <Check className="h-4 w-4" />
                  {busy ? "Saving…" : editing ? "Save changes" : "Add expense"}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
