import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

const KEY_PREFIX = "csk_";

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Mint a new organisation API key. Only the SHA-256 hash is stored, so the
 * secret cannot be read back from the database. `prefix` is the first eight
 * characters, kept for display in settings.
 */
export function mintApiKey(): { secret: string; prefix: string; keyHash: string } {
  const secret = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { secret, prefix: secret.slice(0, 8), keyHash: hashApiKey(secret) };
}

/**
 * Validate an API key from the Authorization header.
 * Format: "Bearer csk_..."
 * Returns org ID if valid, throws if invalid/expired.
 */
export async function validateApiKey(authHeader: string | null): Promise<string> {
  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/);
  if (!match) {
    throw new Error("Invalid Authorization header format");
  }

  const rawKey = match[1];
  if (!rawKey.startsWith(KEY_PREFIX)) {
    throw new Error("Invalid API key format");
  }

  const keyHash = hashApiKey(rawKey);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: {
      organizationId: true,
      expiresAt: true,
      lastUsedAt: true,
    },
  });

  if (!apiKey) {
    throw new Error("API key not found");
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    throw new Error("API key has expired");
  }

  // Update last used timestamp (async, non-blocking)
  prisma.apiKey.update({
    where: { keyHash },
    data: { lastUsedAt: new Date() },
  }).catch(() => null);

  return apiKey.organizationId;
}
