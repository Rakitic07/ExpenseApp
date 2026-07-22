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
  const ledger = await prisma.ledger.create({
    data: { name, nameKey, passHash },
  });

  await createSession({ ledgerId: ledger.id, name: ledger.name });
  return NextResponse.json({ name: ledger.name }, { status: 201 });
}
