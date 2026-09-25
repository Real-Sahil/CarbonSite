export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { CATEGORY_BREAKDOWN_DIMENSIONS } from "@/lib/calculation/aggregate-filters";
import { HEADLINE_ONLY } from "@/lib/project-carbon/sql";
import { evidenceTier, summariseTiers, tierReasons, type TierInput } from "@/lib/data-quality/evidence-tier";

const querySchema = z.object({
  snapshotId: z.string().min(1).optional(),
  reportingPeriodId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  facilityId: z.string().min(1).optional(),
  cursor: z.string().min(1).optional(),
});

const PAGE = 50;

/**
 * Figure to source for one published snapshot: the headline split by evidence
 * tier, the category totals the dashboard and reports show, and, for a chosen
 * category, the calculations behind it (largest first) with the record, the
 * factor, the formula and the evidence files. Everything is scoped to the org
 * and to the snapshot's own calculation run.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    const q = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));

    const snapshot = await prisma.publishedSnapshot.findFirst({
      where: {
        organizationId: orgId,
        ...(q.snapshotId ? { id: q.snapshotId } : {}),
        ...(q.reportingPeriodId ? { reportingPeriodId: q.reportingPeriodId } : {}),
      },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        version: true,
        publishedAt: true,
        calculationRunId: true,
        reportingPeriod: { select: { id: true, label: true } },
        calculationRun: { select: { factorLibrary: { select: { name: true, version: true } }, methodologyVersion: { select: { name: true } } } },
      },
    });
    if (!snapshot) {
      if (q.snapshotId) return apiError("NOT_FOUND", "Snapshot not found.", 404);
      return NextResponse.json({ snapshot: null, tiers: null, categories: [], records: null });
    }
    const runId = snapshot.calculationRunId;

    const [tierRows, categoryRows] = await Promise.all([
      prisma.$queryRaw<Array<{ data_origin: TierInput["dataOrigin"]; evidence_status: string; review_status: string; kg: number; n: number }>>`
        SELECT ar.data_origin, ar.evidence_status::text AS evidence_status, ar.review_status::text AS review_status,
               COALESCE(SUM(ec.total_co2e), 0)::float AS kg, COUNT(*)::int AS n
        FROM emission_calculations ec
        JOIN activity_records ar ON ar.id = ec.activity_record_id
        JOIN emission_categories cat ON cat.id = ar.emission_category_id
        WHERE ec.organization_id = ${orgId}
          AND ec.calculation_run_id = ${runId}
          AND ${HEADLINE_ONLY}
        GROUP BY 1, 2, 3
      `,
      prisma.dashboardAggregate.findMany({
        where: { organizationId: orgId, snapshotId: snapshot.id, ...CATEGORY_BREAKDOWN_DIMENSIONS },
        select: {
          scope: true,
          totalCo2e: true,
          recordCount: true,
          emissionCategory: { select: { id: true, code: true, name: true } },
        },
        orderBy: { totalCo2e: "desc" },
      }),
    ]);

    const tiers = summariseTiers(
      tierRows.map((r) => ({ dataOrigin: r.data_origin, evidenceStatus: r.evidence_status, reviewStatus: r.review_status, totalCo2e: r.kg, count: r.n })),
    );

    let records = null;
    if (q.categoryId) {
      const rows = await prisma.emissionCalculation.findMany({
        where: {
          organizationId: orgId,
          calculationRunId: runId,
          activityRecord: { emissionCategoryId: q.categoryId, ...(q.facilityId ? { facilityId: q.facilityId } : {}) },
        },
        orderBy: [{ totalCo2e: "desc" }, { id: "asc" }],
        take: PAGE + 1,
        ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          totalCo2e: true,
          formula: true,
          factorValue: true,
          factorLibraryVersion: true,
          selectionReason: true,
          normalizedAmount: true,
          normalizedUnit: true,
          warnings: true,
          organizationEmissionFactorId: true,
          activityRecord: {
            select: {
              id: true,
              amount: true,
              unit: true,
              activityDate: true,
              sourceDescription: true,
              supplierName: true,
              dataOrigin: true,
              evidenceStatus: true,
              reviewStatus: true,
              fieldSubmissionId: true,
              facility: { select: { name: true } },
              importBatch: { select: { id: true, sourceFilename: true } },
              evidence: { select: { evidenceFile: { select: { id: true, filename: true, mimeType: true } } } },
            },
          },
        },
      });
      const more = rows.length > PAGE;
      const page = more ? rows.slice(0, PAGE) : rows;
      records = {
        categoryId: q.categoryId,
        nextCursor: more ? page[page.length - 1].id : null,
        items: page.map((c) => {
          const r = c.activityRecord;
          const tierInput = { dataOrigin: r.dataOrigin, evidenceStatus: r.evidenceStatus, reviewStatus: r.reviewStatus };
          return {
            calculationId: c.id,
            kgCo2e: Number(c.totalCo2e),
            formula: c.formula,
            factorValue: c.factorValue != null ? Number(c.factorValue) : null,
            factorSource: c.organizationEmissionFactorId ? "Organisation factor" : c.factorLibraryVersion,
            selectionReason: c.selectionReason,
            normalized: `${Number(c.normalizedAmount).toLocaleString("en-GB", { maximumFractionDigits: 3 })} ${c.normalizedUnit}`,
            warnings: Array.isArray(c.warnings) ? (c.warnings as Prisma.JsonArray).map(String) : [],
            record: {
              id: r.id,
              amount: Number(r.amount),
              unit: r.unit,
              activityDate: r.activityDate,
              description: r.supplierName ?? r.sourceDescription,
              facility: r.facility?.name ?? null,
              source: r.fieldSubmissionId ? "Field app" : r.importBatch ? `Import: ${r.importBatch.sourceFilename}` : "Entered in the web app",
              ...tierInput,
              tier: evidenceTier(tierInput),
              tierReasons: tierReasons(tierInput),
              evidence: r.evidence.map((e) => e.evidenceFile),
            },
          };
        }),
      };
    }

    return NextResponse.json({
      snapshot: {
        id: snapshot.id,
        version: snapshot.version,
        publishedAt: snapshot.publishedAt,
        periodId: snapshot.reportingPeriod.id,
        periodLabel: snapshot.reportingPeriod.label,
        factorLibrary: snapshot.calculationRun.factorLibrary ? `${snapshot.calculationRun.factorLibrary.name} ${snapshot.calculationRun.factorLibrary.version}` : null,
        methodology: snapshot.calculationRun.methodologyVersion?.name ?? null,
      },
      tiers,
      categories: categoryRows
        .filter((c) => c.emissionCategory)
        .map((c) => ({ ...c.emissionCategory!, scope: c.scope, kgCo2e: Number(c.totalCo2e), recordCount: c.recordCount })),
      records,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
