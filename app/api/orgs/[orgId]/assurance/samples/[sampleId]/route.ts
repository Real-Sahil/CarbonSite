export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { recordSampleResultSchema } from "@/lib/validation/assurance";

type Params = { params: Promise<{ orgId: string; sampleId: string }> };

const MANAGE_ROLES = ["admin", "sustainability_director", "auditor"] as const;

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, sampleId } = await params;
    const { session } = await requireOrgMember(orgId, ...MANAGE_ROLES);

    const sample = await prisma.assuranceSample.findFirst({
      where: { id: sampleId, organizationId: orgId },
      include: { engagement: { select: { status: true } } },
    });
    if (!sample) return apiError("NOT_FOUND", "Sample not found.", 404);
    if (sample.engagement.status === "signed" || sample.engagement.status === "withdrawn") {
      return apiError("ENGAGEMENT_CLOSED", `This engagement is ${sample.engagement.status}.`, 409);
    }

    const body = recordSampleResultSchema.parse(await req.json());

    const updated = await prisma.assuranceSample.update({
      where: { id: sampleId },
      data: {
        result: body.result,
        testNotes: body.testNotes ?? sample.testNotes,
        testedByUserId: session.user.id,
        testedAt: new Date(),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "assurance.sample_tested",
      resourceType: "AssuranceSample",
      resourceId: sampleId,
      metadata: { result: body.result },
    });

    return Response.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
