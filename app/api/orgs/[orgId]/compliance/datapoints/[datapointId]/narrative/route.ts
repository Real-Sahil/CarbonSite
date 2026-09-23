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

/** The datapoint plus this organisation's narrative for it. Datapoints are shared; narratives are not. */
async function loadDatapoint(orgId: string, datapointId: string) {
  return prisma.frameworkDatapoint.findUnique({
    where: { id: datapointId },
    select: {
      id: true,
      framework: true,
      code: true,
      title: true,
      narratives: { where: { organizationId: orgId }, select: { narrative: true } },
    },
  });
}

/**
 * GET /api/orgs/[orgId]/compliance/datapoints/[datapointId]/narrative
 * Retrieve this organisation's public narrative for a framework datapoint.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, datapointId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const datapoint = await loadDatapoint(orgId, datapointId);
    if (!datapoint) {
      return apiError("NOT_FOUND", "Datapoint not found.", 404);
    }

    return NextResponse.json({
      id: datapoint.id,
      framework: datapoint.framework,
      code: datapoint.code,
      title: datapoint.title,
      publicNarrative: datapoint.narratives[0]?.narrative ?? null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * PATCH /api/orgs/[orgId]/compliance/datapoints/[datapointId]/narrative
 * Set this organisation's public narrative for a framework datapoint (ESRS
 * disclosure). Null clears it. Editors+.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, datapointId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const body = updateNarrativeSchema.parse(await req.json());

    const datapoint = await loadDatapoint(orgId, datapointId);
    if (!datapoint) {
      return apiError("NOT_FOUND", "Datapoint not found.", 404);
    }
    const previousNarrative = datapoint.narratives[0]?.narrative ?? null;

    const key = { organizationId_datapointId: { organizationId: orgId, datapointId } };
    if (body.publicNarrative === null) {
      await prisma.organizationDatapointNarrative.deleteMany({ where: { organizationId: orgId, datapointId } });
    } else {
      await prisma.organizationDatapointNarrative.upsert({
        where: key,
        create: { organizationId: orgId, datapointId, narrative: body.publicNarrative, updatedByUserId: session.user.id },
        update: { narrative: body.publicNarrative, updatedByUserId: session.user.id },
      });
    }

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "framework.datapoint_narrative_updated",
      resourceType: "framework_datapoint",
      resourceId: datapointId,
      metadata: {
        framework: datapoint.framework,
        code: datapoint.code,
        previousNarrative,
        newNarrative: body.publicNarrative,
      },
    });

    return NextResponse.json({
      id: datapoint.id,
      framework: datapoint.framework,
      code: datapoint.code,
      title: datapoint.title,
      publicNarrative: body.publicNarrative,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
