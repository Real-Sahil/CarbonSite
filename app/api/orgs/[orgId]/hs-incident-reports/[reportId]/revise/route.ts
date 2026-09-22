export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { WORKFLOWS, nextMajorVersion } from "@/lib/structured-forms/workflows";

type Params = { params: Promise<{ orgId: string; reportId: string }> };

const workflow = WORKFLOWS["hs-incident-reports"];

// Reopens the same record so the incident register keeps one entry and corrective actions stay attached.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, reportId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    const existing = await prisma.hsIncidentReport.findFirst({
      where: { id: reportId, organizationId: orgId },
      select: { status: true, version: true },
    });
    if (!existing) return apiError("NOT_FOUND", "H&S incident report not found.", 404);
    if (!workflow.revise?.from.includes(existing.status)) {
      return apiError("INVALID_STATE", `${workflow.revise?.label ?? "This action"} is not available while the incident is ${existing.status}.`, 409);
    }

    const newVersion = nextMajorVersion(existing.version);
    const updated = await prisma.hsIncidentReport.update({
      where: { id: reportId },
      data: {
        version: newVersion,
        status: "investigating",
        closedAt: null,
        lockedAt: null,
        signedOffAt: null,
        signedOffByUserId: null,
      },
      select: { id: true, status: true, version: true },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "hs_incident_report.revised",
      resourceType: "HsIncidentReport",
      resourceId: reportId,
      metadata: { kind: "reopened", fromStatus: existing.status, toStatus: updated.status, fromVersion: existing.version, newVersion },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
