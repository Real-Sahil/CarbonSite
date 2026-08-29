import { Decimal } from "@prisma/client/runtime/library";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { generateComplianceReportWorkbook } from "@/lib/export/excel";
import { z } from "zod";

const querySchema = z.object({
  periodId: z.string().optional(),
  type: z.enum(["full", "records-only", "summary"]).default("full"),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    const query = querySchema.parse({
      periodId: request.nextUrl.searchParams.get("periodId") ?? undefined,
      type: request.nextUrl.searchParams.get("type") ?? "full",
    });

    // Get organization details
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });

    if (!org) {
      return apiError("ORG_NOT_FOUND", "Organization not found", 404);
    }

    // Get reporting period (use latest if not specified)
    let period;
    if (query.periodId) {
      period = await prisma.reportingPeriod.findUnique({
        where: { id: query.periodId },
      });
      if (!period || period.organizationId !== orgId) {
        return apiError("PERIOD_NOT_FOUND", "Reporting period not found", 404);
      }
    } else {
      period = await prisma.reportingPeriod.findFirst({
        where: { organizationId: orgId },
        orderBy: { endDate: "desc" },
      });
      if (!period) {
        return apiError(
          "NO_PERIOD",
          "No reporting period found. Create one first.",
          404
        );
      }
    }

    // Get activity records
    const activityRecords = await prisma.activityRecord.findMany({
      where: {
        organizationId: orgId,
        reportingPeriodId: period.id,
      },
      include: {
        emissionCategory: true,
        facility: true,
        businessUnit: true,
        importBatch: true,
        calculations: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Format records with CO2e values
    const formattedRecords = activityRecords.map((record) => ({
      id: record.id,
      createdAt: record.createdAt,
      category: record.emissionCategory,
      sourceDescription: record.sourceDescription,
      amount: record.amount,
      unit: record.unit,
      reviewStatus: record.reviewStatus,
      evidenceStatus: record.evidenceStatus,
      facility: record.facility,
      businessUnit: record.businessUnit,
      importBatch: record.importBatch,
      totalCo2e:
        record.calculations.length > 0
          ? Math.round(
              parseFloat(record.calculations[0].totalCo2e.toString())
            )
          : 0,
    }));

    // Get dashboard aggregates
    const dashboardData = await prisma.dashboardAggregate.findMany({
      where: {
        organizationId: orgId,
        reportingPeriodId: period.id,
      },
      include: {
        reportingPeriod: true,
      },
    });

    // Calculate category breakdown
    const calculationRecords = await prisma.emissionCalculation.findMany({
      where: {
        activityRecord: {
          organizationId: orgId,
          reportingPeriodId: period.id,
        },
      },
      include: {
        activityRecord: true,
      },
    });

    // Group by category in application code
    const categoryMap = new Map<string, { totalCo2e: Decimal; count: number }>();
    for (const calc of calculationRecords) {
      const catId = calc.activityRecord.emissionCategoryId;
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          totalCo2e: new Decimal(0),
          count: 0,
        });
      }
      const current = categoryMap.get(catId)!;
      current.totalCo2e = current.totalCo2e.plus(calc.totalCo2e ?? 0);
      current.count += 1;
    }

    const categoryBreakdown = Array.from(categoryMap.entries()).map(
      ([emissionCategoryId, data]) => ({
        emissionCategoryId,
        _sum: { totalCo2e: data.totalCo2e },
        _count: data.count,
      })
    );

    // Map category IDs to names
    const categoryData = await Promise.all(
      categoryBreakdown.map(async (cat) => {
        const category = await prisma.emissionCategory.findUnique({
          where: { id: cat.emissionCategoryId },
        });
        return {
          category,
          totalCo2e: Number(cat._sum.totalCo2e),
          recordCount: cat._count,
        };
      })
    );

    // Calculate total emissions
    const totalEmissions = categoryBreakdown.reduce(
      (sum, cat) => sum + Number(cat._sum.totalCo2e ?? 0),
      0
    );

    // Generate Excel file based on type
    let buffer: Buffer;

    if (query.type === "full") {
      buffer = await generateComplianceReportWorkbook(
        org.name,
        period.label,
        formattedRecords,
        dashboardData,
        categoryData,
        totalEmissions
      );
    } else if (query.type === "records-only") {
      const { generateExcelWorkbook } = await import("@/lib/export/excel");
      const { formatActivityRecordsForExport } = await import(
        "@/lib/export/excel"
      );

      buffer = generateExcelWorkbook(
        [
          {
            name: "Activity Records",
            data: formatActivityRecordsForExport(formattedRecords),
            autoWidth: true,
            headerStyle: true,
            freezePane: { row: 1, col: 0 },
          },
        ],
        `${org.name}_records`
      );
    } else {
      const { generateExcelWorkbook } = await import("@/lib/export/excel");
      const { formatCategoryBreakdownForExport } = await import(
        "@/lib/export/excel"
      );

      buffer = generateExcelWorkbook(
        [
          {
            name: "Summary",
            data: [
              {
                "Organization": org.name,
                "Reporting Period": period.label,
                "Total Emissions (kg CO₂e)": Math.round(totalEmissions),
                "Record Count": formattedRecords.length,
                "Report Generated": new Date().toLocaleString(),
              },
            ],
            headerStyle: true,
          },
          {
            name: "By Category",
            data: formatCategoryBreakdownForExport(categoryData, totalEmissions),
            autoWidth: true,
            headerStyle: true,
            freezePane: { row: 1, col: 0 },
          },
        ],
        `${org.name}_summary`
      );
    }

    // Calculate checksum
    const crypto = await import("crypto");
    const checksum = crypto
      .createHash("sha256")
      .update(buffer)
      .digest("hex");

    // Return Excel file
    const fileName = `${org.name}_${period.label}_${new Date().getTime()}.xlsx`;

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-Checksum": checksum,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
