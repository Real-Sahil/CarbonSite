export const dynamic = "force-dynamic";

// Marginal abatement cost curve for the org's reduction initiatives — see
// lib/reductions/macc.ts for the ranking methodology.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { computeMacc, buildMaccCurve } from "@/lib/reductions/macc";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const initiatives = await prisma.reductionInitiative.findMany({
      where: { organizationId: orgId, status: { not: "canceled" } },
      select: {
        id: true,
        name: true,
        status: true,
        capexAmount: true,
        costAmount: true,
        opexDeltaAnnual: true,
        lifetimeYears: true,
        expectedImpactCo2e: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const entries = computeMacc(
      initiatives.map((i) => ({
        id: i.id,
        name: i.name,
        // Fall back to the legacy single-figure costAmount when capexAmount
        // hasn't been set on this initiative yet.
        capexAmount: i.capexAmount != null ? Number(i.capexAmount) : i.costAmount != null ? Number(i.costAmount) : null,
        opexDeltaAnnual: i.opexDeltaAnnual != null ? Number(i.opexDeltaAnnual) : null,
        lifetimeYears: i.lifetimeYears,
        // ReductionInitiative.expectedImpactCo2e is stored in kgCO2e (see
        // the "Expected impact (kgCO2e)" field on the creation form) —
        // computeMacc expects tCO2e, so it must be converted here.
        expectedImpactCo2e: i.expectedImpactCo2e != null ? Number(i.expectedImpactCo2e) / 1000 : null,
      })),
    );

    const curve = buildMaccCurve(entries);
    const excludedCount = initiatives.length - entries.length;

    return NextResponse.json({
      curve,
      totalAbatementTco2e: curve.length > 0 ? curve[curve.length - 1].cumulativeAbatementEndTco2e : 0,
      excludedCount,
      excludedReason:
        excludedCount > 0
          ? "Initiatives with no expected CO2e impact recorded can't be placed on a cost-per-tonne axis."
          : null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
