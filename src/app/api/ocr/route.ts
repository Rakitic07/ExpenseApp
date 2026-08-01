import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Accurate bill OCR for the web/PWA. The browser posts a compressed JPEG here;
// we relay it to OCR.space (Google-ML-Kit-class accuracy, far better than the
// on-device tesseract fallback) and return the recognized text. The image is
// used only for this request and is never written to our DB or disk.
//
// The API key lives in the OCRSPACE_API_KEY env var — never hardcoded.

const OCR_ENDPOINT = "https://api.ocr.space/parse/image";
const MAX_BYTES = 1024 * 1024; // OCR.space free tier caps uploads at ~1MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type OcrSpaceResponse = {
  ParsedResults?: { ParsedText?: string }[];
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[];
};

export async function POST(req: Request) {
  const apiKey = process.env.OCRSPACE_API_KEY;
  if (!apiKey) {
    // No key configured — tell the client so it can fall back to on-device OCR.
    return NextResponse.json(
      { error: "ocr_not_configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  // Validate content before sending anything upstream (size + type allow-list).
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  }

  try {
    const upstream = new FormData();
    upstream.append("apikey", apiKey);
    upstream.append("language", "eng");
    upstream.append("OCREngine", "2"); // engine 2 handles receipts/photos best
    upstream.append("scale", "true");
    upstream.append("isTable", "true"); // keeps line structure for the parser
    upstream.append("file", file, file.name || "bill.jpg");

    const res = await fetch(OCR_ENDPOINT, { method: "POST", body: upstream });
    if (!res.ok) {
      return NextResponse.json({ error: "ocr_upstream" }, { status: 502 });
    }
    const data = (await res.json()) as OcrSpaceResponse;
    if (data.IsErroredOnProcessing) {
      const msg = Array.isArray(data.ErrorMessage)
        ? data.ErrorMessage.join("; ")
        : data.ErrorMessage;
      return NextResponse.json(
        { error: "ocr_failed", detail: msg ?? "unknown" },
        { status: 502 }
      );
    }
    const text = (data.ParsedResults ?? [])
      .map((r) => r.ParsedText ?? "")
      .join("\n")
      .trim();
    return NextResponse.json(
      { text },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "ocr_error" }, { status: 502 });
  }
}
