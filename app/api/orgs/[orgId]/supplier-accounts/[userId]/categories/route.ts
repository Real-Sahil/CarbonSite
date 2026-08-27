import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";

const updateCategoriesSchema = z.object({
  categoryIds: z.array(z.string()),
});

// Get assigned categories for a supplier
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> },
) {
  try {
    const { orgId, userId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const assignments = await prisma.supplierCategoryAssignment.findMany({
      where: {
        organizationId: orgId,
        supplierId: userId,
      },
      select: { categoryCode: true },
    });

    return NextResponse.json({
      categories: assignments.map((a) => a.categoryCode),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// Update assigned categories for a supplier
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> },
) {
  try {
    const { orgId, userId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const body = updateCategoriesSchema.parse(await req.json());

    // Verify supplier exists
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
    });

    if (!membership || membership.role !== "supplier") {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Supplier not found" },
        { status: 404 },
      );
    }

    // Delete existing assignments
    await prisma.supplierCategoryAssignment.deleteMany({
      where: {
        organizationId: orgId,
        supplierId: userId,
      },
    });

    // Create new assignments
    if (body.categoryIds.length > 0) {
      await prisma.supplierCategoryAssignment.createMany({
        data: body.categoryIds.map((categoryCode) => ({
          organizationId: orgId,
          supplierId: userId,
          categoryCode,
        })),
      });
    }

    // Audit log
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "supplier_account.categories_updated",
      resourceType: "SupplierAccount",
      resourceId: userId,
      metadata: {
        categories: body.categoryIds,
      },
    });

    return NextResponse.json({
      message: "Categories updated",
      categories: body.categoryIds,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
