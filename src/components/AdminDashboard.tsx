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
  TrendingDown,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Activity as ActivityIcon,
  Users,
  Tag,
} from "lucide-react";

/* ---------- types ---------- */

type Totals = {
  spaces: number;
  expenses: number;
  grandTotal: number;
  avgExpense: number;
  avgPerSpace: number;
};
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
type Cat = { category: string; count: number; total: number };
type Payer = { payer: string; count: number; total: number };
type Paged<T> = { total: number; page: number; pageSize: number; items: T[] };
type Bucket = "day" | "week" | "month" | "year";
type ActivityData = {
  bucket: Bucket;
  series: { period: string; count: number; total: number }[];
  performance: { curCount: number; curTotal: number; prevCount: number; prevTotal: number };
  activeSpaces: { name: string; inputs: number; total: number }[];
};
type Tab = "spaces" | "categories" | "payers" | "activity";
type Creds = { databaseUrl: string; authSecret: string };

/* ---------- helpers ---------- */

const nf = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function pct(cur: number, prev: number): string {
  if (prev === 0) return cur > 0 ? "+100%" : "0%";
  const d = ((cur - prev) / prev) * 100;
  return `${d >= 0 ? "+" : ""}${d.toFixed(0)}%`;
}

function parseEnvValue(text: string, key: string): string | null {
  const re = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=\\s*(.+?)\\s*$`, "im");
  const m = text.match(re);
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v || null;
}

const PERIOD_LABEL: Record<Bucket, { cur: string; prev: string }> = {
  day: { cur: "Today", prev: "Yesterday" },
  week: { cur: "This week", prev: "Last week" },
  month: { cur: "This month", prev: "Last month" },
  year: { cur: "This year", prev: "Last year" },
};

/* ---------- component ---------- */

export default function AdminDashboard({ open, onClose }: { open: boolean; onClose: () => void }) {
  // gate inputs
  const [mode, setMode] = useState<"fields" | "paste">("fields");
  const [databaseUrl, setDatabaseUrl] = useState("");
  const [authSecret, setAuthSecret] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [showSecrets, setShowSecrets] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // unlocked state — creds kept only in memory for this session (never on disk)
  const [creds, setCreds] = useState<Creds | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);

  // per-tab lazy data
  const [tab, setTab] = useState<Tab>("spaces");
  const [spaces, setSpaces] = useState<Paged<Space> | null>(null);
  const [categories, setCategories] = useState<Paged<Cat> | null>(null);
  const [payers, setPayers] = useState<Paged<Payer> | null>(null);
  const [bucket, setBucket] = useState<Bucket>("week");
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState<string | null>(null);

  // Wipe everything the moment the panel closes — nothing lingers.
  useEffect(() => {
    if (!open) {
      setMode("fields");
      setDatabaseUrl("");
      setAuthSecret("");
      setPasteText("");
      setShowSecrets(false);
      setError(null);
      setLoading(false);
      setCreds(null);
      setTotals(null);
      setTab("spaces");
      setSpaces(null);
      setCategories(null);
      setPayers(null);
      setBucket("week");
      setActivity(null);
      setTabLoading(false);
      setTabError(null);
    }
  }, [open]);

  async function runSection(
    c: Creds,
    section: string,
    extra: Record<string, unknown> = {}
  ) {
    const res = await fetch("/api/admin/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ ...c, section, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Request failed.");
    return data;
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();

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
      const c: Creds = { databaseUrl: dbUrl, authSecret: secret };
      const ov = await runSection(c, "overview");
      setTotals(ov.totals as Totals);
      setCreds(c);
      setTab("spaces");
      // Load the first tab immediately; other tabs load on demand.
      const sp = await runSection(c, "spaces", { page: 0 });
      setSpaces(sp as Paged<Space>);
      // Clear the raw gate inputs — the working copy lives in `creds`.
      setDatabaseUrl("");
      setAuthSecret("");
      setPasteText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function load(c: Creds, t: Tab, opts: { page?: number; bucket?: Bucket } = {}) {
    setTabLoading(true);
    setTabError(null);
    try {
      if (t === "spaces") setSpaces((await runSection(c, "spaces", { page: opts.page ?? 0 })) as Paged<Space>);
      else if (t === "categories") setCategories((await runSection(c, "categories", { page: opts.page ?? 0 })) as Paged<Cat>);
      else if (t === "payers") setPayers((await runSection(c, "payers", { page: opts.page ?? 0 })) as Paged<Payer>);
      else if (t === "activity") setActivity((await runSection(c, "activity", { bucket: opts.bucket ?? bucket })) as ActivityData);
    } catch (err) {
      setTabError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setTabLoading(false);
    }
  }

  function openTab(t: Tab) {
    setTab(t);
    setTabError(null);
    if (!creds) return;
    // Fetch only the first time a tab is opened (keeps things fast).
    if (t === "spaces" && !spaces) void load(creds, "spaces", { page: 0 });
    else if (t === "categories" && !categories) void load(creds, "categories", { page: 0 });
    else if (t === "payers" && !payers) void load(creds, "payers", { page: 0 });
    else if (t === "activity" && !activity) void load(creds, "activity", { bucket });
  }

  function changeBucket(b: Bucket) {
    setBucket(b);
    if (creds) void load(creds, "activity", { bucket: b });
  }

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
            {/* header */}
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-[#38d9a9] to-[#7c8cff]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold leading-tight">Admin dashboard</h2>
                  <p className="text-xs text-white/50">{creds ? "Database overview" : "Owner access only"}</p>
                </div>
              </div>
              <button onClick={onClose} className="glass-btn px-2.5 py-2.5" aria-label="Close admin dashboard">
                <X className="h-4 w-4" />
              </button>
            </div>

            {!creds ? (
              /* ---------- credential gate ---------- */
              <form onSubmit={unlock} className="space-y-4">
                <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                  Provide your <span className="text-white/80">DATABASE_URL</span> and{" "}
                  <span className="text-white/80">AUTH_SECRET</span> to unlock a read-only overview.
                  They&apos;re verified over HTTPS and kept only in memory for this session to load
                  details on demand — <span className="text-white/80">never saved to disk</span>.
                </p>

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
                      style={{ WebkitTextSecurity: showSecrets ? "none" : "disc" } as React.CSSProperties}
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

                <button type="submit" disabled={loading} className="glass-btn-primary w-full justify-center py-3 disabled:opacity-60">
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
              /* ---------- dashboard ---------- */
              <div className="space-y-5">
                {/* summary cards (loaded on unlock) */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard icon={<Layers className="h-4 w-4" />} label="Spaces" value={totals ? String(totals.spaces) : "—"} />
                  <StatCard icon={<Receipt className="h-4 w-4" />} label="Expenses" value={totals ? String(totals.expenses) : "—"} />
                  <StatCard icon={<Coins className="h-4 w-4" />} label="Grand total" value={totals ? nf(totals.grandTotal) : "—"} />
                  <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Avg / expense" value={totals ? nf(totals.avgExpense) : "—"} />
                </div>

                <p className="text-[11px] text-white/40">
                  Amounts are currency-agnostic — currency is a per-device display setting and isn&apos;t stored.
                </p>

                {/* tab bar */}
                <div className="flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-white/5 p-1 text-sm">
                  <TabBtn active={tab === "spaces"} onClick={() => openTab("spaces")} icon={<Layers className="h-3.5 w-3.5" />} label="Spaces" />
                  <TabBtn active={tab === "categories"} onClick={() => openTab("categories")} icon={<Tag className="h-3.5 w-3.5" />} label="Categories" />
                  <TabBtn active={tab === "payers"} onClick={() => openTab("payers")} icon={<Users className="h-3.5 w-3.5" />} label="Payers" />
                  <TabBtn active={tab === "activity"} onClick={() => openTab("activity")} icon={<ActivityIcon className="h-3.5 w-3.5" />} label="Activity" />
                </div>

                {/* tab content */}
                <div className="min-h-[200px]">
                  {tabLoading ? (
                    <div className="grid h-48 place-items-center text-white/50">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : tabError ? (
                    <p className="rounded-xl border border-[#ff6b6b]/30 bg-[#ff6b6b]/10 px-3 py-2 text-sm text-[#ffb3b3]">{tabError}</p>
                  ) : tab === "spaces" ? (
                    <SpacesTab data={spaces} onPage={(p) => creds && load(creds, "spaces", { page: p })} />
                  ) : tab === "categories" ? (
                    <CategoriesTab data={categories} onPage={(p) => creds && load(creds, "categories", { page: p })} />
                  ) : tab === "payers" ? (
                    <PayersTab data={payers} onPage={(p) => creds && load(creds, "payers", { page: p })} />
                  ) : (
                    <ActivityTab data={activity} bucket={bucket} onBucket={changeBucket} />
                  )}
                </div>

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

/* ---------- sub views ---------- */

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 transition ${
        active ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Pager({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-center gap-3">
      <button type="button" onClick={() => onPage(page - 1)} disabled={page === 0} className="glass-btn px-3 py-2 disabled:opacity-40" aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[6rem] text-center text-sm text-white/60">
        Page {page + 1} of {totalPages}
      </span>
      <button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages - 1} className="glass-btn px-3 py-2 disabled:opacity-40" aria-label="Next page">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function SpacesTab({ data, onPage }: { data: Paged<Space> | null; onPage: (p: number) => void }) {
  if (!data) return null;
  return (
    <div>
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
            {data.items.map((s) => (
              <tr key={s.id} className="border-t border-white/5">
                <td className="px-3 py-2 font-medium">{s.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.expenseCount}</td>
                <td className="px-3 py-2 text-right tabular-nums">{nf(s.total)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-white/60">{s.budget != null ? nf(s.budget) : "—"}</td>
                <td className="px-3 py-2 text-white/60">{fmtDate(s.createdAt)}</td>
                <td className="px-3 py-2 text-white/60">{s.firstDate ? `${fmtDate(s.firstDate)} → ${fmtDate(s.lastDate)}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={onPage} />
    </div>
  );
}

