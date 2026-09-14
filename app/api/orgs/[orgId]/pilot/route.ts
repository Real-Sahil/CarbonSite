import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { z } from "zod";

type Params = { params: Promise<{ orgId: string }> };

const pilotToggleSchema = z.object({
  isPilot: z.boolean(),
});

export async function PATCH(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    const body = pilotToggleSchema.parse(await _req.json());

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, isPilot: true },
    });

    if (!org) {
      return apiError("NOT_FOUND", "Organization not found.", 404);
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: { isPilot: body.isPilot },
      select: { id: true, isPilot: true, plan: true },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "org.pilot_flag_changed",
      resourceType: "organization",
      resourceId: orgId,
      metadata: {
        previousValue: org.isPilot,
        newValue: body.isPilot,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin");

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, isPilot: true },
    });

    if (!org) {
      return apiError("NOT_FOUND", "Organization not found.", 404);
    }

    return NextResponse.json(org);
  } catch (err) {
    return handleRouteError(err);
  }
}
