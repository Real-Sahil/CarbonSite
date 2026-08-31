export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ token: string }> };

// GET /api/public/supplier-invites/[token]/validate — validate invite token
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;

    const invite = await prisma.supplierInvite.findUnique({
      where: { token },
      select: {
        id: true,
        email: true,
        companyName: true,
        expiresAt: true,
        usedAt: true,
        organization: { select: { id: true, name: true } },
      },
    });

    if (!invite) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Invitation not found or invalid token" },
        { status: 404 }
      );
    }

    if (invite.usedAt) {
      return NextResponse.json(
        { code: "ALREADY_USED", message: "This invitation has already been used" },
        { status: 410 }
      );
    }

    if (new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json(
        { code: "EXPIRED", message: "This invitation has expired" },
        { status: 410 }
      );
    }

    return NextResponse.json({
      id: invite.id,
      email: invite.email,
      companyName: invite.companyName,
      organizationId: invite.organization.id,
      organizationName: invite.organization.name,
      expiresAt: invite.expiresAt.toISOString(),
      valid: true,
    });
  } catch (err) {
    console.error("[SupplierInviteValidate] Error:", err);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Failed to validate invitation" },
      { status: 500 }
    );
  }
}
