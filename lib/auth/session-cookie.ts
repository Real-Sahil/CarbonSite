import { createHmac, timingSafeEqual } from "crypto";

// Better Auth signs the session cookie as "{token}.{base64 HMAC-SHA256(BETTER_AUTH_SECRET, token)}"
// (better-call crypto.cjs: standard base64, padded). Returns the raw token only when that signature
// checks out, so a bare token from a DB read or backup cannot sign anyone in.
export function verifiedSessionToken(signedValue: string): string | null {
  const secret = process.env.BETTER_AUTH_SECRET;
  const dot = signedValue.lastIndexOf(".");
  if (!secret || dot < 1) return null;
  const token = signedValue.slice(0, dot);
  const expected = Buffer.from(createHmac("sha256", secret).update(token).digest("base64"));
  const given = Buffer.from(signedValue.slice(dot + 1));
  return given.length === expected.length && timingSafeEqual(given, expected) ? token : null;
}
