import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { isAnswerKey } from "./match";

export const answerSchema = z
  .object({
    response: z.enum(["yes", "no", "not_applicable"]).nullable().optional(),
    answer: z.string().max(20000).nullable().optional(),
    evidenceFileIds: z.array(z.string().min(1).max(64)).max(20).optional(),
  })
  .strict();

export class AnswerError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
  }
}

/** Saves the organisation's answer to one topic. Every evidence file must be the organisation's. */
export async function saveAnswer(orgId: string, userId: string, topicKey: string, body: z.infer<typeof answerSchema>) {
  if (!isAnswerKey(topicKey)) throw new AnswerError("Unknown answer topic.", 404, "NOT_FOUND");
  const files = body.evidenceFileIds ?? [];
  if (files.length) {
    const found = await prisma.evidenceFile.count({ where: { organizationId: orgId, id: { in: files } } });
    if (found !== new Set(files).size) throw new AnswerError("Evidence file not found in this organisation.", 404, "NOT_FOUND");
  }
  const data = {
    ...(body.response !== undefined ? { response: body.response } : {}),
    ...(body.answer !== undefined ? { answer: body.answer } : {}),
    ...(body.evidenceFileIds !== undefined ? { evidenceFileIds: [...new Set(files)] } : {}),
    updatedByUserId: userId,
  };
  const saved = await prisma.pqqAnswer.upsert({
    where: { organizationId_topicKey: { organizationId: orgId, topicKey } },
    create: { organizationId: orgId, topicKey, ...data },
    update: data,
  });
  await writeAuditLog({
    organizationId: orgId,
    actorUserId: userId,
    action: "management_system.pqq_answer_updated",
    resourceType: "PqqAnswer",
    resourceId: saved.id,
    metadata: { topicKey, response: saved.response, files: saved.evidenceFileIds.length },
  });
  return saved;
}
