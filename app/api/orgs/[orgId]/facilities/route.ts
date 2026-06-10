import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { handleRouteError } from "@/lib/validation/api";
import { createFacilitySchema } from "@/lib/validation/org";

export async function GET(
  _req: NextRequest,
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
      "field_worker",
    );

    const facilities = await prisma.facility.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(facilities);
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
    const { session } = await requireOrgMember(orgId, "admin", "editor");
    const limited = rateLimit(req, {
      key: rateLimitKey(orgId, "facilities", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;
    const body = createFacilitySchema.parse(await req.json());

    const facility = await prisma.facility.create({
      data: {
        organizationId: orgId,
        name: body.name,
        country: body.country ?? null,
        region: body.region ?? null,
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

    return NextResponse.json(facility, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
