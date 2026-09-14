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

    let updated: { id: string; isPilot?: boolean; plan: string } | null = null;
    try {
      updated = await prisma.organization.update({
        where: { id: orgId },
        data: { isPilot: body.isPilot },
        select: { id: true, isPilot: true, plan: true },
      });
    } catch (err) {
      // Check if column doesn't exist yet (migration not deployed)
      const errorMsg = String(err);
      if (errorMsg.includes("is_pilot") || errorMsg.includes("isPilot")) {
        return apiError(
          "MIGRATION_PENDING",
          "Pilot flag feature not available yet — database migration pending deployment.",
          503
        );
      }
      throw err;
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
        note: "isPilot column not yet deployed",
      },
    });

    return NextResponse.json(updated || { id: orgId, isPilot: false, plan: "trial" });
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
