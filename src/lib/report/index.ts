import type { Expense } from "@/lib/types";
import type { ReportOptions } from "./types";
import { buildReportData } from "./data";

export type {
  ReportOptions,
  ReportPeriod,
  ReportSections,
  ReportSectionKey,
  ReportView,
} from "./types";

function sanitize(s: string): string {
  return s.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke a tick later so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Build the chosen report for the given expenses and download it. Heavy PDF /
 * Excel libraries are code-split and only loaded when the user actually exports.
 */
export async function generateReport(
  expenses: Expense[],
  options: ReportOptions
): Promise<{ filename: string; empty: boolean }> {
  const data = buildReportData(expenses, options);
  const base = `Spendly_${sanitize(options.spaceName || "space")}_${sanitize(
    data.periodLabel
  )}`;

  if (options.format === "pdf") {
    const { generatePdf } = await import("./pdf");
    const blob = await generatePdf(data, options);
    const filename = `${base}.pdf`;
    triggerDownload(blob, filename);
    return { filename, empty: data.txnCount === 0 };
  }

  const { generateExcel } = await import("./excel");
  const blob = await generateExcel(data, options);
  const filename = `${base}.xlsx`;
  triggerDownload(blob, filename);
  return { filename, empty: data.txnCount === 0 };
}
