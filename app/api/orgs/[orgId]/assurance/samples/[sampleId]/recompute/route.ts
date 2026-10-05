export const dynamic = "force-dynamic";

// Repeats the arithmetic of the calculation a sample points at, from its stored formula, so the
// tester sees the recomputed figure beside the stored one. Read-only; the result is advice for the
// tester and is not written to the sample.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { recomputeFromFormula } from "@/lib/assurance/recompute";

type Params = { params: Promise<{ orgId: string; sampleId: string }> };

const ROLES = ["admin", "sustainability_director", "auditor"] as const;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, sampleId } = await params;
    await requireOrgMember(orgId, ...ROLES);
    const sample = await prisma.assuranceSample.findFirst({
      where: { id: sampleId, organizationId: orgId },
      select: { emissionCalculation: { select: { id: true, formula: true, normalizedAmount: true, totalCo2e: true, factorValue: true } } },
    });
    if (!sample) return apiError("NOT_FOUND", "Sample not found.", 404);
    const calc = sample.emissionCalculation;
    if (!calc) return apiError("NOT_CALCULATED", "This sample is not a calculation (it is a water or waste record), so there is no formula to repeat.", 422);
    const result = recomputeFromFormula({ formula: calc.formula, normalizedAmount: Number(calc.normalizedAmount), totalCo2e: Number(calc.totalCo2e) });
    return Response.json({ calculationId: calc.id, formula: calc.formula, factorValue: calc.factorValue == null ? null : Number(calc.factorValue), ...result });
  } catch (err) {
    return handleRouteError(err);
  }
}
