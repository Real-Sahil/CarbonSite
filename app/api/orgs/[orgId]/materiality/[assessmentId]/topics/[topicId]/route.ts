export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { compositeScore, isMaterialByScore } from "@/lib/materiality";

type Ctx = { params: Promise<{ orgId: string; assessmentId: string; topicId: string }> };

const score = z.number().int().min(1).max(5).nullable();
const PatchSchema = z
  .object({
    topicName: z.string().trim().min(1).max(300),
    esrsCode: z.string().trim().max(20).nullable(),
    iroType: z.enum(["impact", "risk", "opportunity"]),
    impactScore: score,
    financialScore: score,
    rationale: z.string().trim().max(5000).nullable(),
    /** Left out, the topic is material when either score reaches the threshold. A person may set it either way. */
    isMaterial: z.boolean().optional(),
  })
  .strict();

/** An approved or published assessment is not edited in place: reopen it first. */
async function editable(orgId: string, assessmentId: string) {
  const a = await prisma.materialityAssessment.findFirst({ where: { id: assessmentId, organizationId: orgId }, select: { status: true } });
  if (!a) return apiError("NOT_FOUND", "Assessment not found", 404);
  if (a.status === "approved" || a.status === "published") {
    return apiError("ASSESSMENT_LOCKED", "This assessment is approved. Set it back to draft before changing its topics.", 409);
  }
  return null;
}

// PATCH /api/orgs/[orgId]/materiality/[assessmentId]/topics/[topicId]
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { orgId, assessmentId, topicId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const locked = await editable(orgId, assessmentId);
    if (locked) return locked;
    const body = PatchSchema.parse(await req.json());

    const scores = { impactScore: body.impactScore, financialScore: body.financialScore };
    const found = await prisma.materialityTopic.updateMany({
      where: { id: topicId, assessmentId, organizationId: orgId },
      data: {
        topicName: body.topicName,
        esrsCode: body.esrsCode,
        iroType: body.iroType,
        impactScore: body.impactScore,
        financialScore: body.financialScore,
        doubleMaterialityScore: compositeScore(scores),
        isMaterial: body.isMaterial ?? isMaterialByScore(scores),
        rationale: body.rationale,
      },
    });
    if (found.count === 0) return apiError("NOT_FOUND", "Topic not found", 404);

    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: "materiality.topic_updated", resourceType: "MaterialityAssessment", resourceId: assessmentId,
      metadata: { topicId, impactScore: body.impactScore, financialScore: body.financialScore },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE /api/orgs/[orgId]/materiality/[assessmentId]/topics/[topicId]
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { orgId, assessmentId, topicId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const locked = await editable(orgId, assessmentId);
    if (locked) return locked;

    const gone = await prisma.materialityTopic.deleteMany({ where: { id: topicId, assessmentId, organizationId: orgId } });
    if (gone.count === 0) return apiError("NOT_FOUND", "Topic not found", 404);

    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: "materiality.topic_deleted", resourceType: "MaterialityAssessment", resourceId: assessmentId,
      metadata: { topicId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
