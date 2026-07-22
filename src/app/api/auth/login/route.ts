import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authSchema } from "@/lib/validation";
import { createSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = authSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, passphrase } = parsed.data;
  const nameKey = name.toLowerCase();

  const ledger = await prisma.ledger.findUnique({ where: { nameKey } });

  // Constant-ish behaviour: always run a bcrypt compare to avoid leaking
  // whether the space exists via response timing, and return a generic error.
  const hash =
    ledger?.passHash ??
    "$2a$12$C6UzMDM.H6dfI/f/IKcEeO7dQ6b3q6zJ8b3q6zJ8b3q6zJ8b3q6zC";
  const ok = await bcrypt.compare(passphrase, hash);

  if (!ledger || !ok) {
    return NextResponse.json(
      { error: "Incorrect space name or passphrase." },
      { status: 401 }
    );
  }

  await createSession({ ledgerId: ledger.id, name: ledger.name });
  return NextResponse.json({ name: ledger.name });
}
