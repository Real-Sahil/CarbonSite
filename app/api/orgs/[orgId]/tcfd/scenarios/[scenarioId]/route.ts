import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

const UpdateScenarioSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  temperaturePathway: z.string().max(50).nullish(),
  timeHorizon: z.enum(["short", "medium", "long"]).optional(),
  description: z.string().max(2000).nullish(),
  grossValueAtRiskLow: z.number().nonnegative().nullish(),
  grossValueAtRiskHigh: z.number().nonnegative().nullish(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; scenarioId: string }> },
) {
  try {
    const { orgId, scenarioId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "viewer", "auditor");

    const scenario = await prisma.tcfdScenario.findFirst({
      where: { id: scenarioId, organizationId: orgId },
      include: {
        riskAssessments: {
          include: { owner: { select: { name: true, email: true } } },
          orderBy: [{ likelihood: "desc" }, { impact: "desc" }],
        },
        createdBy: { select: { name: true, email: true } },
      },
    });

    if (!scenario) return apiError("NOT_FOUND", "Scenario not found", 404);
    return NextResponse.json({ scenario });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; scenarioId: string }> },
) {
  try {
    const { orgId, scenarioId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const existing = await prisma.tcfdScenario.findFirst({
      where: { id: scenarioId, organizationId: orgId },
    });
    if (!existing) return apiError("NOT_FOUND", "Scenario not found", 404);

    const body = UpdateScenarioSchema.parse(await req.json());

    const scenario = await prisma.tcfdScenario.update({
      where: { id: scenarioId },
      data: body,
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "tcfd.scenario_updated",
      resourceType: "TcfdScenario",
      resourceId: scenario.id,
      metadata: { changes: Object.keys(body) },
    });

    return NextResponse.json({ scenario });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; scenarioId: string }> },
) {
  try {
    const { orgId, scenarioId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    const existing = await prisma.tcfdScenario.findFirst({
      where: { id: scenarioId, organizationId: orgId },
    });
    if (!existing) return apiError("NOT_FOUND", "Scenario not found", 404);

    await prisma.tcfdScenario.delete({ where: { id: scenarioId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "tcfd.scenario_deleted",
      resourceType: "TcfdScenario",
      resourceId: scenarioId,
      metadata: { name: existing.name },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
