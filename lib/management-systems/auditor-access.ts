import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getFramework } from "./catalogue";

// Read-only, time-limited access for a certification body's auditor. The
// link carries a random token; only its SHA-256 is stored, so the database
// alone cannot open it. Each link is scoped to chosen frameworks, can be
// revoked, and every use is audit-logged by the routes.

export const MAX_ACCESS_DAYS = 90;

export const auditorAccessSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(200).optional(),
    company: z.string().trim().max(200).optional(),
    frameworks: z.array(z.string().max(80)).min(1).max(20).refine((s) => s.every((x) => getFramework(x)), "Unknown framework"),
    days: z.number().int().min(1).max(MAX_ACCESS_DAYS),
  })
  .strict();

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The access a token opens, or null when it is unknown, expired or revoked. */
export async function resolveAuditorToken(token: string) {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  const access = await prisma.msAuditorAccess.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!access || access.revokedAt || access.expiresAt <= new Date()) return null;
  // Only frameworks the organisation still has adopted.
  const adopted = await prisma.msFrameworkAdoption.findMany({
    where: { organizationId: access.organizationId, frameworkSlug: { in: access.frameworks }, status: { not: "withdrawn" } },
    select: { frameworkSlug: true },
  });
  return { ...access, frameworks: adopted.map((a) => a.frameworkSlug) };
}

export async function touchAuditorAccess(id: string) {
  await prisma.msAuditorAccess.update({ where: { id }, data: { lastUsedAt: new Date() } });
}
