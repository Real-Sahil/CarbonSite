import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import * as crypto from "crypto";
import { createHash } from "crypto";

// Admin resets supplier password
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> },
) {
  try {
    const { orgId, userId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    // Verify the user is a supplier in this org
    const supplierMembership = await prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
    });

    if (!supplierMembership || supplierMembership.role !== "supplier" || supplierMembership.terminatedAt) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Supplier not found in this organization." },
        { status: 404 },
      );
    }

    // Generate new password
    const plainPassword = crypto.randomBytes(9).toString("base64").substring(0, 12);
    // Use SHA-256 hash for temporary password storage (will be updated on first login)
    const hashedPassword = createHash("sha256").update(plainPassword).digest("hex");

    // Get the account
    const account = await prisma.account.findFirst({
      where: { userId },
    });

    if (!account) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Account not found." },
        { status: 404 },
      );
    }

    // Update the password with hashed value
    await prisma.account.update({
      where: { id: account.id },
      data: {
        password: hashedPassword,
      },
    });

    // Audit log
    const user = await prisma.user.findUnique({ where: { id: userId } });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "supplier_account.password_reset",
      resourceType: "SupplierAccount",
      resourceId: userId,
      metadata: {
        email: user?.email,
      },
    });

    return NextResponse.json({
      userId,
      newPassword: plainPassword,
      message: "Password reset. Share the new password with the supplier.",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
