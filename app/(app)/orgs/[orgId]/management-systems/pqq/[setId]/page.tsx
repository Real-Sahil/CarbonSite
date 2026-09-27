export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { PQQ_EDITORS, PQQ_READERS } from "@/lib/pqq/access";
import { loadQuestionSet } from "@/lib/pqq/sets";
import { SECTIONS, getTopic } from "@/lib/pqq/topics";
import { draftAll, loadPqqContext } from "@/lib/pqq/draft";
import { PqqWorkspace, type AnswerCard } from "./workspace";

export default async function PqqSetPage({ params }: { params: Promise<{ orgId: string; setId: string }> }) {
  const { orgId, setId } = await params;
  let role: string;
  try {
    const { membership } = await requireOrgMember(orgId, ...PQQ_READERS);
    role = membership.role;
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return <div className="p-8 text-sm text-[#6B7280]">You do not have permission to view pre-qualification answers.</div>;
  }
  const set = await loadQuestionSet(orgId, setId);
  if (!set) notFound();
  const keys = [...new Set(set.questions.map((q) => q.topicKey))];
  const [answers, files, context] = await Promise.all([
    prisma.pqqAnswer.findMany({ where: { organizationId: orgId, topicKey: { in: keys } } }),
    prisma.evidenceFile.findMany({ where: { organizationId: orgId }, select: { id: true, filename: true }, orderBy: { createdAt: "desc" }, take: 300 }),
    loadPqqContext(orgId),
  ]);
  const drafts = draftAll(context);
  const byKey = new Map(answers.map((a) => [a.topicKey, a]));

  // One card per answer topic, in the order the questionnaire first asks it.
  const cards: AnswerCard[] = keys.map((key) => {
    const topic = getTopic(key);
    const qs = set.questions.filter((q) => q.topicKey === key);
    const a = byKey.get(key);
    return {
      key,
      refs: qs.map((q) => q.ref),
      texts: qs.map((q) => q.text).filter((t): t is string => !!t),
      title: topic?.title ?? qs[0]?.text ?? key,
      section: topic ? SECTIONS[topic.section] : "Other questions",
      guidance: topic?.guidance ?? null,
      yesNo: topic?.yesNo ?? false,
      document: topic?.document ?? false,
      response: a?.response ?? null,
      answer: a?.answer ?? "",
      evidenceFileIds: a?.evidenceFileIds ?? [],
      updatedAt: a?.updatedAt.toISOString() ?? null,
      draft: drafts[key] ?? null,
    };
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href={`/orgs/${orgId}/management-systems/pqq`} className="text-xs text-[#6B7280] hover:text-[#111827]">Pre-qualification answers</Link>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">{set.name}</h1>
        <p className="text-sm text-[#6B7280]">{[set.issuer, set.version, set.dueOn ? `Due ${set.dueOn}` : null].filter(Boolean).join(" · ")}</p>
        {set.note && <p className="mt-1 max-w-[80ch] text-xs text-[#6B7280]">{set.note}{set.sourceUrl ? " " : ""}{set.sourceUrl && <a href={set.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">Source</a>}</p>}
      </div>
      <PqqWorkspace
        orgId={orgId}
        setId={set.id}
        custom={set.custom}
        cards={cards}
        files={files.map((f) => ({ id: f.id, name: f.filename }))}
        canEdit={(PQQ_EDITORS as string[]).includes(role)}
      />
    </div>
  );
}
