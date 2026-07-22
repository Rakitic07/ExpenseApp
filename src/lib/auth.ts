import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";

const COOKIE_NAME = "spendly_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is not set. Add a long random value to your environment."
    );
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  ledgerId: string;
  name: string;
};

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.ledgerId === "string" && typeof payload.name === "string") {
      return { ledgerId: payload.ledgerId, name: payload.name };
    }
    return null;
  } catch {
    return null;
  }
}

// Like getSession, but also confirms the ledger still exists in the database.
// If the cookie references a deleted ledger (e.g. after a DB reset), the stale
// session is cleared and null is returned so the app falls back to guest mode
// instead of failing with a foreign-key error.
export async function getActiveLedger(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session) return null;
  const ledger = await prisma.ledger.findUnique({
    where: { id: session.ledgerId },
    select: { id: true, name: true },
  });
  if (!ledger) {
    await clearSession();
    return null;
  }
  return { ledgerId: ledger.id, name: ledger.name };
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