function CategoriesTab({ data, onPage }: { data: Paged<Cat> | null; onPage: (p: number) => void }) {
  const max = useMemo(() => Math.max(1, ...(data?.items.map((c) => c.total) ?? [1])), [data]);
  if (!data) return null;
  return (
    <div>
      <div className="space-y-2.5">
        {data.items.map((c) => (
          <div key={c.category}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-white/70">{c.category}</span>
              <span className="tabular-nums text-white/50">
                {nf(c.total)} · {c.count}×
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full bg-gradient-to-r from-[#7c8cff] to-[#ff6bd0]" style={{ width: `${(c.total / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={onPage} />
    </div>
  );
}

function PayersTab({ data, onPage }: { data: Paged<Payer> | null; onPage: (p: number) => void }) {
  if (!data) return null;
  return (
    <div>
      <div className="space-y-1.5">
        {data.items.map((p, i) => (
          <div key={p.payer + i} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <span className="truncate text-white/80">{p.payer}</span>
            <span className="ml-3 shrink-0 tabular-nums text-white/55">
              {nf(p.total)} · {p.count}×
            </span>
          </div>
        ))}
      </div>
      <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={onPage} />
    </div>
  );
}

function ActivityTab({
  data,
  bucket,
  onBucket,
}: {
  data: ActivityData | null;
  bucket: Bucket;
  onBucket: (b: Bucket) => void;
}) {
  const max = useMemo(() => Math.max(1, ...(data?.series.map((s) => s.count) ?? [1])), [data]);
  const activeMax = useMemo(() => Math.max(1, ...(data?.activeSpaces.map((s) => s.inputs) ?? [1])), [data]);

  const buckets: Bucket[] = ["day", "week", "month", "year"];

  return (
    <div className="space-y-5">
      {/* period selector — computing happens only when a period is picked */}
      <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1 text-sm">
        {buckets.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => onBucket(b)}
            className={`flex-1 rounded-xl px-3 py-1.5 capitalize transition ${
              bucket === b ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
            }`}
          >
            {b === "day" ? "Daily" : b === "week" ? "Weekly" : b === "month" ? "Monthly" : "Yearly"}
          </button>
        ))}
      </div>

      {!data ? (
        <p className="py-8 text-center text-sm text-white/45">Pick a period above to compute usage.</p>
      ) : (
        <>
          {/* performance: this period vs last */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <PerfCard label={PERIOD_LABEL[bucket].cur} count={data.performance.curCount} total={data.performance.curTotal} />
            <PerfCard label={PERIOD_LABEL[bucket].prev} count={data.performance.prevCount} total={data.performance.prevTotal} muted />
            <DeltaCard cur={data.performance.curCount} prev={data.performance.prevCount} />
          </div>

          {/* inputs over time */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-white/80">Inputs over time (how often it&apos;s used)</h3>
            {data.series.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center text-sm text-white/45">No activity in this window.</p>
            ) : (
              <div className="flex items-end gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-4">
                {data.series.map((s, i) => (
                  <div key={s.period + i} className="flex min-w-[40px] flex-1 flex-col items-center gap-1.5">
                    <span className="text-[10px] tabular-nums text-white/60">{s.count}</span>
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-[#38d9a9] to-[#7c8cff]"
                      style={{ height: `${Math.max(6, (s.count / max) * 120)}px` }}
                      title={`${s.period}: ${s.count} input(s) · ${nf(s.total)}`}
                    />
                    <span className="whitespace-nowrap text-[10px] text-white/45">{s.period}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* most active spaces */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-white/80">Most active spaces</h3>
            {data.activeSpaces.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center text-sm text-white/45">No activity in this window.</p>
            ) : (
              <div className="space-y-2">
                {data.activeSpaces.map((s) => (
                  <div key={s.name}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-white/70">{s.name}</span>
                      <span className="tabular-nums text-white/50">
                        {s.inputs} input{s.inputs === 1 ? "" : "s"} · {nf(s.total)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#ffd43b] to-[#ff6bd0]" style={{ width: `${(s.inputs / activeMax) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function PerfCard({ label, count, total, muted }: { label: string; count: number; total: number; muted?: boolean }) {
  return (
    <div className={`rounded-2xl border border-white/10 p-3 ${muted ? "bg-white/[0.03]" : "bg-white/5"}`}>
      <p className="text-[11px] uppercase tracking-wide text-white/45">{label}</p>
      <p className="text-xl font-semibold tabular-nums">
        {count} <span className="text-xs font-normal text-white/50">inputs</span>
      </p>
      <p className="text-xs tabular-nums text-white/50">{nf(total)}</p>
    </div>
  );
}

function DeltaCard({ cur, prev }: { cur: number; prev: number }) {
  const up = cur >= prev;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="text-[11px] uppercase tracking-wide text-white/45">Change</p>
      <p className={`flex items-center gap-1.5 text-xl font-semibold tabular-nums ${up ? "text-[#38d9a9]" : "text-[#ff8787]"}`}>
        {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        {pct(cur, prev)}
      </p>
      <p className="text-xs text-white/50">vs previous period</p>
    </div>
  );
}
