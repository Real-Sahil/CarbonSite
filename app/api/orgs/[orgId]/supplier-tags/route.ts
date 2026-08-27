import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";

const createTagSchema = z.object({
  name: z.string().min(1).max(100),
});

// List all tags for an organization
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const tags = await prisma.supplierTag.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, createdAt: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ tags });
  } catch (err) {
    return handleRouteError(err);
  }
}

// Create a new tag
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const body = createTagSchema.parse(await req.json());

    // Check if tag already exists
    const existing = await prisma.supplierTag.findUnique({
      where: {
        organizationId_name: {
          organizationId: orgId,
          name: body.name,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { code: "CONFLICT", message: "A tag with this name already exists" },
        { status: 409 },
      );
    }

    const tag = await prisma.supplierTag.create({
      data: {
        organizationId: orgId,
        name: body.name,
      },
    });

    // Audit log
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "supplier_tag.created",
      resourceType: "SupplierTag",
      resourceId: tag.id,
      metadata: { name: body.name },
    });

    return NextResponse.json({ tag }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
