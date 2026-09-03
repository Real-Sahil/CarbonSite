export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { validateApiKey } from "@/lib/auth/api-key";
import { apiError, handleRouteError } from "@/lib/validation/api";

const ExportQuerySchema = z.object({
  snapshotId: z.string().min(1).describe("PublishedSnapshot ID to export"),
  format: z.enum(["json", "csv"]).default("json").describe("Export format"),
  includeLineItems: z.boolean().default(false).describe("Include individual calculation rows"),
  includeMetadata: z.boolean().default(true).describe("Include calculation metadata"),
});

/**
 * GET /api/orgs/[orgId]/reports/export?snapshotId=...&format=json&includeLineItems=false
 * Export dashboard aggregates or report data via API key authentication.
 *
 * Supports:
 * - JSON: Structured data suitable for downstream systems
 * - CSV: Tabular format for spreadsheets
 *
 * Query parameters:
 * - snapshotId: Required. PublishedSnapshot ID
 * - format: json|csv (default: json)
 * - includeLineItems: Include all EmissionCalculation rows (default: false)
 * - includeMetadata: Include calculation metadata (default: true)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;

    // Authenticate via API key
    let authenticatedOrgId: string;
    try {
      authenticatedOrgId = await validateApiKey(req.headers.get("authorization"));
    } catch (err) {
      return apiError("UNAUTHORIZED", "Invalid API key", 401);
    }

    // Ensure the key belongs to the requested org
    if (authenticatedOrgId !== orgId) {
      return apiError("FORBIDDEN", "API key does not belong to this organization", 403);
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const query = ExportQuerySchema.safeParse({
      snapshotId: searchParams.get("snapshotId"),
      format: searchParams.get("format") || "json",
      includeLineItems: searchParams.get("includeLineItems") === "true",
      includeMetadata: searchParams.get("includeMetadata") !== "false",
    });

    if (!query.success) {
      return apiError("VALIDATION_ERROR", "Invalid query parameters", 400, query.error.flatten());
    }

    const { snapshotId, format, includeLineItems, includeMetadata } = query.data;

    // Fetch the published snapshot
    const snapshot = await prisma.publishedSnapshot.findUnique({
      where: { id: snapshotId },
      select: {
        id: true,
        organizationId: true,
        reportingPeriodId: true,
        calculationRunId: true,
        version: true,
        publishedAt: true,
        reportingPeriod: {
          select: {
            id: true,
            label: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    if (!snapshot || snapshot.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Snapshot not found", 404);
    }

    // Fetch calculation run metadata if needed
    let calculationRun: { id: string; status: string; startedAt: Date | null; finishedAt: Date | null } | null = null;
    if (includeMetadata) {
      calculationRun = await prisma.calculationRun.findUnique({
        where: { id: snapshot.calculationRunId },
        select: {
          id: true,
          status: true,
          startedAt: true,
          finishedAt: true,
        },
      });
    }

    // Fetch dashboard aggregates for this snapshot
    const aggregates = await prisma.dashboardAggregate.findMany({
      where: {
        organizationId: orgId,
        snapshotId,
      },
      select: {
        id: true,
        scope: true,
        emissionCategoryId: true,
        facilityId: true,
        businessUnitId: true,
        scope2Method: true,
        totalCo2e: true,
        recordCount: true,
        intensityPerRevenueUnit: true,
        intensityPerFte: true,
        intensityPerM2: true,
        emissionCategory: {
          select: { code: true, name: true },
        },
        facility: {
          select: { name: true },
        },
        businessUnit: {
          select: { name: true },
        },
      },
    });

    type CalculationRow = {
      id: string;
      activityRecordId: string;
      totalCo2e: import("@prisma/client").Prisma.Decimal;
      formula: string | null;
      dataQualityScore: number | null;
      activityRecord: {
        amount: import("@prisma/client").Prisma.Decimal;
        unit: string;
        emissionCategory: { code: string; name: string } | null;
      } | null;
    };
    // Optionally fetch line-item calculations
    let calculations: CalculationRow[] = [];
    if (includeLineItems) {
      calculations = await prisma.emissionCalculation.findMany({
        where: {
          organizationId: orgId,
          calculationRunId: snapshot.calculationRunId,
        },
        select: {
          id: true,
          activityRecordId: true,
          totalCo2e: true,
          formula: true,
          dataQualityScore: true,
          activityRecord: {
            select: {
              amount: true,
              unit: true,
              emissionCategory: {
                select: { code: true, name: true },
              },
            },
          },
        },
        take: 10000, // Cap at 10k to prevent runaway exports
      });
    }

    // Prepare response data
    const data = {
      snapshot: {
        id: snapshot.id,
        version: snapshot.version,
        publishedAt: snapshot.publishedAt?.toISOString(),
        reportingPeriod: snapshot.reportingPeriod,
        calculationRun: includeMetadata ? calculationRun : undefined,
      },
      summary: {
        aggregateCount: aggregates.length,
        calculationCount: calculations.length,
        totalCo2e: aggregates.reduce((sum, a) => sum + (Number(a.totalCo2e) || 0), 0),
        byScope: aggregates.reduce(
          (acc: Record<number, number>, a) => {
            acc[a.scope] = (acc[a.scope] || 0) + (Number(a.totalCo2e) || 0);
            return acc;
          },
          {},
        ),
      },
      aggregates: aggregates.map((a) => ({
        id: a.id,
        scope: a.scope,
        category: a.emissionCategory?.code || "other",
        categoryName: a.emissionCategory?.name,
        facility: a.facility?.name,
        businessUnit: a.businessUnit?.name,
        scope2Method: a.scope2Method,
        co2e: Number(a.totalCo2e),
        recordCount: a.recordCount,
        intensity: {
          perRevenue: a.intensityPerRevenueUnit ? Number(a.intensityPerRevenueUnit) : null,
          perFte: a.intensityPerFte ? Number(a.intensityPerFte) : null,
          perM2: a.intensityPerM2 ? Number(a.intensityPerM2) : null,
        },
      })),
      ...(includeLineItems && { calculations }),
    };

    // Return in requested format
    if (format === "csv") {
      return exportAsCSV(data, aggregates);
    }

    return NextResponse.json(data);
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * Convert aggregates to CSV format.
 */
