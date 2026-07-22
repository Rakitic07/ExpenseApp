import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveLedger } from "@/lib/auth";
import { expenseSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await getActiveLedger();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // Scope the update to the current ledger to prevent editing others' rows.
  const existing = await prisma.expense.findFirst({
    where: { id, ledgerId: session.ledgerId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { title, category, amount, paidBy, date, notes } = parsed.data;
  const expense = await prisma.expense.update({
    where: { id: existing.id },
    data: {
      title,
      category,
      amount,
      paidBy,
      date: new Date(date),
      notes: notes ? notes : null,
    },
  });

  return NextResponse.json({ expense });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getActiveLedger();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.expense.findFirst({
    where: { id, ledgerId: session.ledgerId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.expense.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
