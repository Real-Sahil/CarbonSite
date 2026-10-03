export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { FRAMEWORK_NOTE, STATUS_LABELS } from "@/lib/materiality";
import { StatusControl, StarterButton, TopicEditor } from "./assessment-client";

export default async function MaterialityAssessmentPage({ params }: { params: Promise<{ orgId: string; assessmentId: string }> }) {
  const { orgId, assessmentId } = await params;

  let role;
  try {
    role = (await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders)).membership.role;
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return <p className="p-8 text-sm text-red-600">You do not have access to this assessment.</p>;
  }
  const canEdit = ROLE_GROUPS.editor.includes(role);

  const assessment = await prisma.materialityAssessment.findFirst({
    where: { id: assessmentId, organizationId: orgId },
    include: {
      reportingPeriod: { select: { label: true } },
      topics: { orderBy: [{ esrsCode: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!assessment) notFound();

  const locked = assessment.status === "approved" || assessment.status === "published";
  const material = assessment.topics.filter((t) => t.isMaterial).length;
  const unscored = assessment.topics.filter((t) => t.impactScore == null && t.financialScore == null).length;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-8 sm:px-8">
      <div>
        <Link href={`/orgs/${orgId}/materiality`} className="text-xs text-[#6B7280] underline underline-offset-2">All assessments</Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111827]">{assessment.name}</h1>
            <p className="mt-2 max-w-[70ch] text-sm text-[#374151]">{FRAMEWORK_NOTE}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#6B7280]">Status</p>
            <p className="text-sm font-medium text-[#111827]">{STATUS_LABELS[assessment.status] ?? assessment.status}</p>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 rounded-[10px] border border-[#E5E7EB] bg-white p-5 sm:grid-cols-3">
        <div><p className="text-xs text-[#6B7280]">Topics</p><p className="text-lg font-semibold tabular-nums">{assessment.topics.length}</p></div>
        <div><p className="text-xs text-[#6B7280]">Material (score 3 or more on either dimension)</p><p className="text-lg font-semibold tabular-nums">{material}</p></div>
        <div><p className="text-xs text-[#6B7280]">Not yet scored</p><p className="text-lg font-semibold tabular-nums">{unscored}</p></div>
      </section>

      {canEdit && (
        <section className="rounded-[10px] border border-[#E5E7EB] bg-white p-5">
          <h2 className="text-base font-semibold text-[#111827]">Status</h2>
          <p className="mt-1 max-w-[70ch] text-xs text-[#6B7280]">
            Move the assessment through stakeholder review to approval once the board has signed it off. An approved or published assessment cannot have its topics changed until it is set back to draft. Approved and published assessments feed the sustainability report.
          </p>
          <StatusControl orgId={orgId} assessmentId={assessment.id} status={assessment.status} approvedAt={assessment.approvedAt?.toISOString().slice(0, 10) ?? ""} />
        </section>
      )}

      <section className="rounded-[10px] border border-[#E5E7EB] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F3F4F6] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#111827]">Topics</h2>
            <p className="mt-1 max-w-[70ch] text-xs text-[#6B7280]">
              Score each impact, risk or opportunity from 1 to 5 for impact materiality (your effect on people and the environment) and for financial materiality (its effect on you). A topic is material when either score is 3 or more; you can override that. Say why.
            </p>
          </div>
          {canEdit && !locked && <StarterButton orgId={orgId} assessmentId={assessment.id} />}
        </div>
        <TopicEditor
          orgId={orgId}
          assessmentId={assessment.id}
          canEdit={canEdit && !locked}
          topics={assessment.topics.map((t) => ({
            id: t.id,
            esrsCode: t.esrsCode,
            topicName: t.topicName,
            iroType: t.iroType,
            impactScore: t.impactScore,
            financialScore: t.financialScore,
            isMaterial: t.isMaterial,
            rationale: t.rationale,
          }))}
        />
      </section>
    </div>
  );
}
