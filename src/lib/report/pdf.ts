import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Breakdown, ReportData, ReportOptions, TrendPoint } from "./types";

// jspdf-autotable stashes the last table's end position here; the type
// augmentation isn't always picked up, so we read it through a narrow cast.
type WithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };
const finalY = (doc: jsPDF): number => (doc as WithAutoTable).lastAutoTable.finalY;

// PDF core fonts (Helvetica) can't render many currency glyphs (e.g. ₹), so the
// report formats money with the ISO code — always ASCII and unambiguous.
function pdfFormatter(options: ReportOptions): (v: number) => string {
  return (v: number) => {
    try {
      return new Intl.NumberFormat(options.currencyLocale, {
        style: "currency",
        currency: options.currencyCode,
        currencyDisplay: "code",
        maximumFractionDigits: v % 1 === 0 ? 0 : 2,
      }).format(v);
    } catch {
      return `${options.currencyCode} ${v.toFixed(2)}`;
    }
  };
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const BRAND: [number, number, number] = [124, 140, 255];
const INK: [number, number, number] = [24, 26, 40];
const MUTED: [number, number, number] = [120, 124, 140];

const PAGE_W = 210;
const PAGE_H = 297;
const M = 14; // margin
const CONTENT_W = PAGE_W - M * 2;

function ellipsize(doc: jsPDF, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t + "…") > maxW) t = t.slice(0, -1);
  return t + "…";
}

export async function generatePdf(
  data: ReportData,
  options: ReportOptions
): Promise<Blob> {
  const fmt = pdfFormatter(options);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = M;

  const ensure = (needed: number) => {
    if (y + needed > PAGE_H - M) {
      doc.addPage();
      y = M;
    }
  };

  const sectionTitle = (text: string) => {
    ensure(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(text, M, y);
    doc.setDrawColor(...BRAND);
    doc.setLineWidth(0.6);
    doc.line(M, y + 1.6, M + 22, y + 1.6);
    y += 8;
  };

  /* ---------- header ---------- */
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, PAGE_W, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("Spendly-Plus", M, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Spending report", M, 18.5);
  doc.setFontSize(9);
  const genStr = data.generatedAt.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  doc.text(`Space: ${data.spaceName}`, PAGE_W - M, 11, { align: "right" });
  doc.text(`Period: ${data.periodLabel}`, PAGE_W - M, 16, { align: "right" });
  doc.text(`Generated: ${genStr}`, PAGE_W - M, 21, { align: "right" });
  y = 34;

  /* ---------- summary cards ---------- */
  if (options.sections.summary) {
    const cards: { label: string; value: string }[] = [
      { label: "Total spent", value: fmt(data.total) },
      { label: "Transactions", value: String(data.txnCount) },
      { label: data.avgLabel, value: fmt(data.avgValue) },
      { label: "Avg / txn", value: fmt(data.avgPerTxn) },
    ];
    const gap = 4;
    const cardW = (CONTENT_W - gap * 3) / 4;
    const cardH = 20;
    cards.forEach((c, i) => {
      const x = M + i * (cardW + gap);
      doc.setFillColor(244, 245, 250);
      doc.setDrawColor(226, 228, 238);
      doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, "FD");
      doc.setTextColor(...MUTED);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(ellipsize(doc, c.label.toUpperCase(), cardW - 6), x + 4, y + 6);
      doc.setTextColor(...INK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(ellipsize(doc, c.value, cardW - 6), x + 4, y + 14);
    });
    y += cardH + 10;
  }

  /* ---------- charts ---------- */
  if (options.sections.charts) {
    if (data.categories.length) {
      sectionTitle("Spending by category");
      y = drawHBars(doc, y, data.categories.slice(0, 10), fmt, ensure);
      y += 4;
    }
    if (data.payers.length) {
      sectionTitle("Who paid");
      y = drawHBars(doc, y, data.payers.slice(0, 10), fmt, ensure);
      y += 4;
    }
    if (data.trend.length) {
      sectionTitle(data.trendTitle);
      y = drawVBars(doc, y, data.trend, fmt, ensure);
      y += 4;
    }
  }

  /* ---------- category table ---------- */
  if (options.sections.categories && data.categories.length) {
    sectionTitle("Category breakdown");
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [["Category", "Transactions", "Share", "Amount"]],
      body: data.categories.map((c) => [
        c.name,
        String(c.count),
        `${c.pct.toFixed(1)}%`,
        fmt(c.value),
      ]),
      ...tableStyles(),
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });
    y = finalY(doc) + 8;
  }

  /* ---------- payer table ---------- */
  if (options.sections.payers && data.payers.length) {
    sectionTitle("Paid by breakdown");
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [["Paid by", "Transactions", "Share", "Amount"]],
      body: data.payers.map((p) => [
        p.name,
        String(p.count),
        `${p.pct.toFixed(1)}%`,
        fmt(p.value),
      ]),
      ...tableStyles(),
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });
    y = finalY(doc) + 8;
  }

  /* ---------- insights ---------- */
  if (options.sections.insights) {
    const rows: [string, string][] = [];
    if (data.insights.biggest) {
      rows.push([
        "Biggest expense",
        `${fmt(data.insights.biggest.amount)} — ${data.insights.biggest.title} (${data.insights.biggest.category})`,
      ]);
    }
    if (data.insights.busiestDay) {
      rows.push([
        "Busiest day",
        `${new Date(data.insights.busiestDay.date).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })} — ${fmt(data.insights.busiestDay.total)}`,
      ]);
    }
    if (data.insights.frequentCategory) {
      rows.push([
        "Most frequent category",
        `${data.insights.frequentCategory.name} (${data.insights.frequentCategory.count}×)`,
      ]);
    }
    if (rows.length) {
      sectionTitle("Insights");
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        body: rows,
        ...tableStyles(),
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 50, textColor: MUTED } },
      });
      y = finalY(doc) + 8;
    }
  }

  /* ---------- transactions ---------- */
  if (options.sections.transactions && data.transactions.length) {
    sectionTitle(`Transactions (${data.transactions.length})`);
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [["Date", "Title", "Category", "Paid by", "Payment", "Amount"]],
      body: data.transactions.map((e) => [
        new Date(e.date).toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
          year: "2-digit",
        }),
        e.title,
        e.category,
        e.paidBy,
        e.paymentMode
          ? e.paymentMode + (e.paymentDetail ? ` · ${e.paymentDetail}` : "")
          : "—",
        fmt(e.amount),
      ]),
      ...tableStyles(),
      columnStyles: {
        0: { cellWidth: 20 },
        4: { cellWidth: 30 },
        5: { halign: "right", cellWidth: 26 },
      },
    });
    y = finalY(doc) + 6;
  }

  /* ---------- page footers ---------- */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      "Generated by Spendly-Plus",
      M,
      PAGE_H - 8
    );
    doc.text(`Page ${i} of ${pages}`, PAGE_W - M, PAGE_H - 8, { align: "right" });
  }

  return doc.output("blob");
}

