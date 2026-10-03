export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { parseKpis } from "@/lib/case-studies";
import { CaseStudies } from "./case-studies-client";

export default async function CaseStudiesPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  let role;
  try {
    role = (await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders)).membership.role;
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return <p className="p-8 text-sm text-red-600">You do not have access to case studies.</p>;
  }
  const canEdit = ROLE_GROUPS.editor.includes(role);

  const [rows, contracts] = await Promise.all([
    prisma.caseStudy.findMany({ where: { organizationId: orgId }, orderBy: { updatedAt: "desc" } }),
    prisma.contract.findMany({ where: { organizationId: orgId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 px-4 py-8 sm:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Case studies</h1>
        <p className="mt-2 max-w-[70ch] text-sm text-[#374151]">
          Short project stories for a site noticeboard or a bid: the problem, what you did, what the results are measured against, and the
          results. Figures here are your own statement, not calculated from your records, so the board says so. Give the baseline and the
          assumptions. Published case studies appear on the site noticeboard of their contract (Reports, type &ldquo;Site noticeboard&rdquo;).
        </p>
      </div>
      <CaseStudies
        orgId={orgId}
        canEdit={canEdit}
        contracts={contracts}
        studies={rows.map((r) => ({
          id: r.id,
          contractId: r.contractId,
          title: r.title,
          problem: r.problem,
          solution: r.solution,
          baseline: r.baseline,
          results: r.results,
          kpis: parseKpis(r.kpis),
          assumptions: r.assumptions,
          photoEvidenceFileId: r.photoEvidenceFileId,
          published: r.published,
        }))}
      />
    </div>
  );
}
