import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
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
      action: "record.created",
      resourceType: "business_unit",
      resourceId: businessUnit.id,
      metadata: { name: businessUnit.name },
    });

    return NextResponse.json(businessUnit, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
