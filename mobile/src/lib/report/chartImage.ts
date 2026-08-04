import { Skia, ImageFormat, type SkCanvas, type SkFont } from '@shopify/react-native-skia';
import type { Breakdown } from './data';

/*
 * Renders an app-style colored chart (category donut + "who paid" bars) to a
 * PNG using an offscreen Skia surface, for embedding in the Excel Summary
 * sheet. Best-effort: any failure returns null and the export falls back to the
 * plain data tables. Mirrors the web canvas version.
 */

export type ChartInput = {
  categories: Breakdown[];
  payers: Breakdown[];
  currencySymbol: string;
};

export type ChartImage = { base64: string; widthPx: number; heightPx: number };

const W = 900;
const H = 480;
const INK = '#0f0f14';
const SUB = '#6b7280';
const FALLBACK = '#7c8cff';

function money(symbol: string, v: number): string {
  return `${symbol}${Math.round(v).toLocaleString()}`;
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export function renderChartImage(input: ChartInput): ChartImage | null {
  if (!input.categories.length && !input.payers.length) return null;
  try {
    const surface = Skia.Surface.MakeOffscreen(W, H);
    if (!surface) return null;
    const canvas = surface.getCanvas();

    // Fonts (default typeface). If font creation throws, we bail via catch.
    const fH = Skia.Font(undefined, 20); // headings
    const fB = Skia.Font(undefined, 15); // body
    const fS = Skia.Font(undefined, 14); // small/sub

    const paint = Skia.Paint();
    paint.setAntiAlias(true);

    const fill = (hex: string) => {
      const p = Skia.Paint();
      p.setAntiAlias(true);
      p.setColor(Skia.Color(hex));
      return p;
    };

    // White background.
    canvas.drawRect(Skia.XYWHRect(0, 0, W, H), fill('#ffffff'));

    drawCategories(canvas, input, fill, fH, fB, fS);
    drawPayers(canvas, input, fill, fH, fB, fS);

    const img = surface.makeImageSnapshot();
    const base64 = img.encodeToBase64(ImageFormat.PNG, 100);
    return base64 ? { base64, widthPx: W, heightPx: H } : null;
  } catch {
    return null;
  }
}

function drawText(
  canvas: SkCanvas,
  font: SkFont,
  color: ReturnType<typeof Skia.Paint>,
  str: string,
  x: number,
  y: number,
) {
  canvas.drawText(str, x, y, color, font);
}

function drawCategories(
  canvas: SkCanvas,
  input: ChartInput,
  fill: (hex: string) => ReturnType<typeof Skia.Paint>,
  fH: SkFont,
  fB: SkFont,
  fS: SkFont,
) {
  const cats = input.categories.slice(0, 8);
  if (!cats.length) return;
  const total = cats.reduce((s, c) => s + c.value, 0) || 1;
  const ink = fill(INK);
  const sub = fill(SUB);

  drawText(canvas, fH, ink, 'Spending by category', 24, 40);

  const cx = 150;
  const cy = 270;
  const rO = 108;
  const rI = 62;
  const oval = Skia.XYWHRect(cx - rO, cy - rO, rO * 2, rO * 2);
  let start = -90;
  for (const c of cats) {
    const sweep = (c.value / total) * 360;
    const path = Skia.Path.Make();
    path.moveTo(cx, cy);
    path.addArc(oval, start, sweep);
    path.close();
    canvas.drawPath(path, fill(c.color || FALLBACK));
    start += sweep;
  }
  // Punch the hole.
  canvas.drawCircle(cx, cy, rI, fill('#ffffff'));

  // Legend to the right of the donut.
  let ly = 84;
  const lx = 300;
  for (const c of cats) {
    canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(lx, ly - 11, 14, 14), 3, 3), fill(c.color || FALLBACK));
    drawText(canvas, fB, ink, clip(c.name, 18), lx + 22, ly);
    const pct = `${c.pct.toFixed(1)}%`;
    const w = fS.getTextWidth(pct);
    drawText(canvas, fS, sub, pct, 560 - w, ly);
    ly += 26;
  }
}

function drawPayers(
  canvas: SkCanvas,
  input: ChartInput,
  fill: (hex: string) => ReturnType<typeof Skia.Paint>,
  fH: SkFont,
  fB: SkFont,
  fS: SkFont,
) {
  const payers = input.payers.slice(0, 6);
  if (!payers.length) return;
  const max = payers.reduce((m, p) => Math.max(m, p.value), 0) || 1;
  const ink = fill(INK);
  const sub = fill(SUB);
  const track = fill('#eceef3');

  const x0 = 610;
  const barW = 264;
  drawText(canvas, fH, ink, 'Who paid', x0, 40);

  let y = 84;
  for (const p of payers) {
    drawText(canvas, fB, ink, clip(p.name, 16), x0, y);
    const label = `${p.pct.toFixed(0)}% · ${money(input.currencySymbol, p.value)}`;
    const w = fS.getTextWidth(label);
    drawText(canvas, fS, sub, label, x0 + barW - w, y);

    const ty = y + 10;
    canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x0, ty, barW, 14), 7, 7), track);
    const bw = Math.max(6, (p.value / max) * barW);
    canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x0, ty, bw, 14), 7, 7), fill(p.color || FALLBACK));
    y += 44;
  }
}
