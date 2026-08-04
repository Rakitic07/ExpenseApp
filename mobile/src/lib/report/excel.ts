import * as XLSX from 'xlsx';
import type { ReportData, ReportOptions } from './data';
import { renderChartImage } from './chartImage';
import { embedImageBase64 } from './xlsxImage';

type Cell = string | number | Date | null;
type Row = Cell[];

// Excel number format for money using the real currency symbol (Excel renders
// unicode fine, unlike the PDF's standard font).
function moneyFmt(symbol: string): string {
  return `"${symbol}"#,##0.00`;
}

// Apply a number format to every cell in a column (below the header row).
function formatColumn(ws: XLSX.WorkSheet, colIdx: number, z: string, firstDataRow: number): void {
  const ref = ws['!ref'];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  for (let r = firstDataRow; r <= range.e.r; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: colIdx });
    const cell = ws[addr];
    if (cell && cell.t === 'n') cell.z = z;
  }
}

export function generateExcelBase64(data: ReportData, options: ReportOptions): string {
  const money = moneyFmt(options.currencySymbol);
  const wb = XLSX.utils.book_new();
  const S = options.sections;

  // Row on the Summary sheet where the embedded chart image is anchored.
  let chartRow = -1;

  // ── Summary ────────────────────────────────────────────────────────────────
  if (S.summary) {
    const rows: Row[] = [];
    const moneyCells: string[] = [];
    const at = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

    rows.push(['Spendly+ — Expense report']);
    rows.push(['Space', data.spaceName || 'Space']);
    rows.push(['Period', data.periodLabel]);
    rows.push(['Generated', data.generatedAt.toLocaleString()]);
    rows.push([]);
    moneyCells.push(at(rows.length, 1));
    rows.push(['Total spent', data.total]);
    rows.push(['Transactions', data.txnCount]);
    moneyCells.push(at(rows.length, 1));
    rows.push(['Average / transaction', data.avgPerTxn]);
    rows.push([]);

    // Breakdown tables (the colorful donut + bars go in an embedded image below).
    if (data.categories.length > 0) {
      const cats = data.categories.slice(0, 8);
      rows.push(['Spending by category']);
      rows.push(['Category', 'Amount', 'Share %']);
      for (const b of cats) {
        moneyCells.push(at(rows.length, 1));
        rows.push([b.name, b.value, Number(b.pct.toFixed(1))]);
      }
      rows.push([]);
    }

    if (data.payers.length > 0) {
      const payers = data.payers.slice(0, 6);
      rows.push(['Who paid']);
      rows.push(['Paid by', 'Amount', 'Share %']);
      for (const b of payers) {
        moneyCells.push(at(rows.length, 1));
        rows.push([b.name, b.value, Number(b.pct.toFixed(1))]);
      }
      rows.push([]);
    }

    chartRow = rows.length + 1; // a blank row below the tables

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 10 }, { wch: 12 }];
    for (const addr of moneyCells) {
      if (ws[addr] && ws[addr].t === 'n') ws[addr].z = money;
    }
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  }

  // ── By category ──────────────────────────────────────────────────────────────
  if (S.categories && data.categories.length > 0) {
    const rows: Row[] = [['Category', 'Transactions', 'Amount', 'Share %']];
    for (const b of data.categories) {
      rows.push([b.name, b.count, b.value, Number(b.pct.toFixed(1))]);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 10 }];
    formatColumn(ws, 2, money, 1);
    XLSX.utils.book_append_sheet(wb, ws, 'By category');
  }

  // ── By payer ──────────────────────────────────────────────────────────────────
  if (S.payers && data.payers.length > 0) {
    const rows: Row[] = [['Paid by', 'Transactions', 'Amount', 'Share %']];
    for (const b of data.payers) {
      rows.push([b.name, b.count, b.value, Number(b.pct.toFixed(1))]);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 10 }];
    formatColumn(ws, 2, money, 1);
    XLSX.utils.book_append_sheet(wb, ws, 'By payer');
  }

  // ── Trend ──────────────────────────────────────────────────────────────────────
  if (S.charts && data.trend.length > 0) {
    const rows: Row[] = [[data.trendTitle || 'Trend', 'Amount']];
    for (const t of data.trend) rows.push([t.label, t.total]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 18 }, { wch: 16 }];
    formatColumn(ws, 1, money, 1);
    XLSX.utils.book_append_sheet(wb, ws, 'Trend');
  }

  // ── Transactions ────────────────────────────────────────────────────────────────
  if (S.transactions) {
    const rows: Row[] = [
      ['Date', 'Title', 'Category', 'Paid by', 'Payment', 'Amount', 'Notes'],
    ];
    for (const e of data.transactions) {
      const pay = [e.paymentMode, e.paymentDetail].filter(Boolean).join(' · ');
      rows.push([
        new Date(e.date),
        e.title || '',
        e.category || '',
        e.paidBy || '',
        pay,
        e.amount,
        e.notes || '',
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
    ws['!cols'] = [
      { wch: 12 },
      { wch: 28 },
      { wch: 16 },
      { wch: 14 },
      { wch: 18 },
      { wch: 14 },
      { wch: 30 },
    ];
    formatColumn(ws, 0, 'dd/mm/yyyy', 1);
    formatColumn(ws, 5, money, 1);
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
  }

  // Guarantee at least one sheet so XLSX.write never throws.
  if (wb.SheetNames.length === 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['No sections selected']]), 'Report');
  }

  let b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;

  // Embed the colorful app-style chart on the Summary sheet (below the tables).
  if (chartRow >= 0) {
    const chart = renderChartImage({
      categories: data.categories,
      payers: data.payers,
      currencySymbol: options.currencySymbol,
    });
    if (chart) {
      b64 = embedImageBase64(b64, 'Summary', chart.base64, {
        col: 0,
        row: chartRow,
        widthPx: chart.widthPx,
        heightPx: chart.heightPx,
      });
    }
  }

  return b64;
}
