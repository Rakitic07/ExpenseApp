import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveLedger } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Monthly budget is a per-space setting stored on the Ledger so it syncs across
// all of a user's devices. `null` clears the budget.
const budgetSchema = z.object({
  budget: z
    .number()
    .positive("Budget must be greater than 0")
    .max(1_000_000_000, "Budget is too large")
    .nullable(),
});

export async function GET() {
  const session = await getActiveLedger();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ledger = await prisma.ledger.findUnique({
    where: { id: session.ledgerId },
    select: { monthlyBudget: true },
  });

  return NextResponse.json({ budget: ledger?.monthlyBudget ?? null });
}

export async function PATCH(req: Request) {
  const session = await getActiveLedger();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = budgetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  await prisma.ledger.update({
    where: { id: session.ledgerId },
    data: { monthlyBudget: parsed.data.budget },
  });

  return NextResponse.json({ budget: parsed.data.budget });
}
