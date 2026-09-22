export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { WORKFLOWS, nextMajorVersion } from "@/lib/structured-forms/workflows";

type Params = { params: Promise<{ orgId: string; reportId: string }> };

const workflow = WORKFLOWS["environmental-permits"];

// A variation amends the same permit: status and conditions stay attached, only the version moves on.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, reportId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    const existing = await prisma.environmentalPermit.findFirst({
      where: { id: reportId, organizationId: orgId },
      select: { status: true, version: true },
    });
    if (!existing) return apiError("NOT_FOUND", "Environmental permit not found.", 404);
    if (!workflow.revise?.from.includes(existing.status)) {
      return apiError("INVALID_STATE", `${workflow.revise?.label ?? "This action"} is not available while the permit is ${existing.status}.`, 409);
    }

    const newVersion = nextMajorVersion(existing.version);
    const updated = await prisma.environmentalPermit.update({
      where: { id: reportId },
      data: {
        version: newVersion,
        lockedAt: null,
        signedOffAt: null,
        signedOffByUserId: null,
      },
      select: { id: true, status: true, version: true },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "environmental_permit.revised",
      resourceType: "EnvironmentalPermit",
      resourceId: reportId,
      metadata: { kind: "variation", fromStatus: existing.status, toStatus: updated.status, fromVersion: existing.version, newVersion },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
