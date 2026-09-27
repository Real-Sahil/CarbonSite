import { z } from "zod";
import { prisma } from "@/lib/db";
import { CAS_V5 } from "./catalogue/cas";
import type { QuestionSet } from "./catalogue/types";
import { isAnswerKey } from "./match";

export const BUILT_IN_SETS: QuestionSet[] = [CAS_V5];

export const questionSetSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    issuer: z.string().trim().max(200).optional(),
    dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    questions: z
      .array(z.object({ ref: z.string().trim().min(1).max(20), text: z.string().trim().min(1).max(2000), topicKey: z.string().max(80).refine(isAnswerKey, "Unknown answer topic") }).strict())
      .min(1)
      .max(500),
  })
  .strict();

/** A built-in set, or one of the organisation's own (looked up inside the organisation). */
export async function loadQuestionSet(orgId: string, id: string): Promise<(QuestionSet & { custom: boolean; dueOn: string | null }) | null> {
  const builtIn = BUILT_IN_SETS.find((s) => s.id === id);
  if (builtIn) return { ...builtIn, custom: false, dueOn: null };
  const row = await prisma.pqqQuestionSet.findFirst({ where: { id, organizationId: orgId } });
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    issuer: row.issuer ?? "",
    questions: row.questions as QuestionSet["questions"],
    custom: true,
    dueOn: row.dueOn ? row.dueOn.toISOString().slice(0, 10) : null,
  };
}
