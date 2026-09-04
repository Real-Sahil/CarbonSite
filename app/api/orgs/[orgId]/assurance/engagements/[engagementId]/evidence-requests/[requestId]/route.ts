export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { updateEvidenceRequestSchema } from "@/lib/validation/assurance";

type Params = { params: Promise<{ orgId: string; engagementId: string; requestId: string }> };

const MANAGE_ROLES = ["admin", "sustainability_director", "auditor", "editor"] as const;

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, engagementId, requestId } = await params;
    const { session } = await requireOrgMember(orgId, ...MANAGE_ROLES);

    const existing = await prisma.evidenceRequest.findFirst({
      where: { id: requestId, engagementId, organizationId: orgId },
    });
    if (!existing) return apiError("NOT_FOUND", "Evidence request not found.", 404);

    const body = updateEvidenceRequestSchema.parse(await req.json());

    if (body.status === "not_available" && !body.unavailabilityReason?.trim() && !existing.unavailabilityReason) {
      return apiError(
        "REASON_REQUIRED",
        "Explain why this evidence cannot be provided. That explanation becomes the scope limitation wording in the opinion.",
        422,
      );
    }

    const settling = body.status === "provided" && existing.status !== "provided";

    const evidenceRequest = await prisma.evidenceRequest.update({
      where: { id: requestId },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.ownerUserId !== undefined && { ownerUserId: body.ownerUserId ?? null }),
        ...(body.dueOn !== undefined && { dueOn: body.dueOn ?? null }),
        ...(body.unavailabilityReason !== undefined && {
          unavailabilityReason: body.unavailabilityReason ?? null,
        }),
        ...(body.notes !== undefined && { notes: body.notes ?? null }),
        ...(settling && { providedAt: new Date() }),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "assurance.evidence_request_updated",
      resourceType: "EvidenceRequest",
      resourceId: evidenceRequest.id,
      metadata: { reference: evidenceRequest.reference, status: evidenceRequest.status },
    });

    return Response.json(evidenceRequest);
  } catch (err) {
    return handleRouteError(err);
  }
}
