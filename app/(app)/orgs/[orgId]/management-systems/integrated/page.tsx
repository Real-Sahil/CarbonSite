export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { MS_READERS } from "@/lib/management-systems/access";
import { getFramework, type CatalogueFramework } from "@/lib/management-systems/catalogue";
import { integratedView } from "@/lib/management-systems/integrated";
import type { RequirementState } from "@/lib/management-systems/readiness";

const STYLE: Record<RequirementState, string> = {
  not_started: "bg-[#F3F4F6] text-[#374151]",
  in_progress: "bg-amber-50 text-amber-800",
  implemented: "bg-emerald-50 text-emerald-800",
  not_applicable: "bg-slate-100 text-slate-500",
};
const LABEL: Record<RequirementState, string> = { not_started: "Not started", in_progress: "In progress", implemented: "Implemented", not_applicable: "Not applicable" };

export default async function IntegratedPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  try {
    await requireOrgMember(orgId, ...MS_READERS);
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return <div className="p-8 text-sm text-[#6B7280]">You do not have permission to view management systems.</div>;
  }
  const adoptions = await prisma.msFrameworkAdoption.findMany({ where: { organizationId: orgId, status: { not: "withdrawn" } }, select: { frameworkSlug: true }, orderBy: { createdAt: "asc" } });
  const frameworks = adoptions.map((a) => getFramework(a.frameworkSlug)).filter((f): f is CatalogueFramework => !!f && f.family !== "privacy");
  const slugs = frameworks.map((f) => f.slug);
  const [statuses, evidence] = await Promise.all([
    prisma.msRequirementStatus.findMany({ where: { organizationId: orgId, frameworkSlug: { in: slugs } }, select: { frameworkSlug: true, requirementCode: true, status: true } }),
    prisma.msEvidenceLink.groupBy({ by: ["frameworkSlug", "requirementCode"], where: { organizationId: orgId, frameworkSlug: { in: slugs } }, _count: { _all: true } }),
  ]);
  const { rows, sharedShare } = integratedView(
    frameworks,
    new Map(statuses.map((s) => [`${s.frameworkSlug}|${s.requirementCode}`, s.status as RequirementState])),
    new Map(evidence.map((e) => [`${e.frameworkSlug}|${e.requirementCode}`, e._count._all])),
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href={`/orgs/${orgId}/management-systems`} className="text-xs text-[#6B7280] hover:text-[#111827]">Management systems</Link>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Integrated view</h1>
        <p className="max-w-[75ch] text-sm text-[#6B7280]">
          Clauses your adopted standards share, side by side. Where the statuses differ the row is flagged: the same process usually answers every standard, so
          bring them into line. Certification bodies may shorten a combined audit of an integrated system by up to 20% (IAF MD 11), depending on how integrated it is.
        </p>
        {rows.length > 0 && <p className="text-sm tabular-nums text-[#374151]">{rows.length} shared clauses covering {sharedShare}% of the requirements you assess.</p>}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-[#E5E7EB] p-6 text-sm text-[#6B7280]">Adopt two or more ISO management system standards (for example ISO 9001, 14001 and 45001) to see their shared clauses.</p>
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-[#E5E7EB] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E5E7EB] text-xs text-[#6B7280]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Shared clause</th>
                {frameworks.map((f) => <th key={f.slug} className="whitespace-nowrap px-4 py-2.5 font-medium">{f.shortName}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {rows.map((r) => (
                <tr key={r.key} className="align-top">
                  <td className="px-4 py-2.5 font-medium text-[#111827]">
                    {r.title}
                    {!r.aligned && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-normal text-amber-800">Statuses differ</span>}
                  </td>
                  {frameworks.map((f) => {
                    const c = r.cells[f.slug];
                    return (
                      <td key={f.slug} className="px-4 py-2.5">
                        {c ? (
                          <Link href={`/orgs/${orgId}/management-systems/${f.slug}#req-${c.code.replace(/[^A-Za-z0-9]+/g, "-")}`} className="flex flex-col gap-1 hover:underline">
                            <span className="font-mono text-xs text-[#6B7280]">{c.code}</span>
                            <span className={`self-start rounded-full px-2 py-0.5 text-xs ${STYLE[c.status]}`}>{LABEL[c.status]}</span>
                            <span className="text-xs tabular-nums text-[#6B7280]">{c.evidence} evidence</span>
                          </Link>
                        ) : (
                          <span className="text-[#D1D5DB]">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
