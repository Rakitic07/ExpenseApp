import { createHash, timingSafeEqual } from "crypto";
import { Pool } from "pg";

// Length-independent, timing-safe comparison (hash both to a fixed size first,
// otherwise timingSafeEqual throws on differing lengths and leaks length info).
export function secretsMatch(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export type GateResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string };

// Validates the two admin secrets against the server env and returns the DB URL
// to connect with. The AUTH_SECRET is the real gate; the DATABASE_URL must
// match the server's own (defence in depth against SSRF to arbitrary hosts).
export function adminGate(databaseUrl: string, authSecret: string): GateResult {
  const serverSecret = process.env.AUTH_SECRET;
  if (!serverSecret) {
    return { ok: false, status: 500, error: "Server is not configured for admin access." };
  }
  if (!secretsMatch(authSecret, serverSecret)) {
    return { ok: false, status: 401, error: "Invalid credentials." };
  }
  const url = databaseUrl.trim();
  if (!/^postgres(ql)?:\/\//i.test(url)) {
    return { ok: false, status: 400, error: "DATABASE_URL must be a valid PostgreSQL connection string." };
  }
  const envDbUrl = process.env.DATABASE_URL;
  if (envDbUrl && !secretsMatch(url, envDbUrl.trim())) {
    return { ok: false, status: 401, error: "Invalid credentials." };
  }
  return { ok: true, url };
}

export function makeAdminPool(url: string): Pool {
  return new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 8000,
    statement_timeout: 8000,
  });
}
