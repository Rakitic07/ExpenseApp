import type { Expense } from "./types";
import { categoryColor } from "./categories";
import { MONTH_LABELS } from "./utils";

export type Slice = { name: string; value: number; color: string };

export function sum(expenses: Expense[]): number {
  return expenses.reduce((acc, e) => acc + e.amount, 0);
}

export function inMonth(e: Expense, year: number, month: number): boolean {
  const d = new Date(e.date);
  return d.getFullYear() === year && d.getMonth() === month;
}

export function inYear(e: Expense, year: number): boolean {
  return new Date(e.date).getFullYear() === year;
}

export function inDay(e: Expense, dateISO: string): boolean {
  const d = new Date(e.date);
  const t = new Date(dateISO);
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

export function byCategory(expenses: Expense[]): Slice[] {
  const map = new Map<string, number>();
  for (const e of expenses) {
    map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value, color: categoryColor(name) }))
    .sort((a, b) => b.value - a.value);
}

export function byPaidBy(expenses: Expense[]): Slice[] {
  const palette = ["#7c8cff", "#ff6bd0", "#38d9a9", "#ffd43b", "#66d9e8", "#ff922b"];
  const map = new Map<string, number>();
  for (const e of expenses) {
    map.set(e.paidBy, (map.get(e.paidBy) ?? 0) + e.amount);
  }
  return Array.from(map.entries())
    .map(([name, value], i) => ({ name, value, color: palette[i % palette.length] }))
    .sort((a, b) => b.value - a.value);
}

// 12-month trend for a given year.
export function monthlyTrend(
  expenses: Expense[],
  year: number
): { month: string; total: number }[] {
  const totals = new Array(12).fill(0);
  for (const e of expenses) {
    const d = new Date(e.date);
    if (d.getFullYear() === year) totals[d.getMonth()] += e.amount;
  }
  return MONTH_LABELS.map((month, i) => ({ month, total: totals[i] }));
}

// Daily totals for a given month.
export function dailyTotals(
  expenses: Expense[],
  year: number,
  month: number
): { day: string; total: number }[] {
  const days = new Date(year, month + 1, 0).getDate();
  const totals = new Array(days).fill(0);
  for (const e of expenses) {
    const d = new Date(e.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      totals[d.getDate() - 1] += e.amount;
    }
  }
  return totals.map((total, i) => ({ day: String(i + 1), total }));
}

export function yearlyTotals(expenses: Expense[]): { year: string; total: number }[] {
  const map = new Map<number, number>();
  for (const e of expenses) {
    const y = new Date(e.date).getFullYear();
    map.set(y, (map.get(y) ?? 0) + e.amount);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, total]) => ({ year: String(year), total }));
}

export type Insights = {
  biggest: Expense | null;
  busiestDay: { date: string; total: number } | null;
  frequentCategory: { name: string; count: number } | null;
  count: number;
};

export function insights(expenses: Expense[]): Insights {
  if (expenses.length === 0) {
    return { biggest: null, busiestDay: null, frequentCategory: null, count: 0 };
  }

  const biggest = expenses.reduce((a, b) => (b.amount > a.amount ? b : a));

  const dayMap = new Map<string, number>();
  for (const e of expenses) {
    const key = new Date(e.date).toDateString();
    dayMap.set(key, (dayMap.get(key) ?? 0) + e.amount);
  }
  let busiestDay: { date: string; total: number } | null = null;
  for (const [date, total] of dayMap) {
    if (!busiestDay || total > busiestDay.total) busiestDay = { date, total };
  }

  const catCount = new Map<string, number>();
  for (const e of expenses) catCount.set(e.category, (catCount.get(e.category) ?? 0) + 1);
  let frequentCategory: { name: string; count: number } | null = null;
  for (const [name, count] of catCount) {
    if (!frequentCategory || count > frequentCategory.count) frequentCategory = { name, count };
  }

  return { biggest, busiestDay, frequentCategory, count: expenses.length };
}

// Percentage change vs a comparison total. Returns null when there's no base.
export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export function availableYears(expenses: Expense[]): number[] {
  const set = new Set<number>();
  for (const e of expenses) set.add(new Date(e.date).getFullYear());
  set.add(new Date().getFullYear());
  return Array.from(set).sort((a, b) => b - a);
}
