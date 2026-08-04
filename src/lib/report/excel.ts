import * as XLSX from "xlsx";
import type { ReportData, ReportOptions } from "./types";
import { renderChartPng } from "./chartImage";
import { embedImageInSheet } from "./xlsxImage";

// NOTE: SheetJS is used here for WRITING only (never parsing untrusted input),
// so the known read/parse advisories don't apply to this usage.

type Row = (string | number | Date | null)[];

function moneyFormat(symbol: string): string {
  // Quote the symbol so Excel treats it literally; keep 2 decimals for analysis.
  return `"${symbol}"#,##0.00`;
}

function setColFormat(ws: XLSX.WorkSheet, colIdx: number, z: string, firstDataRow = 1) {
  const range = XLSX.utils.decode_range(ws["!ref"] as string);
  for (let r = firstDataRow; r <= range.e.r; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: colIdx });
    const cell = ws[addr];
    if (cell && typeof cell.v === "number") cell.z = z;
  }
}

export async function generateExcel(
  data: ReportData,
  options: ReportOptions
): Promise<Blob> {
  const money = moneyFormat(options.currencySymbol);
  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: `Spendly-Plus report — ${data.spaceName}`,
    Subject: `Spending report · ${data.periodLabel}`,
    Author: "Spendly-Plus",
    CreatedDate: data.generatedAt,
  };

  /* ---------- Summary ---------- */
  const summaryRows: Row[] = [
    ["Spendly-Plus — Spending report"],
    ["Space", data.spaceName],
    ["Period", data.periodLabel],
    ["Generated", data.generatedAt],
    [],
    ["Metric", "Value"],
    ["Total spent", data.total],
    ["Transactions", data.txnCount],
    [data.avgLabel, data.avgValue],
    ["Avg / transaction", data.avgPerTxn],
  ];
  if (data.insights.biggest) {
    summaryRows.push([
      "Biggest expense",
      `${data.insights.biggest.title} (${data.insights.biggest.category})`,
      data.insights.biggest.amount,
    ]);
  }
  if (data.insights.busiestDay) {
    summaryRows.push([
      "Busiest day",
      new Date(data.insights.busiestDay.date),
      data.insights.busiestDay.total,
    ]);
  }
  if (data.insights.frequentCategory) {
    summaryRows.push([
      "Most frequent category",
      `${data.insights.frequentCategory.name} (${data.insights.frequentCategory.count}x)`,
    ]);
  }

  // Breakdown tables (the colorful donut + bars go in an embedded image below).
  // Layout per row: [name, share %, amount].
  const extraMoney: string[] = [];
  if (data.categories.length) {
    const cats = data.categories.slice(0, 8);
    summaryRows.push([]);
    summaryRows.push(["Spending by category"]);
    summaryRows.push(["Category", "Share %", "Amount"]);
    for (const c of cats) {
      extraMoney.push(XLSX.utils.encode_cell({ r: summaryRows.length, c: 2 }));
      summaryRows.push([c.name, Number(c.pct.toFixed(1)), c.value]);
    }
  }
  if (data.payers.length) {
    const payers = data.payers.slice(0, 6);
    summaryRows.push([]);
    summaryRows.push(["Who paid"]);
    summaryRows.push(["Paid by", "Share %", "Amount"]);
    for (const p of payers) {
      extraMoney.push(XLSX.utils.encode_cell({ r: summaryRows.length, c: 2 }));
      summaryRows.push([p.name, Number(p.pct.toFixed(1)), p.value]);
    }
  }

  // Anchor row for the chart image — a couple of blank rows below the tables.
  const chartRow = summaryRows.length + 1;

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows, { cellDates: true });
  wsSummary["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 16 }, { wch: 12 }];
  // money cells: Total(row6), avg(row8), avgtxn(row9), and any insight amounts col C
  for (const addr of ["B7", "B9", "B10", "C11", "C12", ...extraMoney]) {
    const c = wsSummary[addr];
    if (c && typeof c.v === "number") c.z = money;
  }
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  /* ---------- By category ---------- */
  if (options.sections.categories && data.categories.length) {
    const rows: Row[] = [["Category", "Transactions", "Share %", "Amount"]];
    for (const c of data.categories) {
      rows.push([c.name, c.count, Number(c.pct.toFixed(2)), c.value]);
    }
    rows.push(["Total", data.txnCount, 100, data.total]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 16 }];
    setColFormat(ws, 3, money);
    XLSX.utils.book_append_sheet(wb, ws, "By category");
  }

  /* ---------- By payer ---------- */
  if (options.sections.payers && data.payers.length) {
    const rows: Row[] = [["Paid by", "Transactions", "Share %", "Amount"]];
    for (const p of data.payers) {
      rows.push([p.name, p.count, Number(p.pct.toFixed(2)), p.value]);
    }
    rows.push(["Total", data.txnCount, 100, data.total]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 16 }];
    setColFormat(ws, 3, money);
    XLSX.utils.book_append_sheet(wb, ws, "By payer");
  }

  /* ---------- Trend ---------- */
  if (options.sections.charts && data.trend.length) {
    const rows: Row[] = [[data.trendTitle || "Trend", "Amount"]];
    for (const t of data.trend) rows.push([t.label, t.total]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 16 }, { wch: 16 }];
    setColFormat(ws, 1, money);
    XLSX.utils.book_append_sheet(wb, ws, "Trend");
  }

  /* ---------- Transactions ---------- */
  if (options.sections.transactions && data.transactions.length) {
    const rows: Row[] = [
      ["Date", "Title", "Category", "Paid by", "Payment mode", "Payment detail", "Amount", "Notes"],
    ];
    for (const e of data.transactions) {
      rows.push([
        new Date(e.date),
        e.title,
        e.category,
        e.paidBy,
        e.paymentMode ?? "",
        e.paymentDetail ?? "",
        e.amount,
        e.notes ?? "",
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
    ws["!cols"] = [
      { wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 16 },
      { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 30 },
    ];
    // Date column
    setColFormat(ws, 0, "yyyy-mm-dd");
    // Amount column
    setColFormat(ws, 6, money);
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
  }

  // NOTE: SheetJS `type: "array"` returns an ArrayBuffer — wrap it in a
  // Uint8Array so fflate (in embedImageInSheet) can read it. Without this the
  // image injection silently no-ops and the chart never appears.
  let out: Uint8Array = new Uint8Array(
    XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer
  );

  // Embed the colorful app-style chart on the Summary sheet (below the tables).
  const chart = renderChartPng({
    categories: data.categories,
    payers: data.payers,
    currencySymbol: options.currencySymbol,
  });
  if (chart) {
    out = embedImageInSheet(out, "Summary", chart.png, {
      col: 0,
      row: chartRow,
      widthPx: chart.widthPx,
      heightPx: chart.heightPx,
    });
  }

  return new Blob([out as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
