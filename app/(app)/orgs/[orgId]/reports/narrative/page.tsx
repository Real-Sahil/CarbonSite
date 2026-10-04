export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { aiAssistEnabled } from "@/lib/llm/org-consent";
import { NarrativeEditor } from "./narrative-editor";

export default async function NarrativePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ periodId?: string }>;
}) {
  const { orgId } = await params;
  const { periodId: requested } = await searchParams;
  let role = "";
  try {
    role = (await requireOrgMember(orgId, ...ROLE_GROUPS.reviewersAndEditors)).membership.role;
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in");
    throw err;
  }
  const periods = await prisma.reportingPeriod.findMany({
    where: { organizationId: orgId },
    select: { id: true, label: true },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });
  const period = periods.find((p) => p.id === requested) ?? periods[0];
  const [row, aiAvailable] = period
    ? await Promise.all([
        prisma.reportNarrative.findFirst({ where: { organizationId: orgId, reportingPeriodId: period.id } }),
        aiAssistEnabled(orgId),
      ])
    : [null, false];
  const findings = Array.isArray(row?.keyFindings) ? (row!.keyFindings as unknown[]).map(String) : [];
  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 sm:px-8">
      <p className="text-xs"><Link href={`/orgs/${orgId}/reports`} className="underline underline-offset-2 text-[#374151]">Back to reports</Link></p>
      <h1 className="mt-2 text-2xl font-semibold text-[#111827]">Report summary</h1>
      <p className="mt-1 max-w-[65ch] text-sm text-[#374151]">
        The summary page of your inventory reports, in your own words. When you save text here it replaces generated wording for that period, and each report says your team wrote it. With nothing saved, reports are exactly as they were.
      </p>
      <div className="mt-6">
        {period ? (
          <NarrativeEditor
            orgId={orgId}
            periods={periods}
            periodId={period.id}
            saved={row ? { executiveSummary: row.executiveSummary, keyFindings: findings, recommendations: row.recommendations, aiDrafted: row.aiDrafted } : null}
            aiAvailable={aiAvailable}
            canEdit={(ROLE_GROUPS.editor as string[]).includes(role)}
          />
        ) : (
          <p className="text-sm text-[#374151]">Create a reporting period first.</p>
        )}
      </div>
    </div>
  );
}
