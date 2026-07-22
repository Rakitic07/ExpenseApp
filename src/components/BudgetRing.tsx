"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Target, Check, Pencil } from "lucide-react";
import { useCurrency } from "@/lib/currency";

export default function BudgetRing({
  spent,
  budget,
  periodLabel,
  onSetBudget,
}: {
  spent: number;
  budget: number | null;
  periodLabel: string;
  onSetBudget: (value: number | null) => void;
}) {
  const { format } = useCurrency();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(budget ? String(budget) : "");

  const pct = budget && budget > 0 ? Math.min(spent / budget, 1) : 0;
  const over = budget != null && spent > budget;
  const remaining = budget != null ? budget - spent : 0;

  const size = 132;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  const ringColor = over ? "#ff6b6b" : pct > 0.8 ? "#ffd43b" : "#38d9a9";

  return (
    <div className="glass flex flex-col items-center gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 8px ${ringColor}88)` }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          {budget ? (
            <div>
              <p className="text-2xl font-bold tracking-tight">{Math.round(pct * 100)}%</p>
              <p className="text-[11px] text-white/50">used</p>
            </div>
          ) : (
            <Target className="h-8 w-8 text-white/40" />
          )}
        </div>
      </div>

      <div className="w-full flex-1 text-center sm:text-left">
        <p className="text-xs uppercase tracking-wider text-white/45">
          {periodLabel} budget
        </p>

        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = Number(draft);
              onSetBudget(Number.isFinite(v) && v > 0 ? v : null);
              setEditing(false);
            }}
            className="mt-2 flex items-center gap-2"
          >
            <input
              autoFocus
              type="number"
              min="0"
              inputMode="decimal"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. 30000"
              className="glass-input py-2"
            />
            <button type="submit" className="glass-btn-primary shrink-0 px-3 py-2">
              <Check className="h-4 w-4" />
            </button>
          </form>
        ) : budget ? (
          <>
            <div className="mt-1 flex items-baseline justify-center gap-2 sm:justify-start">
              <span className="text-2xl font-semibold">{format(spent)}</span>
              <span className="text-sm text-white/45">of {format(budget)}</span>
            </div>
            <p className={`mt-1 text-sm font-medium ${over ? "text-red-300" : "text-emerald-300"}`}>
              {over
                ? `${format(Math.abs(remaining))} over budget`
                : `${format(remaining)} left to spend`}
            </p>
            <button
              onClick={() => {
                setDraft(String(budget));
                setEditing(true);
              }}
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-white/50 transition hover:text-white/80"
            >
              <Pencil className="h-3 w-3" /> Edit budget
            </button>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-white/60">
              Set a monthly goal and watch how much you have left.
            </p>
            <button
              onClick={() => {
                setDraft("");
                setEditing(true);
              }}
              className="glass-btn-primary mt-3 px-4 py-2 text-sm"
            >
              <Target className="h-4 w-4" /> Set a budget
            </button>
          </>
        )}
      </div>
    </div>
  );
}
