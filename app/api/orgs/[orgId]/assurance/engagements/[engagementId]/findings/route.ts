export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createFindingSchema } from "@/lib/validation/assurance";

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

    const body = createFindingSchema.parse(await req.json());

    if (body.sampleId) {
      const sample = await prisma.assuranceSample.findFirst({
        where: { id: body.sampleId, engagementId, organizationId: orgId },
        select: { id: true },
      });
      if (!sample) return apiError("NOT_FOUND", "Sample not found on this engagement.", 404);
    }

    const finding = await prisma.assuranceFinding.create({
      data: {
        organizationId: orgId,
        engagementId,
        sampleId: body.sampleId ?? null,
        severity: body.severity,
        title: body.title,
        description: body.description,
        quantifiedImpactCo2e: body.quantifiedImpactCo2e ?? null,
        raisedByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "assurance.finding_raised",
      resourceType: "AssuranceFinding",
      resourceId: finding.id,
      metadata: { engagementId, severity: finding.severity, title: finding.title },
    });

    return Response.json(
      { ...finding, quantifiedImpactCo2e: finding.quantifiedImpactCo2e === null ? null : Number(finding.quantifiedImpactCo2e) },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
