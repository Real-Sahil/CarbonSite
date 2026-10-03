export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { missingStarterTopics } from "@/lib/materiality";

// POST /api/orgs/[orgId]/materiality/[assessmentId]/starter-topics
// Adds the ESRS starter topics the assessment does not have yet, unscored.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ orgId: string; assessmentId: string }> }) {
  try {
    const { orgId, assessmentId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const assessment = await prisma.materialityAssessment.findFirst({
      where: { id: assessmentId, organizationId: orgId },
      select: { status: true, topics: { select: { topicName: true } } },
    });
    if (!assessment) return apiError("NOT_FOUND", "Assessment not found", 404);
    if (assessment.status === "approved" || assessment.status === "published") {
      return apiError("ASSESSMENT_LOCKED", "This assessment is approved. Set it back to draft before changing its topics.", 409);
    }

    const toAdd = missingStarterTopics(assessment.topics.map((t) => t.topicName));
    if (toAdd.length) {
      await prisma.materialityTopic.createMany({
        data: toAdd.map((t) => ({ assessmentId, organizationId: orgId, esrsCode: t.esrsCode, topicName: t.topicName, iroType: "impact" as const })),
      });
    }

    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: "materiality.topic_created", resourceType: "MaterialityAssessment", resourceId: assessmentId,
      metadata: { count: toAdd.length, starter: true },
    });
    return NextResponse.json({ added: toAdd.length }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
