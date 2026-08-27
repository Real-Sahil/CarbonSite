// HMAC signing for the Postgres-backed storage driver's upload/download URLs.
// Mirrors presigned-URL semantics: the URL itself carries a time-limited
// authorization so clients (including the mobile app's plain HTTP client,
// which sends no Bearer token to storage URLs) can PUT/GET without a session.

import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET must be set — storage signing requires it.");
  return s;
}

export function signStorageUrl(key: string, expiresAtMs: number): string {
  return createHmac("sha256", secret())
    .update(`${key}:${expiresAtMs}`)
    .digest("base64url");
}

export function verifyStorageSignature(
  key: string,
  expiresAtMs: number,
  signature: string,
): boolean {
  // Add 5-minute grace period for clock skew between server and client
  const CLOCK_SKEW_MS = 5 * 60 * 1000;
  if (!Number.isFinite(expiresAtMs) || expiresAtMs + CLOCK_SKEW_MS < Date.now()) return false;
  const expected = Buffer.from(signStorageUrl(key, expiresAtMs));
  const provided = Buffer.from(signature);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
