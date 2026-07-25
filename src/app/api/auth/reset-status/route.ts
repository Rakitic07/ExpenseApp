import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetStatusSchema } from "@/lib/validation";
import { hashTicket } from "@/lib/recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner checks whether their reset request was approved. Keyed by the ticket
// code (+ space name) so only the requester can look it up.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = resetStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { name, ticket } = parsed.data;
  const nameKey = name.toLowerCase();

  const request = await prisma.resetRequest.findUnique({
    where: { ticketHash: hashTicket(ticket) },
    select: { status: true, resolvedAt: true, ledger: { select: { nameKey: true } } },
  });

  // Require both the ticket AND the matching space name.
  if (!request || request.ledger.nameKey !== nameKey) {
    return NextResponse.json({ status: "notfound" });
  }

  return NextResponse.json({ status: request.status, resolvedAt: request.resolvedAt });
}
