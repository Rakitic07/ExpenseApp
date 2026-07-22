"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  CalendarDays,
  Wallet,
  Layers,
  PieChart as PieIcon,
  BarChart3,
  Users,
  Search,
  Trophy,
  Flame,
  Repeat,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { Expense } from "@/lib/types";
import {
  byCategory,
  byPaidBy,
  dailyTotals,
  inMonth,
  inYear,
  monthlyTrend,
  sum,
  yearlyTotals,
  availableYears,
  insights as computeInsights,
  pctChange,
} from "@/lib/analytics";
import { MONTH_LABELS, cn } from "@/lib/utils";
import { categoryMeta, CATEGORY_NAMES } from "@/lib/categories";
import { useBudget } from "@/lib/useBudget";
import { useCurrency } from "@/lib/currency";
import dynamic from "next/dynamic";
import ExpenseList from "./ExpenseList";
import BudgetRing from "./BudgetRing";

// Recharts is heavy, so the charts are code-split out of the initial bundle and
// loaded on demand. This keeps first load (especially on phones) fast; a light
// skeleton holds the layout while each chart's chunk streams in.
const ChartFallback = () => (
  <div className="h-[280px] w-full animate-pulse rounded-2xl bg-white/5" />
);
const CategoryDonut = dynamic(() => import("./charts/CategoryDonut"), {
  ssr: false,
  loading: ChartFallback,
});
const TrendArea = dynamic(() => import("./charts/TrendArea"), {
  ssr: false,
  loading: ChartFallback,
});
const Bars = dynamic(() => import("./charts/Bars"), {
  ssr: false,
  loading: ChartFallback,
});

type View = "month" | "year" | "all";

function ChartCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-3xl p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white/70">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-white/55">{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: accent + "33" }}>
          {icon}
        </span>
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <div className="mt-0.5 text-xs text-white/50">{sub}</div>}
    </motion.div>
  );
}

