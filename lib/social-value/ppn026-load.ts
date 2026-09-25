import { prisma } from "@/lib/db";
import { PPN026_SLUG, ppn026Checks, summarisePpn026, type KpiInput } from "./ppn026";

/**
 * The contract's PPN 026 view: the org's PPN 026 framework (if installed),
 * the criterion ids to create KPIs against, and each KPI's delivery so far.
 * Everything is scoped to the organisation. Null when the contract is not the org's.
 */
export async function loadContractPpn026(orgId: string, contractId: string) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, organizationId: orgId },
    select: { id: true, contractValue: true },
  });
  if (!contract) return null;
  const framework = await prisma.svFramework.findUnique({
    where: { organizationId_slug: { organizationId: orgId, slug: PPN026_SLUG } },
    select: {
      id: true,
      version: true,
      themes: { orderBy: { sortOrder: "asc" }, select: { outcomes: { orderBy: { sortOrder: "asc" }, select: { id: true, code: true, name: true } } } },
    },
  });
  const contractValue = contract.contractValue != null ? Number(contract.contractValue) : null;
  if (!framework) return { framework: null, contractValue, criteria: [], checks: [], criterionIds: {} as Record<string, string> };

  const commitments = await prisma.svCommitment.findMany({
    where: { organizationId: orgId, contractId, frameworkId: framework.id },
    select: {
      id: true,
      title: true,
      status: true,
      targetValue: true,
      targetUnit: true,
      outcome: { select: { code: true } },
      activities: { select: { status: true, quantityValue: true, quantityUnit: true, evidenceUrls: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const kpis: KpiInput[] = commitments.map((c) => ({
    id: c.id,
    title: c.title,
    outcomeCode: c.outcome?.code ?? null,
    targetValue: c.targetValue != null ? Number(c.targetValue) : null,
    targetUnit: c.targetUnit,
    status: c.status,
    activities: c.activities.map((a) => ({
      status: a.status,
      quantityValue: a.quantityValue != null ? Number(a.quantityValue) : null,
      quantityUnit: a.quantityUnit,
      evidenceCount: a.evidenceUrls.length,
    })),
  }));
  const criteria = summarisePpn026(kpis);
  const criterionIds = Object.fromEntries(framework.themes.flatMap((t) => t.outcomes.map((o) => [o.code, o.id])));
  return {
    framework: { id: framework.id, version: framework.version },
    contractValue,
    criteria,
    checks: ppn026Checks(contractValue, criteria),
    criterionIds,
    unassigned: kpis.filter((k) => !k.outcomeCode && k.status !== "cancelled").length,
  };
}
