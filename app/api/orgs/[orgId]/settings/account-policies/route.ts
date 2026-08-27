import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";

const policySchema = z.object({
  supplierPasswordRotationDays: z.number().int().min(0).max(365).nullable(),
  supplierAccountExpiryDays: z.number().int().min(0).max(730).nullable(),
});

// Get account policies
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        supplierPasswordRotationDays: true,
        supplierAccountExpiryDays: true,
      },
    });

    if (!org) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Organization not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      supplierPasswordRotationDays: org.supplierPasswordRotationDays,
      supplierAccountExpiryDays: org.supplierAccountExpiryDays,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// Update account policies
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const body = policySchema.parse(await req.json());

    const org = await prisma.organization.update({
      where: { id: orgId },
      data: {
        supplierPasswordRotationDays: body.supplierPasswordRotationDays,
        supplierAccountExpiryDays: body.supplierAccountExpiryDays,
      },
    });

    // Audit log
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "organization.account_policies_updated",
      resourceType: "Organization",
      resourceId: orgId,
      metadata: {
        supplierPasswordRotationDays: body.supplierPasswordRotationDays,
        supplierAccountExpiryDays: body.supplierAccountExpiryDays,
      },
    });

    return NextResponse.json({
      supplierPasswordRotationDays: org.supplierPasswordRotationDays,
      supplierAccountExpiryDays: org.supplierAccountExpiryDays,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
