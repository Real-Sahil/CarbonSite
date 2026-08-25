import { createHash } from "crypto";
import { prisma } from "@/lib/db";

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
  if (!rawKey.startsWith("csk_")) {
    throw new Error("Invalid API key format");
  }

  const keyHash = createHash("sha256").update(rawKey).digest("hex");

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
