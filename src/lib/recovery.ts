import { createHash, randomBytes } from "crypto";

// Unambiguous alphabet (no 0/O/1/I) so codes are easy to read/type. Length 32
// means a raw byte maps cleanly (256 % 32 === 0) with no modulo bias.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(groups: number, groupLen: number): string {
  const bytes = randomBytes(groups * groupLen);
  let out = "";
  for (let i = 0; i < groups * groupLen; i++) {
    if (i > 0 && i % groupLen === 0) out += "-";
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

// ~20 chars / ~80 bits — shown once at signup, e.g. "K7QF-9MTX-2PWH-4RJD".
export const generateRecoveryCode = () => randomCode(4, 4);

// ~15 chars — reference for an admin-mediated reset, e.g. "3PWH-4RJD-K7QF".
export const generateTicketCode = () => randomCode(3, 4);

// Normalize before hashing/compare so casing/spacing/dashes don't matter.
export const normalizeCode = (c: string) =>
  c.trim().toUpperCase().replace(/\s+/g, "");

// Ticket codes are high-entropy, so a fast hash is fine for equality lookups.
export const hashTicket = (code: string) =>
  createHash("sha256").update(normalizeCode(code)).digest("hex");
