import type { Breakdown } from "./types";

/*
 * Renders an app-style, colored chart to a PNG for embedding in the Excel
 * Summary sheet: a category donut + a "who paid" horizontal bar chart, using
 * the same per-slice colors the app shows. Runs on a hidden <canvas> in the
 * browser; returns null when a canvas isn't available so the export degrades
 * gracefully to the data tables.
 */

export type ChartInput = {
  categories: Breakdown[];
  payers: Breakdown[];
  currencySymbol: string;
};

export type ChartImage = { png: Uint8Array; widthPx: number; heightPx: number };

const W = 900;
const H = 480;
const INK = "#0f0f14";
const SUB = "#6b7280";
const FALLBACK = "#7c8cff";
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function money(symbol: string, v: number): string {
  return `${symbol}${Math.round(v).toLocaleString()}`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawCategories(ctx: CanvasRenderingContext2D, input: ChartInput) {
  const cats = input.categories.slice(0, 8);
  if (!cats.length) return;
  const total = cats.reduce((s, c) => s + c.value, 0) || 1;

  ctx.fillStyle = INK;
  ctx.font = `600 16px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("Spending by category", 24, 34);

  const cx = 150;
  const cy = 260;
  const rO = 108;
  const rI = 62;
  let a0 = -Math.PI / 2;
  for (const c of cats) {
    const a1 = a0 + (c.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rO, a0, a1);
    ctx.closePath();
    ctx.fillStyle = c.color || FALLBACK;
    ctx.fill();
    a0 = a1;
  }
  // Punch the hole.
  ctx.beginPath();
  ctx.arc(cx, cy, rI, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  // Center total.
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText(money(input.currencySymbol, total), cx, cy - 1);
  ctx.fillStyle = SUB;
  ctx.font = `500 10px ${FONT}`;
  ctx.fillText("total", cx, cy + 15);

  // Legend to the right of the donut.
  let ly = 74;
  const lx = 300;
  for (const c of cats) {
    ctx.fillStyle = c.color || FALLBACK;
    roundRect(ctx, lx, ly - 10, 13, 13, 3);
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.font = `600 12px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(c.name.length > 18 ? c.name.slice(0, 17) + "…" : c.name, lx + 20, ly);
    ctx.fillStyle = SUB;
    ctx.textAlign = "right";
    ctx.fillText(`${c.pct.toFixed(1)}%`, 556, ly);
    ly += 25;
  }
}

function drawPayers(ctx: CanvasRenderingContext2D, input: ChartInput) {
  const payers = input.payers.slice(0, 6);
  if (!payers.length) return;
  const max = payers.reduce((m, p) => Math.max(m, p.value), 0) || 1;

  const x0 = 610;
  const barW = 264;
  ctx.fillStyle = INK;
  ctx.font = `600 16px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("Who paid", x0, 34);

  let y = 70;
  for (const p of payers) {
    ctx.fillStyle = "#111827";
    ctx.font = `600 12px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(p.name.length > 16 ? p.name.slice(0, 15) + "…" : p.name, x0, y);
    ctx.fillStyle = SUB;
    ctx.textAlign = "right";
    ctx.fillText(`${p.pct.toFixed(0)}% · ${money(input.currencySymbol, p.value)}`, x0 + barW, y);

    const track = y + 8;
    ctx.fillStyle = "#eceef3";
    roundRect(ctx, x0, track, barW, 13, 6);
    ctx.fill();
    const w = Math.max(5, (p.value / max) * barW);
    ctx.fillStyle = p.color || FALLBACK;
    roundRect(ctx, x0, track, w, 13, 6);
    ctx.fill();
    y += 42;
  }
}

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return null;
  const b64 = dataUrl.slice(comma + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function renderChartPng(input: ChartInput): ChartImage | null {
  if (typeof document === "undefined") return null;
  if (!input.categories.length && !input.payers.length) return null;
  try {
    const scale = 2; // render at 2x for a crisp embedded image
    const canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "alphabetic";
    drawCategories(ctx, input);
    drawPayers(ctx, input);
    const png = dataUrlToBytes(canvas.toDataURL("image/png"));
    return png ? { png, widthPx: W, heightPx: H } : null;
  } catch {
    return null;
  }
}
