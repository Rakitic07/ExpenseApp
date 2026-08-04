import { CATEGORY_NAMES } from "@/lib/categories";

/*
 * Pure-JS bill parser shared by the PWA scan flow. Given OCR text it extracts a
 * best-guess amount, date, merchant→title, category, and payment mode/provider
 * using multilingual keyword + number/date heuristics. No network / LLM.
 * (Mirrors mobile/src/lib/billParser.ts.)
 */

export type ParsedBill = {
  title?: string;
  amount?: number;
  date?: string; // YYYY-MM-DD
  category?: string;
  paymentMode?: string; // Cash | UPI | Card
  paymentDetail?: string; // raw provider/bank guess
  confidence: { amount: boolean; date: boolean; title: boolean };
};

// Handles both "1,234.56" (US/IN) and "1.234,56" (EU) plus plain integers.
function toNumber(raw: string): number | null {
  let s = raw.replace(/[^\d.,]/g, "");
  if (!s) return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length === 2) s = parts[0] + "." + parts[1];
    else s = s.replace(/,/g, "");
  } else {
    const parts = s.split(".");
    if (parts.length > 2) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const NUM_RE = /\d[\d.,\s]*\d|\d/g;

function numbersIn(line: string): number[] {
  const out: number[] = [];
  const matches = line.match(NUM_RE) ?? [];
  for (const m of matches) {
    const n = toNumber(m);
    if (n == null) continue;
    if (n <= 0 || n > 9_999_999) continue;
    out.push(n);
  }
  return out;
}

const TOTAL_KEYS =
  /(grand\s*total|total\s*due|amount\s*due|balance\s*due|net\s*payable|total\s*payable|total\s*amount|amount\s*paid|\btotal\b|\bamount\b|\bpaid\b|à\s*payer|gesamt|betrag|importe\s*total|totale|total\s*a\s*pagar|合計|총액)/i;
// Lines we must NOT treat as the grand total (line items, taxes, headers…).
const NON_TOTAL_KEYS =
  /(sub[\s-]*total|tax|vat|gst|cgst|sgst|igst|discount|\bchange\b|round|\bqty\b|\bitem|\bmrp\b|\brate\b|unit\s*price|\bhsn\b|\bsac\b|saving|points|phone|tel|invoice\s*no|bill\s*no|receipt\s*no|order\s*no|gstin|tin)/i;

// Total labels ranked by how strongly they name the final payable amount. The
// highest tier present wins, so "grand total"/"amount due" beats a bare "total"
// (which may also appear as a section header), and item rows never qualify.
const TOTAL_PRIORITY: [RegExp, number][] = [
  [/(grand\s*total|total\s*due|amount\s*due|balance\s*due|net\s*payable|total\s*payable|net\s*amount|total\s*to\s*pay|à\s*payer|total\s*a\s*pagar|合計|총액)/i, 3],
  [/(total\s*amount|amount\s*paid|\bpaid\b|\btotale\b|gesamt|betrag|importe\s*total)/i, 2],
  [/(\btotal\b|\bamount\b|\bbalance\b)/i, 1],
];

function lineTotalPriority(line: string): number {
  for (const [re, p] of TOTAL_PRIORITY) if (re.test(line)) return p;
  return 0;
}

// A leading currency token OCR keeps with the figure ("Rs 195", "₹195", "$9").
const CURRENCY_PREFIX = /^(?:rs\.?|inr|mrp|usd|eur|gbp|₹|\$|€|£)\s*/i;

// True when a line is essentially just the amount — an optional currency token
// followed by digits/separators. Handles the very common case where OCR drops
// the right-aligned total onto its own line beneath the "Total" label.
function looksLikeAmountLine(line: string): boolean {
  const stripped = line.replace(CURRENCY_PREFIX, "").trim();
  return /^[^A-Za-z\u00C0-\u024F]*\d[\d.,\s]*$/.test(stripped);
}

// "Money" numbers only: a currency-tagged number (Rs 195, ₹1,200, $9) OR a
// number with 2 decimals (45.00, 4.63). This deliberately ignores bare integers
// like pincodes, phone numbers, dates and coupon ids so the fallback can't grab
// them — while still catching integer totals that carry a currency symbol.
const MONEY_RE = /(?:rs\.?|inr|₹|\$|€|£)\s*(\d[\d.,]*)|(\d[\d.,]*[.,]\d{2})(?!\d)/gi;

function moneyIn(line: string): number[] {
  const out: number[] = [];
  MONEY_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MONEY_RE.exec(line))) {
    const n = toNumber(m[1] ?? m[2] ?? "");
    if (n != null && n > 0 && n < 9_999_999) out.push(n);
  }
  return out;
}

