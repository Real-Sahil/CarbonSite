// What a contract's site noticeboard prints: the contract's measured carbon,
// waste and social value from the published snapshot (the bid pack's contract
// evidence, org-scoped), and the organisation's published case studies for the
// contract. Case study figures are the organisation's own statement.

import { prisma } from "@/lib/db";
import { loadBidPackData, type BidPackData } from "@/lib/bids/carbon-pack";
import { noticeboardPolicies, parseKpis, type Kpi, type NoticeboardPolicy } from "@/lib/case-studies";
import { orgFormat, type OrgFormat } from "@/lib/i18n/org-format";
import { getObject } from "@/lib/storage";

export type NoticeboardData = {
  orgName: string;
  pack: BidPackData;
  contract: BidPackData["contracts"][number];
  caseStudies: { photoDataUri?: string; id: string; title: string; problem: string; solution: string; baseline: string; results: string; kpis: Kpi[]; assumptions: string }[];
  /** Approved environmental policies from the management system register (see noticeboardPolicies). */
  policies: NoticeboardPolicy[];
  format: OrgFormat;
};

export async function loadSiteNoticeboard(orgId: string, snapshotId: string, contractId: string | null): Promise<NoticeboardData> {
  if (!contractId) throw Object.assign(new Error("A site noticeboard needs a contract."), { code: "VALIDATION_ERROR", status: 422 });
  const [pack, org, rows, policyRows] = await Promise.all([
    loadBidPackData(orgId, snapshotId, { contractIds: [contractId] }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { hqCountry: true, reportingCurrency: true } }),
    prisma.caseStudy.findMany({
      where: { organizationId: orgId, contractId, published: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.msPolicy.findMany({
      where: { organizationId: orgId, status: "approved" },
      select: { title: true, category: true, body: true, version: true, status: true, approvedOn: true },
    }),
  ]);
  // Photos: the organisation's own image files only, read from storage into the page.
  const photoIds = rows.map((r) => r.photoEvidenceFileId).filter((id): id is string => !!id);
  const files = photoIds.length
    ? await prisma.evidenceFile.findMany({
        where: { id: { in: photoIds }, organizationId: orgId, mimeType: { in: ["image/jpeg", "image/png", "image/webp"] } },
        select: { id: true, mimeType: true, storageKey: true },
      })
    : [];
  const photos = new Map<string, string>();
  for (const f of files) {
    try {
      photos.set(f.id, `data:${f.mimeType};base64,${(await getObject(f.storageKey)).toString("base64")}`);
    } catch {
      // A photo that cannot be read leaves the card without one rather than failing the board.
    }
  }
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
      photoDataUri: r.photoEvidenceFileId ? photos.get(r.photoEvidenceFileId) : undefined,
    })),
    policies: noticeboardPolicies(policyRows),
    format: orgFormat(org ?? {}),
  };
}
