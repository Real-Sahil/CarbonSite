import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/management-systems/auditor-access";

// Read-only, time-limited access to one published snapshot's assurance pack for an independent
// verifier who has no seat in the organisation. Same token handling as the management systems
// link (random token, only its SHA-256 stored); scoped to a single snapshot, revocable, and every
// use is audit-logged by the routes.

export const MAX_LINK_DAYS = 90;

/** Who may issue or withdraw a link: it lets an outsider take the whole trail out. */
export const LINK_ROLES = ["admin", "sustainability_director"] as const;

export const auditorLinkSchema = z
  .object({
    snapshotId: z.string().min(1).max(60),
    engagementId: z.string().min(1).max(60).optional(),
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(200).optional(),
    company: z.string().trim().max(200).optional(),
    days: z.number().int().min(1).max(MAX_LINK_DAYS),
  })
  .strict();

/** The link a token opens, or null when it is unknown, expired, revoked or its snapshot is gone. */
export async function resolveInventoryAuditorToken(token: string) {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  const access = await prisma.inventoryAuditorAccess.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!access || access.revokedAt || access.expiresAt <= new Date()) return null;
  const snapshot = await prisma.publishedSnapshot.findFirst({
    where: { id: access.snapshotId, organizationId: access.organizationId },
    select: { id: true, version: true, publishedAt: true, reportingPeriod: { select: { label: true, startDate: true, endDate: true } } },
  });
  if (!snapshot) return null;
  return { ...access, snapshot };
}

export async function touchInventoryAuditorAccess(id: string) {
  await prisma.inventoryAuditorAccess.update({ where: { id }, data: { lastUsedAt: new Date() } });
}
