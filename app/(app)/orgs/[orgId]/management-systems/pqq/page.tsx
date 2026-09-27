export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { PQQ_EDITORS, PQQ_READERS } from "@/lib/pqq/access";
import { BUILT_IN_SETS } from "@/lib/pqq/sets";
import type { QuestionSet } from "@/lib/pqq/catalogue/types";
import { TOPICS } from "@/lib/pqq/topics";
import { ImportQuestionnaire } from "./import-questionnaire";

export default async function PqqPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  let role: string;
  try {
    const { membership } = await requireOrgMember(orgId, ...PQQ_READERS);
    role = membership.role;
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return <div className="p-8 text-sm text-[#6B7280]">You do not have permission to view pre-qualification answers.</div>;
  }
  const [custom, answers] = await Promise.all([
    prisma.pqqQuestionSet.findMany({ where: { organizationId: orgId }, select: { id: true, name: true, issuer: true, dueOn: true, questions: true }, orderBy: { createdAt: "desc" } }),
    prisma.pqqAnswer.findMany({ where: { organizationId: orgId }, select: { topicKey: true, response: true, answer: true } }),
  ]);
  const answered = new Set(answers.filter((a) => a.answer || a.response).map((a) => a.topicKey));
  const progress = (set: Pick<QuestionSet, "questions">) => {
    const keys = [...new Set(set.questions.map((q) => q.topicKey))];
    return { done: keys.filter((k) => answered.has(k)).length, total: keys.length };
  };
  const sets = [
    ...BUILT_IN_SETS.map((s) => ({ id: s.id, name: s.name, issuer: s.issuer, detail: s.version ?? "", ...progress(s) })),
    ...custom.map((s) => ({ id: s.id, name: s.name, issuer: s.issuer ?? "", detail: s.dueOn ? `Due ${s.dueOn.toISOString().slice(0, 10)}` : "Your questionnaire", ...progress({ questions: s.questions as QuestionSet["questions"] }) })),
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href={`/orgs/${orgId}/management-systems`} className="text-xs text-[#6B7280] hover:text-[#111827]">Management systems</Link>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Pre-qualification answers</h1>
        <p className="max-w-[75ch] text-sm text-[#6B7280]">
          Answer each pre-qualification topic once and reuse it for every questionnaire: the Common Assessment Standard (used by Constructionline, Veriforce CHAS,
          Smas Worksafe, Achilles, CQMS, SCCS and Compliance Chain, and preferred for public works under PPN 03/24) and your clients&apos; own PQQs. Answers can be
          drafted from your policies, certificates, training matrix, incident, supplier and carbon records. You have answered {answered.size} of {TOPICS.length} topics.
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-[#E5E7EB] rounded-[14px] border border-[#E5E7EB] bg-white">
        {sets.map((s) => (
          <li key={s.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-[#111827]">{s.name} <span className="text-xs font-normal text-[#6B7280]">{s.issuer}{s.detail ? ` · ${s.detail}` : ""}</span></p>
              <p className="mt-1 text-xs tabular-nums text-[#6B7280]">{s.done} of {s.total} answer topics answered</p>
            </div>
            <Link href={`/orgs/${orgId}/management-systems/pqq/${s.id}`} className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm text-[#111827] hover:bg-[#F9FAFB]">Open</Link>
          </li>
        ))}
      </ul>
      {(PQQ_EDITORS as string[]).includes(role) && <ImportQuestionnaire orgId={orgId} topics={TOPICS.map((t) => ({ key: t.key, title: t.title, section: t.section }))} />}
    </div>
  );
}
