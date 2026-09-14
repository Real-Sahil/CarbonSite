import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ orgId: string }> };

const pilotToggleSchema = z.object({
  isPilot: z.boolean(),
});

export async function PATCH(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    const body = pilotToggleSchema.parse(await _req.json());

    let org: { id: string; isPilot?: boolean } | null = null;
    try {
      org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, isPilot: true },
      });
    } catch {
      // isPilot column doesn't exist yet (migration not deployed) — assume false
      org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true },
      });
      if (org) org.isPilot = false;
    }

    if (!org) {
      return apiError("NOT_FOUND", "Organization not found.", 404);
    }

    // Raw SQL bypasses ORM field-mapping and pgbouncer prepared-statement issues
    try {
      await prisma.$executeRaw`UPDATE organizations SET is_pilot = ${body.isPilot} WHERE id = ${orgId}`;
    } catch (err) {
      const errorMsg = String(err);
      if (errorMsg.includes("does not exist") && errorMsg.includes("is_pilot")) {
        return apiError(
          "FEATURE_UNAVAILABLE",
          "This feature is temporarily unavailable. Please try again later.",
          503
        );
      }
      throw err;
    }

    // Read back to verify and return current state
    const updated = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, isPilot: true, plan: true },
    });

    if (updated && updated.isPilot !== body.isPilot) {
      return apiError(
        "UPDATE_FAILED",
        "Pilot status could not be saved. Please try again.",
        500
      );
    }

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "org.pilot_flag_changed",
      resourceType: "organization",
      resourceId: orgId,
      metadata: {
        previousValue: org.isPilot ?? false,
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

    let org: { id: string; isPilot?: boolean } | null = null;
    try {
      org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, isPilot: true },
      });
    } catch {
      // isPilot column doesn't exist yet (migration not deployed) — assume false
      org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true },
      });
      if (org) org.isPilot = false;
    }

    if (!org) {
      return apiError("NOT_FOUND", "Organization not found.", 404);
    }

    return NextResponse.json(org);
  } catch (err) {
    return handleRouteError(err);
  }
}
