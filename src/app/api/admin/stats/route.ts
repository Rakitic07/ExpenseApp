import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { Pool } from "pg";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The admin dashboard is gated by two shared secrets that only the app owner
// knows: the AUTH_SECRET (verified against the server's env) and the
// DATABASE_URL (used to connect). Nothing here is persisted — the secrets are
// received once over HTTPS, checked, used for a single read-only query, and
// discarded when the request ends.

const bodySchema = z.object({
  databaseUrl: z.string().min(1, "DATABASE_URL is required"),
  authSecret: z.string().min(1, "AUTH_SECRET is required"),
});

// Length-independent, timing-safe comparison (hash both to a fixed size first,
// otherwise timingSafeEqual throws on differing lengths and leaks length info).
function secretsMatch(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function unauthorized() {
  // Generic message — never reveal which of the two secrets was wrong.
  return NextResponse.json(
    { error: "Invalid credentials." },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const serverSecret = process.env.AUTH_SECRET;
  if (!serverSecret) {
    return NextResponse.json(
      { error: "Server is not configured for admin access." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { databaseUrl, authSecret } = parsed.data;

  // Gate: the AUTH_SECRET must match the server's. This is the real
  // authentication — a 64+ char random value is infeasible to brute force.
  if (!secretsMatch(authSecret, serverSecret)) {
    return unauthorized();
  }

  // Only allow Postgres connection strings (no file://, http://, etc.).
  if (!/^postgres(ql)?:\/\//i.test(databaseUrl.trim())) {
    return NextResponse.json(
      { error: "DATABASE_URL must be a valid PostgreSQL connection string." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Defence in depth: if the server has its own DATABASE_URL, require the
  // supplied one to match it so this endpoint can't be pointed at arbitrary
  // hosts (SSRF) even by someone who somehow learned the AUTH_SECRET.
  const envDbUrl = process.env.DATABASE_URL;
  if (envDbUrl && !secretsMatch(databaseUrl.trim(), envDbUrl.trim())) {
    return unauthorized();
  }

  const pool = new Pool({
    connectionString: databaseUrl.trim(),
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 8000,
    statement_timeout: 8000,
  });

  try {
    const [spacesRes, totalsRes, catRes, payerRes, monthlyRes] = await Promise.all([
      pool.query(
        `SELECT l.id,
                l.name,
                l."monthlyBudget" AS budget,
                l."createdAt"     AS created,
                COUNT(e.id)::int  AS expense_count,
                COALESCE(SUM(e.amount), 0)::float AS total,
                MIN(e.date)       AS first_date,
                MAX(e.date)       AS last_date
           FROM "Ledger" l
           LEFT JOIN "Expense" e ON e."ledgerId" = l.id
          GROUP BY l.id
          ORDER BY l."createdAt" ASC`
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count,
                COALESCE(SUM(amount), 0)::float AS total,
                COALESCE(AVG(amount), 0)::float AS avg
           FROM "Expense"`
      ),
      pool.query(
        `SELECT category,
                COUNT(*)::int AS count,
                COALESCE(SUM(amount), 0)::float AS total
           FROM "Expense"
          GROUP BY category
          ORDER BY total DESC`
      ),
      pool.query(
        `SELECT "paidBy" AS payer,
                COUNT(*)::int AS count,
                COALESCE(SUM(amount), 0)::float AS total
           FROM "Expense"
          GROUP BY "paidBy"
          ORDER BY total DESC
          LIMIT 12`
      ),
      pool.query(
        `SELECT to_char(date, 'YYYY-MM') AS month,
                COUNT(*)::int AS count,
                COALESCE(SUM(amount), 0)::float AS total
           FROM "Expense"
          GROUP BY 1
          ORDER BY 1 ASC`
      ),
    ]);

    const spaces = spacesRes.rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      budget: r.budget === null ? null : Number(r.budget),
      createdAt: r.created,
      expenseCount: Number(r.expense_count),
      total: Number(r.total),
      firstDate: r.first_date,
      lastDate: r.last_date,
    }));

    const totalExpenses = Number(totalsRes.rows[0]?.count ?? 0);
    const grandTotal = Number(totalsRes.rows[0]?.total ?? 0);
    const avgExpense = Number(totalsRes.rows[0]?.avg ?? 0);

    return NextResponse.json(
      {
        totals: {
          spaces: spaces.length,
          expenses: totalExpenses,
          grandTotal,
          avgExpense,
          avgPerSpace: spaces.length ? grandTotal / spaces.length : 0,
        },
        spaces,
        byCategory: catRes.rows.map((r) => ({
          category: r.category as string,
          count: Number(r.count),
          total: Number(r.total),
        })),
        topPayers: payerRes.rows.map((r) => ({
          payer: (r.payer as string) || "—",
          count: Number(r.count),
          total: Number(r.total),
        })),
        monthly: monthlyRes.rows.map((r) => ({
          month: r.month as string,
          count: Number(r.count),
          total: Number(r.total),
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    // Never surface driver internals (may echo the host / credentials).
    return NextResponse.json(
      { error: "Could not query the database. Check the connection string." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  } finally {
    await pool.end().catch(() => {});
  }
}
