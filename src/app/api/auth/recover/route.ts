import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { recoverSchema } from "@/lib/validation";
import { generateRecoveryCode, normalizeCode } from "@/lib/recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dummy hash so a missing space/recovery code still costs a bcrypt compare —
// avoids leaking existence via timing, and keeps responses uniform.
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO7dQ6b3q6zJ8b3q6zJ8b3q6zJ8b3q6zC";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = recoverSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { name, recoveryCode, passphrase } = parsed.data;
  const nameKey = name.toLowerCase();

  const ledger = await prisma.ledger.findUnique({ where: { nameKey } });
  const hash = ledger?.recoveryHash ?? DUMMY_HASH;
  const ok = await bcrypt.compare(normalizeCode(recoveryCode), hash);

  // Generic failure — never reveal whether the space exists or which part is wrong.
  if (!ledger || !ledger.recoveryHash || !ok) {
    return NextResponse.json(
      { error: "Incorrect space name or recovery code." },
      { status: 401 }
    );
  }

  // Reset the passphrase and rotate the recovery code (single-use). Do NOT
  // auto-login — the owner re-authenticates with their new passphrase.
  const passHash = await bcrypt.hash(passphrase, 12);
  const newRecoveryCode = generateRecoveryCode();
  const newRecoveryHash = await bcrypt.hash(normalizeCode(newRecoveryCode), 12);

  await prisma.ledger.update({
    where: { id: ledger.id },
    data: { passHash, recoveryHash: newRecoveryHash },
  });

  return NextResponse.json({ name: ledger.name, recoveryCode: newRecoveryCode });
}
