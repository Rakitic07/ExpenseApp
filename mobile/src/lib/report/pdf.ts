import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import type { Breakdown, ReportData, ReportOptions, TrendPoint } from './data';
import { makePdfMoney } from './data';

// A4 portrait.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

const INK = rgb(0.1, 0.1, 0.18);
const MUTED = rgb(0.45, 0.45, 0.55);
const FAINT = rgb(0.62, 0.62, 0.7);
const VIOLET = rgb(0.545, 0.482, 1);
const HAIR = rgb(0.88, 0.88, 0.92);
const ZEBRA = rgb(0.965, 0.965, 0.98);
const HEADER_BG = rgb(0.16, 0.14, 0.28);

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  y: number; // top-down cursor (distance from bottom is PAGE_H - y conceptually; we track y as "pen from top")
  font: PDFFont;
  bold: PDFFont;
};

function newPage(ctx: Ctx): void {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.y = MARGIN; // y measured from the TOP
}

// Available vertical space below the current cursor (before bottom margin).
function remaining(ctx: Ctx): number {
  return PAGE_H - MARGIN - ctx.y;
}

function ensure(ctx: Ctx, needed: number): void {
  if (remaining(ctx) < needed) newPage(ctx);
}

// Convert a top-down y (baseline offset from top) to pdf-lib's bottom-up coord.
function penY(ctx: Ctx, size: number): number {
  return PAGE_H - ctx.y - size;
}

function drawText(
  ctx: Ctx,
  text: string,
  x: number,
  size: number,
  font: PDFFont,
  color: RGB,
): void {
  ctx.page.drawText(text, { x, y: penY(ctx, size), size, font, color });
}

function fit(font: PDFFont, text: string, size: number, maxW: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + '…', size) > maxW) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

function heading(ctx: Ctx, text: string): void {
  ensure(ctx, 34);
  ctx.y += 8;
  drawText(ctx, text, MARGIN, 13, ctx.bold, INK);
  ctx.y += 18;
  ctx.page.drawLine({
    start: { x: MARGIN, y: PAGE_H - ctx.y },
    end: { x: PAGE_W - MARGIN, y: PAGE_H - ctx.y },
    thickness: 1,
    color: HAIR,
  });
  ctx.y += 12;
}

function drawHeader(ctx: Ctx, data: ReportData): void {
  // Brand band.
  const bandH = 58;
  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_H - bandH,
    width: PAGE_W,
    height: bandH,
    color: HEADER_BG,
  });
  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_H - bandH - 3,
    width: PAGE_W,
    height: 3,
    color: VIOLET,
  });
  ctx.page.drawText('Spendly+', {
    x: MARGIN,
    y: PAGE_H - 30,
    size: 18,
    font: ctx.bold,
    color: rgb(1, 1, 1),
  });
  ctx.page.drawText('Expense report', {
    x: MARGIN,
    y: PAGE_H - 46,
    size: 10,
    font: ctx.font,
    color: rgb(0.8, 0.8, 0.9),
  });
  const right = `${data.spaceName || 'Space'}  ·  ${data.periodLabel}`;
  const rw = ctx.bold.widthOfTextAtSize(right, 11);
  ctx.page.drawText(right, {
    x: PAGE_W - MARGIN - rw,
    y: PAGE_H - 30,
    size: 11,
    font: ctx.bold,
    color: rgb(1, 1, 1),
  });
  const gen = `Generated ${data.generatedAt.toLocaleString()}`;
  const gw = ctx.font.widthOfTextAtSize(gen, 8);
  ctx.page.drawText(gen, {
    x: PAGE_W - MARGIN - gw,
    y: PAGE_H - 46,
    size: 8,
    font: ctx.font,
    color: rgb(0.8, 0.8, 0.9),
  });
  ctx.y = bandH + 14;
}

function summaryCards(ctx: Ctx, data: ReportData, fmt: (v: number) => string): void {
  const gap = 12;
  const cardW = (CONTENT_W - gap * 2) / 3;
  const cardH = 56;
  ensure(ctx, cardH + 8);
  const cards: [string, string][] = [
    ['Total spent', fmt(data.total)],
    ['Transactions', String(data.txnCount)],
    ['Avg / transaction', fmt(data.avgPerTxn)],
  ];
  const top = PAGE_H - ctx.y - cardH;
  cards.forEach(([label, value], i) => {
    const x = MARGIN + i * (cardW + gap);
    ctx.page.drawRectangle({
      x,
      y: top,
      width: cardW,
      height: cardH,
      color: ZEBRA,
      borderColor: HAIR,
      borderWidth: 1,
    });
    ctx.page.drawText(label.toUpperCase(), {
      x: x + 12,
      y: top + cardH - 18,
      size: 8,
      font: ctx.bold,
      color: MUTED,
    });
    ctx.page.drawText(fit(ctx.bold, value, 15, cardW - 24), {
      x: x + 12,
      y: top + 14,
      size: 15,
      font: ctx.bold,
      color: INK,
    });
  });
  ctx.y += cardH + 6;
}

