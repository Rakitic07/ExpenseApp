"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ShieldCheck,
  X,
  KeyRound,
  Database,
  ClipboardPaste,
  Loader2,
  Layers,
  Receipt,
  Coins,
  TrendingUp,
  Eye,
  EyeOff,
} from "lucide-react";

type Space = {
  id: string;
  name: string;
  budget: number | null;
  createdAt: string;
  expenseCount: number;
  total: number;
  firstDate: string | null;
  lastDate: string | null;
};

type Stats = {
  totals: {
    spaces: number;
    expenses: number;
    grandTotal: number;
    avgExpense: number;
    avgPerSpace: number;
  };
  spaces: Space[];
  byCategory: { category: string; count: number; total: number }[];
  topPayers: { payer: string; count: number; total: number }[];
  monthly: { month: string; count: number; total: number }[];
};

const nf = (n: number) =>
  n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

// Pull a single KEY=value pair out of pasted .env-style text. Handles optional
// `export`, spaces around `=`, and single/double quotes around the value.
function parseEnvValue(text: string, key: string): string | null {
  const re = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=\\s*(.+?)\\s*$`, "im");
  const m = text.match(re);
  if (!m) return null;
  let v = m[1].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v || null;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminDashboard({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"fields" | "paste">("fields");
  const [databaseUrl, setDatabaseUrl] = useState("");
  const [authSecret, setAuthSecret] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [showSecrets, setShowSecrets] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  // Wipe everything the moment the panel closes — secrets never linger.
  useEffect(() => {
    if (!open) {
      setMode("fields");
      setDatabaseUrl("");
      setAuthSecret("");
      setPasteText("");
      setShowSecrets(false);
      setError(null);
      setStats(null);
      setLoading(false);
    }
  }, [open]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();

    // Resolve the two secrets from whichever input mode is active.
    let dbUrl = databaseUrl;
    let secret = authSecret;
    if (mode === "paste") {
      const pd = parseEnvValue(pasteText, "DATABASE_URL");
      const ps = parseEnvValue(pasteText, "AUTH_SECRET");
      if (!pd || !ps) {
        setError(
          `Couldn't find ${!pd ? "DATABASE_URL" : ""}${!pd && !ps ? " and " : ""}${
            !ps ? "AUTH_SECRET" : ""
          } in the pasted text.`
        );
        return;
      }
      dbUrl = pd;
      secret = ps;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ databaseUrl: dbUrl, authSecret: secret }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong.");
        return;
      }
      setStats(data as Stats);
      // Drop the raw secrets from state once we have the data back.
      setDatabaseUrl("");
      setAuthSecret("");
      setPasteText("");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  const catMax = useMemo(
    () => Math.max(1, ...(stats?.byCategory.map((c) => c.total) ?? [1])),
    [stats]
  );
  const monthMax = useMemo(
    () => Math.max(1, ...(stats?.monthly.map((m) => m.total) ?? [1])),
    [stats]
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-[max(env(safe-area-inset-top),1rem)]"
          onClick={onClose}
        >
          <div
            className="glass-strong my-auto w-full max-w-4xl rounded-3xl p-5 sm:p-7"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-[#38d9a9] to-[#7c8cff]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold leading-tight">Admin dashboard</h2>
                  <p className="text-xs text-white/50">
                    {stats ? "Database overview" : "Owner access only"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="glass-btn px-2.5 py-2.5"
                aria-label="Close admin dashboard"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!stats ? (
              /* ---------- Credential gate ---------- */
              <form onSubmit={unlock} className="space-y-4">
                <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                  Provide your <span className="text-white/80">DATABASE_URL</span> and{" "}
                  <span className="text-white/80">AUTH_SECRET</span> to unlock a read-only
                  overview of every space. These are sent once over HTTPS to verify you,
                  used for a single query, and <span className="text-white/80">never stored</span>.
                </p>

                {/* Input mode switch: type each field, or paste a whole .env block. */}
                <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1 text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("fields");
                      setError(null);
                    }}
                    className={`flex-1 rounded-xl px-3 py-1.5 transition ${
                      mode === "fields" ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
                    }`}
                  >
                    Enter fields
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("paste");
                      setError(null);
                    }}
                    className={`flex-1 rounded-xl px-3 py-1.5 transition ${
                      mode === "paste" ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
                    }`}
                  >
                    Paste .env
                  </button>
                </div>

                {mode === "fields" ? (
                  <>
                    <label className="block">
                      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/60">
                        <Database className="h-3.5 w-3.5" /> DATABASE_URL
                      </span>
                      <input
                        type={showSecrets ? "text" : "password"}
                        value={databaseUrl}
                        onChange={(e) => setDatabaseUrl(e.target.value)}
                        placeholder="postgresql://…"
                        autoComplete="off"
                        spellCheck={false}
                        className="glass-input font-mono text-sm"
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/60">
                        <KeyRound className="h-3.5 w-3.5" /> AUTH_SECRET
                      </span>
                      <input
                        type={showSecrets ? "text" : "password"}
                        value={authSecret}
                        onChange={(e) => setAuthSecret(e.target.value)}
                        placeholder="••••••••••••••••"
                        autoComplete="off"
                        spellCheck={false}
                        className="glass-input font-mono text-sm"
                        required
                      />
                    </label>
                  </>
                ) : (
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/60">
                      <ClipboardPaste className="h-3.5 w-3.5" /> Paste your .env (both variables)
                    </span>
                    <textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      rows={5}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={
                        'DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"\nAUTH_SECRET="your-long-random-secret"'
                      }
                      className="glass-input resize-y font-mono text-xs leading-relaxed"
                      style={{ filter: showSecrets ? "none" : "blur(4px)" }}
                      required
                    />
                    <span className="mt-1 block text-[11px] text-white/40">
                      Extra lines are ignored — only DATABASE_URL and AUTH_SECRET are read.
                    </span>
                  </label>
                )}

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowSecrets((s) => !s)}
                    className="inline-flex items-center gap-1.5 text-xs text-white/50 transition hover:text-white/80"
                  >
                    {showSecrets ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showSecrets ? "Hide" : "Show"} values
                  </button>
                </div>

                {error && (
                  <p className="rounded-xl border border-[#ff6b6b]/30 bg-[#ff6b6b]/10 px-3 py-2 text-sm text-[#ffb3b3]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="glass-btn-primary w-full justify-center py-3 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" /> Unlock dashboard
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* ---------- Stats view ---------- */
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard icon={<Layers className="h-4 w-4" />} label="Spaces" value={String(stats.totals.spaces)} />
                  <StatCard icon={<Receipt className="h-4 w-4" />} label="Expenses" value={String(stats.totals.expenses)} />
                  <StatCard icon={<Coins className="h-4 w-4" />} label="Grand total" value={nf(stats.totals.grandTotal)} />
                  <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Avg / expense" value={nf(stats.totals.avgExpense)} />
                </div>

                <p className="text-[11px] text-white/40">
                  Amounts are currency-agnostic — currency is a per-device display setting
                  and isn&apos;t stored in the database.
                </p>

                {/* Spaces table */}
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-white/80">
                    Spaces ({stats.spaces.length})
                  </h3>
                  <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-white/45">
                        <tr>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2 text-right">Expenses</th>
                          <th className="px-3 py-2 text-right">Total</th>
                          <th className="px-3 py-2 text-right">Budget</th>
                          <th className="px-3 py-2">Created</th>
                          <th className="px-3 py-2">Activity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.spaces.map((s) => (
                          <tr key={s.id} className="border-t border-white/5">
                            <td className="px-3 py-2 font-medium">{s.name}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{s.expenseCount}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{nf(s.total)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-white/60">
                              {s.budget != null ? nf(s.budget) : "—"}
                            </td>
                            <td className="px-3 py-2 text-white/60">{fmtDate(s.createdAt)}</td>
                            <td className="px-3 py-2 text-white/60">
                              {s.firstDate ? `${fmtDate(s.firstDate)} → ${fmtDate(s.lastDate)}` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Category breakdown */}
                  <section>
                    <h3 className="mb-3 text-sm font-semibold text-white/80">By category</h3>
                    <div className="space-y-2.5">
                      {stats.byCategory.map((c) => (
                        <div key={c.category}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-white/70">{c.category}</span>
                            <span className="tabular-nums text-white/50">
                              {nf(c.total)} · {c.count}×
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#7c8cff] to-[#ff6bd0]"
                              style={{ width: `${(c.total / catMax) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Top payers */}
                  <section>
                    <h3 className="mb-3 text-sm font-semibold text-white/80">Top payers</h3>
                    <div className="space-y-1.5">
                      {stats.topPayers.map((p, i) => (
                        <div
                          key={p.payer + i}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                        >
                          <span className="truncate text-white/80">{p.payer}</span>
                          <span className="ml-3 shrink-0 tabular-nums text-white/55">
                            {nf(p.total)} · {p.count}×
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                {/* Monthly trend */}
                {stats.monthly.length > 0 && (
                  <section>
                    <h3 className="mb-3 text-sm font-semibold text-white/80">Monthly spend</h3>
                    <div className="flex items-end gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-4">
                      {stats.monthly.map((m) => (
                        <div key={m.month} className="flex min-w-[44px] flex-1 flex-col items-center gap-1.5">
                          <span className="text-[10px] tabular-nums text-white/50">{nf(m.total)}</span>
                          <div
                            className="w-full rounded-t-md bg-gradient-to-t from-[#38d9a9] to-[#7c8cff]"
                            style={{ height: `${Math.max(6, (m.total / monthMax) * 120)}px` }}
                            title={`${m.month}: ${nf(m.total)} (${m.count}×)`}
                          />
                          <span className="text-[10px] text-white/45">{m.month.slice(2)}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <button onClick={onClose} className="glass-btn w-full justify-center py-2.5">
                  Close
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-white/45">
        {icon}
        {label}
      </div>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
