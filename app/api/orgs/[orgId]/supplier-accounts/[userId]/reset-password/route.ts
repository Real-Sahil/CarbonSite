import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import {
  accountBelongsOnlyToOrg,
  generateTemporaryPassword,
  hashTemporaryPassword,
} from "@/lib/auth/temporary-password";

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

    // The new password is shown to this org's admin, so it must not unlock
    // anything outside this org.
    if (!(await accountBelongsOnlyToOrg(userId, orgId))) {
      return NextResponse.json(
        {
          code: "SHARED_ACCOUNT",
          message:
            "This supplier also uses MetricOra with another organisation, so only they can change their password. Ask them to use \"Forgot password\" on the sign-in page.",
        },
        { status: 409 },
      );
    }

    const plainPassword = generateTemporaryPassword();
    const hashedPassword = await hashTemporaryPassword(plainPassword);

    const account = await prisma.account.findFirst({
      where: { userId, providerId: "credential" },
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
