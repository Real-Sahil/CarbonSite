export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";

const querySchema = z.object({
  reportingPeriodId: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(
      orgId,
      "admin",
      "sustainability_director",
      "sustainability_manager",
      "editor",
      "reviewer",
      "viewer",
      "auditor",
    );

    const searchParams = new URL(req.url).searchParams;
    const reportingPeriodId = searchParams.get("reportingPeriodId");

    // Get all periods or specific period
    const periods = reportingPeriodId
      ? await prisma.reportingPeriod.findMany({
          where: { organizationId: orgId, id: reportingPeriodId },
          orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        })
      : await prisma.reportingPeriod.findMany({
          where: { organizationId: orgId },
          orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
          take: 5,
        });

    if (periods.length === 0) {
      return NextResponse.json({
        success: true,
        periods: [],
        summary: null,
        message: "No reporting periods found",
      });
    }

    // Get Scope 2 statistics for each period
    const periodSummaries = await Promise.all(
      periods.map(async (period) => {
        const scope2Records = await prisma.activityRecord.groupBy({
          by: ["scope2Method"],
          where: {
            organizationId: orgId,
            reportingPeriodId: period.id,
            emissionCategory: { scope: 2 },
          },
          _count: { id: true },
          _sum: { amount: true },
        });

        const categoryStats = await prisma.activityRecord.findMany({
          where: {
            organizationId: orgId,
            reportingPeriodId: period.id,
            emissionCategory: { scope: 2 },
          },
          select: {
            scope2Method: true,
            emissionCategory: { select: { code: true, name: true } },
          },
        });

        // Group by category and method
        const byCategory = new Map<
          string,
          { name: string; marketBased: number; locationBased: number; unset: number }
        >();

        categoryStats.forEach((rec) => {
          const key = rec.emissionCategory.code;
          if (!byCategory.has(key)) {
            byCategory.set(key, {
              name: rec.emissionCategory.name,
              marketBased: 0,
              locationBased: 0,
              unset: 0,
            });
          }
          const entry = byCategory.get(key)!;
          if (rec.scope2Method === "market_based") entry.marketBased++;
          else if (rec.scope2Method === "location_based") entry.locationBased++;
          else entry.unset++;
        });

        const marketBased = scope2Records.find((r) => r.scope2Method === "market_based")?._count.id ?? 0;
        const locationBased = scope2Records.find((r) => r.scope2Method === "location_based")?._count.id ?? 0;
        const unset = scope2Records.find((r) => r.scope2Method === null)?._count.id ?? 0;
        const total = marketBased + locationBased + unset;

        return {
          periodId: period.id,
          label: period.label,
          startDate: period.startDate,
          endDate: period.endDate,
          scope2RecordCount: total,
          methods: {
            marketBased: { count: marketBased, pct: total > 0 ? Math.round((marketBased / total) * 100) : 0 },
            locationBased: { count: locationBased, pct: total > 0 ? Math.round((locationBased / total) * 100) : 0 },
            unset: { count: unset, pct: total > 0 ? Math.round((unset / total) * 100) : 0 },
          },
          byCategory: Array.from(byCategory.values()),
          recommendation:
            unset > 0
              ? `${unset} record${unset !== 1 ? "s" : ""} missing Scope 2 method selection. Review and assign location-based or market-based.`
              : marketBased > 0
                ? `✓ ${marketBased} record${marketBased !== 1 ? "s" : ""} using market-based method.`
                : `All ${total} record${total !== 1 ? "s" : ""} use location-based method.`,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      periods: periodSummaries,
      summary: periodSummaries[0] || null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