function hbars(ctx: Ctx, items: Breakdown[], fmt: (v: number) => string): void {
  const top = items.slice(0, 8);
  const max = top.reduce((m, b) => Math.max(m, b.value), 0) || 1;
  const rowH = 26;
  const labelW = 120;
  const valW = 96;
  const barMaxW = CONTENT_W - labelW - valW - 12;
  for (const b of top) {
    ensure(ctx, rowH);
    const rowTop = PAGE_H - ctx.y - rowH;
    // Label
    ctx.page.drawText(fit(ctx.font, b.name, 9, labelW), {
      x: MARGIN,
      y: rowTop + 9,
      size: 9,
      font: ctx.font,
      color: INK,
    });
    // Bar track + fill
    const bx = MARGIN + labelW;
    const bw = Math.max(2, (b.value / max) * barMaxW);
    ctx.page.drawRectangle({
      x: bx,
      y: rowTop + 6,
      width: barMaxW,
      height: 12,
      color: ZEBRA,
    });
    ctx.page.drawRectangle({
      x: bx,
      y: rowTop + 6,
      width: bw,
      height: 12,
      color: hexToRgb(b.color),
    });
    // Value + pct
    const vtxt = `${fmt(b.value)}  ·  ${b.pct.toFixed(0)}%`;
    const vw = ctx.font.widthOfTextAtSize(vtxt, 8.5);
    ctx.page.drawText(vtxt, {
      x: PAGE_W - MARGIN - vw,
      y: rowTop + 9,
      size: 8.5,
      font: ctx.font,
      color: MUTED,
    });
    ctx.y += rowH;
  }
}

function trendBars(ctx: Ctx, trend: TrendPoint[], fmt: (v: number) => string): void {
  const pts = trend.filter(t => t.total > 0);
  if (pts.length === 0) {
    ensure(ctx, 20);
    drawText(ctx, 'No spending in this period.', MARGIN, 9, ctx.font, FAINT);
    ctx.y += 18;
    return;
  }
  const max = pts.reduce((m, t) => Math.max(m, t.total), 0) || 1;
  const rowH = 20;
  const labelW = 60;
  const valW = 110;
  const barMaxW = CONTENT_W - labelW - valW - 12;
  for (const t of pts) {
    ensure(ctx, rowH);
    const rowTop = PAGE_H - ctx.y - rowH;
    ctx.page.drawText(fit(ctx.font, t.label, 8.5, labelW), {
      x: MARGIN,
      y: rowTop + 6,
      size: 8.5,
      font: ctx.font,
      color: MUTED,
    });
    const bx = MARGIN + labelW;
    const bw = Math.max(2, (t.total / max) * barMaxW);
    ctx.page.drawRectangle({ x: bx, y: rowTop + 4, width: barMaxW, height: 10, color: ZEBRA });
    ctx.page.drawRectangle({ x: bx, y: rowTop + 4, width: bw, height: 10, color: VIOLET });
    const vtxt = fmt(t.total);
    const vw = ctx.font.widthOfTextAtSize(vtxt, 8);
    ctx.page.drawText(vtxt, {
      x: PAGE_W - MARGIN - vw,
      y: rowTop + 6,
      size: 8,
      font: ctx.font,
      color: MUTED,
    });
    ctx.y += rowH;
  }
}

type Col = { title: string; width: number; align?: 'left' | 'right' };

function table(ctx: Ctx, cols: Col[], rows: string[][]): void {
  const rowH = 18;
  const headH = 20;
  const size = 8.5;
  const drawHead = () => {
    ensure(ctx, headH + rowH);
    const top = PAGE_H - ctx.y - headH;
    ctx.page.drawRectangle({ x: MARGIN, y: top, width: CONTENT_W, height: headH, color: HEADER_BG });
    let x = MARGIN + 6;
    for (const c of cols) {
      const label = c.title.toUpperCase();
      const tw = ctx.bold.widthOfTextAtSize(label, 7.5);
      const tx = c.align === 'right' ? x + c.width - 12 - tw : x;
      ctx.page.drawText(label, { x: tx, y: top + 6, size: 7.5, font: ctx.bold, color: rgb(1, 1, 1) });
      x += c.width;
    }
    ctx.y += headH;
  };

  drawHead();
  rows.forEach((row, ri) => {
    if (remaining(ctx) < rowH) {
      newPage(ctx);
      drawHead();
    }
    const top = PAGE_H - ctx.y - rowH;
    if (ri % 2 === 1) {
      ctx.page.drawRectangle({ x: MARGIN, y: top, width: CONTENT_W, height: rowH, color: ZEBRA });
    }
    let x = MARGIN + 6;
    row.forEach((cell, ci) => {
      const c = cols[ci];
      const txt = fit(ctx.font, cell, size, c.width - 12);
      const tw = ctx.font.widthOfTextAtSize(txt, size);
      const tx = c.align === 'right' ? x + c.width - 12 - tw : x;
      ctx.page.drawText(txt, { x: tx, y: top + 5, size, font: ctx.font, color: INK });
      x += c.width;
    });
    ctx.y += rowH;
  });
}

