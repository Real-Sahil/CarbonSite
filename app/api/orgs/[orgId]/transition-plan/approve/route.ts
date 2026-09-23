export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";

const approveSchema = z.object({
  approvalBody: z.string().trim().min(2).max(200),
  approvedOn: z.coerce.date(),
});

// POST /api/orgs/[orgId]/transition-plan/approve
// An admin records that the board (or equivalent body) approved the plan as
// it stands. The date is when the body approved it, not when it was entered.
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);
    const body = approveSchema.parse(await req.json());
    if (body.approvedOn > new Date()) return apiError("VALIDATION_ERROR", "The approval date cannot be in the future.", 400);

    const existing = await prisma.transitionPlan.findUnique({ where: { organizationId: orgId }, select: { id: true } });
    if (!existing) return apiError("NOT_FOUND", "Save the plan before recording its approval.", 404);

    const plan = await prisma.transitionPlan.update({
      where: { id: existing.id },
      data: { status: "approved", approvalBody: body.approvalBody, approvedAt: body.approvedOn, approvedByUserId: session.user.id },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "transition_plan.approved",
      resourceType: "TransitionPlan",
      resourceId: plan.id,
      metadata: { approvalBody: body.approvalBody, approvedOn: body.approvedOn.toISOString().slice(0, 10) },
    });

    return NextResponse.json({ plan });
  } catch (err) {
    return handleRouteError(err);
  }
}