// Lines whose money value must never count as the grand total: cash tendered,
// change handed back, deposits and struck-through MRPs can all be larger than
// the amount actually paid.
const MONEY_EXCLUDE = /(\bchange\b|tender|\bcash\b|deposit|\bmrp\b)/i;

// The single largest "money" figure on the whole bill (currency-tagged or
// 2-decimal), ignoring tender/change/MRP lines. On a well-printed receipt this
// is the grand total, and it survives OCR that scrambles the totals table onto
// the wrong rows (e.g. the net amount landing on the "Round off" line).
function maxMoneyValue(lines: string[]): number | undefined {
  let best: number | undefined;
  for (const line of lines) {
    if (MONEY_EXCLUDE.test(line)) continue;
    for (const n of moneyIn(line)) if (best == null || n > best) best = n;
  }
  return best;
}

/**
 * Finds the bill's final payable amount rather than the priciest line item.
 * Two independent signals are combined:
 *  1) `keyword` — the number on the strongest total-labelled line ("grand
 *     total" > "total amount" > bare "total"), taking the figure on that line
 *     or the pure-number line right below it.
 *  2) `maxMoney` — the largest currency/2-decimal figure anywhere on the bill.
 * We trust the labelled total when it's plausibly the real grand total (≥ half
 * the biggest money figure); otherwise OCR almost certainly mislabelled a tax /
 * round-off row, so we fall back to the largest money value. This fixes bills
 * where the net total is OCR'd onto a "Round off" row while a tiny GST figure
 * lands on the "Total Amount" label.
 */
