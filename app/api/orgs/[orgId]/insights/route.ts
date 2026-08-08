import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

// GET /api/orgs/[orgId]/insights
// Returns rule-based carbon insights derived from org data.
// No external LLM API required — insights computed deterministically.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "viewer");

    const [latestSnapshot, offsets, targets, recentRecords] = await Promise.all([
      prisma.publishedSnapshot.findFirst({
        where: { organizationId: orgId },
        orderBy: { publishedAt: "desc" },
        include: {
          aggregates: { orderBy: { scope: "asc" } },
          reportingPeriod: { select: { label: true, startDate: true, endDate: true } },
        },
      }),
      prisma.carbonOffset.findMany({
        where: { organizationId: orgId },
        select: { quantityTonnes: true },
      }),
      prisma.reductionTarget.findMany({
        where: { organizationId: orgId },
        select: { reductionAmount: true, targetType: true },
        take: 1,
      }),
      prisma.activityRecord.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
        },
      }),
    ]);

    const insights: Array<{ type: string; title: string; body: string; severity: "info" | "warning" | "success" }> = [];

    if (!latestSnapshot) {
      insights.push({
        type: "no_data",
        title: "No published snapshot yet",
        body: "Run your first calculation and publish a snapshot to see carbon insights.",
        severity: "info",
      });
    } else {
      const totalTco2e = latestSnapshot.aggregates.reduce((s, a) => s + Number(a.totalCo2e), 0);
      const totalOffsetTonnes = offsets.reduce((s, o) => s + Number(o.quantityTonnes), 0);
      const netPosition = totalTco2e - totalOffsetTonnes;
      const periodLabel = latestSnapshot.reportingPeriod?.label ?? "current period";

      insights.push({
        type: "net_position",
        title: `Net position: ${netPosition.toFixed(1)} tCO2e`,
        body: `Total emissions ${totalTco2e.toFixed(1)} tCO2e minus ${totalOffsetTonnes.toFixed(1)} tCO2e in purchased offsets for ${periodLabel}.`,
        severity: netPosition <= 0 ? "success" : "info",
      });

      const scope1 = latestSnapshot.aggregates.find((a) => a.scope === 1);
      const scope2 = latestSnapshot.aggregates.find((a) => a.scope === 2);
      if (scope1 && scope2 && totalTco2e > 0) {
        const s1pct = ((Number(scope1.totalCo2e) / totalTco2e) * 100).toFixed(0);
        const s2pct = ((Number(scope2.totalCo2e) / totalTco2e) * 100).toFixed(0);
        insights.push({
          type: "scope_split",
          title: `Scope 1: ${s1pct}% | Scope 2: ${s2pct}%`,
          body: `Scope 1 direct emissions are ${Number(scope1.totalCo2e).toFixed(1)} tCO2e. Scope 2 electricity is ${Number(scope2.totalCo2e).toFixed(1)} tCO2e. Consider renewable energy tariffs to reduce Scope 2.`,
          severity: "info",
        });
      }

      if (targets.length > 0 && targets[0] && targets[0].targetType === "absolute") {
        const target = targets[0];
        const targetTco2e = Number(target.reductionAmount);
        const gap = totalTco2e - targetTco2e;
        insights.push({
          type: "target_gap",
          title: gap > 0 ? `${gap.toFixed(1)} tCO2e above target` : "On track with reduction target",
          body: gap > 0
            ? `Emissions exceed your absolute target by ${gap.toFixed(1)} tCO2e. Review your reduction initiatives or purchase additional offsets.`
            : `Emissions are within your target. Keep monitoring to maintain performance.`,
          severity: gap > 0 ? "warning" : "success",
        });
      }

      if (totalTco2e > 0) {
        const coveragePct = Math.min(100, (totalOffsetTonnes / totalTco2e) * 100);
        if (coveragePct < 10) {
          insights.push({
            type: "offset_coverage",
            title: "Low offset coverage",
            body: `Offsets cover only ${coveragePct.toFixed(0)}% of emissions. Consider purchasing verified carbon credits to improve your net position.`,
            severity: "warning",
          });
        }
      }
    }

    if (recentRecords === 0) {
      insights.push({
        type: "data_activity",
        title: "No new records in 30 days",
        body: "No activity records were added in the last 30 days. Ensure your team is capturing evidence regularly.",
        severity: "warning",
      });
    }

    return NextResponse.json({ insights });
  } catch (err) {
    return handleRouteError(err);
  }
}
