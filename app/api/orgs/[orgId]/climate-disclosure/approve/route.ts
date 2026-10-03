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

// POST /api/orgs/[orgId]/climate-disclosure/approve
// An admin records that the board (or equivalent body) approved the statement
// as it stands. The date is when the body approved it, not when it was entered.
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);
    const body = approveSchema.parse(await req.json());
    if (body.approvedOn > new Date()) return apiError("VALIDATION_ERROR", "The approval date cannot be in the future.", 400);

    const existing = await prisma.climateDisclosure.findUnique({ where: { organizationId: orgId }, select: { id: true } });
    if (!existing) return apiError("NOT_FOUND", "Save the statement before recording its approval.", 404);

    await prisma.climateDisclosure.update({
      where: { id: existing.id },
      data: { status: "approved", approvalBody: body.approvalBody, approvedAt: body.approvedOn, approvedByUserId: session.user.id },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "climate_disclosure.approved",
      resourceType: "ClimateDisclosure",
      resourceId: existing.id,
      metadata: { approvalBody: body.approvalBody, approvedOn: body.approvedOn.toISOString().slice(0, 10) },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
