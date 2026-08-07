import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest, rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError } from "@/lib/validation/api";
import { createBusinessUnitSchema } from "@/lib/validation/org";

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

    const businessUnits = await prisma.businessUnit.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(businessUnits);
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
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "business-units", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;
    const body = createBusinessUnitSchema.parse(await req.json());

    const businessUnit = await prisma.businessUnit.create({
      data: {
        organizationId: orgId,
        name: body.name,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "business_unit.created",
      resourceType: "business_unit",
      resourceId: businessUnit.id,
      metadata: { name: businessUnit.name },
    });

    return NextResponse.json(businessUnit, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
