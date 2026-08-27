import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";

const terminateSchema = z.object({
  action: z.enum(["terminate", "reactivate"]),
});

// Admin terminates or reactivates supplier account
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> },
) {
  try {
    const { orgId, userId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);
    const body = terminateSchema.parse(await req.json());

    // Verify the user is a supplier in this org
    const supplierMembership = await prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
    });

    if (!supplierMembership || supplierMembership.role !== "supplier") {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Supplier not found in this organization." },
        { status: 404 },
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (body.action === "terminate") {
      // Soft-delete by setting terminatedAt
      if (supplierMembership.terminatedAt) {
        return NextResponse.json(
          { code: "INVALID_STATE", message: "This supplier account is already terminated." },
          { status: 400 },
        );
      }

      await prisma.organizationMembership.update({
        where: { id: supplierMembership.id },
        data: { terminatedAt: new Date() },
      });

      // Audit log
      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "supplier_account.terminated",
        resourceType: "SupplierAccount",
        resourceId: userId,
        metadata: {
          email: user?.email,
        },
      });

      return NextResponse.json({
        userId,
        status: "terminated",
        message: "Supplier account terminated successfully.",
      });
    } else if (body.action === "reactivate") {
      // Reactivate by clearing terminatedAt
      if (!supplierMembership.terminatedAt) {
        return NextResponse.json(
          { code: "INVALID_STATE", message: "This supplier account is already active." },
          { status: 400 },
        );
      }

      await prisma.organizationMembership.update({
        where: { id: supplierMembership.id },
        data: { terminatedAt: null },
      });

      // Audit log
      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "supplier_account.reactivated",
        resourceType: "SupplierAccount",
        resourceId: userId,
        metadata: {
          email: user?.email,
        },
      });

      return NextResponse.json({
        userId,
        status: "active",
        message: "Supplier account reactivated successfully.",
      });
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
