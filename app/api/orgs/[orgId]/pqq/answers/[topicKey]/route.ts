export const dynamic = "force-dynamic";

// The organisation's answer to one pre-qualification topic, shared by every
// questionnaire that asks it.

import { NextRequest } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { PQQ_EDITORS } from "@/lib/pqq/access";
import { AnswerError, answerSchema, saveAnswer } from "@/lib/pqq/answers";

type Params = { params: Promise<{ orgId: string; topicKey: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { orgId, topicKey } = await params;
    const { session } = await requireOrgMember(orgId, ...PQQ_EDITORS);
    const body = answerSchema.parse(await req.json());
    const saved = await saveAnswer(orgId, session.user.id, decodeURIComponent(topicKey), body);
    return Response.json({ topicKey: saved.topicKey, response: saved.response, answer: saved.answer, evidenceFileIds: saved.evidenceFileIds, updatedAt: saved.updatedAt });
  } catch (err) {
    if (err instanceof AnswerError) return apiError(err.code, err.message, err.status);
    return handleRouteError(err);
  }
}
