import { prisma } from "@/lib/db";
import { obligationProgress, obligationState } from "@/lib/social-value/obligations";

/** Obligations with site and contract names, delivery from the linked commitment, and state. */
export async function loadObligations(orgId: string, opts: { siteId?: string } = {}) {
  const rows = await prisma.svPlanningObligation.findMany({
    where: { organizationId: orgId, ...(opts.siteId && { siteId: opts.siteId }) },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    take: 500,
  });
  const ids = (key: "siteId" | "contractId" | "commitmentId") =>
    [...new Set(rows.map((r) => r[key]).filter((v): v is string => !!v))];

  const [sites, contracts, activities] = await Promise.all([
    prisma.site.findMany({ where: { organizationId: orgId, id: { in: ids("siteId") } }, select: { id: true, name: true } }),
    prisma.contract.findMany({ where: { organizationId: orgId, id: { in: ids("contractId") } }, select: { id: true, name: true } }),
    prisma.svActivity.findMany({
      where: { organizationId: orgId, status: "approved", commitmentId: { in: ids("commitmentId") } },
      select: { commitmentId: true, quantityValue: true, quantityUnit: true },
    }),
  ]);
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const contractName = new Map(contracts.map((c) => [c.id, c.name]));

  return rows.map((r) => {
    const target = { value: r.targetValue == null ? null : Number(r.targetValue), unit: r.targetUnit };
    const delivered = activities
      .filter((a) => a.commitmentId === r.commitmentId && a.quantityValue != null)
      .map((a) => ({ unit: a.quantityUnit, quantity: Number(a.quantityValue) }));
    return {
      id: r.id,
      title: r.title,
      reference: r.reference,
      authority: r.authority,
      clause: r.clause,
      kind: r.kind,
      status: r.status,
      dueDate: r.dueDate,
      target,
      siteId: r.siteId,
      siteName: r.siteId ? (siteName.get(r.siteId) ?? null) : null,
      contractName: r.contractId ? (contractName.get(r.contractId) ?? null) : null,
      commitmentId: r.commitmentId,
      state: obligationState(r),
      progress: r.commitmentId && target.unit ? obligationProgress(target, delivered) : null,
    };
  });
}