function tableStyles() {
  return {
    theme: "grid" as const,
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 2,
      lineColor: [230, 232, 240] as [number, number, number],
      lineWidth: 0.1,
      textColor: INK,
    },
    headStyles: {
      fillColor: BRAND,
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: "bold" as const,
      fontSize: 8.5,
    },
    alternateRowStyles: { fillColor: [247, 248, 252] as [number, number, number] },
  };
}

function drawHBars(
  doc: jsPDF,
  startY: number,
  items: Breakdown[],
  fmt: (v: number) => string,
  ensure: (n: number) => void
): number {
  let y = startY;
  const rowH = 8;
  const labelW = 42;
  const valueW = 34;
  const barX = M + labelW;
  const barMaxW = CONTENT_W - labelW - valueW - 4;
  const max = Math.max(...items.map((i) => i.value), 1);

  for (const it of items) {
    ensure(rowH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(ellipsize(doc, it.name, labelW - 3), M, y + 4);
    // track
    doc.setFillColor(238, 240, 248);
    doc.roundedRect(barX, y + 1, barMaxW, 4.5, 1, 1, "F");
    // fill
    const w = Math.max(1, (barMaxW * it.value) / max);
    doc.setFillColor(...hexRgb(it.color));
    doc.roundedRect(barX, y + 1, w, 4.5, 1, 1, "F");
    // value
    doc.setTextColor(...MUTED);
    doc.setFontSize(8);
    doc.text(fmt(it.value), M + CONTENT_W, y + 4, { align: "right" });
    y += rowH;
  }
  return y;
}

function drawVBars(
  doc: jsPDF,
  startY: number,
  trend: TrendPoint[],
  fmt: (v: number) => string,
  ensure: (n: number) => void
): number {
  const plotH = 42;
  const labelH = 6;
  ensure(plotH + labelH + 4);
  const y = startY;
  const baseY = y + plotH;
  const n = trend.length;
  const max = Math.max(...trend.map((t) => t.total), 1);
  const slot = CONTENT_W / n;
  const barW = Math.min(slot * 0.62, 9);

  // baseline
  doc.setDrawColor(220, 222, 232);
  doc.setLineWidth(0.2);
  doc.line(M, baseY, M + CONTENT_W, baseY);

  // peak label
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(`peak ${fmt(max)}`, M + CONTENT_W, y + 2, { align: "right" });

  const labelEvery = Math.max(1, Math.ceil(n / 12));
  trend.forEach((t, i) => {
    const cx = M + slot * i + slot / 2;
    const h = (plotH - 4) * (t.total / max);
    if (t.total > 0) {
      doc.setFillColor(...BRAND);
      doc.roundedRect(cx - barW / 2, baseY - h, barW, h, 0.6, 0.6, "F");
    }
    if (i % labelEvery === 0 || i === n - 1) {
      doc.setFontSize(6.5);
      doc.setTextColor(...MUTED);
      doc.text(String(t.label), cx, baseY + 4, { align: "center" });
    }
  });

  return baseY + labelH;
}
