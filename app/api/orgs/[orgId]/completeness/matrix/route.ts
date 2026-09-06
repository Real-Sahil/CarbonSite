export const dynamic = "force-dynamic";

// Completeness matrix: facility x emission category coverage for one
// reporting period, graded RAG against the org's own configured
// requirements (DataCompletenessRequirement) — see lib/inventory/completeness.ts.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { gradeCells, summarizeCompleteness, type CompletenessCellInput } from "@/lib/inventory/completeness";

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const requestedPeriodId = req.nextUrl.searchParams.get("reportingPeriodId");

    const reportingPeriod = requestedPeriodId
      ? await prisma.reportingPeriod.findFirst({ where: { id: requestedPeriodId, organizationId: orgId } })
      : await prisma.reportingPeriod.findFirst({
          where: { organizationId: orgId },
          orderBy: { startDate: "desc" },
        });

    if (!reportingPeriod) {
      return apiError("NOT_FOUND", "No reporting period found for this organisation.", 404);
    }

    // This GHG-only matrix covers emission-category requirements; water/waste
    // completeness (metricType-based rows) has its own surface.
    const requirements = await prisma.dataCompletenessRequirement.findMany({
      where: { organizationId: orgId, emissionCategoryId: { not: null } },
      include: {
        facility: { select: { id: true, name: true } },
        emissionCategory: { select: { id: true, code: true, name: true, scope: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    if (requirements.length === 0) {
      return NextResponse.json({
        reportingPeriod: { id: reportingPeriod.id, label: reportingPeriod.label },
        facilities: [],
        categories: [],
        cells: [],
        summary: summarizeCompleteness([]),
        setupNeeded: true,
      });
    }

    const facilityIds = [...new Set(requirements.map((r) => r.facilityId))];
    const records = await prisma.activityRecord.groupBy({
      by: ["facilityId", "emissionCategoryId", "reviewStatus"],
      where: {
        organizationId: orgId,
        reportingPeriodId: reportingPeriod.id,
        facilityId: { in: facilityIds },
      },
      _count: { _all: true },
    });

    const countsByKey = new Map<string, { recordCount: number; approvedCount: number }>();
    for (const row of records) {
      if (!row.facilityId) continue;
      const key = `${row.facilityId}:${row.emissionCategoryId}`;
      const existing = countsByKey.get(key) ?? { recordCount: 0, approvedCount: 0 };
      existing.recordCount += row._count._all;
      if (row.reviewStatus === "approved") existing.approvedCount += row._count._all;
      countsByKey.set(key, existing);
    }

    const cellInputs: CompletenessCellInput[] = requirements.map((req) => {
      const counts = countsByKey.get(`${req.facilityId}:${req.emissionCategoryId}`) ?? {
        recordCount: 0,
        approvedCount: 0,
      };
      return {
        facilityId: req.facilityId,
        emissionCategoryId: req.emissionCategoryId!,
        required: req.required,
        ownerUserId: req.ownerUserId,
        recordCount: counts.recordCount,
        approvedCount: counts.approvedCount,
      };
    });

    const cells = gradeCells(cellInputs).map((cell, i) => ({
      ...cell,
      requirementId: requirements[i].id,
      facility: requirements[i].facility,
      emissionCategory: requirements[i].emissionCategory,
      owner: requirements[i].owner,
      notes: requirements[i].notes,
    }));

    const facilities = [...new Map(requirements.map((r) => [r.facility.id, r.facility])).values()];
    const categories = [
      ...new Map(requirements.map((r) => [r.emissionCategory!.id, r.emissionCategory!])).values(),
    ].sort((a, b) => a.scope - b.scope || a.name.localeCompare(b.name));

    return NextResponse.json({
      reportingPeriod: { id: reportingPeriod.id, label: reportingPeriod.label },
      facilities,
      categories,
      cells,
      summary: summarizeCompleteness(cells),
      setupNeeded: false,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
