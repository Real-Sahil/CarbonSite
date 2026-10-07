import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const selectedProjectCookie = (orgId: string) => `mo_project_${orgId}`;

/**
 * The project this person picked in the sidebar for this organisation, or null.
 * The cookie is only a preference: it is checked against the organisation's own
 * projects on every read, so a stale or forged value selects nothing.
 */
export const getSelectedProject = cache(async (orgId: string): Promise<{ id: string; name: string } | null> => {
  const id = (await cookies()).get(selectedProjectCookie(orgId))?.value;
  if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  return prisma.project.findFirst({ where: { id, organizationId: orgId }, select: { id: true, name: true } });
});
