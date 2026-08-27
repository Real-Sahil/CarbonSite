export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "auditor", "reviewer");

    const recordId = req.nextUrl.searchParams.get("recordId");

    if (!recordId) {
      return apiError("INVALID_PARAMS", "recordId parameter is required", 400);
    }

    // Fetch the activity record to verify org ownership
    const activityRecord = await prisma.activityRecord.findFirst({
      where: { id: recordId, organizationId: orgId },
      include: {
        emissionCategory: { select: { id: true, name: true, scope: true } },
        facility: { select: { id: true, name: true } },
        importBatch: { select: { id: true, createdAt: true } },
      },
    });

    if (!activityRecord) {
      return apiError("NOT_FOUND", "Activity record not found", 404);
    }

    // Build lineage nodes showing the record's journey
    const lineageNodes = await buildLineageNodes(orgId, recordId, activityRecord);

    // Fetch audit trail for this record
    const auditTrail = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        resourceId: recordId,
      },
      include: {
        actor: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const timeline = auditTrail.map((log) => ({
      timestamp: log.createdAt.toISOString(),
      action: humanizeAction(log.action),
      actor: log.actor?.email || "system",
      resourceId: log.resourceId,
    }));

    return NextResponse.json({
      recordId,
      nodes: lineageNodes,
      timeline,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

interface ActivityRecordWithCategory {
  id: string;
  createdAt: Date;
  amount: { toString(): string };
  unit: string;
  sourceDescription: string | null;
  activityDate: Date | null;
  emissionCategory: { id: string; name: string; scope: number };
  facility: { id: string; name: string } | null;
  importBatch: { id: string; createdAt: Date } | null;
}

async function buildLineageNodes(
  orgId: string,
  recordId: string,
  activityRecord: ActivityRecordWithCategory
): Promise<Array<{
  type: 'activity_record' | 'factor_selection' | 'calculation' | 'snapshot' | 'report';
  id: string;
  label: string;
  timestamp?: Date;
  actor?: string;
  status: 'complete' | 'pending' | 'error';
  details?: Record<string, string | number | boolean>;
}>> {
  const nodes = [];

  // 1. Activity Record node
  nodes.push({
    type: "activity_record" as const,
    id: `activity-${recordId}`,
    label: "Activity Record Captured",
    timestamp: activityRecord.createdAt,
    actor: activityRecord.sourceDescription || "imported",
    status: "complete" as const,
    details: {
      "Amount": `${activityRecord.amount.toString()} ${activityRecord.unit}`,
      Category: activityRecord.emissionCategory.name,
      Scope: String(activityRecord.emissionCategory.scope),
      "Activity Date": activityRecord.activityDate?.toISOString() || "N/A",
      ...(activityRecord.facility && { Facility: activityRecord.facility.name }),
      ...(activityRecord.importBatch && {
        "Import Batch": activityRecord.importBatch.id,
      }),
    },
  });

  // 2. Factor Selection node
  const calculations = await prisma.emissionCalculation.findMany({
    where: { activityRecordId: recordId },
    take: 1,
  });

  if (calculations.length > 0) {
    const calc = calculations[0];
    nodes.push({
      type: "factor_selection" as const,
      id: `factor-${recordId}`,
      label: "Emission Factor Selected",
      timestamp: calc.createdAt,
      actor: "automatic",
      status: "complete" as const,
      details: {
        "Emission Factor": `${calc.emissionFactorId} kg CO2e per unit`,
        "Scope Coverage": "emission_category",
      },
    });

    // 3. Calculation node
    nodes.push({
      type: "calculation" as const,
      id: `calculation-${calc.id}`,
      label: "Emissions Calculated",
      timestamp: calc.createdAt,
      actor: "automatic",
      status: "complete" as const,
      details: {
        "CO2e (kg)": String(calc.totalCo2e),
        "Data Quality Score": `${calc.dataQualityScore || 0}%`,
        "Calculation Run": calc.calculationRunId,
      },
    });

    // 4. Snapshot node
    const snapshot = await prisma.publishedSnapshot.findFirst({
      where: {
        calculationRunId: calc.calculationRunId,
      },
      include: {
        reportingPeriod: { select: { startDate: true, endDate: true } },
      },
    });

    if (snapshot) {
      nodes.push({
        type: "snapshot" as const,
        id: `snapshot-${snapshot.id}`,
        label: "Snapshot Published",
        timestamp: snapshot.publishedAt,
        actor: snapshot.publishedByUserId || "system",
        status: "complete" as const,
        details: {
          "Period Start": snapshot.reportingPeriod.startDate.toISOString().split("T")[0],
          "Period End": snapshot.reportingPeriod.endDate.toISOString().split("T")[0],
          "Version": String(snapshot.version),
        },
      });

      // 5. Report node
      const report = await prisma.report.findFirst({
        where: {
          reportingPeriodId: snapshot.reportingPeriodId,
        },
      });

      if (report) {
        const reportStatus = report.status === "ready" ? "complete" : "pending";
        nodes.push({
          type: "report" as const,
          id: `report-${report.id}`,
          label: "Report Generated",
          timestamp: report.createdAt,
          actor: report.createdByUserId || "system",
          status: reportStatus as "complete" | "pending",
          details: {
            "Report Type": report.type,
            "Report Status": report.status,
            "Created At": report.createdAt.toISOString(),
            "Available for Download": report.status === "ready" ? "Yes" : "No",
          },
        });
      }
    }
  }

  return nodes;
}

function humanizeAction(action: string): string {
  const actionMap: Record<string, string> = {
    "record.created": "Record Created",
    "record.updated": "Record Updated",
    "record.approved": "Record Approved",
    "record.rejected": "Record Rejected",
    "calculation.completed": "Calculation Completed",
    "snapshot.published": "Snapshot Published",
    "report.generated": "Report Generated",
    "field_submission.reviewed": "Submission Reviewed",
    "factor.selected": "Factor Selected",
  };

  return actionMap[action] || action;
}
