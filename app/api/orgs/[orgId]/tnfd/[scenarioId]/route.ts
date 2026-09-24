export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  gbfTarget: z.string().optional().nullable(),
  timeHorizon: z.string().optional().nullable(),
  sectorScope: z.string().optional().nullable(),
  riskRating: z.string().optional().nullable(),
  locateNotes: z.string().optional().nullable(),
  evaluateNotes: z.string().optional().nullable(),
  assessNotes: z.string().optional().nullable(),
  prepareNotes: z.string().optional().nullable(),
  financialImpactLow: z.number().optional().nullable(),
  financialImpactHigh: z.number().optional().nullable(),
}).strict();

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string; scenarioId: string }> }) {
  try {
    const { orgId, scenarioId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);

    const scenario = await prisma.tnfdScenario.findUnique({
      where: { id: scenarioId },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    if (!scenario || scenario.organizationId !== orgId) return apiError("NOT_FOUND", "TNFD scenario not found", 404);
    return NextResponse.json(scenario);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string; scenarioId: string }> }) {
  try {
    const { orgId, scenarioId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const scenario = await prisma.tnfdScenario.findUnique({ where: { id: scenarioId }, select: { organizationId: true } });
    if (!scenario || scenario.organizationId !== orgId) return apiError("NOT_FOUND", "TNFD scenario not found", 404);

    const body = PatchSchema.parse(await req.json());
    const updated = await prisma.tnfdScenario.update({ where: { id: scenarioId }, data: body });

    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: "tnfd.scenario_updated", resourceType: "TnfdScenario", resourceId: scenarioId,
      metadata: { patch: body },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ orgId: string; scenarioId: string }> }) {
  try {
    const { orgId, scenarioId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    const scenario = await prisma.tnfdScenario.findUnique({ where: { id: scenarioId }, select: { organizationId: true } });
    if (!scenario || scenario.organizationId !== orgId) return apiError("NOT_FOUND", "TNFD scenario not found", 404);

    await prisma.tnfdScenario.delete({ where: { id: scenarioId } });
    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: "tnfd.scenario_deleted", resourceType: "TnfdScenario", resourceId: scenarioId,
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
