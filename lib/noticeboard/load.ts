// What a contract's site noticeboard prints: the contract's measured carbon,
// waste and social value from the published snapshot (the bid pack's contract
// evidence, org-scoped), and the organisation's published case studies for the
// contract. Case study figures are the organisation's own statement.

import { prisma } from "@/lib/db";
import { loadBidPackData, type BidPackData } from "@/lib/bids/carbon-pack";
import { parseKpis, type Kpi } from "@/lib/case-studies";
import { orgFormat, type OrgFormat } from "@/lib/i18n/org-format";

export type NoticeboardData = {
  orgName: string;
  pack: BidPackData;
  contract: BidPackData["contracts"][number];
  caseStudies: { id: string; title: string; problem: string; solution: string; baseline: string; results: string; kpis: Kpi[]; assumptions: string }[];
  format: OrgFormat;
};

export async function loadSiteNoticeboard(orgId: string, snapshotId: string, contractId: string | null): Promise<NoticeboardData> {
  if (!contractId) throw Object.assign(new Error("A site noticeboard needs a contract."), { code: "VALIDATION_ERROR", status: 422 });
  const [pack, org, rows] = await Promise.all([
    loadBidPackData(orgId, snapshotId, { contractIds: [contractId] }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { hqCountry: true, reportingCurrency: true } }),
    prisma.caseStudy.findMany({
      where: { organizationId: orgId, contractId, published: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const contract = pack.contracts[0];
  if (!contract) throw Object.assign(new Error("Contract not found."), { code: "NOT_FOUND", status: 404 });
  return {
    orgName: pack.orgName,
    pack,
    contract,
    caseStudies: rows.map((r) => ({
      id: r.id,
      title: r.title,
      problem: r.problem,
      solution: r.solution,
      baseline: r.baseline,
      results: r.results,
      kpis: parseKpis(r.kpis),
      assumptions: r.assumptions,
    })),
    format: orgFormat(org ?? {}),
  };
}
