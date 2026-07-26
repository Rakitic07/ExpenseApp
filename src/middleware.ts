import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// CORS for the native app.
//
// The packaged app serves its UI from a local origin (https://localhost on
// Android, capacitor://localhost on iOS) and calls this deployment's /api/*
// cross-origin. Auth is Bearer-token based (not cookies), so we do NOT enable
// credentialed CORS — we only reflect a small allow-list of the Capacitor local
// origins and permit the Authorization header. The web app is same-origin and
// never triggers CORS, so it is unaffected.
const ALLOWED_ORIGINS = new Set([
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
  "ionic://localhost",
]);

function corsHeaders(origin: string): Headers {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", origin);
  h.set("Vary", "Origin");
  h.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "";
  const isAllowed = ALLOWED_ORIGINS.has(origin);

  // Preflight: answer directly with the CORS headers.
  if (req.method === "OPTIONS") {
    if (!isAllowed) return new NextResponse(null, { status: 204 });
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
  }

  const res = NextResponse.next();
  if (isAllowed) {
    for (const [k, v] of corsHeaders(origin)) res.headers.set(k, v);
  }
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
