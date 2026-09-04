export const dynamic = "force-dynamic";

// Data provenance disclosure.
//
// Returns the emissions-weighted split of the inventory across provenance
// tiers. Two disclosures depend on this: the ESRS E1 primary-vs-secondary
// data split, and the CDP-scored share of Scope 3 backed by supplier-specific
// figures. It is also the sampling frame an assurance provider works from.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { summariseProvenance, DATA_ORIGIN_META } from "@/lib/inventory/provenance";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const url = new URL(req.url);
    const reportingPeriodId = url.searchParams.get("reportingPeriodId");

    let periodId = reportingPeriodId;
    if (!periodId) {
      const latest = await prisma.reportingPeriod.findFirst({
        where: { organizationId: orgId },
        orderBy: { startDate: "desc" },
        select: { id: true },
      });
      periodId = latest?.id ?? null;
    }

    if (!periodId) {
      return apiError("NO_PERIOD", "No reporting period found for this organisation.", 404);
    }

    const period = await prisma.reportingPeriod.findFirst({
      where: { id: periodId, organizationId: orgId },
      select: { id: true, label: true, startDate: true, endDate: true },
    });
    if (!period) {
      return apiError("NOT_FOUND", "Reporting period not found in this organisation.", 404);
    }

    // Emissions per record, joined to the record's provenance tier and scope.
    // Reads calculations rather than aggregates because provenance lives on the
    // activity record and aggregates do not carry it.
    const calculations = await prisma.emissionCalculation.findMany({
      where: { organizationId: orgId, activityRecord: { reportingPeriodId: period.id } },
      select: {
        totalCo2e: true,
        activityRecord: {
          select: {
            dataOrigin: true,
            emissionCategory: { select: { scope: true } },
          },
        },
      },
    });

    const all = calculations.map((c) => ({
      dataOrigin: c.activityRecord.dataOrigin,
      totalCo2e: Number(c.totalCo2e),
      scope: c.activityRecord.emissionCategory.scope,
    }));

    const overall = summariseProvenance(all);
    const byScope = [1, 2, 3].map((scope) => ({
      scope,
      ...summariseProvenance(all.filter((r) => r.scope === scope)),
    }));

    // Records on the weakest tiers that carry no written justification. These
    // are the first thing an assurance provider will raise, so they are
    // surfaced as an actionable count rather than buried in a percentage.
    const unjustifiedCount = await prisma.activityRecord.count({
      where: {
        organizationId: orgId,
        reportingPeriodId: period.id,
        dataOrigin: { in: ["proxy", "extrapolated"] },
        OR: [{ dataOriginNote: null }, { dataOriginNote: "" }],
      },
    });

    return Response.json({
      reportingPeriod: period,
      overall,
      byScope,
      tiers: DATA_ORIGIN_META,
      unjustifiedWeakTierRecords: unjustifiedCount,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
