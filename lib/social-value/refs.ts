import { prisma } from "@/lib/db";

export type SvRefs = {
  contractId?: string | null;
  frameworkId?: string | null;
  outcomeId?: string | null;
  reportingPeriodId?: string | null;
  ownerUserId?: string | null;
  commitmentId?: string | null;
  measureId?: string | null;
  facilityId?: string | null;
};

/**
 * Every id a social value commitment or activity may point at must belong to
 * the organisation. Returns the first failing reference's message, or null.
 * `frameworkId` is the commitment's framework after the write (so an outcome
 * must sit in that framework).
 */
export async function svRefsError(orgId: string, refs: SvRefs): Promise<string | null> {
  const [contract, framework, outcome, period, owner, commitment, measure, facility] = await Promise.all([
    refs.contractId ? prisma.contract.findFirst({ where: { id: refs.contractId, organizationId: orgId }, select: { id: true } }) : true,
    refs.frameworkId ? prisma.svFramework.findFirst({ where: { id: refs.frameworkId, organizationId: orgId }, select: { id: true } }) : true,
    refs.outcomeId
      ? prisma.svOutcome.findFirst({
          where: { id: refs.outcomeId, theme: { framework: { organizationId: orgId } } },
          select: { theme: { select: { frameworkId: true } } },
        })
      : true,
    refs.reportingPeriodId ? prisma.reportingPeriod.findFirst({ where: { id: refs.reportingPeriodId, organizationId: orgId }, select: { id: true } }) : true,
    refs.ownerUserId ? prisma.organizationMembership.findFirst({ where: { userId: refs.ownerUserId, organizationId: orgId }, select: { id: true } }) : true,
    refs.commitmentId ? prisma.svCommitment.findFirst({ where: { id: refs.commitmentId, organizationId: orgId }, select: { id: true } }) : true,
    refs.measureId
      ? prisma.svMeasure.findFirst({ where: { id: refs.measureId, outcome: { theme: { framework: { organizationId: orgId } } } }, select: { id: true } })
      : true,
    refs.facilityId ? prisma.facility.findFirst({ where: { id: refs.facilityId, organizationId: orgId }, select: { id: true } }) : true,
  ]);
  if (!contract) return "Contract not found.";
  if (!framework) return "Framework not found.";
  if (!outcome) return "Criterion not found.";
  if (outcome !== true && refs.frameworkId && outcome.theme.frameworkId !== refs.frameworkId) {
    return "That criterion belongs to a different framework.";
  }
  if (!period) return "Reporting period not found.";
  if (!owner) return "Owner is not a member of this organisation.";
  if (!commitment) return "Commitment not found.";
  if (!measure) return "Measure not found.";
  if (!facility) return "Facility not found.";
  return null;
}
