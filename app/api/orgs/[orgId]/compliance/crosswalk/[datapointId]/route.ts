export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { recordDatapointStatusSchema } from "@/lib/validation/assurance";

type Params = { params: Promise<{ orgId: string; datapointId: string }> };

const MANAGE_ROLES = ["admin", "sustainability_director", "sustainability_manager"] as const;

/**
 * Records manual evidence against a datapoint. This is the only way a
 * narrative disclosure (no resolverKey) can ever move off "gap", and it is
 * also how a human overrides what an automatic resolver found — that
 * override is itself visible in the audit trail, never silent.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { orgId, datapointId } = await params;
    const { session } = await requireOrgMember(orgId, ...MANAGE_ROLES);

    const datapoint = await prisma.frameworkDatapoint.findUnique({ where: { id: datapointId } });
    if (!datapoint) return apiError("NOT_FOUND", "Datapoint not found.", 404);

    const body = recordDatapointStatusSchema.parse(await req.json());

    const status = await prisma.organizationDatapointStatus.upsert({
      where: { organizationId_datapointId: { organizationId: orgId, datapointId } },
      update: {
        status: body.status,
        evidenceSummary: body.evidenceSummary ?? null,
        recordedByUserId: session.user.id,
      },
      create: {
        organizationId: orgId,
        datapointId,
        status: body.status,
        evidenceSummary: body.evidenceSummary ?? null,
        recordedByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "compliance.datapoint_status_recorded",
      resourceType: "OrganizationDatapointStatus",
      resourceId: status.id,
      metadata: {
        framework: datapoint.framework,
        code: datapoint.code,
        status: body.status,
        wasAutomaticallyResolved: datapoint.resolverKey !== null,
      },
    });

    return Response.json(status);
  } catch (err) {
    return handleRouteError(err);
  }
}
