import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation/api";

/**
 * Ids a request may name that must belong to the organisation. Any key ending
 * in `UserId` must be a member of the organisation. Null and undefined skip
 * the check (clearing a link is always allowed).
 */
export type OrgRefs = {
  projectId?: string | null;
  siteId?: string | null;
  facilityId?: string | null;
  businessUnitId?: string | null;
  reportingPeriodId?: string | null;
  contractId?: string | null;
  permitId?: string | null;
  methodStatementId?: string | null;
  activityRecordId?: string | null;
  evidenceFileId?: string | null;
} & { [userKey: `${string}UserId`]: string | null | undefined };

const TABLES = {
  projectId: ["project", "Project"],
  siteId: ["site", "Site"],
  facilityId: ["facility", "Facility"],
  businessUnitId: ["businessUnit", "Business unit"],
  reportingPeriodId: ["reportingPeriod", "Reporting period"],
  contractId: ["contract", "Contract"],
  permitId: ["environmentalPermit", "Permit"],
  methodStatementId: ["methodStatement", "Method statement"],
  activityRecordId: ["activityRecord", "Activity record"],
  evidenceFileId: ["evidenceFile", "Evidence file"],
} as const;

type Delegate = { findFirst: (args: { where: Record<string, unknown>; select: { id: true } }) => Promise<unknown> };

/** The first reference that is not the organisation's, as a message, or null. */
export async function orgRefsMessage(orgId: string, refs: OrgRefs): Promise<string | null> {
  for (const [key, value] of Object.entries(refs)) {
    if (!value) continue;
    if (key.endsWith("UserId")) {
      const member = await prisma.organizationMembership.findFirst({
        where: { userId: value, organizationId: orgId },
        select: { id: true },
      });
      if (!member) return "That person is not a member of this organisation.";
      continue;
    }
    const entry = TABLES[key as keyof typeof TABLES];
    if (!entry) throw new Error(`orgRefsMessage: unknown reference ${key}`);
    const [table, label] = entry;
    const found = await (prisma[table] as unknown as Delegate).findFirst({
      where: { id: value, organizationId: orgId },
      select: { id: true },
    });
    if (!found) return `${label} not found in this organisation.`;
  }
  return null;
}

/** Same as orgRefsMessage, as a 404 response ready to return from a route, or null. */
export async function orgRefsError(orgId: string, refs: OrgRefs) {
  const message = await orgRefsMessage(orgId, refs);
  return message ? apiError("NOT_FOUND", message, 404) : null;
}
