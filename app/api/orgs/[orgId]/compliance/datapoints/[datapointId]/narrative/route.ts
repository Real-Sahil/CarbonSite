export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";

type Params = { params: Promise<{ orgId: string; datapointId: string }> };

const updateNarrativeSchema = z.object({
  publicNarrative: z.string().min(1).max(50000).nullable(),
});

/**
 * GET /api/orgs/[orgId]/compliance/datapoints/[datapointId]/narrative
 * Retrieve public narrative for a framework datapoint.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, datapointId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const datapoint = await prisma.frameworkDatapoint.findUnique({
      where: { id: datapointId },
      select: {
        id: true,
        framework: true,
        code: true,
        title: true,
        publicNarrative: true,
      },
    });

    if (!datapoint) {
      return apiError("NOT_FOUND", "Datapoint not found.", 404);
    }

    return NextResponse.json({
      id: datapoint.id,
      framework: datapoint.framework,
      code: datapoint.code,
      title: datapoint.title,
      publicNarrative: datapoint.publicNarrative ?? null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * PATCH /api/orgs/[orgId]/compliance/datapoints/[datapointId]/narrative
 * Update public narrative for a framework datapoint (ESRS disclosure).
 * Editors+.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, datapointId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const body = updateNarrativeSchema.parse(await req.json());

    const datapoint = await prisma.frameworkDatapoint.findUnique({
      where: { id: datapointId },
      select: {
        id: true,
        framework: true,
        code: true,
        publicNarrative: true,
      },
    });

    if (!datapoint) {
      return apiError("NOT_FOUND", "Datapoint not found.", 404);
    }

    const updated = await prisma.frameworkDatapoint.update({
      where: { id: datapointId },
      data: {
        publicNarrative: body.publicNarrative,
      },
      select: {
        id: true,
        framework: true,
        code: true,
        title: true,
        publicNarrative: true,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "framework.datapoint_narrative_updated",
      resourceType: "framework_datapoint",
      resourceId: datapointId,
      metadata: {
        framework: datapoint.framework,
        code: datapoint.code,
        previousNarrative: datapoint.publicNarrative,
        newNarrative: body.publicNarrative,
      },
    });

    return NextResponse.json({
      id: updated.id,
      framework: updated.framework,
      code: updated.code,
      title: updated.title,
      publicNarrative: updated.publicNarrative ?? null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
