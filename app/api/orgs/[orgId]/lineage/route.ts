export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { z } from "zod";

const lineageQuerySchema = z.object({
  snapshotId: z.string().optional(),
  reportingPeriodId: z.string().optional(),
  categoryId: z.string().optional(),
  facilityId: z.string().optional(),
});

type LineageQuery = z.infer<typeof lineageQuerySchema>;

interface LineageActivityRecord {
  id: string;
  amount: number;
  unit: string;
  sourceDescription: string | null;
  createdAt: Date;
  importBatch?: {
    id: string;
    sourceFilename: string;
    createdAt: Date;
    createdBy?: { name: string | null; email: string } | null;
  } | null;
  fieldSubmissionId?: string | null;
  fieldSubmissionDocumentType?: string | null;
  fieldSubmissionCreatedAt?: Date | null;
  submittedByName?: string | null;
  submittedByEmail?: string;
  evidence: Array<{ id: string; filename: string; mimeType: string }>;
}

interface LineageCalculation {
  id: string;
  totalCo2e: number;
  formula: string;
  factorValue: number | null;
  normalizedAmount: number;
  normalizedUnit: string;
  selectionReason: string | null;
  dataQualityScore: number;
  activityRecord: LineageActivityRecord;
}

interface LineageAggregate {
  id: string;
  scope: number;
  totalCo2e: number;
  recordCount: number;
  emissionCategory?: { id: string; name: string; code: string } | null;
  facility?: { id: string; name: string } | null;
  calculations: LineageCalculation[];
}

