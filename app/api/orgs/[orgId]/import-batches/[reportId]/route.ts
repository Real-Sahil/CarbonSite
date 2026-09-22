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
  sectionsJson: z.unknown().optional(),
  signedOffByUserId: z.string().optional().nullable(),
  signedOffAt: z.string().datetime().optional().nullable(),
}).strict();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string; reportId: string }> }) {
  try {
    const { orgId, reportId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const report = await prisma.importBatch.findUnique({
      where: { id: reportId },
      select: { organizationId: true, status: true, lockedAt: true },
    });
    if (!report || report.organizationId !== orgId) return apiError("NOT_FOUND", "Import batch not found", 404);

    const body = PatchSchema.parse(await req.json());
    if (report.lockedAt && body.sectionsJson !== undefined) {
      return apiError("LOCKED", "This revision is locked. Start a new revision to make changes.", 409);
    }

    const adminOnlyStatuses = ["approved", "issued"];
    if (body.status && adminOnlyStatuses.includes(body.status)) {
      const { membership } = await requireOrgMember(orgId, "admin");
      if (membership.role !== "admin") return apiError("FORBIDDEN", "Only admins can approve or issue.", 403);
    }

    const lockNow = body.status === "approved" || body.status === "issued";

    const updated = await prisma.importBatch.update({
      where: { id: reportId },
      data: {
        ...(body.status && { status: body.status as never }),
        ...(body.title && { title: body.title }),
        ...(body.version && { version: body.version }),
        ...(body.sectionsJson !== undefined && { sectionsJson: body.sectionsJson as never }),
        ...(body.signedOffByUserId !== undefined && { signedOffByUserId: body.signedOffByUserId }),
        ...(body.signedOffAt !== undefined && { signedOffAt: body.signedOffAt ? new Date(body.signedOffAt) : null }),
        ...(lockNow && !report.lockedAt && { lockedAt: new Date() }),
      },
    });

    const action = body.status === "issued" ? "import_batch.issued"
      : body.status === "approved" ? "import_batch.approved"
      : body.status === "review" ? "import_batch.submitted_for_review"
      : body.status === "signed_off" ? "import_batch.signed_off"
      : body.status === "superseded" ? "import_batch.superseded"
      : "import_batch.updated";

    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id, action: action as any,
      resourceType: "ImportBatch", resourceId: reportId,
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

    const report = await prisma.importBatch.findUnique({
      where: { id: reportId },
      select: { organizationId: true, lockedAt: true },
    });
    if (!report || report.organizationId !== orgId) return apiError("NOT_FOUND", "Import batch not found", 404);
    if (report.lockedAt) return apiError("LOCKED", "Cannot delete a locked revision.", 409);

    await prisma.importBatch.delete({ where: { id: reportId } });
    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: "import_batch.deleted", resourceType: "ImportBatch", resourceId: reportId,
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