function exportAsCSV(
  data: Record<string, unknown>,
  aggregates: {
    scope: number;
    totalCo2e: { toString(): string } | null;
    recordCount: number;
    intensityPerRevenueUnit: { toString(): string } | null;
    intensityPerFte: { toString(): string } | null;
    intensityPerM2: { toString(): string } | null;
    emissionCategory: { code: string; name: string } | null;
    facility: { name: string } | null;
    businessUnit: { name: string } | null;
    scope2Method: string | null;
  }[],
): NextResponse {
  const headers = [
    "Scope",
    "Category",
    "Facility",
    "Business Unit",
    "Scope 2 Method",
    "CO2e (tonnes)",
    "Record Count",
    "Intensity per Revenue",
    "Intensity per FTE",
    "Intensity per m²",
  ];

  const rows = aggregates.map((a) => [
    a.scope,
    a.emissionCategory?.code || "other",
    a.facility?.name || "",
    a.businessUnit?.name || "",
    a.scope2Method || "",
    Number(a.totalCo2e).toFixed(4),
    a.recordCount,
    a.intensityPerRevenueUnit ? Number(a.intensityPerRevenueUnit).toFixed(8) : "",
    a.intensityPerFte ? Number(a.intensityPerFte).toFixed(4) : "",
    a.intensityPerM2 ? Number(a.intensityPerM2).toFixed(4) : "",
  ]);

  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report-export-${Date.now()}.csv"`,
    },
  });
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = value.toString();
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