async function fetchLineageData(
  orgId: string,
  query: LineageQuery,
): Promise<LineageAggregate[]> {
  interface WhereClause {
    organizationId: string;
    snapshotId?: string;
    reportingPeriodId?: string;
    emissionCategoryId?: string;
    facilityId?: string;
  }
  const whereClause: WhereClause = {
    organizationId: orgId,
  };

  if (query.snapshotId) {
    whereClause.snapshotId = query.snapshotId;
  } else if (query.reportingPeriodId) {
    whereClause.reportingPeriodId = query.reportingPeriodId;
  } else {
    throw new Error("Either snapshotId or reportingPeriodId is required");
  }

  if (query.categoryId) {
    whereClause.emissionCategoryId = query.categoryId;
  }

  if (query.facilityId) {
    whereClause.facilityId = query.facilityId;
  }

  const aggregates = await prisma.dashboardAggregate.findMany({
    where: whereClause,
    include: {
      emissionCategory: { select: { id: true, name: true, code: true } },
      facility: { select: { id: true, name: true } },
    },
  });

  if (aggregates.length === 0) {
    return [];
  }

  // Get calculation run IDs from snapshots linked to these aggregates
  const calculationRunIds = new Set<string>();
  for (const agg of aggregates) {
    if (agg.snapshotId) {
      const snapshot = await prisma.publishedSnapshot.findUnique({
        where: { id: agg.snapshotId },
        select: { calculationRunId: true },
      });
      if (snapshot) {
        calculationRunIds.add(snapshot.calculationRunId);
      }
    } else {
      // If no snapshot, find latest calculation run for the period
      const calcRun = await prisma.calculationRun.findFirst({
        where: {
          organizationId: orgId,
          reportingPeriodId: agg.reportingPeriodId,
          status: "succeeded",
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (calcRun) {
        calculationRunIds.add(calcRun.id);
      }
    }
  }

  // Fetch calculations for these runs with full lineage data
  const calculations = await prisma.emissionCalculation.findMany({
    where: {
      organizationId: orgId,
      calculationRunId: {
        in: Array.from(calculationRunIds),
      },
    },
    include: {
      activityRecord: {
        include: {
          importBatch: {
            select: {
              id: true,
              sourceFilename: true,
              createdAt: true,
              createdBy: {
                select: { name: true, email: true },
              },
            },
          },
          evidence: {
            include: {
              evidenceFile: {
                select: { id: true, filename: true, mimeType: true },
              },
            },
          },
        },
      },
    },
  });

  // Fetch field submissions for activity records that have them
  const fieldSubmissionIds = new Set(
    calculations
      .map((c) => c.activityRecord.fieldSubmissionId)
      .filter((id): id is string => id !== null && id !== undefined),
  );

  let fieldSubmissionMap = new Map();
  if (fieldSubmissionIds.size > 0) {
    const fieldSubmissions = await prisma.fieldSubmission.findMany({
      where: {
        organizationId: orgId,
        id: {
          in: Array.from(fieldSubmissionIds),
        },
      },
      include: {
        submittedBy: { select: { name: true, email: true } },
        files: {
          include: {
            evidenceFile: { select: { id: true, filename: true } },
          },
        },
      },
    });
    fieldSubmissionMap = new Map(
      fieldSubmissions.map((fs) => [
        fs.id,
        {
          documentType: fs.documentType,
          createdAt: fs.createdAt,
          submittedByName: fs.submittedBy.name,
          submittedByEmail: fs.submittedBy.email,
          files: fs.files.map((f) => ({
            id: f.evidenceFile.id,
            filename: f.evidenceFile.filename,
          })),
        },
      ]),
    );
  }

  // Group calculations by aggregate
  const aggMap = new Map<string, LineageAggregate>();

  for (const agg of aggregates) {
    const lineageCalcs = calculations
      .filter((calc) => {
        const rec = calc.activityRecord;
        let matches = true;
        if (query.categoryId) {
          matches = rec.emissionCategoryId === query.categoryId;
        }
        if (query.facilityId) {
          matches = matches && rec.facilityId === query.facilityId;
        }
        return matches;
      })
      .map((calc) => {
        const fsData =
          calc.activityRecord.fieldSubmissionId &&
          fieldSubmissionMap.get(calc.activityRecord.fieldSubmissionId);
        return {
          id: calc.id,
          totalCo2e: Number(calc.totalCo2e),
          formula: calc.formula,
          factorValue: calc.factorValue ? Number(calc.factorValue) : null,
          normalizedAmount: Number(calc.normalizedAmount),
          normalizedUnit: calc.normalizedUnit,
          selectionReason: calc.selectionReason,
          dataQualityScore: calc.dataQualityScore,
          activityRecord: {
            id: calc.activityRecord.id,
            amount: Number(calc.activityRecord.amount),
            unit: calc.activityRecord.unit,
            sourceDescription: calc.activityRecord.sourceDescription,
            createdAt: calc.activityRecord.createdAt,
            importBatch: calc.activityRecord.importBatch,
            fieldSubmissionId: calc.activityRecord.fieldSubmissionId,
            fieldSubmissionDocumentType: fsData?.documentType || undefined,
            fieldSubmissionCreatedAt: fsData?.createdAt || undefined,
            submittedByName: fsData?.submittedByName || undefined,
            submittedByEmail: fsData?.submittedByEmail || undefined,
            evidence: calc.activityRecord.evidence.map((e) => ({
              id: e.evidenceFile.id,
              filename: e.evidenceFile.filename,
              mimeType: e.evidenceFile.mimeType,
            })),
          } as LineageActivityRecord,
        };
      });

    if (lineageCalcs.length > 0) {
      aggMap.set(agg.id, {
        id: agg.id,
        scope: agg.scope,
        totalCo2e: Number(agg.totalCo2e),
        recordCount: agg.recordCount,
        emissionCategory: agg.emissionCategory,
        facility: agg.facility,
        calculations: lineageCalcs,
      });
    }
  }

  return Array.from(aggMap.values());
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(
      orgId,
      "admin",
      "editor",
      "reviewer",
      "viewer",
      "auditor",
    );

    const searchParams = req.nextUrl.searchParams;
    const query = lineageQuerySchema.parse({
      snapshotId: searchParams.get("snapshotId") || undefined,
      reportingPeriodId: searchParams.get("reportingPeriodId") || undefined,
      categoryId: searchParams.get("categoryId") || undefined,
      facilityId: searchParams.get("facilityId") || undefined,
    });

    if (!query.snapshotId && !query.reportingPeriodId) {
      return apiError(
        "MISSING_PARAMETER",
        "Either snapshotId or reportingPeriodId is required",
        400,
      );
    }

    const lineageData = await fetchLineageData(orgId, query);

    return NextResponse.json({
      aggregates: lineageData,
      count: lineageData.length,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
