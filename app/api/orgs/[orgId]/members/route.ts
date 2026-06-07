import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { inviteMemberSchema } from "@/lib/validation/org";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const members = await prisma.organizationMembership.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(members);
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
    const { session } = await requireOrgMember(orgId, "admin");
    const body = inviteMemberSchema.parse(await req.json());

    const user = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (!user) {
      return apiError(
        "USER_NOT_FOUND",
        "No account found with that email. The user must sign up first before being invited.",
        404,
      );
    }

    const existing = await prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId: user.id },
      },
    });

    if (existing) {
      return apiError("ALREADY_MEMBER", "User is already a member of this organization.", 409);
    }

    const membership = await prisma.organizationMembership.create({
      data: {
        organizationId: orgId,
        userId: user.id,
        role: body.role,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, createdAt: true },
        },
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "org.member.invite",
      resourceType: "membership",
      resourceId: membership.id,
      metadata: { invitedUserId: user.id, email: body.email, role: body.role },
    });

    return NextResponse.json(membership, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
