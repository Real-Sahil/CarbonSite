// Request schemas for the climate disclosure routes. Route files cannot export
// helpers, so the shared pieces live here.

import { z } from "zod";
import { HORIZONS, RISK_KINDS, RISK_STATUSES } from "./index";

const text = z.string().trim().max(5000).nullable().optional().transform((v) => (v ? v : null));
const scale = z.number().int().min(1).max(5);
const oneOf = <T extends readonly { value: string }[]>(list: T) => z.enum(list.map((i) => i.value) as [string, ...string[]]);

export const riskBody = z
  .object({
    kind: oneOf(RISK_KINDS),
    title: z.string().trim().min(2).max(200),
    description: text,
    horizon: oneOf(HORIZONS),
    inherentLikelihood: scale,
    inherentImpact: scale,
    residualLikelihood: scale.nullable().optional().transform((v) => v ?? null),
    residualImpact: scale.nullable().optional().transform((v) => v ?? null),
    mitigation: text,
    financialEffect: text,
    ownerRole: z.string().trim().max(120).nullable().optional().transform((v) => (v ? v : null)),
    status: oneOf(RISK_STATUSES).default("open"),
  })
  .refine((r) => (r.residualLikelihood == null) === (r.residualImpact == null), {
    message: "Give both residual likelihood and residual impact, or neither.",
    path: ["residualLikelihood"],
  });
export type RiskBody = z.infer<typeof riskBody>;
