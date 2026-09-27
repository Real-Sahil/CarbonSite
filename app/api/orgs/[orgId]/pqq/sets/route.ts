export const dynamic = "force-dynamic";

// A client's own questionnaire. POST { name, issuer?, dueOn?, text, preview: true }
// returns the questions parsed from the pasted text with a suggested answer
// topic each; POST { name, issuer?, dueOn?, questions } saves them.

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/validation/api";
import { PQQ_EDITORS } from "@/lib/pqq/access";
import { customTopicKey, parseQuestions, suggestTopic } from "@/lib/pqq/match";
import { questionSetSchema } from "@/lib/pqq/sets";

const previewSchema = z.object({ preview: z.literal(true), text: z.string().min(1).max(200_000) }).strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...PQQ_EDITORS);
    const json = await req.json();
    if (json?.preview === true) {
      const { text } = previewSchema.parse(json);
      const questions = parseQuestions(text).map((q) => {
        const suggested = suggestTopic(q.text);
        return { ...q, topicKey: suggested ?? customTopicKey(q.text), suggested: !!suggested };
      });
      return Response.json({ questions });
    }
    const body = questionSetSchema.parse(json);
    const set = await prisma.pqqQuestionSet.create({
      data: {
        organizationId: orgId,
        name: body.name,
        issuer: body.issuer ?? null,
        dueOn: body.dueOn ? new Date(`${body.dueOn}T00:00:00Z`) : null,
        questions: body.questions,
        createdByUserId: session.user.id,
      },
    });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "management_system.pqq_set_saved",
      resourceType: "PqqQuestionSet",
      resourceId: set.id,
      metadata: { name: body.name, questions: body.questions.length },
    });
    return Response.json({ id: set.id }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
