export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import type { OrgRole } from "@prisma/client";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { modeSplit, SURVEY_MODES, type SurveyMode, type Workforce } from "@/lib/commuting/attendance";
import { CommutingWorkspace, type SiteRow, type ImportRow } from "./workspace";

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function CommutingPage({ params }: PageProps) {
  const { orgId } = await params;
  let role: OrgRole;
  try {
    role = (await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders)).membership.role;
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return <div className="p-8 text-sm text-red-600">You do not have permission to view commuting.</div>;
  }
  const canEdit = (ROLE_GROUPS.editor as OrgRole[]).includes(role);

  const [sites, surveys, imports, org] = await Promise.all([
    prisma.site.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, postcode: true, project: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.commuteSurvey.findMany({
      where: { organizationId: orgId },
      select: { siteId: true, token: true, isOpen: true, responses: { select: { mode: true, occupancy: true, workforce: true } } },
    }),
    prisma.commuteImport.findMany({
      where: { organizationId: orgId },
      select: { id: true, siteId: true, month: true, recordIds: true, summary: true, createdAt: true },
      orderBy: [{ month: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
  ]);

  const surveyBySite = new Map(surveys.map((s) => [s.siteId, s]));
  const siteRows: SiteRow[] = sites.map((s) => {
    const survey = surveyBySite.get(s.id);
    const answers = (survey?.responses ?? []).map((r) => ({ mode: r.mode as SurveyMode, occupancy: r.occupancy, workforce: r.workforce as Workforce }));
    const split = modeSplit(answers, "own");
    return {
      id: s.id,
      name: s.name,
      project: s.project.name,
      postcode: s.postcode,
      survey: survey ? { token: survey.token, isOpen: survey.isOpen, responses: answers.length } : null,
      split: {
        source: split.source,
        parts: (Object.entries(split.people) as [SurveyMode, number][])
          .sort((a, b) => b[1] - a[1])
          .map(([mode, share]) => ({ label: SURVEY_MODES[mode].label, share })),
      },
    };
  });

  const allRecordIds = imports.flatMap((i) => i.recordIds);
  const records = allRecordIds.length
    ? await prisma.activityRecord.findMany({
        where: { organizationId: orgId, id: { in: allRecordIds } },
        select: { id: true, reviewStatus: true },
      })
    : [];
  const statusById = new Map(records.map((r) => [r.id, r.reviewStatus]));
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const importRows: ImportRow[] = imports.map((i) => {
    const summary = i.summary as { own?: { days: number; personKm: number; lodgingDays: number; averagedDays: number }; subcontractor?: { days: number; personKm: number } };
    const statuses = i.recordIds.map((id) => statusById.get(id)).filter(Boolean) as string[];
    return {
      id: i.id,
      site: siteName.get(i.siteId) ?? "Site",
      month: i.month.toISOString().slice(0, 7),
      records: i.recordIds.length,
      approved: statuses.filter((s) => s === "approved").length,
      ownDays: summary.own?.days ?? 0,
      ownKm: Math.round(summary.own?.personKm ?? 0),
      lodgingDays: summary.own?.lodgingDays ?? 0,
      averagedDays: summary.own?.averagedDays ?? 0,
      subcontractorDays: summary.subcontractor?.days ?? 0,
      subcontractorKm: Math.round(summary.subcontractor?.personKm ?? 0),
    };
  });

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB]">
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-8">
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Employee commuting</h1>
          <p className="mt-1 max-w-[70ch] text-sm text-[#374151]">
            Scope 3 Category 7 from your site sign-ins: days on site, the road distance from each person&apos;s home
            postcode district to the site and back, and how people travel from each site&apos;s survey. Only your own
            staff count in the inventory; subcontractor travel is shown beside it. Records go to{" "}
            <Link href={`/orgs/${orgId}/records`} className="underline underline-offset-2">Records</Link> for review.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-8">
        <CommutingWorkspace orgId={orgId} orgName={org?.name ?? ""} canEdit={canEdit} sites={siteRows} imports={importRows} />
      </div>
    </div>
  );
}
