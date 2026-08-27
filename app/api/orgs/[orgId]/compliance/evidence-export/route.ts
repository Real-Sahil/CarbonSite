export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "auditor");

    const query = req.nextUrl.searchParams;
    const snapshotId = query.get("snapshotId");
    const startDate = query.get("startDate") ? new Date(query.get("startDate")!) : undefined;
    const endDate = query.get("endDate") ? new Date(query.get("endDate")!) : undefined;
    const framework = query.get("framework") || "all"; // 'csrd', 'sbti', 'cdp', 'all'

    if (!snapshotId && !startDate) {
      return apiError(
        "INVALID_PARAMS",
        "Either snapshotId or startDate must be provided",
        400
      );
    }

    // Fetch audit logs for the compliance framework
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        ...(startDate && { createdAt: { gte: startDate } }),
        ...(endDate && { createdAt: { lte: endDate } }),
        // Filter by actions that are compliance-relevant
        action: {
          in: [
            "record.created",
            "calculation.completed",
            "snapshot.published",
            "report.generated",
            "field_submission.reviewed",
          ],
        },
      },
      include: {
        actor: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Fetch related emissions calculations and records
    const calculationIds = auditLogs
      .filter((log) => log.resourceType === "emission_calculation")
      .map((log) => log.resourceId);

    const calculations = await prisma.emissionCalculation.findMany({
      where: {
        id: { in: calculationIds },
      },
      include: {
        activityRecord: {
          include: {
            emissionCategory: { select: { id: true, name: true, scope: true } },
          },
        },
      },
    });

    // Build compliance evidence document
    const evidence = generateComplianceEvidence({
      orgId,
      snapshotId: snapshotId || undefined,
      auditLogs,
      calculations,
      framework,
    });

    // Return as JSON for now; can be extended to PDF/CSV
    return NextResponse.json(evidence);
  } catch (err) {
    return handleRouteError(err);
  }
}

interface ComplianceEvidence {
  reportId: string;
  organizationId: string;
  framework: string;
  generatedAt: string;
  auditTrail: Array<{
    timestamp: string;
    actor: { email: string; name: string | null };
    action: string;
    resourceType: string;
    resourceId: string;
  }>;
  calculations: Array<{
    id: string;
    activityRecordId: string;
    activity: {
      date: string;
      amount: number;
      unit: string;
      category: string;
      scope: string;
    };
    emissionFactor: {
      value: number;
      source: string;
      version: string;
    };
    result: {
      co2e_kg: number;
      formula: string;
      dataQualityScore: number;
    };
  }>;
  summary: {
    totalRecords: number;
    totalAuditEvents: number;
    dateRange: {
      start: string;
      end: string;
    };
    dataIntegrity: {
      hashChainValid: boolean;
      allRecordsLinked: boolean;
      certificateAttached: boolean;
    };
  };
}

interface AuditLogWithActor {
  id: string;
  createdAt: Date;
  action: string;
  resourceType: string;
  resourceId: string;
  actor: { email: string; name: string | null } | null;
}

interface CalculationData {
  id: string;
  activityRecordId: string;
  createdAt: Date;
  emissionFactorId: string;
  totalCo2e: { toString(): string };
  dataQualityScore: { toString(): string } | null;
  activityRecord: {
    id: string;
    amount: { toString(): string };
    unit: string;
    activityDate: Date | null;
    emissionCategory: { id: string; name: string; scope: string };
  };
}

function generateComplianceEvidence(params: {
  orgId: string;
  snapshotId?: string;
  auditLogs: AuditLogWithActor[];
  calculations: CalculationData[];
  framework: string;
}): ComplianceEvidence {
  const { orgId, auditLogs, calculations, framework } = params;

  return {
    reportId: `compliance-${orgId}-${Date.now()}`,
    organizationId: orgId,
    framework: framework === "all" ? "multi-framework" : framework,
    generatedAt: new Date().toISOString(),
    auditTrail: auditLogs.map((log) => ({
      timestamp: log.createdAt.toISOString(),
      actor: {
        email: log.actor?.email || "system",
        name: log.actor?.name || null,
      },
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
    })),
    calculations: calculations.map((calc) => ({
      id: calc.id,
      activityRecordId: calc.activityRecordId,
      activity: {
        date: calc.activityRecord.activityDate?.toISOString() || new Date().toISOString(),
        amount: parseFloat(calc.activityRecord.amount.toString()),
        unit: calc.activityRecord.unit,
        category: calc.activityRecord.emissionCategory.name,
        scope: calc.activityRecord.emissionCategory.scope,
      },
      emissionFactor: {
        value: parseFloat(calc.emissionFactor.toString()),
        source: "library",
        version: "2025.1",
      },
      result: {
        co2e_kg: parseFloat(calc.totalCo2e.toString()),
        formula: "standard",
        dataQualityScore: parseFloat(calc.dataQualityScore?.toString() || "0"),
      },
    })),
    summary: {
      totalRecords: calculations.length,
      totalAuditEvents: auditLogs.length,
      dateRange: {
        start: auditLogs.length > 0 ? auditLogs[0].createdAt.toISOString() : new Date().toISOString(),
        end:
          auditLogs.length > 0
            ? auditLogs[auditLogs.length - 1].createdAt.toISOString()
            : new Date().toISOString(),
      },
      dataIntegrity: {
        hashChainValid: validateHashChain(auditLogs),
        allRecordsLinked: calculations.every((c) => c.activityRecordId),
        certificateAttached: false, // Can be extended with digital signing
      },
    },
  };
}

function validateHashChain(auditLogs: AuditLogWithActor[]): boolean {
  for (let i = 1; i < auditLogs.length; i++) {
    const current = auditLogs[i];
    const previous = auditLogs[i - 1];

    if (current.previousHash !== previous.hash) {
      return false;
    }
  }
  return true;
}
