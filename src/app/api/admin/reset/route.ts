import { NextResponse } from "next/server";
import { z } from "zod";
import { adminGate, makeAdminPool } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin action on an owner's passphrase-reset request. Approving copies the
// owner's already-hashed proposed passphrase onto the ledger (nothing secret is
// transmitted); rejecting just closes the request. Runs against the same DB the
// admin is viewing (gate enforces url === server env).

const bodySchema = z.object({
  databaseUrl: z.string().min(1),
  authSecret: z.string().min(1),
  requestId: z.string().min(1).max(64),
  action: z.enum(["approve", "reject"]),
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

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

  const { databaseUrl, authSecret, requestId, action } = parsed.data;

  const gate = adminGate(databaseUrl, authSecret);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const pool = makeAdminPool(gate.url);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock the request row; only act on still-pending requests.
    const reqRes = await client.query(
      `SELECT "ledgerId", "proposedHash", status
         FROM "ResetRequest" WHERE id = $1 FOR UPDATE`,
      [requestId]
    );
    const row = reqRes.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return json({ error: "Request not found." }, 404);
    }
    if (row.status !== "pending") {
      await client.query("ROLLBACK");
      return json({ error: `Request already ${row.status}.` }, 409);
    }

    if (action === "approve") {
      await client.query(`UPDATE "Ledger" SET "passHash" = $1 WHERE id = $2`, [
        row.proposedHash,
        row.ledgerId,
      ]);
      await client.query(
        `UPDATE "ResetRequest" SET status = 'approved', "resolvedAt" = now() WHERE id = $1`,
        [requestId]
      );
    } else {
      await client.query(
        `UPDATE "ResetRequest" SET status = 'rejected', "resolvedAt" = now() WHERE id = $1`,
        [requestId]
      );
    }

    await client.query("COMMIT");
    return json({ ok: true, status: action === "approve" ? "approved" : "rejected" });
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    return json({ error: "Could not complete the action." }, 502);
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}
