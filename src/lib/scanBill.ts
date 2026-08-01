import { parseBill, type ParsedBill } from "@/lib/billParser";

/*
 * Browser bill scanner for the PWA. Runs OCR fully on-device with tesseract.js
 * (WASM) — the photo never leaves the browser — then reuses the shared heuristic
 * parser. Produces a ~50–100KB JPEG thumbnail via <canvas>; the full photo is
 * discarded. Mirrors the native flow (mobile/src/lib/scan.ts).
 */

export type ScanResult = {
  parsed: ParsedBill;
  thumbnail: string | null; // base64 JPEG data URL, ~50–100KB
  rawText: string;
};

// Target a 50–100KB thumbnail: crisp when enlarged, still small for the DB.
// base64 grows ~4/3, so chars ≈ bytes * 4/3.
const THUMB_MAX_CHARS = 137000; // ~100KB hard cap
const THUMB_MIN_CHARS = 68000; //  ~50KB preferred floor (best-effort)
const THUMB_MAX_DIM = 900;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the image."));
    };
    img.src = url;
  });
}

async function makeThumbnail(file: Blob): Promise<string | null> {
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, THUMB_MAX_DIM / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    // Step quality high→low; the first render under the 30KB cap is the largest
    // (clearest) allowed and usually clears the ~15KB floor. Fall back to that
    // largest under-cap result if we dip below the floor.
    let best: string | null = null;
    for (const q of [0.86, 0.78, 0.7, 0.62, 0.54, 0.46, 0.38, 0.3]) {
      const dataUrl = canvas.toDataURL("image/jpeg", q);
      if (dataUrl.length <= THUMB_MAX_CHARS) {
        if (!best) best = dataUrl;
        if (dataUrl.length >= THUMB_MIN_CHARS) return dataUrl;
        return best;
      }
    }
    return best; // couldn't get under the cap — skip rather than bloat the DB
  } catch {
    return null;
  }
}

// Pre-process the photo for OCR: normalize size (upscale small shots, downscale
// huge ones) and convert to grayscale with a light contrast stretch. Tesseract
// reads clean, appropriately-sized grayscale better than a raw phone photo.
// NOTE: we deliberately do NOT hard-binarize (e.g. Otsu) — on crumpled receipts
// shot against a dark background a global threshold wipes out the text and makes
// OCR worse, not better.
async function preprocessForOcr(file: Blob): Promise<HTMLCanvasElement | Blob> {
  try {
    const img = await loadImage(file);
    const maxDim = Math.max(img.width, img.height);
    let scale = 1;
    if (maxDim > 2200) scale = 2200 / maxDim; // very large → shrink (faster)
    else if (maxDim < 1100) scale = Math.min(2.4, 1500 / maxDim); // small → enlarge
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    // Pass 1: grayscale + track min/max for a simple contrast stretch.
    let min = 255;
    let max = 0;
    for (let i = 0; i < px.length; i += 4) {
      const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
      px[i] = px[i + 1] = px[i + 2] = g;
      if (g < min) min = g;
      if (g > max) max = g;
    }
    const range = Math.max(1, max - min);
    // Pass 2: stretch contrast so faint print separates from the paper.
    for (let i = 0; i < px.length; i += 4) {
      const v = ((px[i] - min) / range) * 255;
      px[i] = px[i + 1] = px[i + 2] = v;
    }
    ctx.putImageData(data, 0, 0);
    return canvas;
  } catch {
    return file; // preprocessing is best-effort; fall back to the raw file
  }
}

// Downscale + compress to a JPEG under OCR.space's ~1MB upload limit. Bigger is
// better for OCR, so we keep the largest dimension we can while staying safely
// under the cap.
const UPLOAD_MAX_DIM = 1600;
const UPLOAD_MAX_BYTES = 1000 * 1024; // stay under the 1MB server/API cap

async function toUploadJpeg(file: Blob): Promise<Blob | null> {
  try {
    const img = await loadImage(file);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // Shrink the longest side progressively; for each size step quality down.
    // We return the first render under the 1MB cap — the largest (crispest) one
    // that fits — which guarantees the accurate server OCR is used even for huge
    // photos instead of falling back to tesseract. A 640px JPEG at q0.45 is a
    // few tens of KB, so a real receipt photo always clears the cap here.
    for (const dim of [UPLOAD_MAX_DIM, 1400, 1200, 1000, 800, 640]) {
      const scale = Math.min(1, dim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      for (const q of [0.85, 0.75, 0.65, 0.55, 0.45]) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", q)
        );
        if (blob && blob.size <= UPLOAD_MAX_BYTES) return blob;
      }
    }
    return null; // nothing fit under the cap (practically impossible) — use tesseract
  } catch {
    return null;
  }
}

// Accurate path: relay a compressed copy to our /api/ocr (OCR.space). Returns
// null when the server has no key, we're offline, or anything fails — callers
// then fall back to on-device tesseract.
async function serverOcr(file: Blob): Promise<string | null> {
  try {
    const jpeg = await toUploadJpeg(file);
    if (!jpeg) return null;
    const form = new FormData();
    form.append("file", jpeg, "bill.jpg");
    const res = await fetch("/api/ocr", { method: "POST", body: form });
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? "").trim();
    return text.length ? text : null;
  } catch {
    return null;
  }
}

async function tesseractOcr(file: Blob): Promise<string> {
  // Lazy-load tesseract so its WASM/worker only downloads when the user scans.
  const Tesseract = (await import("tesseract.js")).default;
  const input = await preprocessForOcr(file);
  const { data } = await Tesseract.recognize(input, "eng");
  return data?.text ?? "";
}

// Prefer the accurate server OCR; fall back to on-device tesseract if it's
// unavailable (no key, offline, upstream error) so scanning always works.
async function runOcr(file: Blob): Promise<string> {
  const server = await serverOcr(file);
  if (server) return server;
  return tesseractOcr(file);
}

// Scan a bill image File (from a camera-capture / file input) → parsed fields +
// tiny thumbnail. The form is the editable preview; the user fills the rest.
export async function scanBillFromFile(file: File): Promise<ScanResult> {
  const [rawText, thumbnail] = await Promise.all([runOcr(file), makeThumbnail(file)]);
  const parsed = parseBill(rawText);
  return { parsed, thumbnail, rawText };
}