function extractAmount(lines: string[]): number | undefined {
  const cands: { priority: number; value: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (NON_TOTAL_KEYS.test(line)) continue;
    const p = lineTotalPriority(line);
    if (!p) continue;
    let nums = numbersIn(line);
    // Label with the figure on the next line (right-aligned total, e.g. a
    // "Total Amount ==>" row whose "Rs 195" wrapped to the following line).
    if (!nums.length) {
      const next = lines[i + 1];
      if (next && !NON_TOTAL_KEYS.test(next) && looksLikeAmountLine(next)) nums = numbersIn(next);
    }
    if (nums.length) cands.push({ priority: p, value: Math.max(...nums) });
  }

  let keyword: number | undefined;
  if (cands.length) {
    const maxP = Math.max(...cands.map((c) => c.priority));
    keyword = cands
      .filter((c) => c.priority === maxP)
      .reduce((a, c) => (c.value > a ? c.value : a), 0);
  }

  const maxMoney = maxMoneyValue(lines);
  if (keyword != null && (maxMoney == null || keyword >= 0.5 * maxMoney)) return keyword;
  return maxMoney ?? keyword;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9,
  oct: 10, nov: 11, dec: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function normYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

// Return the first regex match (scanning all, not just the first) for which
// `build` yields a valid date. This lets us skip a bogus leading match like the
// "TA2026-27/2528" bill number and still find the real "02-08-26" further along.
function firstValidDate(
  text: string,
  re: RegExp,
  build: (m: RegExpMatchArray) => string | null
): string | undefined {
  for (const m of text.matchAll(re)) {
    const r = build(m);
    if (r) return r;
  }
  return undefined;
}

function extractDate(text: string): string | undefined {
  // Separators may be OCR'd with stray spaces ("30 / 05 / 26"), so allow them.
  let r = firstValidDate(
    text,
    /(20\d{2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})/g,
    (m) => {
      const y = +m[1], mo = +m[2], d = +m[3];
      return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(mo)}-${pad(d)}` : null;
    }
  );
  if (r) return r;
  r = firstValidDate(text, /(\d{1,2})\s*([A-Za-z]{3,})\.?\s*,?\s*(\d{2,4})/g, (m) => {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (!mo) return null;
    const d = +m[1], y = normYear(+m[3]);
    return d >= 1 && d <= 31 ? `${y}-${pad(mo)}-${pad(d)}` : null;
  });
  if (r) return r;
  r = firstValidDate(text, /([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{2,4})/g, (m) => {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (!mo) return null;
    const d = +m[2], y = normYear(+m[3]);
    return d >= 1 && d <= 31 ? `${y}-${pad(mo)}-${pad(d)}` : null;
  });
  if (r) return r;
  r = firstValidDate(text, /\b(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{2,4})\b/g, (m) => {
    const a = +m[1], b = +m[2], y = normYear(+m[3]);
    let d = a, mo = b;
    if (a > 12 && b <= 12) {
      d = a; mo = b;
    } else if (b > 12 && a <= 12) {
      d = b; mo = a;
    }
    return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(mo)}-${pad(d)}` : null;
  });
  if (r) return r;
  // OCR often drops the separators ("Date 300526" / "Date 30052026"). Only trust
  // a bare digit run when it's anchored to a "date" label so we don't grab a
  // phone number or amount by mistake.
  return firstValidDate(text, /date\D{0,6}(\d{2})(\d{2})(\d{4}|\d{2})\b/gi, (m) => {
    const d = +m[1], mo = +m[2], y = normYear(+m[3]);
    return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(mo)}-${pad(d)}` : null;
  });
}

const CATEGORY_HINTS: [RegExp, string][] = [
  [/pharmac|chemist|medical|hospital|clinic|drug|apollo|medico|health/i, "Health"],
  [/restaurant|cafe|coffee|\bfood\b|dining|pizza|burger|kitchen|bakery|bar\b|zomato|swiggy|mcdonald|kfc|starbuck|domino|hotel\b/i, "Food"],
  [/petrol|fuel|gasolin|diesel|\bhp\b|iocl|bharat\s*petro|indian\s*oil|shell|\bbp\b/i, "Petrol"],
  [/meat|fish|chicken|mutton|butcher|seafood|poultry/i, "Meat/Fish"],
  [/grocery|supermarket|super\s*market|kirana|vegetable|dairy|milk|mart\b|bigbasket|dmart|reliance\s*fresh/i, "Grocery"],
  [/uber|\bola\b|taxi|\bcab\b|flight|airline|irctc|train|metro|booking|travel|makemytrip|redbus/i, "Travel"],
  [/salon|spa\b|beauty|cosmetic|parlour|parlor/i, "Beauty"],
  [/pharma|book|stationery|school|tuition|course|udemy|coursera/i, "Education"],
  [/electric|water\s*bill|gas\s*bill|broadband|recharge|utility|telecom|airtel|jio|vodafone|\bbill\b/i, "Bills"],
  [/insurance|policy|premium|lic\b/i, "Insurance"],
  [/amazon|flipkart|myntra|ikea|mall|furniture|decor|store\b|shopping/i, "Shopping/Home"],
];

function guessCategory(text: string): string | undefined {
  for (const [re, cat] of CATEGORY_HINTS) {
    if (re.test(text) && CATEGORY_NAMES.includes(cat)) return cat;
  }
  return undefined;
}

function guessPayment(text: string): { mode?: string; detail?: string } {
  const t = text.toLowerCase();
  if (/\bupi\b|g[\s-]*pay|google\s*pay|phonepe|phone\s*pe|paytm|bhim|@ok|@ybl|@paytm|@axl/.test(t)) {
    let detail: string | undefined;
    if (/g[\s-]*pay|google\s*pay|@ok/.test(t)) detail = "Google Pay";
    else if (/phonepe|phone\s*pe|@ybl/.test(t)) detail = "PhonePe";
    else if (/paytm/.test(t)) detail = "Paytm";
    else if (/bhim/.test(t)) detail = "BHIM";
    return { mode: "UPI", detail };
  }
  if (/visa|master\s*card|mastercard|maestro|amex|american\s*express|rupay|credit\s*card|debit\s*card|\bcard\b|xxxx/.test(t)) {
    let detail: string | undefined;
    if (/visa/.test(t)) detail = "Visa";
    else if (/master/.test(t)) detail = "Mastercard";
    else if (/amex|american/.test(t)) detail = "Amex";
    else if (/rupay/.test(t)) detail = "RuPay";
    else if (/hdfc/.test(t)) detail = "HDFC";
    else if (/\bsbi\b/.test(t)) detail = "SBI";
    else if (/icici/.test(t)) detail = "ICICI";
    else if (/axis/.test(t)) detail = "Axis";
    return { mode: "Card", detail };
  }
  if (/\bcash\b|tender|change\s*due/.test(t)) return { mode: "Cash" };
  return {};
}

// Scores how "merchant-name-like" a line is, so OCR gibberish such as
// "nm54 OW zZ & - RQ AR63%" is rejected in favour of a real name like
// "SHREE VISHNU GRAND". Real names are mostly letters forming multi-letter
// words; gibberish is full of digits, stray symbols and 1–2 char fragments.
function titleScore(line: string): number {
  const t = line.trim();
  if (t.length < 3) return -Infinity;
  const letters = (t.match(/[A-Za-z\u00C0-\u024F]/g) ?? []).length;
  const digits = (t.match(/\d/g) ?? []).length;
  const symbols = (t.match(/[^A-Za-z0-9\u00C0-\u024F\s]/g) ?? []).length;
  const nonSpace = t.replace(/\s/g, "").length || 1;
  const alphaRatio = letters / nonSpace;
  // "Real" words: start with a letter and have ≥3 letters total.
  const words = t
    .split(/\s+/)
    .filter((w) => /^[A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F.'&-]{2,}$/.test(w));
  return words.length * 3 + alphaRatio * 5 - digits * 1.5 - symbols * 1.2;
}

// Our own UI strings — if the user accidentally scans an app screenshot instead
// of a receipt, OCR reads these and we must never treat them as a merchant name.
const APP_UI_NOISE =
  /(scan a bill|choose from gallery|what did you spend on|bill fetched|add expense|paid by|auto[-\s]?detected|payment mode)/i;

// Boilerplate that appears near the top of receipts but is never the merchant's
// name: copy markers, service modes, legal-entity suffixes, greetings, etc. We
// skip these so a slogan or "(A Unit of … Pvt Ltd)" line can't win the title.
const TITLE_NOISE =
  /(guest\s*copy|customer\s*copy|duplicate|original\s*copy|take\s*away|dine[\s-]*in|home\s*delivery|tax\s*invoice|cash\s*memo|retail\s*invoice|bill\s*of\s*supply|thank\s*you|visit\s*again|welcome|a\s*unit\s*of|(?:pvt|private)\.?\s*(?:ltd|limited)|\bltd\b|\bllp\b|counter\s*:|\bkot\b)/i;

// Words that strongly signal a business/merchant name — the line carrying one of
// these is almost always the shop title, so we give it a firm bump over slogans
// and taglines that OCR reads just above/below it.
const BUSINESS_HINT =
  /(palace|hotel|restaurant|grand\b|cafe|coffee|bakery|kitchen|foods?|\bbar\b|\binn\b|dhaba|sweets?|stores?|\bmart\b|super\s*market|pharmac|medical|hospital|clinic|traders?|enterprises?|provisions?|departmental|electronics|jewell?ers?)/i;

function guessTitle(lines: string[]): string | undefined {
  let best: string | undefined;
  let bestScore = 1.5; // minimum bar — below this we treat the line as noise
  const top = lines.slice(0, 10);
  for (let i = 0; i < top.length; i++) {
    const line = top[i];
    if (TOTAL_KEYS.test(line) || NON_TOTAL_KEYS.test(line)) continue;
    if (APP_UI_NOISE.test(line) || TITLE_NOISE.test(line)) continue;
    if (/(www\.|http|@|gstin|tel|phone|\+\d|\d{5,})/i.test(line)) continue;
    const clean = line
      .replace(/[*_|]+/g, "")
      .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "") // trim leading/trailing junk ("[ ", " %")
      .trim();
    // Merchant name is usually right at the top, so nudge earlier lines up, and
    // reward lines that read like an actual business name.
    let score = titleScore(clean) - i * 0.4;
    if (BUSINESS_HINT.test(clean)) score += 8;
    if (score > bestScore) {
      bestScore = score;
      best = clean.slice(0, 60);
    }
  }
  return best;
}

export function parseBill(rawText: string): ParsedBill {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const amount = extractAmount(lines);
  const date = extractDate(rawText);
  const title = guessTitle(lines);
  const category = guessCategory(rawText);
  const { mode, detail } = guessPayment(rawText);

  return {
    title,
    amount,
    date,
    category,
    paymentMode: mode,
    paymentDetail: detail,
    confidence: { amount: amount != null, date: !!date, title: !!title },
  };
}
