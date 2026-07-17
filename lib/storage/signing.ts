// HMAC signing for the Postgres-backed storage driver's upload/download URLs.
// Mirrors presigned-URL semantics: the URL itself carries a time-limited
// authorization so clients (including the mobile app's plain HTTP client,
// which sends no Bearer token to storage URLs) can PUT/GET without a session.

import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  return process.env.BETTER_AUTH_SECRET ?? "carbonsite-dev-storage-secret";
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
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) return false;
  const expected = Buffer.from(signStorageUrl(key, expiresAtMs));
  const provided = Buffer.from(signature);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