function hexToRgb(hex: string): RGB {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  if ([r, g, b].some(n => Number.isNaN(n))) return VIOLET;
  return rgb(r, g, b);
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function toBase64(bytes: Uint8Array): string {
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < len ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < len ? B64[b2 & 63] : '=';
  }
  return out;
}

// Build the PDF entirely on-device and return base64 (never uploaded anywhere).
export async function generatePdfBase64(data: ReportData, options: ReportOptions): Promise<string> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { doc, page: doc.addPage([PAGE_W, PAGE_H]), y: MARGIN, font, bold };
  const fmt = makePdfMoney(options.currencyCode);
  const S = options.sections;

  drawHeader(ctx, data);

  if (S.summary) {
    summaryCards(ctx, data, fmt);
  }

  if (S.charts && data.trend.length > 0) {
    heading(ctx, data.trendTitle);
    trendBars(ctx, data.trend, fmt);
  }

  if (S.categories && data.categories.length > 0) {
    heading(ctx, 'Spending by category');
    hbars(ctx, data.categories, fmt);
    table(
      ctx,
      [
        { title: 'Category', width: CONTENT_W - 200 },
        { title: 'Txns', width: 60, align: 'right' },
        { title: 'Amount', width: 140, align: 'right' },
      ],
      data.categories.map(b => [b.name, String(b.count), fmt(b.value)]),
    );
  }

  if (S.payers && data.payers.length > 0) {
    heading(ctx, 'Who paid');
    hbars(ctx, data.payers, fmt);
  }

  if (S.insights) {
    heading(ctx, 'Insights');
    const rows: [string, string][] = [];
    if (data.insights.biggest) {
      const b = data.insights.biggest;
      rows.push(['Biggest expense', `${b.title} — ${fmt(b.amount)} (${shortDate(b.date)})`]);
    }
    if (data.insights.busiestDay) {
      rows.push([
        'Busiest day',
        `${new Date(data.insights.busiestDay.date).toLocaleDateString()} — ${fmt(data.insights.busiestDay.total)}`,
      ]);
    }
    if (data.insights.frequentCategory) {
      rows.push([
        'Most frequent category',
        `${data.insights.frequentCategory.name} (${data.insights.frequentCategory.count} txns)`,
      ]);
    }
    if (rows.length === 0) rows.push(['—', 'No insights for this period.']);
    for (const [k, v] of rows) {
      ensure(ctx, 16);
      drawText(ctx, k, MARGIN, 9, ctx.bold, MUTED);
      drawText(ctx, fit(ctx.font, v, 9, CONTENT_W - 150), MARGIN + 150, 9, ctx.font, INK);
      ctx.y += 16;
    }
  }

  if (S.transactions) {
    heading(ctx, `Transactions (${data.transactions.length})`);
    if (data.transactions.length === 0) {
      ensure(ctx, 16);
      drawText(ctx, 'No transactions in this period.', MARGIN, 9, ctx.font, FAINT);
      ctx.y += 16;
    } else {
      table(
        ctx,
        [
          { title: 'Date', width: 66 },
          { title: 'Title', width: CONTENT_W - 66 - 92 - 84 - 92 },
          { title: 'Category', width: 92 },
          { title: 'Paid by', width: 84 },
          { title: 'Amount', width: 92, align: 'right' },
        ],
        data.transactions.map(e => [
          shortDate(e.date),
          e.title || '—',
          e.category || '—',
          e.paidBy || '—',
          fmt(e.amount),
        ]),
      );
    }
  }

  // Page numbers footer on every page.
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = `Spendly+  ·  page ${i + 1} of ${pages.length}`;
    const w = font.widthOfTextAtSize(label, 8);
    p.drawText(label, { x: (PAGE_W - w) / 2, y: 20, size: 8, font, color: FAINT });
  });

  const bytes = await doc.save();
  return toBase64(bytes);
}
