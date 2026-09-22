export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";

const PatchSchema = z.object({
  status: z.enum(["draft", "review", "approved", "issued", "signed_off", "superseded"]).optional(),
  title: z.string().min(1).max(200).optional(),
  version: z.string().optional(),
  projectId: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
  sectionsJson: z.unknown().optional(),
  incidentDate: z.string().optional().nullable(),
  signedOffByUserId: z.string().optional().nullable(),
  signedOffAt: z.string().datetime().optional().nullable(),
}).strict();

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string; reportId: string }> }) {
  try {
    const { orgId, reportId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const report = await prisma.hsIncidentReport.findUnique({
      where: { id: reportId },
      include: {
        createdBy: { select: { id: true, name: true } },
        signedOffBy: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
      },
    });
    if (!report || report.organizationId !== orgId) return apiError("NOT_FOUND", "H&S incident report not found", 404);
    return NextResponse.json(report);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string; reportId: string }> }) {
  try {
    const { orgId, reportId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const report = await prisma.hsIncidentReport.findUnique({
      where: { id: reportId },
      select: { organizationId: true, status: true, lockedAt: true },
    });
    if (!report || report.organizationId !== orgId) return apiError("NOT_FOUND", "H&S incident report not found", 404);

    const body = PatchSchema.parse(await req.json());

    // Locked revisions can only have status changed, not content edited
    if (report.lockedAt && body.sectionsJson !== undefined) {
      return apiError("LOCKED", "This revision is locked. Start a new revision to make changes.", 409);
    }

    // Only admin can approve or issue
    const adminOnlyStatuses = ["approved", "issued"];
    if (body.status && adminOnlyStatuses.includes(body.status)) {
      const { membership } = await requireOrgMember(orgId, "admin");
      if (membership.role !== "admin") {
        return apiError("FORBIDDEN", "Only admins can approve or issue a report.", 403);
      }
    }

    const lockNow = body.status === "approved" || body.status === "issued";

    const updated = await prisma.hsIncidentReport.update({
      where: { id: reportId },
      data: {
        ...(body.status && { status: body.status as never }),
        ...(body.title && { title: body.title }),
        ...(body.version && { version: body.version }),
        ...(body.projectId !== undefined && { projectId: body.projectId }),
        ...(body.siteId !== undefined && { siteId: body.siteId }),
        ...(body.sectionsJson !== undefined && { sectionsJson: body.sectionsJson as never }),
        ...(body.incidentDate !== undefined && { incidentDate: body.incidentDate ? new Date(body.incidentDate) : null }),
        ...(body.signedOffByUserId !== undefined && { signedOffByUserId: body.signedOffByUserId }),
        ...(body.signedOffAt !== undefined && { signedOffAt: body.signedOffAt ? new Date(body.signedOffAt) : null }),
        ...(lockNow && !report.lockedAt && { lockedAt: new Date() }),
      },
    });

    const action =
      body.status === "issued" ? "hs_incident_report.issued"
      : body.status === "approved" ? "hs_incident_report.approved"
      : body.status === "review" ? "hs_incident_report.submitted_for_review"
      : body.status === "signed_off" ? "hs_incident_report.signed_off"
      : body.status === "superseded" ? "hs_incident_report.superseded"
      : "hs_incident_report.updated";

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: action as any,
      resourceType: "HsIncidentReport",
      resourceId: reportId,
      metadata: { patch: { ...body, sectionsJson: body.sectionsJson ? "[sections]" : undefined } },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ orgId: string; reportId: string }> }) {
  try {
    const { orgId, reportId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    const report = await prisma.hsIncidentReport.findUnique({
      where: { id: reportId },
      select: { organizationId: true, status: true, lockedAt: true },
    });
    if (!report || report.organizationId !== orgId) return apiError("NOT_FOUND", "H&S incident report not found", 404);
    if (report.lockedAt) return apiError("LOCKED", "Cannot delete a locked revision.", 409);

    await prisma.hsIncidentReport.delete({ where: { id: reportId } });
    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: "hs_incident_report.deleted", resourceType: "HsIncidentReport", resourceId: reportId,
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
