import type { Expense } from '../types';
import {
  sum,
  byCategory,
  byPaidBy,
  dailyTotals,
  monthlyTrend,
  yearlyTotals,
  filterByPeriod,
  periodLabel,
  insights as computeInsights,
  type PeriodView,
  type Slice,
} from '../analytics';

// ── Report option types (mobile) ────────────────────────────────────────────
export type ReportView = PeriodView; // 'day' | 'month' | 'year' | 'all'

export type ReportSectionKey =
  | 'summary'
  | 'charts'
  | 'categories'
  | 'payers'
  | 'insights'
  | 'transactions';

export type ReportSections = Record<ReportSectionKey, boolean>;

export type ReportPeriod = {
  view: ReportView;
  year: number;
  month: number; // 0-based
  day: number; // 1-31
};

export type ReportOptions = {
  format: 'pdf' | 'excel';
  period: ReportPeriod;
  sections: ReportSections;
  spaceName: string;
  currencyCode: string;
  currencySymbol: string;
  currencyLocale: string;
};

export type Breakdown = {
  name: string;
  value: number;
  color: string;
  pct: number; // 0-100
  count: number;
};

export type TrendPoint = { label: string; total: number };

export type ReportData = {
  spaceName: string;
  periodLabel: string;
  generatedAt: Date;
  total: number;
  txnCount: number;
  avgPerTxn: number;
  categories: Breakdown[];
  payers: Breakdown[];
  trend: TrendPoint[];
  trendTitle: string;
  insights: {
    biggest: Expense | null;
    busiestDay: { date: string; total: number } | null;
    frequentCategory: { name: string; count: number } | null;
  };
  transactions: Expense[];
};

export function filterForReport(expenses: Expense[], p: ReportPeriod): Expense[] {
  return filterByPeriod(expenses, p.view, p.year, p.month, p.day);
}

export function reportPeriodLabel(p: ReportPeriod): string {
  return periodLabel(p.view, p.year, p.month, p.day);
}

function toBreakdown(
  slices: Slice[],
  scoped: Expense[],
  keyOf: (e: Expense) => string,
  total: number,
): Breakdown[] {
  const counts = new Map<string, number>();
  for (const e of scoped) {
    const k = keyOf(e);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return slices.map(s => ({
    name: s.name,
    value: s.value,
    color: s.color,
    pct: total > 0 ? (s.value / total) * 100 : 0,
    count: counts.get(s.name) ?? 0,
  }));
}

export function buildReportData(
  allExpenses: Expense[],
  options: ReportOptions,
): ReportData {
  const { period } = options;
  const scoped = filterForReport(allExpenses, period);
  const sorted = [...scoped].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const total = sum(scoped);
  const txnCount = scoped.length;

  const categories = toBreakdown(byCategory(scoped), scoped, e => e.category, total);
  const payers = toBreakdown(byPaidBy(scoped), scoped, e => e.paidBy, total);

  // Trend series adapts to the selected view (day view has no meaningful trend).
  let trend: TrendPoint[] = [];
  let trendTitle = '';
  if (period.view === 'month') {
    trend = dailyTotals(allExpenses, period.year, period.month).map(r => ({
      label: r.day,
      total: r.total,
    }));
    trendTitle = 'Daily spending';
  } else if (period.view === 'year') {
    trend = monthlyTrend(allExpenses, period.year).map(r => ({
      label: r.month,
      total: r.total,
    }));
    trendTitle = 'Monthly spending';
  } else if (period.view === 'all') {
    trend = yearlyTotals(allExpenses).map(r => ({ label: r.year, total: r.total }));
    trendTitle = 'Yearly spending';
  }

  const ins = computeInsights(scoped);

  return {
    spaceName: options.spaceName,
    periodLabel: reportPeriodLabel(period),
    generatedAt: new Date(),
    total,
    txnCount,
    avgPerTxn: txnCount > 0 ? total / txnCount : 0,
    categories,
    payers,
    trend,
    trendTitle,
    insights: {
      biggest: ins.biggest,
      busiestDay: ins.busiestDay,
      frequentCategory: ins.frequentCategory,
    },
    transactions: sorted,
  };
}

// ── Formatting helpers ────────────────────────────────────────────────────────
// PDF uses the standard Helvetica font which cannot render many currency
// glyphs (₹, ﷼, etc.), so PDFs print the ISO code (e.g. "INR 1,234.00"). Excel
// handles unicode fine and uses the real symbol via number formats.
function groupInt(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function makePdfMoney(code: string): (v: number) => string {
  return (v: number) => {
    const neg = v < 0;
    const abs = Math.abs(v);
    const fixed = abs % 1 === 0 ? String(Math.round(abs)) : abs.toFixed(2);
    const [i, d] = fixed.split('.');
    return `${neg ? '-' : ''}${code} ${groupInt(i)}${d ? '.' + d : ''}`;
  };
}
