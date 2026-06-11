import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { updateMemberRoleSchema } from "@/lib/validation/org";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; memberId: string }> },
) {
  try {
    const { orgId, memberId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");
    const limited = rateLimit(req, {
      key: rateLimitKey(orgId, "member-role-change", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;
    const body = updateMemberRoleSchema.parse(await req.json());

    const target = await prisma.organizationMembership.findUnique({
      where: { id: memberId },
    });

    if (!target || target.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Membership not found.", 404);
    }

    // If the actor is updating their own role and they are currently admin,
    // ensure another admin exists before the role change.
    if (target.userId === session.user.id && target.role === "admin" && body.role !== "admin") {
      const adminCount = await prisma.organizationMembership.count({
        where: {
          organizationId: orgId,
          role: "admin",
          id: { not: memberId },
        },
      });
      if (adminCount === 0) {
        return apiError(
          "LAST_ADMIN",
          "Cannot change your own role — you are the last admin. Promote another member first.",
          409,
        );
      }
    }

    const updated = await prisma.organizationMembership.update({
      where: { id: memberId },
      data: { role: body.role },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "org.member.role_change",
      resourceType: "membership",
      resourceId: memberId,
      metadata: {
        targetUserId: target.userId,
        previousRole: target.role,
        newRole: body.role,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; memberId: string }> },
) {
  try {
    const { orgId, memberId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");
    const limited = rateLimit(req, {
      key: rateLimitKey(orgId, "member-remove", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const target = await prisma.organizationMembership.findUnique({
      where: { id: memberId },
    });

    if (!target || target.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Membership not found.", 404);
    }

    // Prevent removing self if they are the last admin
    if (target.userId === session.user.id && target.role === "admin") {
      const adminCount = await prisma.organizationMembership.count({
        where: {
          organizationId: orgId,
          role: "admin",
          id: { not: memberId },
        },
      });
      if (adminCount === 0) {
        return apiError(
          "LAST_ADMIN",
          "Cannot remove yourself — you are the last admin. Promote another member first.",
          409,
        );
      }
    }

    await prisma.organizationMembership.delete({ where: { id: memberId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "org.member.remove",
      resourceType: "membership",
      resourceId: memberId,
      metadata: { removedUserId: target.userId, removedRole: target.role },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
