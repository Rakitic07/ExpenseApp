import type { Expense } from "@/lib/types";

export type ReportView = "day" | "month" | "year" | "all";

export type ReportSectionKey =
  | "summary"
  | "charts"
  | "categories"
  | "payers"
  | "insights"
  | "transactions";

export type ReportSections = Record<ReportSectionKey, boolean>;

export type ReportPeriod = {
  view: ReportView;
  year: number;
  /** 0-based month, used when view === "month". */
  month: number;
  /** YYYY-MM-DD, used when view === "day". */
  day: string;
};

export type ReportOptions = {
  format: "pdf" | "excel";
  period: ReportPeriod;
  sections: ReportSections;
  spaceName: string;
  currencyCode: string;
  currencyLocale: string;
  currencySymbol: string;
};

export type Breakdown = {
  name: string;
  value: number;
  color: string;
  /** share of the period total, 0–100 */
  pct: number;
  /** number of transactions in this bucket */
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
  /** period-appropriate secondary average (per day / per month / per year) */
  avgLabel: string;
  avgValue: number;
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
