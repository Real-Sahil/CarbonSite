import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { nanoid } from "nanoid";

const TopicSchema = z.object({
  esrsCode: z.string().optional().nullable(),
  topicName: z.string().min(1),
  iroType: z.enum(["impact", "risk", "opportunity"]),
  impactScore: z.number().int().min(1).max(5).optional().nullable(),
  financialScore: z.number().int().min(1).max(5).optional().nullable(),
  doubleMaterialityScore: z.number().int().optional().nullable(),
  isMaterial: z.boolean().default(false),
  rationale: z.string().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
});

const BulkSchema = z.object({ topics: z.array(TopicSchema).min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; assessmentId: string }> }) {
  try {
    const { orgId, assessmentId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const assessment = await prisma.materialityAssessment.findUnique({
      where: { id: assessmentId },
      select: { organizationId: true },
    });
    if (!assessment || assessment.organizationId !== orgId) return apiError("NOT_FOUND", "Assessment not found", 404);

    const body = BulkSchema.parse(await req.json());

    const created = await prisma.$transaction(
      body.topics.map((t) =>
        prisma.materialityTopic.create({
          data: {
            id: nanoid(),
            assessmentId,
            organizationId: orgId,
            esrsCode: t.esrsCode ?? null,
            topicName: t.topicName,
            iroType: t.iroType as never,
            impactScore: t.impactScore ?? null,
            financialScore: t.financialScore ?? null,
            doubleMaterialityScore: t.doubleMaterialityScore ?? null,
            isMaterial: t.isMaterial,
            rationale: t.rationale ?? null,
            ownerUserId: t.ownerUserId ?? null,
          },
        }),
      ),
    );

    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: "materiality.topic_created", resourceType: "MaterialityAssessment", resourceId: assessmentId,
      metadata: { count: created.length },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
