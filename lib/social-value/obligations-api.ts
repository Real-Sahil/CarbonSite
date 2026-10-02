import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { orgRefsMessage } from "@/lib/security/org-refs";
import { svRefsError } from "@/lib/social-value/refs";
import { OBLIGATION_KINDS, OBLIGATION_STATUSES } from "@/lib/social-value/obligations";

export const obligationBody = z.object({
  title: z.string().trim().min(1).max(200),
  reference: z.string().trim().max(100).nullish(),
  authority: z.string().trim().max(200).nullish(),
  clause: z.string().trim().max(200).nullish(),
  kind: z.enum(OBLIGATION_KINDS).optional(),
  description: z.string().trim().max(4000).nullish(),
  targetValue: z.number().nonnegative().nullish(),
  targetUnit: z.string().trim().max(50).nullish(),
  dueDate: z.string().date().nullish(),
  status: z.enum(OBLIGATION_STATUSES).optional(),
  notes: z.string().trim().max(4000).nullish(),
  siteId: z.string().min(1).nullish(),
  contractId: z.string().min(1).nullish(),
  commitmentId: z.string().min(1).nullish(),
  ownerUserId: z.string().min(1).nullish(),
});
type Body = z.infer<typeof obligationBody>;

/** Every id the body names must be this organisation's. */
export async function obligationRefsError(orgId: string, b: Partial<Body>): Promise<string | null> {
  return (
    (await orgRefsMessage(orgId, { siteId: b.siteId, contractId: b.contractId, ownerUserId: b.ownerUserId })) ??
    (await svRefsError(orgId, { commitmentId: b.commitmentId }))
  );
}

export function obligationData(b: Partial<Body>) {
  return {
    ...b,
    targetValue: b.targetValue == null ? b.targetValue : new Decimal(b.targetValue),
    dueDate: b.dueDate ? new Date(b.dueDate) : b.dueDate,
  };
}