function InsightCard({
  icon,
  accent,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  accent: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="glass flex items-center gap-3 rounded-2xl p-3.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: accent + "33" }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-white/45">{label}</p>
        <p className="truncate font-semibold">{value}</p>
        {sub && <p className="truncate text-xs text-white/50">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard({
  expenses,
  readOnly,
  onEdit,
  spaceName = "",
}: {
  expenses: Expense[];
  readOnly?: boolean;
  onEdit?: (e: Expense) => void;
  spaceName?: string;
}) {
  const now = new Date();
  const years = useMemo(() => availableYears(expenses), [expenses]);
  const [view, setView] = useState<View>("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("");

  const { budget, setBudget } = useBudget(spaceName);
  const { format: formatCurrency } = useCurrency();

  const filtered = useMemo(() => {
    if (view === "all") return expenses;
    if (view === "year") return expenses.filter((e) => inYear(e, year));
    return expenses.filter((e) => inMonth(e, year, month));
  }, [expenses, view, year, month]);

  const total = sum(filtered);
  const cats = useMemo(() => byCategory(filtered), [filtered]);
  const payers = useMemo(() => byPaidBy(filtered), [filtered]);
  const topCat = cats[0];
  const ins = useMemo(() => computeInsights(filtered), [filtered]);

  // vs previous period (only meaningful for month / year views)
  const prevTotal = useMemo(() => {
    if (view === "month") {
      const p = new Date(year, month - 1, 1);
      return sum(expenses.filter((e) => inMonth(e, p.getFullYear(), p.getMonth())));
    }
    if (view === "year") return sum(expenses.filter((e) => inYear(e, year - 1)));
    return 0;
  }, [expenses, view, year, month]);
  const delta = view === "all" ? null : pctChange(total, prevTotal);

  const periodDivisor =
    view === "month"
      ? new Date(year, month + 1, 0).getDate()
      : view === "year"
        ? 12
        : Math.max(1, yearlyTotals(expenses).length);
  const avgLabel = view === "month" ? "avg / day" : view === "year" ? "avg / month" : "avg / year";

  const trendData =
    view === "month"
      ? dailyTotals(filtered, year, month).map((d) => ({ month: d.day, total: d.total }))
      : view === "year"
        ? monthlyTrend(filtered, year)
        : monthlyTrend(expenses.filter((e) => inYear(e, year)), year);

  const barData =
    view === "all"
      ? yearlyTotals(expenses).map((y) => ({ label: y.year, total: y.total }))
      : view === "year"
        ? monthlyTrend(filtered, year).map((m) => ({ label: m.month, total: m.total }))
        : dailyTotals(filtered, year, month).map((d) => ({ label: d.day, total: d.total }));

  // Transactions list: apply search + category filter on top of the period.
  const listExpenses = useMemo(() => {
    const q = query.trim().toLowerCase();
    return filtered.filter((e) => {
      if (catFilter && e.category !== catFilter) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.paidBy.toLowerCase().includes(q) ||
        (e.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [filtered, query, catFilter]);

  const periodLabel =
    view === "month" ? `${MONTH_LABELS[month]} ${year}` : view === "year" ? String(year) : "All time";

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
          {(["month", "year", "all"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-xl px-4 py-1.5 text-sm font-medium capitalize transition",
                view === v ? "bg-white/20 text-white shadow-glass-sm" : "text-white/55 hover:text-white"
              )}
            >
              {v === "all" ? "All time" : v}
            </button>
          ))}
        </div>

        {view !== "all" && (
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm outline-none backdrop-blur-xl"
          >
            {years.map((y) => (
              <option key={y} value={y} className="bg-[#0b1030]">
                {y}
              </option>
            ))}
          </select>
        )}

        {view === "month" && (
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm outline-none backdrop-blur-xl"
          >
            {MONTH_LABELS.map((m, i) => (
              <option key={m} value={i} className="bg-[#0b1030]">
                {m}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Budget ring (month view) */}
      {view === "month" && !readOnly && (
        <BudgetRing spent={total} budget={budget} periodLabel="Monthly" onSetBudget={setBudget} />
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Total spent"
          value={formatCurrency(total)}
          sub={
            delta == null ? (
              `${filtered.length} transactions`
            ) : (
              <span className={cn("inline-flex items-center gap-1", delta > 0 ? "text-red-300" : "text-emerald-300")}>
                {delta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {Math.abs(delta).toFixed(0)}% vs last {view}
              </span>
            )
          }
          icon={<Wallet className="h-4 w-4 text-[#7c8cff]" />}
          accent="#7c8cff"
        />
        <Stat
          label={avgLabel}
          value={formatCurrency(total / periodDivisor)}
          sub={`${filtered.length} transactions`}
          icon={<TrendingUp className="h-4 w-4 text-[#38d9a9]" />}
          accent="#38d9a9"
        />
        <Stat
          label="Top category"
          value={topCat ? topCat.name : "—"}
          sub={topCat ? formatCurrency(topCat.value) : undefined}
          icon={<Layers className="h-4 w-4 text-[#ff6bd0]" />}
          accent="#ff6bd0"
        />
        <Stat
          label="Categories used"
          value={String(cats.length)}
          sub={payers.length ? `${payers.length} payer(s)` : undefined}
          icon={<CalendarDays className="h-4 w-4 text-[#ffd43b]" />}
          accent="#ffd43b"
        />
      </div>

      {/* Insights */}
      {ins.count > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <InsightCard
            icon={<Trophy className="h-5 w-5 text-[#ffd43b]" />}
            accent="#ffd43b"
            label="Biggest expense"
            value={ins.biggest ? `${formatCurrency(ins.biggest.amount)}` : "—"}
            sub={ins.biggest ? `${ins.biggest.title} · ${ins.biggest.category}` : undefined}
          />
          <InsightCard
            icon={<Flame className="h-5 w-5 text-[#ff6b6b]" />}
            accent="#ff6b6b"
            label="Busiest day"
            value={
              ins.busiestDay
                ? new Date(ins.busiestDay.date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })
                : "—"
            }
            sub={ins.busiestDay ? formatCurrency(ins.busiestDay.total) : undefined}
          />
          <InsightCard
            icon={<Repeat className="h-5 w-5 text-[#38d9a9]" />}
            accent="#38d9a9"
            label="Most frequent"
            value={ins.frequentCategory ? ins.frequentCategory.name : "—"}
            sub={ins.frequentCategory ? `${ins.frequentCategory.count} times` : undefined}
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Spending by category" icon={<PieIcon className="h-4 w-4" />}>
          <CategoryDonut data={cats} />
        </ChartCard>

        <ChartCard
          title={
            view === "month"
              ? "Daily spending"
              : view === "year"
                ? "Monthly trend"
                : "Yearly totals"
          }
          icon={<BarChart3 className="h-4 w-4" />}
        >
          {view === "year" ? <TrendArea data={trendData} /> : <Bars data={barData} />}
        </ChartCard>

        <ChartCard
          title={view === "month" ? "Trend across the month" : "Trend over time"}
          icon={<TrendingUp className="h-4 w-4" />}
        >
          <TrendArea data={trendData} />
        </ChartCard>

        <ChartCard title="Who paid" icon={<Users className="h-4 w-4" />}>
          <CategoryDonut data={payers} />
        </ChartCard>
      </div>

      {/* List */}
      <div>
        <div className="mb-3 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-medium text-white/70">
            Transactions · {periodLabel}
          </h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="glass-input w-40 py-2 pl-9 text-sm sm:w-52"
              />
            </div>
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm outline-none backdrop-blur-xl"
            >
              <option value="" className="bg-[#0b1030]">
                All categories
              </option>
              {CATEGORY_NAMES.map((c) => (
                <option key={c} value={c} className="bg-[#0b1030]">
                  {categoryMeta(c).emoji} {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ExpenseList expenses={listExpenses} onEdit={onEdit} readOnly={readOnly} />
      </div>
    </div>
  );
}
