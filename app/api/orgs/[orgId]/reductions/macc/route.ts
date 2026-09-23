export const dynamic = "force-dynamic";

// Marginal abatement cost curve for the org's reduction initiatives — see
// lib/reductions/macc.ts for the ranking methodology.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { computeMacc, buildMaccCurve } from "@/lib/reductions/macc";
import { appraisalPrice, netOfCarbonPrice } from "@/lib/carbon-price";
import { maccInputsInCurrency, priceIn } from "@/lib/reductions/macc-inputs";
import { loadCarbonPrices } from "@/lib/carbon-price/load";

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
        costCurrency: true,
        opexDeltaAnnual: true,
        lifetimeYears: true,
        expectedImpactCo2e: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { reportingCurrency: true } });
    const currency = org?.reportingCurrency ?? "GBP";
    // Costs converted to the reporting currency (see lib/reductions/macc-inputs.ts).
    const { inputs, unconverted } = await maccInputsInCurrency(initiatives, currency);
    const entries = computeMacc(inputs);

    const price = appraisalPrice(await loadCarbonPrices(orgId), new Date());
    const netPrice = price ? priceIn(price, currency) : null;
    const curve = buildMaccCurve(entries).map((e) => ({
      ...e,
      ...(netPrice != null ? netOfCarbonPrice(e.marginalCostPerTco2e, netPrice) : {}),
    }));
    const excludedCount = inputs.length - entries.length;

    return NextResponse.json({
      curve,
      currency,
      unconverted,
      carbonPrice: price
        ? { name: price.name, pricePerTonne: price.pricePerTonne, currency: price.currency, pricePerTonneInCurrency: netPrice, appliedToCurve: netPrice != null }
        : null,
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
