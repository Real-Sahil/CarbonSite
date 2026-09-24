import type { PlatformRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";

const SHARED_LIBRARY_ROLES: PlatformRole[] = ["platform_owner", "platform_support"];

/** Whether this user may change reference data every organisation reads (factor and material libraries). */
export async function canEditSharedLibraries(userId: string): Promise<boolean> {
  const pm = await prisma.platformMembership.findUnique({ where: { userId }, select: { role: true } });
  return !!pm && SHARED_LIBRARY_ROLES.includes(pm.role);
}

/**
 * Guard for writes to shared reference data. Org membership alone is not
 * enough: an edit here changes every other tenant's calculations.
 */
export async function requireSharedLibraryEditor(orgId: string) {
  const ctx = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
  if (!(await canEditSharedLibraries(ctx.session.user.id))) {
    throw new AuthError("SHARED_LIBRARY_READ_ONLY", 403);
  }
  return ctx;
}
