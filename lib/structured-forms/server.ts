import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation/api";

export const EDIT_ROLES = ["admin", "editor"] as const;

export const sectionsSchema = z.record(z.string(), z.unknown());

const optionalId = z.string().min(1).nullable().optional();
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

export const contentFields = {
  title: z.string().max(200).optional(),
  sectionsJson: sectionsSchema.optional(),
  projectId: optionalId.or(z.literal("").transform(() => null)),
  siteId: optionalId.or(z.literal("").transform(() => null)),
};

export { optionalDate };

export function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(`${value}T00:00:00Z`);
}

export function toJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/** Rejects a project or site that belongs to another organisation. Returns an error response, or null when valid. */
export async function checkOrgRefs(
  orgId: string,
  refs: { projectId?: string | null; siteId?: string | null },
) {
  if (refs.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: refs.projectId, organizationId: orgId },
      select: { id: true },
    });
    if (!project) return apiError("VALIDATION_ERROR", "Project not found in this organisation.", 400);
  }
  if (refs.siteId) {
    const site = await prisma.site.findFirst({
      where: { id: refs.siteId, organizationId: orgId },
      select: { id: true },
    });
    if (!site) return apiError("VALIDATION_ERROR", "Site not found in this organisation.", 400);
  }
  return null;
}

export function lockedError(noun: string) {
  return apiError(
    "LOCKED",
    `This ${noun} is locked because of its status. Use the action on the page to reopen or start a new version.`,
    409,
  );
}

export function omit<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Omit<T, K> {
  const copy = { ...obj };
  for (const key of keys) delete copy[key];
  return copy;
}
