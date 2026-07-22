import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, clearSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-shot startup endpoint: returns auth state AND the expense list in a single
// request. This halves the app's initial latency versus calling /api/auth/me
// and /api/expenses separately (one round trip + one cold start instead of two),
// and it fetches the ledger and its expenses in a single database query.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  const ledger = await prisma.ledger.findUnique({
    where: { id: session.ledgerId },
    select: {
      id: true,
      name: true,
      expenses: { orderBy: { date: "desc" } },
    },
  });

  // Stale cookie (e.g. ledger deleted): drop it and fall back to guest.
  if (!ledger) {
    await clearSession();
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    name: ledger.name,
    expenses: ledger.expenses,
  });
}
