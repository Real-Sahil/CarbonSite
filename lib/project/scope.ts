import { prisma } from "@/lib/db";
import { getSelectedProject } from "./selected";

/**
 * The sidebar's project as a set of sites, for pages whose data hangs off sites (fuel, plant, material
 * movements). Null when no project is picked or it has no sites yet; both read as "everything".
 * A project with no sites gives an empty list, so those pages show nothing rather than everything.
 */
export async function selectedProjectScope(orgId: string): Promise<{ project: { id: string; name: string }; siteIds: string[] } | null> {
  const project = await getSelectedProject(orgId);
  if (!project) return null;
  const sites = await prisma.site.findMany({ where: { organizationId: orgId, projectId: project.id }, select: { id: true } });
  return { project, siteIds: sites.map((s) => s.id) };
}

/** A where-fragment for a site column: one chosen site, else the project's sites, else no restriction. */
export function siteScope(siteId?: string | null, siteIds?: string[] | null): { siteId?: string | { in: string[] } } {
  if (siteId) return { siteId };
  if (siteIds) return { siteId: { in: siteIds } };
  return {};
}
