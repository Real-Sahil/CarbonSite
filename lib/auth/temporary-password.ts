import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/db";

/** Random 16-character password for accounts an admin creates on someone's behalf. */
export function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}

/**
 * Hash in the format Better Auth verifies at sign-in. Anything else (bcrypt,
 * bare SHA-256) produces a password the user can never sign in with.
 */
export const hashTemporaryPassword = hashPassword;

/**
 * An org admin may only set a password for someone whose account exists
 * solely inside that org. A person who also belongs to another org, or who
 * works on the platform itself, owns their password: overwriting it from one
 * tenant would lock them out of the others.
 */
export async function accountBelongsOnlyToOrg(userId: string, orgId: string): Promise<boolean> {
  const [otherMemberships, platform] = await Promise.all([
    prisma.organizationMembership.count({ where: { userId, organizationId: { not: orgId } } }),
    prisma.platformMembership.count({ where: { userId } }),
  ]);
  return otherMemberships === 0 && platform === 0;
}
