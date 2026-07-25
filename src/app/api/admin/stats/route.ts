import { NextResponse } from "next/server";
import { z } from "zod";
import { adminGate, makeAdminPool } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The admin dashboard is gated by two shared secrets that only the app owner
// knows: the AUTH_SECRET (verified against the server's env) and the
// DATABASE_URL (used to connect). Details are fetched section-by-section, on
// demand, so the initial unlock stays fast and heavy aggregates only run when
// the owner actually opens that tab.

const PAGE_SIZE = 5;

const bodySchema = z.object({
  databaseUrl: z.string().min(1, "DATABASE_URL is required"),
  authSecret: z.string().min(1, "AUTH_SECRET is required"),
  section: z.enum(["overview", "spaces", "categories", "payers", "activity", "resets"]),
  page: z.number().int().min(0).max(100_000).optional(),
  bucket: z.enum(["day", "week", "month", "year"]).optional(),
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

// Fixed, allow-listed bucket config — these strings are inlined into SQL, so
// they must never come from free-form user input (they don't: zod enum above).
const BUCKET = {
  day: { unit: "day", windows: 14, fmt: "DD Mon" },
  week: { unit: "week", windows: 12, fmt: "DD Mon" },
  month: { unit: "month", windows: 12, fmt: "Mon YY" },
  year: { unit: "year", windows: 5, fmt: "YYYY" },
} as const;

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, 400);
  }

  const { databaseUrl, authSecret, section } = parsed.data;
  const page = parsed.data.page ?? 0;
  const bucket = parsed.data.bucket ?? "week";

  const gate = adminGate(databaseUrl, authSecret);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const pool = makeAdminPool(gate.url);

  try {
    switch (section) {
      case "overview": {
        const [exp, led] = await Promise.all([
          pool.query(
            `SELECT COUNT(*)::int AS count,
                    COALESCE(SUM(amount), 0)::float AS total,
                    COALESCE(AVG(amount), 0)::float AS avg
               FROM "Expense"`
          ),
          pool.query(`SELECT COUNT(*)::int AS count FROM "Ledger"`),
        ]);
        const spaces = Number(led.rows[0]?.count ?? 0);
        const grandTotal = Number(exp.rows[0]?.total ?? 0);
        return json({
          totals: {
            spaces,
            expenses: Number(exp.rows[0]?.count ?? 0),
            grandTotal,
            avgExpense: Number(exp.rows[0]?.avg ?? 0),
            avgPerSpace: spaces ? grandTotal / spaces : 0,
          },
        });
      }

      case "spaces": {
        const [countRes, rowsRes] = await Promise.all([
          pool.query(`SELECT COUNT(*)::int AS total FROM "Ledger"`),
          pool.query(
            `SELECT l.id,
                    l.name,
                    l."monthlyBudget" AS budget,
                    l."createdAt"     AS created,
                    (SELECT COUNT(*) FROM "Expense" e WHERE e."ledgerId" = l.id)::int AS expense_count,
                    (SELECT COALESCE(SUM(amount), 0) FROM "Expense" e WHERE e."ledgerId" = l.id)::float AS total,
                    (SELECT MIN(date) FROM "Expense" e WHERE e."ledgerId" = l.id) AS first_date,
                    (SELECT MAX(date) FROM "Expense" e WHERE e."ledgerId" = l.id) AS last_date
               FROM "Ledger" l
              ORDER BY l."createdAt" ASC
              LIMIT ${PAGE_SIZE} OFFSET $1`,
            [page * PAGE_SIZE]
          ),
        ]);
        return json({
          total: Number(countRes.rows[0]?.total ?? 0),
          page,
          pageSize: PAGE_SIZE,
          items: rowsRes.rows.map((r) => ({
            id: r.id as string,
            name: r.name as string,
            budget: r.budget === null ? null : Number(r.budget),
            createdAt: r.created,
            expenseCount: Number(r.expense_count),
            total: Number(r.total),
            firstDate: r.first_date,
            lastDate: r.last_date,
          })),
        });
      }

      case "categories": {
        const [countRes, rowsRes] = await Promise.all([
          pool.query(`SELECT COUNT(DISTINCT category)::int AS total FROM "Expense"`),
          pool.query(
            `SELECT category,
                    COUNT(*)::int AS count,
                    COALESCE(SUM(amount), 0)::float AS total
               FROM "Expense"
              GROUP BY category
              ORDER BY total DESC
              LIMIT ${PAGE_SIZE} OFFSET $1`,
            [page * PAGE_SIZE]
          ),
        ]);
        return json({
          total: Number(countRes.rows[0]?.total ?? 0),
          page,
          pageSize: PAGE_SIZE,
          items: rowsRes.rows.map((r) => ({
            category: r.category as string,
            count: Number(r.count),
            total: Number(r.total),
          })),
        });
      }

      case "payers": {
        const [countRes, rowsRes] = await Promise.all([
          pool.query(`SELECT COUNT(DISTINCT "paidBy")::int AS total FROM "Expense"`),
          pool.query(
            `SELECT "paidBy" AS payer,
                    COUNT(*)::int AS count,
                    COALESCE(SUM(amount), 0)::float AS total
               FROM "Expense"
              GROUP BY "paidBy"
              ORDER BY total DESC
              LIMIT ${PAGE_SIZE} OFFSET $1`,
            [page * PAGE_SIZE]
          ),
        ]);
        return json({
          total: Number(countRes.rows[0]?.total ?? 0),
          page,
          pageSize: PAGE_SIZE,
          items: rowsRes.rows.map((r) => ({
            payer: (r.payer as string) || "—",
            count: Number(r.count),
            total: Number(r.total),
          })),
        });
      }

      case "activity": {
        const cfg = BUCKET[bucket];
        const [seriesRes, perfRes, activeRes] = await Promise.all([
          pool.query(
            `SELECT to_char(date_trunc('${cfg.unit}', "createdAt"), '${cfg.fmt}') AS period,
                    date_trunc('${cfg.unit}', "createdAt") AS bucket_start,
                    COUNT(*)::int AS count,
                    COALESCE(SUM(amount), 0)::float AS total
               FROM "Expense"
              WHERE "createdAt" >= date_trunc('${cfg.unit}', now()) - interval '${cfg.windows} ${cfg.unit}'
              GROUP BY 1, 2
              ORDER BY 2 ASC`
          ),
          pool.query(
            `SELECT
               COUNT(*) FILTER (WHERE "createdAt" >= date_trunc('${cfg.unit}', now()))::int AS cur_count,
               COALESCE(SUM(amount) FILTER (WHERE "createdAt" >= date_trunc('${cfg.unit}', now())), 0)::float AS cur_total,
               COUNT(*) FILTER (
                 WHERE "createdAt" >= date_trunc('${cfg.unit}', now()) - interval '1 ${cfg.unit}'
                   AND "createdAt" <  date_trunc('${cfg.unit}', now())
               )::int AS prev_count,
               COALESCE(SUM(amount) FILTER (
                 WHERE "createdAt" >= date_trunc('${cfg.unit}', now()) - interval '1 ${cfg.unit}'
                   AND "createdAt" <  date_trunc('${cfg.unit}', now())
               ), 0)::float AS prev_total
             FROM "Expense"`
          ),
          pool.query(
            `SELECT l.name,
                    COUNT(e.id)::int AS inputs,
                    COALESCE(SUM(e.amount), 0)::float AS total
               FROM "Ledger" l
               JOIN "Expense" e ON e."ledgerId" = l.id
              WHERE e."createdAt" >= date_trunc('${cfg.unit}', now()) - interval '${cfg.windows} ${cfg.unit}'
              GROUP BY l.id, l.name
              ORDER BY inputs DESC
              LIMIT 5`
          ),
        ]);

        const p = perfRes.rows[0] ?? {};
        return json({
          bucket,
          series: seriesRes.rows.map((r) => ({
            period: r.period as string,
            count: Number(r.count),
            total: Number(r.total),
          })),
          performance: {
            curCount: Number(p.cur_count ?? 0),
            curTotal: Number(p.cur_total ?? 0),
            prevCount: Number(p.prev_count ?? 0),
            prevTotal: Number(p.prev_total ?? 0),
          },
          activeSpaces: activeRes.rows.map((r) => ({
            name: r.name as string,
            inputs: Number(r.inputs),
            total: Number(r.total),
          })),
        });
      }

      case "resets": {
        // Reset requests with the space's real data so the admin can verify the
        // owner's questionnaire before approving. Pending ones surface first.
        const [countRes, rowsRes] = await Promise.all([
          pool.query(`SELECT COUNT(*)::int AS total FROM "ResetRequest"`),
          pool.query(
            `SELECT r.id,
                    r.status,
                    r.questionnaire,
                    r."createdAt" AS requested_at,
                    r."resolvedAt" AS resolved_at,
                    l.name AS space_name,
                    l."createdAt" AS space_created,
                    (l."recoveryHash" IS NOT NULL) AS has_recovery,
                    (SELECT COUNT(*) FROM "Expense" e WHERE e."ledgerId" = l.id)::int AS expense_count,
                    (SELECT COALESCE(SUM(amount), 0) FROM "Expense" e WHERE e."ledgerId" = l.id)::float AS total,
                    (SELECT json_agg(x) FROM (
                       SELECT title, amount, "paidBy" AS payer, date
                         FROM "Expense" e WHERE e."ledgerId" = l.id
                        ORDER BY e."createdAt" DESC LIMIT 5
                     ) x) AS recent
               FROM "ResetRequest" r
               JOIN "Ledger" l ON l.id = r."ledgerId"
              ORDER BY (r.status = 'pending') DESC, r."createdAt" DESC
              LIMIT ${PAGE_SIZE} OFFSET $1`,
            [page * PAGE_SIZE]
          ),
        ]);
        return json({
          total: Number(countRes.rows[0]?.total ?? 0),
          page,
          pageSize: PAGE_SIZE,
          items: rowsRes.rows.map((r) => ({
            id: r.id as string,
            status: r.status as string,
            spaceName: r.space_name as string,
            spaceCreated: r.space_created,
            requestedAt: r.requested_at,
            resolvedAt: r.resolved_at,
            hasRecovery: Boolean(r.has_recovery),
            expenseCount: Number(r.expense_count),
            total: Number(r.total),
            questionnaire: r.questionnaire as string,
            recent: (r.recent ?? []) as { title: string; amount: number; payer: string; date: string }[],
          })),
        });
      }
    }
  } catch {
    return json({ error: "Could not query the database. Check the connection string." }, 502);
  } finally {
    await pool.end().catch(() => {});
  }
}
