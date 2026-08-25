import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { z } from "zod";

const querySchema = z.object({
  type: z.enum(["sbti", "benchmark", "compliance", "all"]).default("all"),
  severity: z.enum(["critical", "warning", "info"]).optional(),
  resolved: z.string().transform(v => v === 'true').optional(),
});

const acknowledgeSchema = z.object({
  alertIds: z.array(z.string()),
  resolved: z.boolean().optional(),
});

/**
 * GET /api/orgs/[orgId]/alerts
 * List alerts for the organization (SBTi, benchmarks, compliance).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    const query = querySchema.parse({
      type: request.nextUrl.searchParams.get("type") ?? "all",
      severity: request.nextUrl.searchParams.get("severity") ?? undefined,
      resolved: request.nextUrl.searchParams.get("resolved") ?? undefined,
    });

    const target = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });

    if (!target) {
      return apiError("ORG_NOT_FOUND", "Organization not found", 404);
    }

    const alerts: any[] = [];

    // Get SBTi alerts
    if (query.type === "sbti" || query.type === "all") {
      const sbtialerts = await prisma.sbtiTarget.findUnique({
        where: { organizationId: orgId },
      });

      if (sbtialerts) {
        // Get current year emissions
        const now = new Date();
        const currentYear = now.getFullYear();
        const yearStart = new Date(`${currentYear}-01-01`);
        const yearEnd = new Date(`${currentYear}-12-31`);

        const actualData = await prisma.dashboardAggregate.aggregate({
          where: {
            organizationId: orgId,
            reportingPeriod: {
              startDate: { gte: yearStart },
              endDate: { lte: yearEnd },
            },
          },
          _sum: {
            totalCo2e: true,
          },
        });

        const actual = Number(actualData._sum?.totalCo2e ?? 0);

        // Calculate expected emissions
        const baselineScope1 = Number(sbtialerts.baselineScope1Tco2e);
        const baselineScope2 = Number(sbtialerts.baselineScope2Tco2e);
        const baselineScope3 = sbtialerts.baselineScope3Tco2e
          ? Number(sbtialerts.baselineScope3Tco2e)
          : 0;
        const totalBaseline = baselineScope1 + baselineScope2 + baselineScope3;

        if (currentYear <= sbtialerts.nearTermYear) {
          const yearsToNearTerm =
            sbtialerts.nearTermYear - sbtialerts.baseYear;
          const nearTermReduction = Number(sbtialerts.nearTermReductionPct);
          const expectedNearTerm =
            totalBaseline * (1 - nearTermReduction / 100);
          const annualRate = (totalBaseline - expectedNearTerm) / yearsToNearTerm;
          const yearsElapsed = currentYear - sbtialerts.baseYear;
          const expectedEmissions = totalBaseline - annualRate * yearsElapsed;
          const deviation = actual - expectedEmissions;
          const deviationPercent = (deviation / expectedEmissions) * 100;

          if (deviation > 0) {
            let severity: "critical" | "warning" | "info" = "info";
            if (deviationPercent > 20) severity = "critical";
            else if (deviationPercent > 10) severity = "warning";

            if (!query.severity || query.severity === severity) {
              alerts.push({
                id: `sbti-${orgId}-nearterm`,
                type: "sbti",
                severity,
                message: `SBTi near-term target (${sbtialerts.nearTermYear}): Current emissions are ${Math.round(deviationPercent)}% above trajectory.`,
                targetType: "sbti-target",
                targetId: sbtialerts.id,
                createdAt: new Date(),
                resolved: false,
                data: {
                  currentDeviation: Math.round(deviation),
                  deviationPercent: Math.round(deviationPercent * 10) / 10,
                  targetMilestone: "near-term",
                },
              });
            }
          }
        }
      }
    }

    // Get benchmark alerts (when organization is underperforming)
    if (query.type === "benchmark" || query.type === "all") {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { industry: true, hqCountry: true },
      });

      if (org) {
        const peers = await prisma.organization.findMany({
          where: {
            id: { not: orgId },
            industry: org.industry,
            hqCountry: org.hqCountry,
          },
          select: { id: true },
        });

        if (peers.length > 0) {
          const orgEmissions = await prisma.dashboardAggregate.aggregate({
            where: { organizationId: orgId },
            _sum: { totalCo2e: true },
          });

          const peerEmissions = await prisma.dashboardAggregate.groupBy({
            by: ["organizationId"],
            where: {
              organizationId: { in: peers.map((p) => p.id) },
            },
            _sum: {
              totalCo2e: true,
            },
          });

          const peerValues = peerEmissions
            .map((p) => Number(p._sum.totalCo2e ?? 0))
            .sort((a, b) => a - b);
          const avgPeerEmissions =
            peerValues.reduce((a, b) => a + b, 0) / peerValues.length;
          const orgValue = Number(orgEmissions._sum.totalCo2e ?? 0);

          if (orgValue > avgPeerEmissions * 1.5) {
            const severity = orgValue > avgPeerEmissions * 2 ? "critical" : "warning";
            if (!query.severity || query.severity === severity) {
              alerts.push({
                id: `benchmark-${orgId}`,
                type: "benchmark",
                severity,
                message: `Your emissions are significantly higher than peer average. Consider accelerating reduction initiatives.`,
                targetType: "organization",
                targetId: orgId,
                createdAt: new Date(),
                resolved: false,
                data: {
                  orgEmissions: Math.round(orgValue),
                  peerAvg: Math.round(avgPeerEmissions),
                  peerCount: peers.length,
                },
              });
            }
          }
        }
      }
    }

    // Filter by resolved status if specified
    const filteredAlerts = query.resolved !== undefined
      ? alerts.filter((a) => a.resolved === query.resolved)
      : alerts;

    return NextResponse.json({
      alerts: filteredAlerts.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
      summary: {
        total: filteredAlerts.length,
        critical: filteredAlerts.filter((a) => a.severity === "critical").length,
        warning: filteredAlerts.filter((a) => a.severity === "warning").length,
        info: filteredAlerts.filter((a) => a.severity === "info").length,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * POST /api/orgs/[orgId]/alerts/acknowledge
 * Mark alerts as resolved.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    const body = acknowledgeSchema.parse(await request.json());

    // In a real implementation, this would persist alert acknowledgments
    // For now, we just return success for acknowledged alerts
    return NextResponse.json({
      success: true,
      acknowledgedCount: body.alertIds.length,
      resolved: body.resolved ?? false,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
