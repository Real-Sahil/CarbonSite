import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["draft", "stakeholder_review", "approved", "published"]).optional(),
  esrsScope: z.string().optional().nullable(),
  methodologyNotes: z.string().optional().nullable(),
  stakeholderInput: z.string().optional().nullable(),
  approvedAt: z.string().optional().nullable(),
  publishedAt: z.string().datetime().optional().nullable(),
}).strict();

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string; assessmentId: string }> }) {
  try {
    const { orgId, assessmentId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const assessment = await prisma.materialityAssessment.findUnique({
      where: { id: assessmentId },
      include: {
        createdBy: { select: { id: true, name: true } },
        reportingPeriod: { select: { id: true, label: true } },
        topics: {
          orderBy: [{ iroType: "asc" }, { doubleMaterialityScore: "desc" }],
          include: { owner: { select: { id: true, name: true } } },
        },
      },
    });
    if (!assessment || assessment.organizationId !== orgId) return apiError("NOT_FOUND", "Assessment not found", 404);
    return NextResponse.json(assessment);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string; assessmentId: string }> }) {
  try {
    const { orgId, assessmentId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const assessment = await prisma.materialityAssessment.findUnique({ where: { id: assessmentId }, select: { organizationId: true } });
    if (!assessment || assessment.organizationId !== orgId) return apiError("NOT_FOUND", "Assessment not found", 404);

    const body = PatchSchema.parse(await req.json());
    const updated = await prisma.materialityAssessment.update({
      where: { id: assessmentId },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.status && { status: body.status as never }),
        ...(body.esrsScope !== undefined && { esrsScope: body.esrsScope }),
        ...(body.methodologyNotes !== undefined && { methodologyNotes: body.methodologyNotes }),
        ...(body.stakeholderInput !== undefined && { stakeholderInput: body.stakeholderInput }),
        ...(body.approvedAt !== undefined && { approvedAt: body.approvedAt ? new Date(body.approvedAt) : null }),
        ...(body.publishedAt !== undefined && { publishedAt: body.publishedAt ? new Date(body.publishedAt) : null }),
      },
    });

    const action = body.status === "published"
      ? "materiality.assessment_published"
      : "materiality.assessment_updated";

    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action, resourceType: "MaterialityAssessment", resourceId: assessmentId,
      metadata: { patch: body },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
