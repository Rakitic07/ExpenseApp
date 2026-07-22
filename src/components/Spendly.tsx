"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, LogOut, Sparkles, Wallet, ShieldCheck, PartyPopper } from "lucide-react";
import { api } from "@/lib/api";
import type { Expense, ExpenseDraft } from "@/lib/types";
import { CurrencyProvider, formatFor } from "@/lib/currency";
import Background from "./Background";
import AuthCard from "./AuthCard";
import Dashboard from "./Dashboard";
import ExpenseForm from "./ExpenseForm";
import CurrencySelect from "./CurrencySelect";

type Status = "loading" | "guest" | "authed";

export default function Spendly() {
  const [status, setStatus] = useState<Status>("loading");
  const [name, setName] = useState<string>("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadExpenses = useCallback(async () => {
    const { expenses } = await api.listExpenses();
    setExpenses(expenses);
  }, []);

  // Unique, most-recent expense titles for quick re-entry in the form.
  const recentTitles = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of expenses) {
      const t = e.title.trim();
      if (t && !seen.has(t.toLowerCase())) {
        seen.add(t.toLowerCase());
        out.push(t);
      }
      if (out.length >= 8) break;
    }
    return out;
  }, [expenses]);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }

  useEffect(() => {
    (async () => {
      try {
        const me = await api.me();
        if (me.authenticated && me.name) {
          setName(me.name);
          setStatus("authed");
          await loadExpenses();
        } else {
          setStatus("guest");
        }
      } catch {
        setStatus("guest");
      }
    })();
  }, [loadExpenses]);

  async function handleAuthed(n: string) {
    setName(n);
    setStatus("authed");
    await loadExpenses();
  }

  async function handleLogout() {
    await api.logout();
    setExpenses([]);
    setName("");
    setStatus("guest");
  }

  async function handleSave(draft: ExpenseDraft, id?: string) {
    if (id) {
      await api.updateExpense(id, draft);
      showToast("Expense updated");
    } else {
      await api.createExpense(draft);
      showToast(`Added ${draft.title} · ${formatFor(name, draft.amount)}`);
    }
    await loadExpenses();
  }

  async function handleDelete(id: string) {
    await api.deleteExpense(id);
    await loadExpenses();
  }

  return (
    <CurrencyProvider space={name}>
    <main className="relative min-h-screen">
      <Background />

      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#7c8cff] to-[#ff6bd0] shadow-glow sm:h-11 sm:w-11">
              <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight sm:text-lg">Spendly-Plus</h1>
              <p className="truncate text-xs text-white/50">
                {status === "authed" ? `Space · ${name}` : "Liquid-glass expense tracker"}
              </p>
            </div>
          </div>

          {status === "authed" && (
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <CurrencySelect />
              <button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className="glass-btn-primary px-3 py-2.5 sm:px-4"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add expense</span>
              </button>
              <button onClick={handleLogout} className="glass-btn px-3 py-2.5" aria-label="Lock space">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </header>

        {status === "loading" && (
          <div className="grid min-h-[50vh] place-items-center text-white/50">
            <div className="animate-pulse">Loading your space…</div>
          </div>
        )}

        {status === "authed" && (
          <Dashboard
            expenses={expenses}
            spaceName={name}
            onEdit={(e) => {
              setEditing(e);
              setFormOpen(true);
            }}
          />
        )}

        {status === "guest" && (
          <div className="grid min-h-[62vh] items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-6 text-center lg:text-left"
            >
              <span className="pill mx-auto lg:mx-0">
                <Sparkles className="h-3.5 w-3.5" /> iOS-style liquid glass
              </span>
              <h2 className="text-5xl font-bold leading-[1.05] sm:text-6xl">
                Track every expense,
                <br />
                <span className="bg-gradient-to-r from-[#a5b4ff] via-[#e2b0ff] to-[#ff9ed8] bg-clip-text text-transparent">
                  beautifully.
                </span>
              </h2>
              <p className="mx-auto max-w-md text-lg text-white/60 lg:mx-0">
                A calm, glassy home for your daily, monthly and yearly spending.
                Set a passphrase to keep your space private and see your live
                statistics the moment you unlock it.
              </p>
              <ul className="mx-auto flex max-w-md flex-col gap-2.5 text-sm text-white/70 sm:flex-row sm:flex-wrap sm:justify-center lg:mx-0 lg:justify-start">
                <li className="pill">
                  <ShieldCheck className="h-4 w-4 text-[#38d9a9]" /> Private &amp; passphrase-protected
                </li>
                <li className="pill">
                  <Sparkles className="h-4 w-4 text-[#ff6bd0]" /> Live donuts, trends &amp; charts
                </li>
              </ul>
            </motion.div>

            <div className="flex justify-center">
              <AuthCard onAuthed={handleAuthed} />
            </div>
          </div>
        )}
      </div>

      <ExpenseForm
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
        recentTitles={recentTitles}
      />

      {/* Success toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="glass-strong fixed inset-x-0 bottom-6 z-[60] mx-auto flex w-fit items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-medium"
          >
            <PartyPopper className="h-4 w-4 text-[#ffd43b]" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="pb-8 pt-4 text-center text-xs text-white/35">
        Spendly-Plus · built with Next.js · deploy-ready for Vercel
      </footer>
    </main>
    </CurrencyProvider>
  );
}
