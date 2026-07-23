"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, LogOut, Sparkles, Wallet, ShieldCheck, PartyPopper, Github } from "lucide-react";
import { api } from "@/lib/api";
import type { Expense, ExpenseDraft } from "@/lib/types";
import { CurrencyProvider, formatFor } from "@/lib/currency";
import {
  readCache,
  writeCache,
  pendingCount,
  draftToExpense,
  enqueueCreate,
  enqueueUpdate,
  enqueueDelete,
  sync as syncStore,
  rememberSpace,
  getLastSpace,
  forgetSpace,
  readBudget,
  setBudgetLocal,
  adoptServerBudget,
  isBudgetDirty,
} from "@/lib/offline";
import Background from "./Background";
import AuthCard from "./AuthCard";
import Dashboard from "./Dashboard";
import ExpenseForm from "./ExpenseForm";
import CurrencySelect from "./CurrencySelect";
import SyncButton from "./SyncButton";

type Status = "loading" | "guest" | "authed";

export default function Spendly() {
  const [status, setStatus] = useState<Status>("loading");
  const [name, setName] = useState<string>("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budget, setBudget] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [syncError, setSyncError] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  // Push queued writes to the DB, then pull the canonical list (when the queue
  // is fully drained). Takes the space explicitly so it can run before the
  // `name` state has settled (e.g. right after auth).
  const runSync = useCallback(async (space: string) => {
    if (!space) return;
    setSyncing(true);
    let ok = true;
    try {
      const { expenses: fresh, budget: freshBudget, mapped, ok: drained } =
        await syncStore(space);
      ok = drained;
      if (Object.keys(mapped).length) {
        setExpenses((prev) =>
          prev.map((e) => (mapped[e.id] ? { ...e, id: mapped[e.id] } : e))
        );
      }
      if (fresh) setExpenses(fresh);
      // `undefined` means the server value wasn't touched this run — leave state.
      if (freshBudget !== undefined) setBudget(freshBudget);
    } catch {
      /* offline or server error — keep the local cache and queued writes */
      ok = false;
    } finally {
      setSyncing(false);
      setSyncError(!ok); // green on success, red on failure
      setPending(pendingCount(space));
    }
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

  // Show cached data instantly, then reconcile with the server in the
  // background — this is the "opens fast even on a slow/absent network" path.
  const enterSpace = useCallback(
    (space: string) => {
      setName(space);
      setStatus("authed");
      rememberSpace(space);
      const cached = readCache(space);
      if (cached.length) setExpenses(cached);
      setBudget(readBudget(space)); // instant; runSync then pulls/pushes the DB value
      setPending(pendingCount(space));
      void runSync(space);
    },
    [runSync]
  );

  useEffect(() => {
    (async () => {
      try {
        // Single startup call: auth state + expenses in one round trip.
        const boot = await api.bootstrap();
        if (boot.authenticated && boot.name) {
          const space = boot.name;
          setName(space);
          setStatus("authed");
          rememberSpace(space);
          const cached = readCache(space);
          if (cached.length) setExpenses(cached);
          const pend = pendingCount(space);
          setPending(pend);

          // Reconcile the budget. A local edit not yet pushed wins (and gets
          // flushed below); otherwise the server value is authoritative. If the
          // server has no budget but this device has an old local-only one,
          // migrate it up so it starts syncing.
          let mustSyncBudget = false;
          if (isBudgetDirty(space)) {
            setBudget(readBudget(space));
            mustSyncBudget = true;
          } else {
            const serverBudget = boot.budget ?? null;
            const local = readBudget(space);
            if (serverBudget == null && local != null) {
              setBudget(local);
              setBudgetLocal(space, local); // marks dirty → pushed by runSync
              mustSyncBudget = true;
            } else {
              adoptServerBudget(space, serverBudget);
              setBudget(serverBudget);
            }
          }

          if (pend > 0 || mustSyncBudget) {
            // Unsynced local writes exist — flush them, then refresh.
            void runSync(space);
          } else if (boot.expenses) {
            setExpenses(boot.expenses);
            writeCache(space, boot.expenses);
          }
        } else {
          setStatus("guest");
        }
      } catch {
        // Offline (or server unreachable): fall back to the last space's cache
        // so the app is still usable without a connection.
        const last = getLastSpace();
        if (last && readCache(last).length) {
          setOnline(false);
          setName(last);
          setStatus("authed");
          setExpenses(readCache(last));
          setBudget(readBudget(last));
          setPending(pendingCount(last));
        } else {
          setStatus("guest");
        }
      }
    })();
  }, [runSync]);

  // Mirror the working set into the cache so a reload/offline open is instant.
  useEffect(() => {
    if (status === "authed" && name) writeCache(name, expenses);
  }, [expenses, status, name]);

  // Detect iOS once so we can slightly shrink the header controls there (they
  // otherwise crowd out the space name on a narrow iPhone). iPadOS 13+ reports
  // as "MacIntel" with touch points, so include that case.
  useEffect(() => {
    const ua = navigator.userAgent || "";
    const iOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(iOS);
  }, []);

  // Auto-sync when connectivity returns; track online/offline for the badge.
  useEffect(() => {
    if (typeof navigator !== "undefined") setOnline(navigator.onLine);
    function onOnline() {
      setOnline(true);
      if (name) void runSync(name);
    }
    function onOffline() {
      setOnline(false);
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [name, runSync]);

  function handleAuthed(n: string) {
    enterSpace(n);
  }

  async function handleLogout() {
    // Best-effort flush so unsynced changes aren't stranded (only if online).
    if (name && typeof navigator !== "undefined" && navigator.onLine && pendingCount(name) > 0) {
      try {
        await runSync(name);
      } catch {
        /* ignore — queued writes stay for next unlock */
      }
    }
    await api.logout();
    forgetSpace();
    setExpenses([]);
    setBudget(null);
    setName("");
    setStatus("guest");
    setPending(0);
  }

  // The monthly budget is a per-space DB setting: update locally for an instant
  // response, then push to the server so every device sees the same goal.
  const handleSetBudget = useCallback(
    (value: number | null) => {
      setBudget(value);
      setBudgetLocal(name, value);
      void runSync(name);
    },
    [name, runSync]
  );

  // Writes are applied locally first (instant + offline-friendly) and queued;
  // runSync then flushes to the DB — a no-op that stays queued if offline.
  function handleSave(draft: ExpenseDraft, id?: string) {
    if (id) {
      setExpenses((prev) => prev.map((e) => (e.id === id ? draftToExpense(draft, e) : e)));
      enqueueUpdate(name, id, draft);
      showToast("Expense updated");
    } else {
      const optimistic = draftToExpense(draft);
      setExpenses((prev) => [optimistic, ...prev]);
      enqueueCreate(name, optimistic.id, draft);
      showToast(`Added ${draft.title} · ${formatFor(name, draft.amount)}`);
    }
    setPending(pendingCount(name));
    void runSync(name);
    return Promise.resolve();
  }

  function handleDelete(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    enqueueDelete(name, id);
    setPending(pendingCount(name));
    void runSync(name);
    return Promise.resolve();
  }

  return (
    <CurrencyProvider space={name}>
    <main className="relative min-h-screen">
      <Background />

      {/*
       * Top padding respects the iOS safe-area inset so the header isn't hidden
       * under the notch / translucent status bar when installed as a PWA. On
       * Android and desktop env(safe-area-inset-top) is 0, so nothing changes.
       */}
      <div className="mx-auto w-full max-w-6xl px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)] sm:px-6 sm:pb-[calc(env(safe-area-inset-bottom)+2.5rem)] sm:pt-[calc(env(safe-area-inset-top)+2.5rem)]">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#7c8cff] to-[#ff6bd0] shadow-glow sm:h-11 sm:w-11">
              <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              {/* `truncate` keeps the name on one line — otherwise "Spendly-Plus"
                  breaks at the hyphen on narrow iPhones and squeezes the space
                  name into an ellipsis. */}
              <h1 className="truncate text-sm font-semibold leading-tight sm:text-lg">
                Spendly-Plus
              </h1>
              <p className="truncate text-xs text-white/50">
                {status === "authed" ? `Space · ${name}` : "Liquid-glass expense tracker"}
              </p>
            </div>
          </div>

          {status === "authed" && (
            <div
              className={`flex shrink-0 items-center gap-1.5 sm:gap-2 ${
                isIOS ? "ios-compact" : ""
              }`}
            >
              <SyncButton
                online={online}
                syncing={syncing}
                pending={pending}
                error={syncError}
                onSync={() => void runSync(name)}
              />
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
            budget={budget}
            onSetBudget={handleSetBudget}
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

      <footer className="flex flex-col items-center gap-2 pb-8 pt-4 text-center text-xs text-white/35">
        <span>Spendly-Plus · built with Next.js · deploy-ready for Vercel</span>
        <a
          href="https://github.com/Rakitic07/ExpenseApp"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View source & creator on GitHub"
          title="Made by Rakitic07 · View on GitHub"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-white/50 transition hover:bg-white/10 hover:text-white/80"
        >
          <Github className="h-4 w-4" />
          <span>Rakitic07</span>
        </a>
      </footer>
    </main>
    </CurrencyProvider>
  );
}
