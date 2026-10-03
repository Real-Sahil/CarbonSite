export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { aggregateStreams, buildMrvWorkbook } from "@/lib/exports/abu-dhabi-mrv";
import { formatters, orgFormat } from "@/lib/i18n/org-format";

type Params = { params: Promise<{ orgId: string }> };

/** Same roles that may take the whole trail out. */
const EXPORT_ROLES = ["admin", "sustainability_director", "sustainability_manager", "reviewer", "auditor"] as const;

const querySchema = z.object({
  facilityId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
});

// GET /api/orgs/[orgId]/exports/abu-dhabi-mrv?facilityId=&year=
//
// One facility's Scope 1 data for a calendar year, from the latest published
// snapshot whose period covers that whole year. Nothing is estimated: a year
// with no such snapshot is refused.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...EXPORT_ROLES);
    const { facilityId, year } = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));

    const facility = await prisma.facility.findFirst({
      where: { id: facilityId, organizationId: orgId },
      include: {
        organization: { select: { name: true, hqCountry: true, reportingCurrency: true } },
        legalEntity: { select: { name: true, parent: { select: { name: true } } } },
      },
    });
    if (!facility) return apiError("NOT_FOUND", "Facility not found.", 404);

    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    const snapshot = await prisma.publishedSnapshot.findFirst({
      where: {
        organizationId: orgId,
        reportingPeriod: { startDate: { lte: from }, endDate: { gte: new Date(Date.UTC(year, 11, 31)) } },
      },
      orderBy: { publishedAt: "desc" },
      select: { id: true, calculationRunId: true, version: true },
    });
    if (!snapshot) {
      return apiError(
        "NO_PUBLISHED_SNAPSHOT",
        `No published snapshot covers all of ${year}. Publish a calculation run for a period that includes the whole calendar year first.`,
        422,
      );
    }

    const calcs = await prisma.emissionCalculation.findMany({
      where: {
        organizationId: orgId,
        calculationRunId: snapshot.calculationRunId,
        activityRecord: {
          organizationId: orgId,
          facilityId: facility.id,
          activityDate: { gte: from, lte: to },
          emissionCategory: { scope: 1 },
        },
      },
      select: {
        normalizedAmount: true,
        normalizedUnit: true,
        totalCo2e: true,
        factorValue: true,
        factorLibraryVersion: true,
        activityRecord: { select: { fuelType: true, dataOrigin: true, emissionCategory: { select: { name: true } } } },
      },
    });

    const streams = aggregateStreams(
      calcs.map((c) => ({
        categoryName: c.activityRecord.emissionCategory.name,
        fuelType: c.activityRecord.fuelType,
        normalizedAmount: Number(c.normalizedAmount),
        normalizedUnit: c.normalizedUnit,
        totalKg: Number(c.totalCo2e),
        factorValue: c.factorValue == null ? null : Number(c.factorValue),
        factorSource: c.factorLibraryVersion,
        dataOrigin: c.activityRecord.dataOrigin,
      })),
    );

    const F = formatters(orgFormat(facility.organization));
    const buf = buildMrvWorkbook({
      year,
      companyName: facility.legalEntity?.name ?? facility.organization.name,
      parentName: facility.legalEntity?.parent?.name ?? null,
      facilityName: facility.name,
      economicLicenceNumber: facility.economicLicenceNumber,
      environmentalPermitNumber: facility.environmentalPermitNumber,
      address: [facility.addressLine, facility.region, facility.postcode].filter(Boolean).join(", ") || null,
      latitude: facility.latitude == null ? null : Number(facility.latitude),
      longitude: facility.longitude == null ? null : Number(facility.longitude),
      streams,
      generatedOn: F.date(new Date()),
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "export.abu_dhabi_mrv",
      resourceType: "facility",
      resourceId: facility.id,
      metadata: { year, snapshotId: snapshot.id, streams: streams.length },
    });

    const safeName = facility.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 60);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="abu-dhabi-mrv-${safeName}-${year}.xlsx"`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
