export const dynamic = "force-dynamic";

import { requireCapacity } from "@/lib/billing/limits";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createFacilitySchema } from "@/lib/validation/org";
import { withApiVersion, checkDeprecationWarning } from "@/lib/api/versioned-handler";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(_req);

    const deprecationWarning = checkDeprecationWarning(version);
    if (deprecationWarning) {
      console.warn(`[API v${version}] ${deprecationWarning}`);
    }

    // Read-only listing used to populate dropdowns (waste/water capture,
    // completeness matrix, etc.) across many roles — widened to anyMember
    // rather than the narrower legacy list, which excluded sustainability
    // and project/site roles that need to log facility-scoped records.
    // field_worker kept explicitly (mobile facility-picker on submission)
    // even though ROLE_GROUPS.anyMember deliberately excludes it elsewhere.
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember, "field_worker");

    const facilities = await prisma.facility.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    });

    return json(facilities, { version });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(req);
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "facilities", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;
    const body = createFacilitySchema.parse(await req.json());
    const capacity = await requireCapacity(orgId, "facilities");
    if (capacity) return capacity;

    if (body.legalEntityId) {
      const entity = await prisma.legalEntity.findFirst({
        where: { id: body.legalEntityId, organizationId: orgId },
        select: { id: true },
      });
      if (!entity) {
        return apiError("NOT_FOUND", "Legal entity not found in this organisation.", 404);
      }
    }

    // One site, one facility: a second "Leeds depot" splits its records and
    // its totals across two rows with nothing to show they are the same place.
    const sameName = await prisma.facility.findFirst({
      where: { organizationId: orgId, name: { equals: body.name.trim(), mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (sameName) {
      return apiError("FACILITY_EXISTS", `A facility called "${sameName.name}" already exists.`, 409, { facilityId: sameName.id });
    }

    const facility = await prisma.facility.create({
      data: {
        organizationId: orgId,
        name: body.name.trim(),
        country: body.country ?? null,
        region: body.region ?? null,
        addressLine: body.addressLine ?? null,
        postcode: body.postcode ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        siteType: body.siteType ?? null,
        floorAreaM2: body.floorAreaM2 ?? null,
        headcount: body.headcount ?? null,
        legalEntityId: body.legalEntityId ?? null,
        ...(body.operationalControl !== undefined && {
          operationalControl: body.operationalControl,
        }),
        operationalFrom: body.operationalFrom ?? null,
        operationalTo: body.operationalTo ?? null,
        externalRef: body.externalRef ?? null,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "facility.created",
      resourceType: "facility",
      resourceId: facility.id,
      metadata: { name: facility.name },
    });

    return json(facility, { status: 201, version });
  } catch (err) {
    return handleRouteError(err);
  }
}
