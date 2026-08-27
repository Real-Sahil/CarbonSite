import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import * as crypto from "crypto";
import { createHash } from "crypto";

// Admin creates a supplier account (email/password auto-generated)
const createSupplierSchema = z.object({
  orgId: z.string(),
  email: z.string().email(),
  name: z.string().min(1).max(255),
  company: z.string().max(255).optional(),
  assignedCategoryIds: z.array(z.string()).optional(),
  assignedPeriodIds: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { session } = await requireOrgMember("", ...ROLE_GROUPS.admins);
    const body = createSupplierSchema.parse(await req.json());

    // Check that the requester is admin for this org
    const requesterMembership = await prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: body.orgId,
          userId: session.user.id,
        },
      },
    });

    if (!requesterMembership || !["admin", "owner"].includes(requesterMembership.role)) {
      return NextResponse.json(
        { code: "FORBIDDEN", message: "You do not have permission to create supplier accounts in this organization." },
        { status: 403 },
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { code: "CONFLICT", message: "A user with this email already exists." },
        { status: 409 },
      );
    }

    // Generate random password (12 chars, mixed case + numbers + symbols)
    const plainPassword = crypto.randomBytes(9).toString("base64").substring(0, 12);
    // Use SHA-256 hash for temporary password storage (will be updated on first login)
    const hashedPassword = createHash("sha256").update(plainPassword).digest("hex");

    // Create user, account, and organization membership in a transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: body.email,
          name: body.name,
          emailVerified: true,
        },
      });

      // Create the account with hashed password
      await tx.account.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: hashedPassword,
        },
      });

      // Create organization membership
      await tx.organizationMembership.create({
        data: {
          organizationId: body.orgId,
          userId: user.id,
          role: "supplier",
        },
      });

      return user;
    });

    // Audit log
    await writeAuditLog({
      organizationId: body.orgId,
      actorUserId: session.user.id,
      action: "supplier_account.created",
      resourceType: "SupplierAccount",
      resourceId: newUser.id,
      metadata: {
        email: body.email,
        name: body.name,
        company: body.company,
      },
    });

    return NextResponse.json({
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      password: plainPassword, // Return plain password once for admin to share
      message: "Supplier account created. Share the email and password with the supplier.",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
