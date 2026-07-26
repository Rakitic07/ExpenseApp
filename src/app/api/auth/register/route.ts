import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";
import { createSession } from "@/lib/auth";
import { generateRecoveryCode, normalizeCode } from "@/lib/recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, passphrase } = parsed.data;
  const nameKey = name.toLowerCase();

  const existing = await prisma.ledger.findUnique({ where: { nameKey } });
  if (existing) {
    return NextResponse.json(
      {
        error:
          "That space name is already taken. Pick another name, or unlock it with its passphrase.",
      },
      { status: 409 }
    );
  }

  const passHash = await bcrypt.hash(passphrase, 12);

  // One-time recovery code — shown once now, stored only as a hash. Lets the
  // owner reset their own passphrase later without an admin.
  const recoveryCode = generateRecoveryCode();
  const recoveryHash = await bcrypt.hash(normalizeCode(recoveryCode), 12);

  const ledger = await prisma.ledger.create({
    data: { name, nameKey, passHash, recoveryHash },
  });

  // Token is returned for native clients (Bearer auth); the web app ignores it
  // and relies on the HttpOnly cookie set by createSession.
  const token = await createSession({ ledgerId: ledger.id, name: ledger.name });
  return NextResponse.json(
    { name: ledger.name, recoveryCode, token },
    { status: 201 }
  );
}
