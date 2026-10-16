import { createHmac, timingSafeEqual } from "crypto";

// Better Auth prefixes Secure cookies with __Secure- on HTTPS (production).
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Secure-better-auth.session_token" : "better-auth.session_token";

// Better Auth signs the session cookie as "{token}.{base64 HMAC-SHA256(BETTER_AUTH_SECRET, token)}"
// (better-call crypto.cjs: standard base64, padded). Returns the raw token only when that signature
// checks out, so a bare token from a DB read or backup cannot sign anyone in.
export function verifiedSessionToken(signedValue: string): string | null {
  const secret = process.env.BETTER_AUTH_SECRET;
  const dot = signedValue.lastIndexOf(".");
  if (!secret || dot < 1) return null;
  const token = signedValue.slice(0, dot);
  const expected = Buffer.from(signatureOf(token, secret));
  const given = Buffer.from(signedValue.slice(dot + 1));
  return given.length === expected.length && timingSafeEqual(given, expected) ? token : null;
}

// The cookie value for a raw token, signed the way verifiedSessionToken and Better Auth expect.
export function signedSessionToken(token: string): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set; cannot sign the session cookie");
  return `${token}.${signatureOf(token, secret)}`;
}

function signatureOf(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("base64");
}
