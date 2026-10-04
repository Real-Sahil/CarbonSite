export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createActivityRecordSchema } from "@/lib/validation/records";
import { duplicateKey, findExistingDuplicates } from "@/lib/data-quality/duplicates";
import { withApiVersion, checkDeprecationWarning } from "@/lib/api/versioned-handler";
import { REVIEW_STATUSES } from "@/lib/saved-views";

type Params = { params: Promise<{ orgId: string }> };

/** The filters the records list accepts (the same keys as the saved views surface). */
const listFilters = z.object({
  periodId: z.string().min(1).max(64).optional(),
  categoryId: z.string().min(1).max(64).optional(),
  reviewStatus: z.enum(REVIEW_STATUSES).optional(),
  facilityId: z.string().min(1).max(64).optional(),
  contractId: z.string().min(1).max(64).optional(),
  supplier: z.string().trim().min(1).max(64).optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(_req);

    // Log deprecation warning if applicable
    const deprecationWarning = checkDeprecationWarning(version);
    if (deprecationWarning) {
      console.warn(`[API v${version}] ${deprecationWarning}`);
    }

    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);

    const url = new URL(_req.url);
    const cursor = url.searchParams.get("cursor");
    const f = listFilters.parse(Object.fromEntries(url.searchParams));
    const take = 50;

    // Every filter narrows inside the organisation; none can widen the scope.
    const where = {
      organizationId: orgId,
      ...(f.periodId ? { reportingPeriodId: f.periodId } : {}),
      ...(f.categoryId ? { emissionCategoryId: f.categoryId } : {}),
      ...(f.reviewStatus ? { reviewStatus: f.reviewStatus } : {}),
      ...(f.facilityId ? { facilityId: f.facilityId } : {}),
      ...(f.contractId ? { contractId: f.contractId } : {}),
      ...(f.supplier ? { supplierName: { contains: f.supplier, mode: "insensitive" as const } } : {}),
    };

    const [records, total] = await Promise.all([
      prisma.activityRecord.findMany({
        where,
        include: {
          reportingPeriod: { select: { label: true } },
          emissionCategory: { select: { scope: true, name: true, code: true } },
          facility: { select: { name: true } },
          businessUnit: { select: { name: true } },
          evidence: {
            include: {
              evidenceFile: { select: { id: true, filename: true } },
            },
          },
          _count: { select: { calculations: true } },
        },
        orderBy: { createdAt: "desc" },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      prisma.activityRecord.count({ where }),
    ]);

    const hasMore = records.length > take;
    const data = hasMore ? records.slice(0, take) : records;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return json({ data, nextCursor, total }, { version });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(req);

    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const body = createActivityRecordSchema.parse(await req.json());

    // Verify the reporting period belongs to this org
    const period = await prisma.reportingPeriod.findUnique({
      where: { id: body.reportingPeriodId },
      select: { organizationId: true, status: true },
    });
    if (!period || period.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Reporting period not found.", 404);
    }
    if (period.status === "locked") {
      return apiError("LOCKED", "Reporting period is locked.", 409);
    }

    // Verify facility belongs to this org if provided
    if (body.facilityId) {
      const facility = await prisma.facility.findUnique({
        where: { id: body.facilityId },
        select: { organizationId: true },
      });
      if (!facility || facility.organizationId !== orgId) {
        return apiError("NOT_FOUND", "Facility not found.", 404);
      }
    }

    // Verify business unit belongs to this org if provided
    if (body.businessUnitId) {
      const bu = await prisma.businessUnit.findUnique({
        where: { id: body.businessUnitId },
        select: { organizationId: true },
      });
      if (!bu || bu.organizationId !== orgId) {
        return apiError("NOT_FOUND", "Business unit not found.", 404);
      }
    }

    // The same line entered twice would be counted twice. Ask first; a
    // genuine repeat is sent again with allowDuplicate.
    if (!body.allowDuplicate) {
      const candidate = {
        emissionCategoryId: body.emissionCategoryId,
        amount: body.amount,
        unit: body.unit,
        activityDate: body.activityDate,
        facilityId: body.facilityId,
        supplierName: body.supplierName,
      };
      const key = duplicateKey(candidate);
      const existingId = key ? (await findExistingDuplicates(orgId, [candidate])).get(key) : undefined;
      if (existingId) {
        return apiError(
          "POSSIBLE_DUPLICATE",
          "A record with the same category, amount, unit, date and facility already exists. Save anyway only if this is a separate activity.",
          409,
          { existingRecordId: existingId },
        );
      }
    }

    const record = await prisma.activityRecord.create({
      data: {
        organizationId: orgId,
        reportingPeriodId: body.reportingPeriodId,
        emissionCategoryId: body.emissionCategoryId,
        amount: body.amount,
        unit: body.unit,
        activityDate: body.activityDate ? new Date(body.activityDate) : undefined,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        sourceDescription: body.sourceDescription,
        facilityId: body.facilityId,
        businessUnitId: body.businessUnitId,
        supplierName: body.supplierName,
        country: body.country,
        region: body.region,
        spendAmount: body.spendAmount,
        spendCurrency: body.spendCurrency,
        distanceAmount: body.distanceAmount,
        distanceUnit: body.distanceUnit,
        transportMode: body.transportMode,
        fuelType: body.fuelType,
        refrigerantType: body.refrigerantType,
        industryCode: body.industryCode,
        scope2Method: body.scope2Method,
        assumptionNotes: body.assumptionNotes,
        dataOrigin: body.dataOrigin,
        dataOriginNote: body.dataOriginNote ?? null,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.created",
      resourceType: "activity_record",
      resourceId: record.id,
      metadata: { unit: record.unit, emissionCategoryId: record.emissionCategoryId },
    });

    return json(record, { status: 201, version });
  } catch (err) {
    return handleRouteError(err);
  }
}
