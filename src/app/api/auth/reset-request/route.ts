import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetRequestSchema } from "@/lib/validation";
import { generateTicketCode, hashTicket } from "@/lib/recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner asks an admin to approve a passphrase reset. They propose the new
// passphrase (stored only as a hash) and answer a short questionnaire the admin
// verifies against the real data. A ticket code is returned so the owner can
// check status later — nothing changes until the admin approves.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = resetRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { name, passphrase, questionnaire } = parsed.data;
  const nameKey = name.toLowerCase();

  // Always mint a ticket so the response is identical whether or not the space
  // exists (prevents space-name enumeration). We only persist a real request
  // when the space actually exists.
  const ticket = generateTicketCode();
  const ledger = await prisma.ledger.findUnique({ where: { nameKey }, select: { id: true } });

  if (ledger) {
    const proposedHash = await bcrypt.hash(passphrase, 12);
    // Collapse any earlier pending request for this space so the queue stays clean.
    await prisma.resetRequest.deleteMany({ where: { ledgerId: ledger.id, status: "pending" } });
    await prisma.resetRequest.create({
      data: {
        ledgerId: ledger.id,
        ticketHash: hashTicket(ticket),
        proposedHash,
        questionnaire: JSON.stringify(questionnaire),
      },
    });
  }

  return NextResponse.json({ ticket });
}
