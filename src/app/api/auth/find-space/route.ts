import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { findSpaceSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RESULTS = 8;
// Cap bcrypt comparisons so a passphrase search can't turn into a long scan.
const MAX_SCAN = 25;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = findSpaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const query = (parsed.data.query ?? "").trim().toLowerCase();
  const passphrase = parsed.data.passphrase ?? "";
  const usePrefix = query.length >= 4;
  const usePass = passphrase.length >= 4;

  const headers = { "Cache-Control": "no-store" };

  // Build candidate ledgers, bounded so we never load/verify too many.
  const candidates = usePrefix
    ? await prisma.ledger.findMany({
        where: { nameKey: { startsWith: query } },
        select: { name: true, passHash: true },
        orderBy: { createdAt: "desc" },
        take: usePass ? MAX_SCAN : MAX_RESULTS,
      })
    : await prisma.ledger.findMany({
        select: { name: true, passHash: true },
        orderBy: { createdAt: "desc" },
        take: MAX_SCAN,
      });

  let matches: string[];
  if (usePass) {
    // Only reveal names whose passphrase the caller actually knows — this
    // proves ownership, so returning the exact name is safe.
    matches = [];
    for (const c of candidates) {
      if (matches.length >= MAX_RESULTS) break;
      // eslint-disable-next-line no-await-in-loop
      if (await bcrypt.compare(passphrase, c.passHash)) matches.push(c.name);
    }
  } else {
    matches = candidates.slice(0, MAX_RESULTS).map((c) => c.name);
  }

  return NextResponse.json({ matches }, { headers });
}
