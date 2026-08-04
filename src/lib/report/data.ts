import type { Expense } from "@/lib/types";
import {
  sum,
  inMonth,
  inYear,
  inDay,
  byCategory,
  byPaidBy,
  dailyTotals,
  monthlyTrend,
  yearlyTotals,
  insights as computeInsights,
} from "@/lib/analytics";
import { MONTH_LABELS } from "@/lib/utils";
import type { Breakdown, ReportData, ReportOptions, ReportPeriod } from "./types";

export function filterByPeriod(expenses: Expense[], p: ReportPeriod): Expense[] {
  if (p.view === "all") return expenses;
  if (p.view === "year") return expenses.filter((e) => inYear(e, p.year));
  if (p.view === "day") return expenses.filter((e) => inDay(e, p.day));
  return expenses.filter((e) => inMonth(e, p.year, p.month));
}

export function periodLabel(p: ReportPeriod): string {
  if (p.view === "month") return `${MONTH_LABELS[p.month]} ${p.year}`;
  if (p.view === "year") return String(p.year);
  if (p.view === "day") {
    const d = new Date(p.day);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return "All time";
}

function toBreakdown(
  slices: { name: string; value: number; color: string }[],
  expenses: Expense[],
  keyOf: (e: Expense) => string,
  total: number
): Breakdown[] {
  const counts = new Map<string, number>();
  for (const e of expenses) counts.set(keyOf(e), (counts.get(keyOf(e)) ?? 0) + 1);
  return slices.map((s) => ({
    name: s.name,
    value: s.value,
    color: s.color,
    pct: total > 0 ? (s.value / total) * 100 : 0,
    count: counts.get(s.name) ?? 0,
  }));
}

export function buildReportData(
  allExpenses: Expense[],
  options: ReportOptions
): ReportData {
  const { period } = options;
  const filtered = filterByPeriod(allExpenses, period);
  // Newest first for the transactions table.
  const transactions = [...filtered].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const total = sum(filtered);
  const txnCount = filtered.length;

  const categories = toBreakdown(byCategory(filtered), filtered, (e) => e.category, total);
  const payers = toBreakdown(byPaidBy(filtered), filtered, (e) => e.paidBy, total);

  // Period-appropriate trend + secondary average.
  let trend: { label: string; total: number }[];
  let trendTitle: string;
  let avgLabel: string;
  let avgValue: number;

  if (period.view === "month") {
    trend = dailyTotals(filtered, period.year, period.month).map((d) => ({
      label: d.day,
      total: d.total,
    }));
    trendTitle = "Daily spending";
    const daysInMonth = new Date(period.year, period.month + 1, 0).getDate();
    const now = new Date();
    const isCurrent = now.getFullYear() === period.year && now.getMonth() === period.month;
    const divisor = isCurrent ? Math.max(1, now.getDate()) : daysInMonth;
    avgLabel = "Avg / day";
    avgValue = total / divisor;
  } else if (period.view === "year") {
    trend = monthlyTrend(filtered, period.year).map((m) => ({
      label: m.month,
      total: m.total,
    }));
    trendTitle = "Monthly trend";
    avgLabel = "Avg / month";
    avgValue = total / 12;
  } else if (period.view === "all") {
    trend = yearlyTotals(allExpenses).map((y) => ({ label: y.year, total: y.total }));
    trendTitle = "Yearly totals";
    const years = Math.max(1, trend.length);
    avgLabel = "Avg / year";
    avgValue = total / years;
  } else {
    // day
    trend = [];
    trendTitle = "";
    avgLabel = "Avg / txn";
    avgValue = txnCount > 0 ? total / txnCount : 0;
  }

  const ins = computeInsights(filtered);

  return {
    spaceName: options.spaceName,
    periodLabel: periodLabel(period),
    generatedAt: new Date(),
    total,
    txnCount,
    avgPerTxn: txnCount > 0 ? total / txnCount : 0,
    avgLabel,
    avgValue,
    categories,
    payers,
    trend,
    trendTitle,
    insights: {
      biggest: ins.biggest,
      busiestDay: ins.busiestDay,
      frequentCategory: ins.frequentCategory,
    },
    transactions,
  };
}

/** Format a value using the report's chosen currency (works off the main thread too). */
export function makeFormatter(options: ReportOptions): (v: number) => string {
  return (v: number) => {
    try {
      return new Intl.NumberFormat(options.currencyLocale, {
        style: "currency",
        currency: options.currencyCode,
        maximumFractionDigits: v % 1 === 0 ? 0 : 2,
      }).format(v);
    } catch {
      return `${options.currencySymbol}${v.toFixed(2)}`;
    }
  };
}
