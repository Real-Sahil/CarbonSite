export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createEvidenceRequestSchema } from "@/lib/validation/assurance";

type Params = { params: Promise<{ orgId: string; engagementId: string }> };

const MANAGE_ROLES = ["admin", "sustainability_director", "auditor"] as const;

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, engagementId } = await params;
    const { session } = await requireOrgMember(orgId, ...MANAGE_ROLES);

    const engagement = await prisma.assuranceEngagement.findFirst({
      where: { id: engagementId, organizationId: orgId },
      select: { id: true, status: true },
    });
    if (!engagement) return apiError("NOT_FOUND", "Engagement not found.", 404);
    if (engagement.status === "signed" || engagement.status === "withdrawn") {
      return apiError("ENGAGEMENT_CLOSED", `This engagement is ${engagement.status}.`, 409);
    }

    const body = createEvidenceRequestSchema.parse(await req.json());

    const duplicate = await prisma.evidenceRequest.findUnique({
      where: { engagementId_reference: { engagementId, reference: body.reference } },
    });
    if (duplicate) {
      return apiError("DUPLICATE_REFERENCE", "An evidence request with that reference already exists.", 409);
    }

    if (body.ownerUserId) {
      const member = await prisma.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: body.ownerUserId } },
        select: { userId: true },
      });
      if (!member) return apiError("NOT_FOUND", "Owner is not a member of this organisation.", 404);
    }

    const evidenceRequest = await prisma.evidenceRequest.create({
      data: {
        organizationId: orgId,
        engagementId,
        reference: body.reference,
        description: body.description,
        category: body.category ?? null,
        ownerUserId: body.ownerUserId ?? null,
        dueOn: body.dueOn ?? null,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "assurance.evidence_request_created",
      resourceType: "EvidenceRequest",
      resourceId: evidenceRequest.id,
      metadata: { engagementId, reference: evidenceRequest.reference },
    });

    return Response.json(evidenceRequest, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
