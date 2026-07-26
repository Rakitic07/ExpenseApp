// Central place that decides WHERE API calls go and HOW they authenticate.
//
// Web app (served from the same origin as the API): calls are relative
// ("/api/...") and the browser sends the HttpOnly session cookie automatically.
//
// Native app (Capacitor): the UI is bundled inside the APK and served from
// https://localhost, so it can't share a cookie with the remote backend. The
// remote origin is baked in at build time via NEXT_PUBLIC_API_BASE, and auth
// rides on a Bearer token (the same signed JWT the web app keeps in a cookie)
// which we store locally and attach to every request. This avoids fragile
// cross-site cookies in the WebView entirely.

import { isNativeApp } from "./platform";

// Baked at build time. Empty on the web build (relative, same-origin); set to
// the deployed origin for the native bundle so it talks to the live backend.
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");

const TOKEN_KEY = "spendly_token";

export function apiBase(): string {
  return API_BASE;
}

/** Session token for the native app. Stored only inside the packaged app. */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage disabled — nothing we can do */
  }
}

/**
 * fetch() wrapper used by every API call. Prefixes the base URL and, in the
 * native app, attaches the Bearer token. On the web it's a thin pass-through
 * that keeps cookie-based auth working exactly as before.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = /^https?:\/\//.test(path) ? path : API_BASE + path;
  const headers = new Headers(init.headers);
  const native = isNativeApp();

  if (native) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, {
    ...init,
    headers,
    // Web keeps sending the same-origin session cookie; the native app is
    // token-based and cross-origin, so it must not rely on cookies.
    credentials: native ? "omit" : init.credentials ?? "same-origin",
  });
}
