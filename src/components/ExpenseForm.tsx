"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check, Trash2 } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import type { Expense, ExpenseDraft } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/lib/currency";
import DatePicker from "./DatePicker";

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
      setCategory(editing.category);
      setAmount(String(editing.amount));
      setPaidBy(editing.paidBy);
      setDate(toDateInput(editing.date));
      setNotes(editing.notes ?? "");
    } else {
      setTitle("");
      setCategory(CATEGORIES[0].name);
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
    setBusy(true);
    try {
      await onSave(
        {
          title: title.trim(),
          category,
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
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="glass-strong relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-4xl p-6 sm:max-w-lg sm:rounded-4xl"
          >
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
                    {recentTitles.slice(0, 6).map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setTitle(t)}
                        className="pill text-white/70 transition hover:text-white"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      type="button"
                      key={c.name}
                      onClick={() => setCategory(c.name)}
                      className={cn(
                        "pill transition",
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
