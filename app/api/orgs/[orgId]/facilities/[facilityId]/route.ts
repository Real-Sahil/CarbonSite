export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { updateFacilitySchema } from "@/lib/validation/org";

async function resolveFacility(orgId: string, facilityId: string) {
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
  });
  if (!facility || facility.organizationId !== orgId) {
    return null;
  }
  return facility;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; facilityId: string }> },
) {
  try {
    const { orgId, facilityId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "facility-update", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const facility = await resolveFacility(orgId, facilityId);
    if (!facility) {
      return apiError("NOT_FOUND", "Facility not found.", 404);
    }

    const body = updateFacilitySchema.parse(await req.json());

    if (body.legalEntityId) {
      const entity = await prisma.legalEntity.findFirst({
        where: { id: body.legalEntityId, organizationId: orgId },
        select: { id: true },
      });
      if (!entity) {
        return apiError("NOT_FOUND", "Legal entity not found in this organisation.", 404);
      }
    }

    const updated = await prisma.facility.update({
      where: { id: facilityId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.country !== undefined && { country: body.country }),
        ...(body.region !== undefined && { region: body.region }),
        ...(body.addressLine !== undefined && { addressLine: body.addressLine ?? null }),
        ...(body.postcode !== undefined && { postcode: body.postcode ?? null }),
        ...(body.latitude !== undefined && { latitude: body.latitude ?? null }),
        ...(body.longitude !== undefined && { longitude: body.longitude ?? null }),
        ...(body.siteType !== undefined && { siteType: body.siteType ?? null }),
        ...(body.floorAreaM2 !== undefined && { floorAreaM2: body.floorAreaM2 ?? null }),
        ...(body.headcount !== undefined && { headcount: body.headcount ?? null }),
        ...(body.legalEntityId !== undefined && { legalEntityId: body.legalEntityId ?? null }),
        ...(body.operationalControl !== undefined && {
          operationalControl: body.operationalControl,
        }),
        ...(body.operationalFrom !== undefined && {
          operationalFrom: body.operationalFrom ?? null,
        }),
        ...(body.operationalTo !== undefined && { operationalTo: body.operationalTo ?? null }),
        ...(body.externalRef !== undefined && { externalRef: body.externalRef ?? null }),
        ...(body.waterStressLevel !== undefined && {
          waterStressLevel: body.waterStressLevel ?? null,
          waterStressAssessedAt: body.waterStressLevel ? new Date() : null,
        }),
        ...(body.waterStressSource !== undefined && { waterStressSource: body.waterStressSource ?? null }),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "facility.updated",
      resourceType: "facility",
      resourceId: facilityId,
      metadata: { changes: body },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; facilityId: string }> },
) {
  try {
    const { orgId, facilityId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "facility-delete", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const facility = await resolveFacility(orgId, facilityId);
    if (!facility) {
      return apiError("NOT_FOUND", "Facility not found.", 404);
    }

    const refCount = await prisma.activityRecord.count({
      where: { facilityId, organizationId: orgId },
    });

    if (refCount > 0) {
      return apiError(
        "FACILITY_IN_USE",
        `Cannot delete facility — it is referenced by ${refCount} activity record(s). Reassign or delete those records first.`,
        409,
      );
    }

    await prisma.facility.delete({ where: { id: facilityId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "facility.deleted",
      resourceType: "facility",
      resourceId: facilityId,
      metadata: { name: facility.name },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
