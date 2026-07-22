import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveLedger } from "@/lib/auth";
import { expenseSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getActiveLedger();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expenses = await prisma.expense.findMany({
    where: { ledgerId: session.ledgerId },
    orderBy: { date: "desc" },
  });

  return NextResponse.json({ expenses });
}

export async function POST(req: Request) {
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

  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { title, category, amount, paidBy, date, notes } = parsed.data;
  const expense = await prisma.expense.create({
    data: {
      ledgerId: session.ledgerId,
      title,
      category,
      amount,
      paidBy,
      date: new Date(date),
      notes: notes ? notes : null,
    },
  });

  return NextResponse.json({ expense }, { status: 201 });
}
