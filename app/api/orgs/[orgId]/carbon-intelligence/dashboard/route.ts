export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "sustainability_director", "sustainability_manager", "editor", "reviewer", "viewer", "auditor");

    const [
      alertSeverityCounts,
      unresolvedAlerts,
      recentSignals,
      signalTypeSummary,
      openAlertCount,
      integrationCount,
    ] = await Promise.all([
      // Alert breakdown by severity (unresolved only)
      prisma.impactAlert.groupBy({
        by: ["severity"],
        where: { organizationId: orgId, resolvedAt: null },
        _count: { _all: true },
      }),

      // 5 most recent unresolved alerts
      prisma.impactAlert.findMany({
        where: { organizationId: orgId, resolvedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true, alertType: true, severity: true,
          title: true, message: true, createdAt: true,
          resourceType: true, resourceId: true,
        },
      }),

      // 10 most recent signals
      prisma.carbonSignal.findMany({
        where: { organizationId: orgId },
        orderBy: { recordedAt: "desc" },
        take: 10,
        select: {
          id: true, signalType: true, source: true,
          region: true, value: true, unit: true, recordedAt: true,
        },
      }),

      // Signal type distribution over last 30 days
      prisma.carbonSignal.groupBy({
        by: ["signalType"],
        where: {
          organizationId: orgId,
          recordedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        _count: { _all: true },
        _avg: { value: true },
      }),

      // Total open alerts
      prisma.impactAlert.count({
        where: { organizationId: orgId, resolvedAt: null },
      }),

      // Active integrations
      prisma.externalApiCredential.count({
        where: { organizationId: orgId, isActive: true },
      }),
    ]);

    const severityMap = Object.fromEntries(
      alertSeverityCounts.map((r) => [r.severity, r._count._all]),
    );

    return NextResponse.json({
      openAlerts: openAlertCount,
      alertsBySeverity: severityMap,
      unresolvedAlerts,
      recentSignals,
      signalTypeSummary: signalTypeSummary.map((s) => ({
        signalType: s.signalType,
        count: s._count._all,
        avgValue: s._avg.value ? Number(s._avg.value) : null,
      })),
      activeIntegrations: integrationCount,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
